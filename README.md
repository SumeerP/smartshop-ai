# 🛍️ SmartShop AI

AI-powered personal shopping assistant with conversational search, personalized recommendations, and smart product discovery. Built with React and Claude AI.

**[Live Demo →](https://sumeerp.github.io/smartshop-ai/)**

---

## Features

- **Conversational AI Search** — Ask about any product in natural language and get real-time recommendations powered by Claude with web search
- **Personalized Profile** — Onboarding captures gender, age, skin type, hair type, interests, and budget to tailor every suggestion
- **Smart Home Feed** — Deals, trending searches, popular purchases, and "because you searched" sections update dynamically
- **Product Details** — Star ratings, reviews, retailer info, "Why Recommended" explanations, and direct buy links
- **Save & Track** — Save items, track viewed products, and log purchases
- **Responsive Design** — Mobile-first UI optimized for touch interactions

---

## Architecture

```
┌──────────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│                  │     │  Cloudflare Worker   │     │                  │
│  GitHub Pages    │────▶│    (proxy)           │────▶│  Anthropic API   │
│  (index.html)    │◀────│                      │◀────│  (Claude + Web   │
│                  │     │  API key stored here  │     │   Search)        │
└──────────────────┘     └─────────────────────┘     └──────────────────┘
     Browser                  Serverless                  AI Backend
```

The API key **never touches the browser**. The Cloudflare Worker acts as a secure proxy with:
- CORS origin validation
- Rate limiting (30 req/min per IP)
- Model & token allowlisting
- Request validation

---

## Deployment Guide

### Step 1: Deploy the Cloudflare Worker (API proxy)

This takes ~5 minutes. The free tier handles 100K requests/day.

```bash
# 1. Install Wrangler CLI
npm install -g wrangler

# 2. Login to Cloudflare (creates free account if needed)
wrangler login

# 3. Create a new directory for the worker
mkdir smartshop-proxy && cd smartshop-proxy

# 4. Copy the worker files from this repo
cp ../worker.js ./src/index.js
cp ../wrangler.toml ./wrangler.toml

# 5. Set your Anthropic API key as a secret (never committed to code)
wrangler secret put ANTHROPIC_API_KEY
# → Paste your sk-ant-... key when prompted

# 6. Deploy
wrangler deploy
# → Outputs: https://smartshop-proxy.<your-subdomain>.workers.dev
```

Save the worker URL — you'll need it in Step 3.

### Step 2: Deploy the Frontend (GitHub Pages)

```bash
# Already done if you're reading this from the repo!
# Go to: Settings → Pages → Source: Deploy from branch → main → / (root) → Save
```

Your app will be live at `https://<username>.github.io/smartshop-ai/`

### Step 3: Connect the App to Your Worker

1. Open the deployed app
2. Complete the onboarding flow (name, preferences)
3. Go to **Settings** (gear icon in bottom nav)
4. Find **AI Configuration** card
5. Paste your Cloudflare Worker URL (e.g., `https://smartshop-proxy.your-subdomain.workers.dev`)
6. Click **Connect**

That's it! The AI search is now fully functional.

---

## Project Structure

```
smartshop-ai/
├── index.html          # Complete app (React + JSX, runs via Babel standalone)
├── smartshop-app.tsx    # Original source (for reference / IDE use)
├── worker.js           # Cloudflare Worker proxy
├── wrangler.toml       # Worker deployment config
└── README.md           # This file
```

### Why a single index.html?

GitHub Pages serves static files. Instead of a build step, the app loads React and Babel from CDN and compiles JSX in-browser. This means:
- **Zero build tooling** — no Node.js, no bundler, no CI/CD needed
- **Edit and push** — changes go live immediately
- **Works anywhere** — download and open locally, or deploy to any static host

For production at scale, you'd migrate to Vite/Next.js with proper bundling.

---

## Security

| Concern | Mitigation |
|---|---|
| API key exposure | Stored as Cloudflare secret, never in browser |
| Unauthorized usage | CORS origin whitelist + rate limiting |
| Prompt injection | System prompt is server-controlled |
| Model abuse | Allowlisted models & capped tokens |
| Data privacy | No user data stored server-side; all state is in-browser |

---

## Configuration

### Cloudflare Worker (`worker.js`)

| Setting | Default | Description |
|---|---|---|
| `ALLOWED_ORIGINS` | `sumeerp.github.io`, `localhost:*` | Domains allowed to call the proxy |
| `RATE_LIMIT` | 30 | Max requests per minute per IP |
| `allowedModels` | `claude-sonnet-4, claude-haiku-4.5` | Models the frontend can request |
| `max_tokens` cap | 4096 | Maximum tokens per response |

### Frontend (`index.html`)

The proxy URL is stored in `localStorage` under `__smartshop_proxy`. Users configure it in Settings → AI Configuration.

---

## Local Development

```bash
# Serve locally with any static server
npx serve .
# or
python3 -m http.server 8000

# Open http://localhost:8000 (or 3000/5173/5500 — all whitelisted in the worker)
```

---

## Tech Stack

- **Frontend**: React 18, Babel Standalone (in-browser JSX)
- **AI**: Claude Sonnet 4 via Anthropic Messages API + Web Search tool
- **Proxy**: Cloudflare Workers (serverless, free tier)
- **Hosting**: GitHub Pages (static, free)
- **Styling**: Inline CSS-in-JS (zero dependencies)

---

## License

MIT
