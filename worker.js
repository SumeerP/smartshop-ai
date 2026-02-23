/**
 * SmartShop AI — Cloudflare Worker Proxy
 *
 * Proxies requests to Anthropic API + provides product image search.
 * API key stored as Cloudflare secret (never exposed to browser).
 *
 * ENDPOINTS:
 *   POST /          — Anthropic API proxy
 *   GET  /product-image?asin=XXX  — Fetch Amazon product image by ASIN
 *   GET  /search-image?q=XXX     — Search Google for product image
 */

const ALLOWED_ORIGINS = [
  'https://sumeerp.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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

// Image cache (in-memory, resets on worker restart, good enough for demo)
const imageCache = new Map();

/**
 * Extract main product image from Amazon product page HTML
 */
function extractAmazonImage(html) {
  // Try multiple patterns Amazon uses for main product image
  const patterns = [
    // data-old-hires attribute (high-res image)
    /data-old-hires="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // colorImages JSON block (most reliable)
    /"hiRes"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Main image in landing image tag
    /id="landingImage"[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // imgBlkFront
    /id="imgBlkFront"[^>]*src="(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Any large Amazon image
    /"large"\s*:\s*"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+)"/,
    // Fallback: any media-amazon image that looks like a product image
    /(https:\/\/m\.media-amazon\.com\/images\/I\/[A-Za-z0-9+%-]+\._AC_S[XY]\d+_\.jpg)/,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      // Normalize to a good size (SX500)
      let url = match[1];
      url = url.replace(/\._AC_S[XY]\d+_\./, '._AC_SX300_.');
      return url;
    }
  }
  return null;
}

/**
 * Extract product image from Google search results
 */
function extractGoogleImage(html) {
  // Google Images encodes thumbnails in the HTML
  // Look for base64 images or direct URLs in the response
  const patterns = [
    // Direct image URLs in search results
    /\["(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)(?:\?[^"]*)?)",[0-9]+,[0-9]+\]/gi,
    // Image URLs in data attributes
    /data-src="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
    // og:image
    /content="(https:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
  ];

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)];
    for (const match of matches) {
      const url = match[1];
      // Filter out Google's own assets, tiny icons, etc.
      if (url.includes('gstatic.com') || url.includes('google.com') || url.includes('googleapis.com')) continue;
      if (url.includes('amazon.com') || url.includes('media-amazon') || url.includes('ssl-images-amazon')) {
        return url;
      }
      // Accept other product image sources
      if (url.length > 40 && !url.includes('favicon') && !url.includes('logo')) {
        return url;
      }
    }
  }
  return null;
}

/**
 * Handle Amazon product image request
 */
async function handleProductImage(asin, corsHeaders) {
  if (!asin || !/^[A-Z0-9]{10}$/.test(asin)) {
    return new Response(JSON.stringify({ error: 'Invalid ASIN' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Check cache
  if (imageCache.has(asin)) {
    return new Response(JSON.stringify({ imageUrl: imageCache.get(asin), source: 'cache' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  try {
    // Fetch Amazon product page
    const amazonUrl = `https://www.amazon.com/dp/${asin}`;
    const response = await fetch(amazonUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });

    if (!response.ok) {
      throw new Error(`Amazon returned ${response.status}`);
    }

    const html = await response.text();
    const imageUrl = extractAmazonImage(html);

    if (imageUrl) {
      imageCache.set(asin, imageUrl);
      return new Response(JSON.stringify({ imageUrl, source: 'amazon' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    // Fallback: try Google Image search
    return await handleSearchImage(`amazon ${asin} product`, corsHeaders, asin);

  } catch (err) {
    // Fallback to Google search
    try {
      return await handleSearchImage(`amazon ${asin} product`, corsHeaders, asin);
    } catch {
      return new Response(JSON.stringify({ error: 'Could not fetch image', details: err.message }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
}

/**
 * Handle Google image search request
 */
async function handleSearchImage(query, corsHeaders, cacheKey) {
  if (!query) {
    return new Response(JSON.stringify({ error: 'Missing query parameter' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const key = cacheKey || query;
  if (imageCache.has(key)) {
    return new Response(JSON.stringify({ imageUrl: imageCache.get(key), source: 'cache' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
    });
  }

  try {
    // Use Google Images search
    const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch&source=lnms`;
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    const html = await response.text();
    const imageUrl = extractGoogleImage(html);

    if (imageUrl) {
      imageCache.set(key, imageUrl);
      return new Response(JSON.stringify({ imageUrl, source: 'google' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=86400' },
      });
    }

    return new Response(JSON.stringify({ error: 'No image found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: 'Search failed', details: err.message }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
      return handleProductImage(asin, corsHeaders);
    }

    // Route: GET /search-image?q=XXX
    if (request.method === 'GET' && url.pathname === '/search-image') {
      const query = url.searchParams.get('q');
      return handleSearchImage(query, corsHeaders);
    }

    // Route: POST / — Anthropic API proxy
    if (request.method === 'POST') {
      return handleApiProxy(request, env, corsHeaders);
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  },
};
