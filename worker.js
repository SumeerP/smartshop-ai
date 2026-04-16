/**
 * SmartShop AI — Cloudflare Worker Proxy
 *
 * Proxies requests to Anthropic API + provides product image search + user auth & sync.
 * API key stored as Cloudflare secret (never exposed to browser).
 *
 * ENDPOINTS:
 *   POST /                     — Anthropic API proxy
 *   GET  /product-image?asin=  — Fetch Amazon product image by ASIN
 *   GET  /search-image?q=      — Search Google for product image
 *   POST /api/auth/register    — Create account (email + password)
 *   POST /api/auth/login       — Login (email + password → session token)
 *   POST /api/auth/logout      — Invalidate session token
 *   PATCH /api/user/profile    — Update profile fields
 *   POST /api/sync/push        — Push local state to D1
 *   GET  /api/sync/pull        — Pull full user state from D1
 *   GET  /api/search-products  — SerpAPI Google Shopping search (cached)
 *   GET  /api/product-details  — SerpAPI product details + reviews (cached)
 *   GET  /api/search-quota     — Today's SerpAPI usage vs daily limit
 */

const ALLOWED_ORIGINS = [
  'https://sumeerp.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5500',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Token',
  'Access-Control-Max-Age': '86400',
};

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const headers = { ...CORS_HEADERS };
  if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.github.io')) {
    headers['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60000;

function checkRateLimit(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip);
  if (!entry || now - entry.windowStart > RATE_WINDOW) {
    rateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// Hot in-memory cache (survives within single worker instance)
const memCache = new Map();
const KV_TTL = 604800; // 7 days in seconds

/**
 * Get image URL from cache (memory first, then KV)
 */
async function getCachedImage(key, env) {
  if (memCache.has(key)) return memCache.get(key);
  if (env.IMAGE_CACHE) {
    try {
      const val = await env.IMAGE_CACHE.get(key);
      if (val) {
        memCache.set(key, val);
        return val;
      }
    } catch {}
  }
  return null;
}

/**
 * Store image URL in cache (memory + KV)
 */
async function cacheImage(key, url, env) {
  memCache.set(key, url);
  if (env.IMAGE_CACHE) {
    try {
      await env.IMAGE_CACHE.put(key, url, { expirationTtl: KV_TTL });
    } catch {}
  }
}

// ============================================================
// SERPAPI — Real product data from Google Shopping
// ============================================================

const SERPAPI_DAILY_LIMIT = 8; // Free tier: 250/month ≈ 8/day
const SEARCH_CACHE_TTL_HOURS = 24;
const DETAIL_CACHE_TTL_DAYS = 7;

async function sha256(text) {
  const data = new TextEncoder().encode(text.toLowerCase().trim());
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getApiUsage(env) {
  if (!env.DB) return 0;
  const dateKey = new Date().toISOString().slice(0, 10);
  const row = await env.DB.prepare(
    'SELECT call_count FROM api_usage WHERE api_name = ? AND date_key = ?'
  ).bind('serpapi', dateKey).first();
  return row ? row.call_count : 0;
}

async function incrementApiUsage(env) {
  if (!env.DB) return;
  const dateKey = new Date().toISOString().slice(0, 10);
  await env.DB.prepare(
    `INSERT INTO api_usage (api_name, date_key, call_count) VALUES ('serpapi', ?, 1)
     ON CONFLICT(api_name, date_key) DO UPDATE SET call_count = call_count + 1`
  ).bind(dateKey).run();
}

// Image URL validation
const VALID_IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif|svg)(\?|$)/i;
const VALID_IMAGE_DOMAINS = ['media-amazon.com', 'images-amazon.com', 'gstatic.com', 'googleusercontent.com', 'target.com', 'walmart.com', 'bestbuy.com'];
function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (
      VALID_IMAGE_EXTENSIONS.test(url) ||
      VALID_IMAGE_DOMAINS.some(d => parsed.hostname.endsWith(d))
    );
  } catch { return false; }
}

function mapSerpProduct(item, index) {
  const asinMatch = (item.product_link || '').match(/\/dp\/([A-Z0-9]{10})/);
  const asin = asinMatch ? asinMatch[1] : '';
  const price = item.extracted_price != null ? item.extracted_price : null;
  const oldPrice = item.extracted_old_price || null;
  const hasDeal = oldPrice != null && price != null && oldPrice > price;
  const dealPct = hasDeal ? Math.round((1 - price / oldPrice) * 100) : 0;
  const thumbnail = item.thumbnail || '';

  return {
    id: `serp-${Date.now()}-${index}`,
    name: item.title || 'Unknown Product',
    price,
    rating: item.rating != null ? item.rating : null,
    reviews: item.reviews != null ? item.reviews : null,
    retailer: item.source || 'Online',
    cat: '',
    img: '',
    thumbnail: isValidImageUrl(thumbnail) ? thumbnail : (thumbnail || ''),
    url: item.product_link || item.link || '',
    asin,
    deal: hasDeal,
    dealPct,
    why: '',
    serpapi_product_id: item.product_id || '',
    delivery: item.delivery || '',
    extensions: item.extensions || [],
    tag: item.tag || '',
    snippet: item.snippet || '',
    dataSource: 'serpapi',
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * GET /api/search-products?q=...&num=5 — SerpAPI Google Shopping search
 */
async function handleSearchProducts(request, env, corsHeaders) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const num = Math.min(parseInt(url.searchParams.get('num') || '5'), 10);

  if (!query) return json({ error: 'Missing query parameter q' }, 400, corsHeaders);

  const queryHash = await sha256(query);

  // Check D1 cache (24h TTL)
  if (env.DB) {
    try {
      const cached = await env.DB.prepare(
        `SELECT results_json, created_at FROM search_cache WHERE query_hash = ? AND created_at > datetime('now', '-${SEARCH_CACHE_TTL_HOURS} hours')`
      ).bind(queryHash).first();
      if (cached) {
        const products = JSON.parse(cached.results_json);
        const usage = await getApiUsage(env);
        return json({ products: products.slice(0, num), source: 'cache', quota: { used: usage, limit: SERPAPI_DAILY_LIMIT } }, 200, corsHeaders);
      }
    } catch {}
  }

  // Check daily quota
  const usage = await getApiUsage(env);
  if (usage >= SERPAPI_DAILY_LIMIT) {
    // Try returning stale cache (beyond TTL)
    if (env.DB) {
      try {
        const stale = await env.DB.prepare(
          'SELECT results_json, created_at FROM search_cache WHERE query_hash = ?'
        ).bind(queryHash).first();
        if (stale) {
          const products = JSON.parse(stale.results_json);
          return json({ products: products.slice(0, num), source: 'stale_cache', cacheAge: stale.created_at, quota_exhausted: true, quota: { used: usage, limit: SERPAPI_DAILY_LIMIT } }, 200, corsHeaders);
        }
      } catch {}
    }
    return json({ products: [], quota_exhausted: true, quota: { used: usage, limit: SERPAPI_DAILY_LIMIT } }, 200, corsHeaders);
  }

  // Call SerpAPI
  const serpApiKey = env.SERPAPI_KEY;
  if (!serpApiKey) return json({ error: 'SerpAPI key not configured' }, 500, corsHeaders);

  try {
    const serpUrl = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(query)}&api_key=${serpApiKey}&num=${num}&hl=en&gl=us`;
    const serpRes = await fetch(serpUrl);
    if (!serpRes.ok) {
      return json({ error: 'SerpAPI request failed', status: serpRes.status }, 502, corsHeaders);
    }
    const serpData = await serpRes.json();
    const shoppingResults = serpData.shopping_results || [];
    const products = shoppingResults.slice(0, num).map((item, i) => mapSerpProduct(item, i));

    // Cache in D1
    if (env.DB) {
      try {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO search_cache (query_hash, query_text, results_json, result_count) VALUES (?, ?, ?, ?)'
        ).bind(queryHash, query, JSON.stringify(products), products.length).run();
      } catch {}
    }

    // Increment usage
    await incrementApiUsage(env);
    const newUsage = usage + 1;

    return json({ products, source: 'serpapi', quota: { used: newUsage, limit: SERPAPI_DAILY_LIMIT } }, 200, corsHeaders);
  } catch (err) {
    return json({ error: 'SerpAPI error: ' + err.message }, 502, corsHeaders);
  }
}

/**
 * GET /api/product-details?product_id=... — SerpAPI product details + reviews
 */
async function handleProductDetails(request, env, corsHeaders) {
  const url = new URL(request.url);
  const productId = url.searchParams.get('product_id');

  if (!productId) return json({ error: 'Missing product_id parameter' }, 400, corsHeaders);

  // Check D1 cache (7-day TTL)
  if (env.DB) {
    try {
      const cached = await env.DB.prepare(
        `SELECT details_json FROM product_details_cache WHERE product_id = ? AND created_at > datetime('now', '-${DETAIL_CACHE_TTL_DAYS} days')`
      ).bind(productId).first();
      if (cached) {
        const data = JSON.parse(cached.details_json);
        return json({ ...data, source: 'cache' }, 200, corsHeaders);
      }
    } catch {}
  }

  // Check quota
  const usage = await getApiUsage(env);
  if (usage >= SERPAPI_DAILY_LIMIT) {
    // Try stale cache
    if (env.DB) {
      try {
        const stale = await env.DB.prepare(
          'SELECT details_json, created_at FROM product_details_cache WHERE product_id = ?'
        ).bind(productId).first();
        if (stale) {
          const data = JSON.parse(stale.details_json);
          return json({ ...data, source: 'stale_cache', cacheAge: stale.created_at, quota_exhausted: true }, 200, corsHeaders);
        }
      } catch {}
    }
    return json({ details: null, reviews: [], quota_exhausted: true }, 200, corsHeaders);
  }

  // Call SerpAPI Google Product API
  const serpApiKey = env.SERPAPI_KEY;
  if (!serpApiKey) return json({ error: 'SerpAPI key not configured' }, 500, corsHeaders);

  try {
    const serpUrl = `https://serpapi.com/search.json?engine=google_product&product_id=${encodeURIComponent(productId)}&api_key=${serpApiKey}&hl=en&gl=us`;
    const serpRes = await fetch(serpUrl);
    if (!serpRes.ok) {
      return json({ details: null, reviews: [], error: 'SerpAPI product request failed' }, 200, corsHeaders);
    }
    const serpData = await serpRes.json();

    // Extract details (enhanced)
    const pr = serpData.product_results || {};
    const details = {
      description: pr.description || '',
      highlights: (pr.highlights || []).slice(0, 8),
      features: (pr.extensions || []).slice(0, 5),
      specs: {},
      media: [],
      typicalPrices: serpData.typical_prices || null,
    };
    // Extract specs from specifications
    if (serpData.specifications) {
      for (const group of serpData.specifications) {
        for (const item of (group.items || [])) {
          if (item.title && item.value) {
            details.specs[item.title] = item.value;
          }
        }
      }
    }
    // Extract media images (validated)
    if (pr.media) {
      details.media = pr.media.slice(0, 6).map(m => ({
        link: m.link || '',
        type: m.type || 'image',
      })).filter(m => m.link);
    }

    // Extract reviews (enhanced with histogram & topics)
    const reviewsData = serpData.reviews_results?.reviews || [];
    const reviews = reviewsData.slice(0, 8).map(r => ({
      name: r.source || r.author || 'Reviewer',
      rating: r.rating != null ? r.rating : null,
      date: r.date || '',
      title: r.title || '',
      body: r.content || r.snippet || '',
      verified: !!r.source,
      dataSource: 'serpapi',
    }));
    const ratingsHistogram = serpData.reviews_results?.ratings || [];
    const topicFilters = (serpData.reviews_results?.filters?.topic || []).slice(0, 8);

    // Extract sellers (enhanced)
    const sellersData = serpData.sellers_results?.online_sellers || [];
    const sellers = sellersData.slice(0, 5).map(s => ({
      name: s.name || '',
      price: s.base_price || s.total_price || '',
      shipping: s.additional_price?.shipping || '',
      url: s.link || '#',
      rating: s.rating || null,
      reviewCount: s.reviews || null,
      topQualityStore: !!s.top_quality_store,
    }));

    const result = { details, reviews, sellers, ratingsHistogram, topicFilters, reviews_results: serpData.reviews_results };

    // Cache
    if (env.DB) {
      try {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO product_details_cache (product_id, details_json) VALUES (?, ?)'
        ).bind(productId, JSON.stringify(result)).run();
      } catch {}
    }
    await incrementApiUsage(env);

    return json({ ...result, source: 'serpapi' }, 200, corsHeaders);
  } catch (err) {
    return json({ details: null, reviews: [], error: 'SerpAPI error: ' + err.message }, 200, corsHeaders);
  }
}

/**
 * GET /api/search-quota — Today's SerpAPI usage
 */
async function handleSearchQuota(request, env, corsHeaders) {
  const used = await getApiUsage(env);
  return json({
    used,
    limit: SERPAPI_DAILY_LIMIT,
    remaining: Math.max(0, SERPAPI_DAILY_LIMIT - used),
    date: new Date().toISOString().slice(0, 10),
  }, 200, corsHeaders);
}

// ============================================================
// IMAGE SCRAPING
// ============================================================

const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip',
  'Cache-Control': 'no-cache',
};

/**
 * Extract main product image from Amazon product page HTML
 */
function extractAmazonImage(html) {
  const patterns = [
    // og:image meta tag (most reliable across page variants)
    /property="og:image"\s+content="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    /content="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"\s+property="og:image"/,
    // data-old-hires attribute (high-res image)
    /data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // colorImages JSON block
    /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Main image in landing image tag
    /id="landingImage"[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // imgBlkFront
    /id="imgBlkFront"[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Any large Amazon image
    /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // dynamicImageData (mobile pages)
    /"mainUrl"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Fallback: any media-amazon image that looks like a product image
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+%-]+\._AC_S[XY]\d+_\.jpg)/,
    // Even broader: any non-tiny Amazon product image
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+%-]+\.(?:_AC_UL\d+_|_AC_SL\d+_|jpg))/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let url = match[1];
      // Normalize to 300px product image
      url = url.replace(/\._[A-Z]{2}_[A-Z]{2,}\d*_\./, '._AC_SX300_.');
      if (!url.includes('._AC_SX300_.')) {
        url = url.replace(/\.jpg/, '._AC_SX300_.jpg');
      }
      return url;
    }
  }
  return null;
}

/**
 * Extract product image from Google search results
 */
function extractGoogleImage(html) {
  const patterns = [
    // Direct image URLs in search results
    /\["(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^\"]*)?)"\s*,\s*[0-9]+\s*,\s*[0-9]+\s*\]/gi,
    // Image URLs in data attributes
    /data-src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
    // og:image
    /content="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
    // shopping result thumbnails
    /src="(https:\/\/encrypted-tbn\d\.gstatic\.com\/shopping\?[^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const url = match[1];
      // Skip Google's own non-product assets
      if (url.includes('gstatic.com/images') || url.includes('google.com/images') || url.includes('googleusercontent.com')) continue;
      // Prefer Amazon images
      if (url.includes('media-amazon') || url.includes('ssl-images-amazon')) return url;
      // Accept Google Shopping thumbnails (these are reliable product images)
      if (url.includes('gstatic.com/shopping')) return url;
      // Accept other product image sources (not icons/logos)
      if (url.length > 40 && !url.includes('favicon') && !url.includes('logo') && !url.includes('pixel')) return url;
    }
  }
  return null;
}

/**
 * Try fetching Amazon product page image
 */
async function tryAmazonImage(asin) {
  // Strategy 1: Regular product page
  try {
    const response = await fetch(`https://www.amazon.com/dp/${asin}`, {
      headers: FETCH_HEADERS,
      redirect: 'follow',
    });
    if (response.ok) {
      const html = await response.text();
      const url = extractAmazonImage(html);
      if (url) return url;
    }
  } catch {}

  // Strategy 2: Mobile product page (often less protected)
  try {
    const response = await fetch(`https://www.amazon.com/gp/aw/d/${asin}`, {
      headers: {
        ...FETCH_HEADERS,
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
      redirect: 'follow',
    });
    if (response.ok) {
      const html = await response.text();
      const url = extractAmazonImage(html);
      if (url) return url;
    }
  } catch {}

  return null;
}

/**
 * Try Google Shopping search for product image
 */
async function tryGoogleImage(query) {
  // Strategy 1: Google Shopping search (better product images)
  try {
    const response = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=shop`,
      { headers: FETCH_HEADERS }
    );
    if (response.ok) {
      const html = await response.text();
      const url = extractGoogleImage(html);
      if (url) return url;
    }
  } catch {}

  // Strategy 2: Regular Google Images search
  try {
    const response = await fetch(
      `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&source=lnms`,
      { headers: FETCH_HEADERS }
    );
    if (response.ok) {
      const html = await response.text();
      const url = extractGoogleImage(html);
      if (url) return url;
    }
  } catch {}

  return null;
}

/**
 * Handle Amazon product image request
 */
async function handleProductImage(asin, corsHeaders, env) {
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return new Response(JSON.stringify({ error: 'Invalid ASIN' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check cache (memory + KV)
  const cached = await getCachedImage(`asin:${asin}`, env);
  if (cached) {
    return new Response(JSON.stringify({ imageUrl: cached, source: 'cache' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  // Try Amazon directly
  let imageUrl = await tryAmazonImage(asin);

  // Fallback: Google search
  if (!imageUrl) {
    imageUrl = await tryGoogleImage(`amazon ${asin} product`);
  }

  // Broader fallback: search by ASIN only
  if (!imageUrl) {
    imageUrl = await tryGoogleImage(`${asin} product image`);
  }

  if (imageUrl) {
    await cacheImage(`asin:${asin}`, imageUrl, env);
    return new Response(JSON.stringify({ imageUrl, source: 'fetched' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  return new Response(JSON.stringify({ error: 'No image found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Handle Google image search request
 */
async function handleSearchImage(query, corsHeaders, env) {
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const key = `q:${query}`;
  const cached = await getCachedImage(key, env);
  if (cached) {
    return new Response(JSON.stringify({ imageUrl: cached, source: 'cache' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  const imageUrl = await tryGoogleImage(query);

  if (imageUrl) {
    await cacheImage(key, imageUrl, env);
    return new Response(JSON.stringify({ imageUrl, source: 'google' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  return new Response(JSON.stringify({ error: 'No image found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ============================================================
// AUTH & SYNC — User identity + data persistence via D1
// ============================================================

// Auth rate limiting (stricter: 5 per minute per IP)
const authRateLimits = new Map();
function checkAuthRateLimit(ip) {
  const now = Date.now();
  const entry = authRateLimits.get(ip);
  if (!entry || now - entry.windowStart > 60000) {
    authRateLimits.set(ip, { windowStart: now, count: 1 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

function json(data, status, corsHeaders) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * PBKDF2 password hashing (Web Crypto API — native in Workers)
 */
async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
    key, 256
  );
  return btoa(String.fromCharCode(...new Uint8Array(bits)));
}

/**
 * Validate session token → return user row or null
 */
async function authenticate(request, env) {
  const token = request.headers.get('X-Session-Token');
  if (!token || !env.DB) return null;
  try {
    return await env.DB.prepare(
      'SELECT id, email, name, gender, age, skin, hair, interests, budget FROM users WHERE session_token = ?'
    ).bind(token).first();
  } catch { return null; }
}

function userToProfile(row) {
  return {
    name: row.name, email: row.email, gender: row.gender || '',
    age: row.age || '', skin: row.skin || '', hair: row.hair || '',
    interests: JSON.parse(row.interests || '[]'), budget: row.budget || 'moderate',
  };
}

/**
 * POST /api/auth/register — Create account or return existing
 */
async function handleRegister(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkAuthRateLimit(ip)) return json({ error: 'Too many attempts. Try again later.' }, 429, corsHeaders);
  if (!env.DB) return json({ error: 'Database not configured' }, 500, corsHeaders);

  try {
    const body = await request.json();
    const { email, password, name, gender, age, skin, hair, interests, budget } = body;

    if (!email || !password || !name) return json({ error: 'Email, password, and name are required' }, 400, corsHeaders);
    if (password.length < 6) return json({ error: 'Password must be at least 6 characters' }, 400, corsHeaders);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email format' }, 400, corsHeaders);

    // Check if email already exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    if (existing) return json({ error: 'An account with this email already exists. Please log in.' }, 409, corsHeaders);

    const salt = crypto.randomUUID();
    const hash = await hashPassword(password, salt);
    const token = crypto.randomUUID();

    await env.DB.prepare(
      `INSERT INTO users (email, name, password_hash, password_salt, gender, age, skin, hair, interests, budget, session_token)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      email.toLowerCase(), name, hash, salt,
      gender || '', age || '', skin || '', hair || '',
      JSON.stringify(interests || []), budget || 'moderate', token
    ).run();

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email.toLowerCase()).first();
    return json({ user: userToProfile(user), sessionToken: token, isNew: true }, 201, corsHeaders);
  } catch (err) {
    return json({ error: 'Registration failed: ' + err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/auth/login — Email + password login
 */
async function handleLogin(request, env, corsHeaders) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkAuthRateLimit(ip)) return json({ error: 'Too many attempts. Try again later.' }, 429, corsHeaders);
  if (!env.DB) return json({ error: 'Database not configured' }, 500, corsHeaders);

  try {
    const { email, password } = await request.json();
    if (!email || !password) return json({ error: 'Email and password are required' }, 400, corsHeaders);

    const user = await env.DB.prepare(
      'SELECT id, email, name, password_hash, password_salt, gender, age, skin, hair, interests, budget FROM users WHERE email = ?'
    ).bind(email.toLowerCase()).first();
    if (!user) return json({ error: 'No account found with this email' }, 404, corsHeaders);

    const hash = await hashPassword(password, user.password_salt);
    if (hash !== user.password_hash) return json({ error: 'Incorrect password' }, 401, corsHeaders);

    const token = crypto.randomUUID();
    await env.DB.prepare('UPDATE users SET session_token = ?, updated_at = datetime(\'now\') WHERE id = ?').bind(token, user.id).run();

    return json({ user: userToProfile(user), sessionToken: token }, 200, corsHeaders);
  } catch (err) {
    return json({ error: 'Login failed: ' + err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/auth/logout — Invalidate session
 */
async function handleLogout(request, env, corsHeaders) {
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401, corsHeaders);
  await env.DB.prepare('UPDATE users SET session_token = NULL WHERE id = ?').bind(user.id).run();
  return json({ ok: true }, 200, corsHeaders);
}

/**
 * PATCH /api/user/profile — Update profile fields
 */
async function handleProfileUpdate(request, env, corsHeaders) {
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401, corsHeaders);

  try {
    const updates = await request.json();
    const allowed = ['name', 'gender', 'age', 'skin', 'hair', 'budget'];
    const sets = [];
    const vals = [];
    for (const key of allowed) {
      if (updates[key] !== undefined) {
        sets.push(`${key} = ?`);
        vals.push(updates[key]);
      }
    }
    if (updates.interests !== undefined) {
      sets.push('interests = ?');
      vals.push(JSON.stringify(updates.interests));
    }
    if (sets.length === 0) return json({ error: 'No valid fields to update' }, 400, corsHeaders);
    sets.push("updated_at = datetime('now')");
    vals.push(user.id);

    await env.DB.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    const updated = await env.DB.prepare(
      'SELECT id, email, name, gender, age, skin, hair, interests, budget FROM users WHERE id = ?'
    ).bind(user.id).first();
    return json({ user: userToProfile(updated) }, 200, corsHeaders);
  } catch (err) {
    return json({ error: 'Update failed: ' + err.message }, 500, corsHeaders);
  }
}

/**
 * POST /api/sync/push — Push local state to D1
 */
async function handleSyncPush(request, env, corsHeaders) {
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401, corsHeaders);

  try {
    const data = await request.json();
    const uid = user.id;
    const stmts = [];

    // Saved products
    if (data.saved && Array.isArray(data.saved)) {
      for (const s of data.saved) {
        if (s.product_id && s.product_json) {
          stmts.push(env.DB.prepare(
            'INSERT OR REPLACE INTO saved_products (user_id, product_id, product_json) VALUES (?, ?, ?)'
          ).bind(uid, s.product_id, s.product_json));
        }
      }
    }

    // Purchases
    if (data.buys && Array.isArray(data.buys)) {
      for (const b of data.buys) {
        if (b.product_id && b.purchased_at) {
          stmts.push(env.DB.prepare(
            'INSERT OR IGNORE INTO purchases (user_id, product_id, product_json, retailer, purchased_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(uid, b.product_id, b.product_json || '{}', b.retailer || '', b.purchased_at));
        }
      }
    }

    // Searches (append only, ignore duplicates within same second)
    if (data.searches && Array.isArray(data.searches)) {
      for (const q of data.searches) {
        if (q) {
          stmts.push(env.DB.prepare(
            'INSERT INTO search_history (user_id, query) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM search_history WHERE user_id = ? AND query = ? ORDER BY searched_at DESC LIMIT 1)'
          ).bind(uid, q, uid, q));
        }
      }
    }

    // Threads
    if (data.threads && Array.isArray(data.threads)) {
      for (const t of data.threads) {
        if (t.thread_cid) {
          stmts.push(env.DB.prepare(
            'INSERT OR REPLACE INTO threads (user_id, thread_cid, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
          ).bind(uid, t.thread_cid, t.name || 'New Chat', t.created_at || new Date().toISOString(), t.updated_at || new Date().toISOString()));
        }
      }
    }

    // Thread data
    if (data.thread_data && typeof data.thread_data === 'object') {
      for (const [cid, td] of Object.entries(data.thread_data)) {
        stmts.push(env.DB.prepare(
          "INSERT OR REPLACE INTO thread_data (user_id, thread_cid, data_json, updated_at) VALUES (?, ?, ?, datetime('now'))"
        ).bind(uid, cid, JSON.stringify(td)));
      }
    }

    // Viewed products
    if (data.viewed && Array.isArray(data.viewed)) {
      for (const v of data.viewed) {
        if (v.product_id && v.product_json) {
          stmts.push(env.DB.prepare(
            "INSERT OR REPLACE INTO viewed_products (user_id, product_id, product_json, viewed_at) VALUES (?, ?, ?, datetime('now'))"
          ).bind(uid, v.product_id, v.product_json));
        }
      }
    }

    // Execute all in batch
    if (stmts.length > 0) {
      await env.DB.batch(stmts);
    }

    return json({ ok: true, synced_at: new Date().toISOString(), statements: stmts.length }, 200, corsHeaders);
  } catch (err) {
    return json({ error: 'Sync push failed: ' + err.message }, 500, corsHeaders);
  }
}

/**
 * GET /api/sync/pull — Pull full user state from D1
 */
async function handleSyncPull(request, env, corsHeaders) {
  const user = await authenticate(request, env);
  if (!user) return json({ error: 'Not authenticated' }, 401, corsHeaders);

  try {
    const uid = user.id;

    const [savedRows, buyRows, searchRows, threadRows, threadDataRows, viewedRows] = await Promise.all([
      env.DB.prepare('SELECT product_id, product_json FROM saved_products WHERE user_id = ? ORDER BY created_at DESC').bind(uid).all(),
      env.DB.prepare('SELECT product_id, product_json, retailer, purchased_at FROM purchases WHERE user_id = ? ORDER BY purchased_at DESC').bind(uid).all(),
      env.DB.prepare('SELECT query FROM search_history WHERE user_id = ? ORDER BY searched_at DESC LIMIT 200').bind(uid).all(),
      env.DB.prepare('SELECT thread_cid, name, created_at, updated_at FROM threads WHERE user_id = ? ORDER BY updated_at DESC').bind(uid).all(),
      env.DB.prepare('SELECT thread_cid, data_json FROM thread_data WHERE user_id = ?').bind(uid).all(),
      env.DB.prepare('SELECT product_id, product_json FROM viewed_products WHERE user_id = ? ORDER BY viewed_at DESC LIMIT 100').bind(uid).all(),
    ]);

    return json({
      user: userToProfile(user),
      saved: savedRows.results || [],
      buys: buyRows.results || [],
      searches: (searchRows.results || []).map(r => r.query),
      threads: threadRows.results || [],
      thread_data: Object.fromEntries(
        (threadDataRows.results || []).map(r => [r.thread_cid, JSON.parse(r.data_json || '{}')])
      ),
      viewed: viewedRows.results || [],
      synced_at: new Date().toISOString(),
    }, 200, corsHeaders);
  } catch (err) {
    return json({ error: 'Sync pull failed: ' + err.message }, 500, corsHeaders);
  }
}

/**
 * Handle Anthropic API proxy
 */
async function handleApiProxy(request, env, corsHeaders) {
  const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
      status: 429,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server API key not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const allowedModels = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
    if (!allowedModels.includes(body.model)) {
      body.model = 'claude-sonnet-4-20250514';
    }
    if (!body.max_tokens || body.max_tokens > 4096) {
      body.max_tokens = 2048;
    }

    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'prompt-caching-2024-07-31',
      },
      body: JSON.stringify(body),
    });

    const responseData = await anthropicResponse.text();
    return new Response(responseData, {
      status: anthropicResponse.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Check origin
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin) && !origin.endsWith('.github.io')) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: GET /product-image?asin=XXX
    if (request.method === 'GET' && url.pathname === '/product-image') {
      const asin = url.searchParams.get('asin');
      return handleProductImage(asin, corsHeaders, env);
    }

    // Route: GET /search-image?q=XXX
    if (request.method === 'GET' && url.pathname === '/search-image') {
      const query = url.searchParams.get('q');
      return handleSearchImage(query, corsHeaders, env);
    }

    // Route: POST /api/auth/register
    if (request.method === 'POST' && url.pathname === '/api/auth/register') {
      return handleRegister(request, env, corsHeaders);
    }
    // Route: POST /api/auth/login
    if (request.method === 'POST' && url.pathname === '/api/auth/login') {
      return handleLogin(request, env, corsHeaders);
    }
    // Route: POST /api/auth/logout
    if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
      return handleLogout(request, env, corsHeaders);
    }
    // Route: PATCH /api/user/profile
    if (request.method === 'PATCH' && url.pathname === '/api/user/profile') {
      return handleProfileUpdate(request, env, corsHeaders);
    }
    // Route: POST /api/sync/push
    if (request.method === 'POST' && url.pathname === '/api/sync/push') {
      return handleSyncPush(request, env, corsHeaders);
    }
    // Route: GET /api/sync/pull
    if (request.method === 'GET' && url.pathname === '/api/sync/pull') {
      return handleSyncPull(request, env, corsHeaders);
    }

    // Route: GET /api/search-products?q=...
    if (request.method === 'GET' && url.pathname === '/api/search-products') {
      return handleSearchProducts(request, env, corsHeaders);
    }
    // Route: GET /api/product-details?product_id=...
    if (request.method === 'GET' && url.pathname === '/api/product-details') {
      return handleProductDetails(request, env, corsHeaders);
    }
    // Route: GET /api/search-quota
    if (request.method === 'GET' && url.pathname === '/api/search-quota') {
      return handleSearchQuota(request, env, corsHeaders);
    }

    // Route: POST / — Anthropic API proxy (catch-all, must be LAST)
    if (request.method === 'POST') {
      return handleApiProxy(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
