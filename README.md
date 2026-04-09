# FlowIQ

Smart personal finance dashboard with automatic bank synchronisation.

---

## Israeli Bank Integration

FlowIQ integrates with real Israeli banks and credit-card providers via a
**Node.js microservice** that wraps
[eshaham/israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers) (MIT).

### Architecture

```
Browser / Mobile
      │
      ▼
FastAPI backend  (/api/banks/israel/*)
      │  httpx + X-Internal-Secret
      ▼
Node.js scraper service  (/api/scraper/israel/*)
      │  israeli-bank-scrapers + Chromium
      ▼
Bank / credit-card website
```

The FastAPI backend never exposes the scraper service to the public; all calls
are authenticated with a shared `INTERNAL_API_SECRET`.

### Supported institutions (MVP set)

| ID | Name | Type | Login fields |
|----|------|------|-------------|
| `hapoalim` | Bank Hapoalim | Bank | `userCode`, `password` |
| `leumi` | Bank Leumi | Bank | `username`, `password` |
| `discount` | Discount Bank | Bank | `id`, `password`, `num` |
| `mizrahi` | Mizrahi Bank | Bank | `username`, `password` |
| `beinleumi` | Beinleumi | Bank | `username`, `password` |
| `mercantile` | Mercantile Bank | Bank | `id`, `password`, `num` |
| `max` | Max | Credit card | `username`, `password` |
| `visaCal` | Visa Cal | Credit card | `username`, `password` |
| `isracard` | Isracard | Credit card | `id`, `card6Digits`, `password` |
| `amex` | Amex | Credit card | `id`, `card6Digits`, `password` |

### Environment variables

#### FastAPI backend (`backend/`)

| Variable | Required in prod | Description |
|----------|-----------------|-------------|
| `ISRAEL_BANKS_SECRET_KEY` | **Yes** | AES-256 key used to encrypt stored credentials. **Required in production** – the server refuses to start without it to prevent silent credential loss on restart. Generate with `openssl rand -base64 32`. |
| `INTERNAL_API_SECRET` | **Yes** | Shared secret used by FastAPI to authenticate requests to the Node.js scraper service. Must match the value set on the scraper. |
| `SCRAPER_SERVICE_URL` | No | Base URL of the scraper microservice. Defaults to `https://{VERCEL_URL}` in Vercel, or `http://localhost:3001` locally. |
| `ISRAEL_BANKS_SYNC_HOURS` | No | How often (in hours) the background scheduler re-syncs. Default: `6`. |

#### Node.js scraper service (`scraper-service/`)

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_API_SECRET` | **Yes** | Must match the value set in the FastAPI backend. |
| `VERCEL` | Auto | Set by Vercel; triggers use of `@sparticuz/chromium` for serverless Chromium. |

### Security – credential storage

* Credentials are encrypted with **AES-256-GCM** (Python `cryptography.fernet`) before
  being written to the database.
* The encryption key is derived from `ISRAEL_BANKS_SECRET_KEY` using SHA-256.
* Plain-text credentials are **never** persisted; they exist in memory only during the
  login / sync flow.
* The Node.js scraper service is never exposed directly to the client.
  Every call must include the `X-Internal-Secret` header.

### FastAPI endpoints

All endpoints require the standard FlowIQ auth headers (`Authorization: Bearer <token>`
in Supabase mode, or `X-User-Id` in development mode).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/banks/israel/supported` | List supported institutions with login fields |
| `GET` | `/api/banks/israel/connections` | List current user's connections |
| `POST` | `/api/banks/israel/connect` | Connect a bank (body: `{bank_id, username, password}` or `{bank_id, credentials: {...}}`) |
| `POST` | `/api/banks/israel/otp` | Complete an OTP-required connection (body: `{bank_id, otp}`) |
| `POST` | `/api/banks/israel/disconnect` | Disconnect a bank (body: `{bank_id}`) |
| `GET` | `/api/banks/israel/accounts` | List all linked accounts with balances |
| `POST` | `/api/banks/israel/sync` | Trigger manual sync (body: `{bank_id}`) |

#### OTP flow

1. **Client** → `POST /api/banks/israel/connect` with credentials.
2. **Response** → `{"status": "otp_required", ...}` if the bank needs OTP.
3. **User** receives OTP via SMS/app.
4. **Client** → `POST /api/banks/israel/otp` with `{bank_id, otp}`.
5. **Response** → connected account data.

### Scraper microservice endpoints (internal only)

Accessible only with `X-Internal-Secret` header. Do **not** expose these to clients.

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/scraper/israel/supported` | List MVP institutions from the library |
| `POST` | `/api/scraper/israel/login` | Run a full scraping login; returns `connected` or `otp_required` |
| `POST` | `/api/scraper/israel/otp` | Complete OTP login with pre-provided OTP code |
| `POST` | `/api/scraper/israel/accounts` | Re-authenticate and fetch current account balances |
| `POST` | `/api/scraper/israel/transactions` | Re-authenticate and fetch transactions for a date range |

### Database tables required

**Supabase** – run the following SQL once:

```sql
create table if not exists bank_connections (
  id text primary key,
  user_id text not null,
  bank_id text not null,
  bank_name text,
  connector_type text default 'israeli-bank-scrapers',
  status text default 'connected',
  encrypted_credentials text,
  accounts jsonb default '[]',
  last_synced_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Allow the external_id dedup upsert for imported transactions
alter table transactions
  add column if not exists external_id text unique,
  add column if not exists source text,
  add column if not exists currency text default 'ILS';
```

**MongoDB** – collections are created automatically: `bank_connections`.

### Automatic sync scheduler

A background `asyncio` task runs every `ISRAEL_BANKS_SYNC_HOURS` hours and:

1. Fetches all `status=connected` Israeli bank connections from the DB.
2. Decrypts credentials.
3. Calls the scraper microservice `/transactions` endpoint (incremental, since `last_synced_at`).
4. Normalises and upserts transactions (de-duplicated by `external_id`).
5. Handles transient errors with exponential back-off (up to 5 retries).

### Serverless limitations (Vercel)

| Limitation | Detail |
|-----------|--------|
| **Function timeout** | Browser-based scraping takes 30–120 s. Requires **Vercel Pro** (≥ 60 s timeout) or Enterprise (≥ 900 s). Hobby plan (10 s) is insufficient. |
| **Chromium binary** | The `@sparticuz/chromium` package provides a serverless-compatible Chromium binary. It is larger than a typical function (~100 MB); deployment size stays within Vercel's 250 MB limit. |
| **OTP mid-session** | Stateless serverless functions cannot pause a browser session to await a user-provided OTP. The OTP must be pre-provided before the scraping session starts. For banks that send OTP automatically on login attempt (e.g. Hapoalim), the user must obtain the OTP first and include it in the `/otp` call. |
| **Alternative deployment** | For lower latency and longer timeouts, deploy the scraper service on a container platform (Railway, Fly.io, Render) and set `SCRAPER_SERVICE_URL` accordingly. |

### Running the tests

```bash
pip install pytest cryptography
python -m pytest tests/test_israel_banks.py -v
```

---

## Backend security – environment variables

### Production detection

The backend considers itself to be running in **production** when any of the
following environment variables equals `production` (case-insensitive):

| Variable | Example |
|----------|---------|
| `ENV` | `production` |
| `NODE_ENV` | `production` |
| `APP_ENV` | `production` |

### `ISRAEL_BANKS_SECRET_KEY`

**Required in production.** The server refuses to start without it.

```bash
ISRAEL_BANKS_SECRET_KEY=$(openssl rand -base64 32)
```

### `INTERNAL_API_SECRET`

Shared secret between the FastAPI backend and the Node.js scraper service.
**Required** whenever bank scraping is used.

```bash
INTERNAL_API_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
```

### `CRON_SECRET`

Protects the `/api/banks/sync-all` endpoint that is designed to be called by a
scheduler (e.g. Vercel Cron).

| Scenario | Behaviour |
|----------|-----------|
| Production, `CRON_SECRET` **absent** | Request refused with **500** – the endpoint cannot be called safely without a secret in production. |
| Production, `CRON_SECRET` **present** | The `X-Cron-Secret` request header must match. Comparison is done with `hmac.compare_digest` to prevent timing attacks. |
| Development, `CRON_SECRET` **absent** | No check – permissive for local development. |
| Development, `CRON_SECRET` **present** | Same strict check as production. |

Set a random, high-entropy value:

```bash
CRON_SECRET=$(python3 -c "import secrets; print(secrets.token_hex(32))")
```

### `CORS_ORIGINS`

Controls which origins are allowed by the CORS middleware.

| Scenario | Behaviour |
|----------|-----------|
| Production, `CORS_ORIGINS` **absent or empty** | Server **refuses to start** – wildcard is forbidden in production. |
| Production, `CORS_ORIGINS` contains `*` | Server **refuses to start**. |
| Production, valid list | Only the listed origins are allowed. |
| Development, not set | Defaults to `*` (permissive for local development). |

Format: comma-separated list of origins.

```bash
CORS_ORIGINS=https://app.flowiq.com,https://staging.flowiq.com
```

### Rate limiting

The backend applies in-memory, fixed-window rate limiting (no Redis required):

| Endpoint pattern | Limit |
|-----------------|-------|
| `/api/banks/*/connect` | 5 req / min / IP |
| `/api/upload-csv` | 10 req / 5 min / IP |
| `/api/banks/sync-all` | 2 req / min / IP |

Exceeded limits return **429 Too Many Requests** with a `Retry-After` header.

---
