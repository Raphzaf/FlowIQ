# FlowIQ — Smart Personal Finance for Israeli Banks

> Connect all your Israeli bank and credit card accounts in one place, visualise your spending, and stay on top of your budget — automatically.

## Live Demo

🔗 **[flowiq.vercel.app](https://flowiq.vercel.app)** — click **"Try Demo"** to explore without connecting a bank.

---

## Features

- 🏦 **Automatic sync** with 10 Israeli banks & credit cards (Hapoalim, Leumi, Discount, Mizrahi, Max, Isracard, Amex, and more)
- 📊 **Visual spending dashboard** with Bento Grid layout and interactive charts
- 🏷️ **Smart transaction categorisation** with manual override
- 🎯 **Monthly budgets** by category with progress tracking
- 🔍 **Full-text search** and advanced filters (date, amount, category)
- 📱 **Fully responsive** — mobile-first design
- 🌙 **Dark mode** out of the box
- 🔒 **AES-256-GCM encryption** for all stored bank credentials
- ⚡ **Offline-ready** PWA with service worker cache

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, React Router, Recharts, Tailwind CSS |
| **Backend** | FastAPI (Python), Supabase (Postgres), AES-256-GCM encryption |
| **Scraper** | Node.js, [israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers), Puppeteer / @sparticuz/chromium |
| **Infrastructure** | Vercel (frontend + serverless functions), Upstash Redis (rate limiting), Vercel Cron (auto-sync) |

---

## Architecture

```
Browser / Mobile
      │
      ▼
React SPA  (frontend/)
      │  REST API calls
      ▼
FastAPI backend  (backend/api/index.py)
      │  AES-256-GCM encrypted credentials
      │  httpx + X-Internal-Secret
      ▼
Node.js scraper service  (scraper-service/)
      │  israeli-bank-scrapers + Chromium
      ▼
Bank / credit-card website
```

The FastAPI backend never exposes the scraper to the public — all internal calls are authenticated with a shared `INTERNAL_API_SECRET`.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/Raphzaf/FlowIQ.git
cd FlowIQ
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Edit .env and fill in your values (see Environment Variables below)
```

### 3. Install & run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn server:app --reload --port 8000
```

### 4. Install & run the scraper service

```bash
cd scraper-service
npm install
node server.js   # or: npm start
```

### 5. Install & run the frontend

```bash
cd frontend
npm install
npm start
# Open http://localhost:3000
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your values. See `.env.example` for full descriptions.

| Variable | Required | Description |
|----------|----------|-------------|
| `ISRAEL_BANKS_SECRET_KEY` | **Yes (prod)** | AES-256 key for encrypting bank credentials |
| `INTERNAL_API_SECRET` | **Yes** | Shared secret between FastAPI ↔ scraper |
| `CORS_ORIGINS` | **Yes (prod)** | Comma-separated allowed origins |
| `CRON_SECRET` | **Yes (prod)** | Protects the `/api/banks/sync-all` cron endpoint |
| `SUPABASE_URL` | **Yes** | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | **Yes** | Your Supabase anon key |
| `ENV` | No | `development` or `production` (default: `development`) |
| `UPSTASH_REDIS_REST_URL` | No | Upstash Redis URL (recommended for prod rate limiting) |
| `UPSTASH_REDIS_REST_TOKEN` | No | Upstash Redis token |
| `ISRAEL_BANKS_SYNC_HOURS` | No | Auto-sync interval in hours (default: `6`) |

---

## Screenshots

> _[Dashboard screenshot — coming soon]_

---

## Supported Banks

| Institution | Type |
|-------------|------|
| Bank Hapoalim | Bank |
| Bank Leumi | Bank |
| Discount Bank | Bank |
| Mizrahi Bank | Bank |
| Beinleumi | Bank |
| Mercantile Bank | Bank |
| Max | Credit card |
| Visa Cal | Credit card |
| Isracard | Credit card |
| Amex | Credit card |

---

## Security

- Bank credentials are encrypted with **AES-256-GCM** before storage — plain-text credentials never touch the database.
- The encryption key is derived from `ISRAEL_BANKS_SECRET_KEY` using SHA-256.
- The scraper service is **never exposed to the client** — all calls require `X-Internal-Secret`.
- Rate limiting is applied on sensitive endpoints (Redis-backed in production, in-memory fallback for local dev).

---

## License

MIT
