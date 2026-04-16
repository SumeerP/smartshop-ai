# SmartShop AI

AI-powered personal shopping assistant with conversational search, personalized recommendations, and real product data from Google Shopping. Built with React, Claude AI, and Cloudflare Workers.

**[Live Demo](https://sumeerp.github.io/smartshop-ai/)**

---

## Features

- **Conversational AI Search** -- Ask about any product in natural language; Claude extracts intent and fetches real products from Google Shopping via SerpAPI
- **Personalized Recommendations** -- Onboarding captures gender, age, skin type, hair type, interests, and budget; Sonnet ranks real products for you
- **Smart Home Feed** -- Deals, trending searches, popular purchases, and "because you searched" sections driven by Haiku-generated queries
- **Real Product Data** -- Prices, ratings, reviews, retailer info, and direct buy links from Google Shopping (not mock data)
- **Review Synthesis** -- AI-powered analysis of customer reviews: pros, cons, red flags, and claim verification
- **Multi-User Auth & Sync** -- Email/password accounts stored in D1, with push/pull sync across devices
- **Multi-Thread Chat** -- Multiple conversation threads with independent history
- **Product Comparison** -- Side-by-side comparison of up to 3 products
- **Save & Track** -- Save items, track viewed products, log purchases
- **Mobile-First PWA** -- Responsive design optimized for touch interactions

---

## Architecture

```
Browser (GitHub Pages)          Cloudflare Worker              External APIs
┌─────────────────────┐    ┌──────────────────────────┐    ┌──────────────────┐
│                     │    │  worker.js               │    │  Anthropic API   │
│  React SPA          │───>│                          │───>│  (Claude Haiku   │
│  (src/App.tsx)      │<───│  - Anthropic proxy       │<───│   + Sonnet)      │
│                     │    │  - SerpAPI proxy          │    │                  │
│  Vite + TypeScript  │    │  - Auth (email/password)  │    ├──────────────────┤
│  Inline styles      │    │  - Sync (push/pull)       │    │  SerpAPI         │
│                     │    │  - Image cache (KV)       │    │  (Google         │
│  sync.ts            │    │  - D1 (SQLite)            │    │   Shopping)      │
└─────────────────────┘    └──────────────────────────┘    └──────────────────┘
```

API keys **never touch the browser**. The Cloudflare Worker acts as a secure proxy with:
- CORS origin validation (whitelist of allowed origins)
- Rate limiting (30 req/min per IP)
- Request validation

---

## Tiered Processing Pipeline

Every user query flows through this cost-optimized pipeline:

| Tier | Stage | Model/Source | Cost | Purpose |
|------|-------|-------------|------|---------|
| T0 | Cache | In-memory `searchCache` per thread | Free | Avoid duplicate searches |
| T1 | Local Filter | (Planned) Filter existing products | Free | Handle refinements without API calls |
| T2 | Intent | Haiku, 256 tokens | ~$0.001 | Classify shopping vs general query |
| T3 | Product DB | SerpAPI Google Shopping + D1 cache | Free if cached | Fetch real product data |
| T4 | Personalize | Sonnet, 1024 tokens | ~$0.01 | Rank and annotate real products |
| T5 | Conversational | Haiku, 512 tokens | ~$0.001 | Answer non-shopping questions |
| T6 | No fallback | -- | -- | Show "no results" + retailer links |
| T7 | Review Synthesis | Haiku, 500 tokens | ~$0.001 | On-demand review analysis (cached) |

**Typical shopping query cost: ~$0.011** (intent + SerpAPI + personalization)

---

## Project Structure

```
smartshop-ai/
├── src/
│   ├── App.tsx           # Main app (~1200 lines -- UI + AI pipeline + state)
│   ├── sync.ts           # Auth + cloud sync client (push/pull, session tokens)
│   ├── main.tsx          # React entry point
│   └── index.css         # Minimal base styles
├── worker.js             # Cloudflare Worker (~1055 lines -- proxy + SerpAPI + auth + sync + image)
├── wrangler.toml         # Worker config (KV namespace, D1 database bindings)
├── schema.sql            # D1 schema (users, products, threads, caches)
├── schema-phase3.sql     # D1 migration (search_cache, product_details_cache, api_usage)
├── vite.config.ts        # Vite build config (base: /smartshop-ai/)
├── package.json          # Dependencies (React 18, Vite 5, TypeScript 5)
├── index.html            # HTML entry (Vite SPA)
├── CLAUDE.md             # Architecture doc for Claude Code
└── .antigravity/
    └── rules.md          # Agent rules
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite 5 (inline styles, no Tailwind) |
| AI | Claude Haiku (intent, conversational, reviews) + Claude Sonnet (personalization) |
| Product Data | SerpAPI Google Shopping (8 calls/day free tier) |
| Caching | D1 (24h search cache, 7d detail cache) + KV (image cache) + in-memory |
| Auth | Custom email/password, PBKDF2 hashing, session tokens in D1 |
| Backend | Cloudflare Workers (serverless) |
| Database | Cloudflare D1 (SQLite) |
| Hosting | GitHub Pages (frontend), Cloudflare Workers (backend) |
| Deployment | `npm run deploy` (gh-pages), `wrangler deploy` (worker) |

---

## Setup & Development

### Prerequisites

- Node.js 18+
- Wrangler CLI (`npm install -g wrangler`)
- Cloudflare account (free tier)
- Anthropic API key
- SerpAPI key (free tier: 100 searches/month)

### Local Development

```bash
# Install frontend dependencies
npm install

# Start Vite dev server (port 5173)
npm run dev

# In another terminal, start the worker locally (port 8787)
wrangler dev

# The app auto-detects localhost and routes to http://localhost:8787
```

### Deploy the Worker

```bash
# Login to Cloudflare
wrangler login

# Set secrets (never committed to code)
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put SERPAPI_KEY

# Create D1 database (first time)
wrangler d1 create smartshop-users
wrangler d1 execute smartshop-users --file=schema.sql

# Deploy
wrangler deploy
```

### Deploy the Frontend

```bash
# Build and deploy to GitHub Pages
npm run deploy
# This runs: vite build && gh-pages -d dist
```

---

## Configuration

### Worker Secrets (Cloudflare)

| Secret | Description |
|--------|------------|
| `ANTHROPIC_API_KEY` | Anthropic API key (sk-ant-...) |
| `SERPAPI_KEY` | SerpAPI key for Google Shopping |

### Worker Settings (`wrangler.toml`)

| Binding | Type | Purpose |
|---------|------|---------|
| `IMAGE_CACHE` | KV Namespace | Cached product image URLs (7d TTL) |
| `DB` | D1 Database | Users, products, threads, search cache |

### Frontend Config (`src/App.tsx`)

| Function | Behavior |
|----------|----------|
| `getProxyUrl()` | Always returns production worker URL (for AI calls) |
| `getWorkerUrl()` | Returns `localhost:8787` in dev, production URL otherwise |

---

## Security

| Concern | Mitigation |
|---------|-----------|
| API key exposure | Stored as Cloudflare secrets, never in browser code |
| Unauthorized usage | CORS origin whitelist + IP rate limiting (30/min) |
| Prompt injection | Security disclaimers in every system prompt |
| Password storage | PBKDF2 with random salt, never plaintext |
| Image validation | `isValidImageUrl()` domain whitelist in worker.js |
| SerpAPI abuse | Daily usage tracking in D1 (8 calls/day limit) |

---

## D1 Database Tables

| Table | Purpose |
|-------|---------|
| `users` | Email, password hash/salt, profile, session token |
| `saved_products` | User's saved/favorited products |
| `purchases` | Purchase history |
| `search_history` | Search query log |
| `threads` | Chat thread metadata |
| `thread_data` | Chat message data (JSON blob per thread) |
| `viewed_products` | Recently viewed products |
| `search_cache` | SerpAPI search results (24h TTL) |
| `product_details_cache` | SerpAPI product details (7d TTL) |
| `api_usage` | Daily SerpAPI call counter |

---

## Planned Improvements

- T1 local filter: re-rank existing products for refinement queries without new API calls
- Component decomposition: break App.tsx into smaller modules
- Tailwind CSS migration (replace inline styles)
- Zod schema validation for API responses
- Test framework (Vitest)
- PWA offline support with service worker

---

## License

MIT
