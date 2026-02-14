/**
 * SmartShop AI — Cloudflare Worker Proxy
 * 
 * This worker securely proxies requests from the frontend to the Anthropic API.
 * The API key is stored as a Cloudflare secret (never exposed to the browser).
 * 
 * SETUP:
 * 1. Install Wrangler CLI: npm install -g wrangler
 * 2. Login: wrangler login
 * 3. Create worker: wrangler init smartshop-proxy
 * 4. Replace the generated worker.js with this file
 * 5. Set the secret: wrangler secret put ANTHROPIC_API_KEY
 *    (paste your sk-ant-... key when prompted)
 * 6. Deploy: wrangler deploy
 * 7. Your proxy URL will be: https://smartshop-proxy.<your-subdomain>.workers.dev
 * 8. Update PROXY_URL in index.html to match
 */

const ALLOWED_ORIGINS = [
  'https://sumeerp.github.io',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5500',  // VS Code Live Server
];

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

// Rate limiting (simple in-memory, resets on worker restart)
const rateLimits = new Map();
const RATE_LIMIT = 30;       // requests per window
const RATE_WINDOW = 60000;   // 1 minute

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

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check origin
    const origin = request.headers.get('Origin') || '';
    if (!ALLOWED_ORIGINS.includes(origin) && !origin.endsWith('.github.io')) {
      return new Response(JSON.stringify({ error: 'Origin not allowed' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Rate limit
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    if (!checkRateLimit(clientIP)) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please wait a moment.' }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check API key is configured
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Server API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Parse and validate the request body
      const body = await request.json();

      // Enforce allowed models
      const allowedModels = ['claude-sonnet-4-20250514', 'claude-haiku-4-5-20251001'];
      if (!allowedModels.includes(body.model)) {
        body.model = 'claude-sonnet-4-20250514';
      }

      // Cap max_tokens
      if (!body.max_tokens || body.max_tokens > 4096) {
        body.max_tokens = 2048;
      }

      // Forward to Anthropic
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
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Proxy error: ' + err.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  },
};
