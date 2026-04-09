# FlowIQ

Smart personal finance dashboard with automatic bank synchronisation.

---

## Israeli Bank Integration

FlowIQ can automatically sync transactions from Israeli banks. The integration
is inspired by [eshaham/israeli-bank-scrapers](https://github.com/eshaham/israeli-bank-scrapers)
and implements the same connector pattern without copying any code from that project.

### Supported institutions (demo connectors)

| ID | Name | Name (Hebrew) |
|----|------|---------------|
| `hapoalim` | Bank Hapoalim | בנק הפועלים |
| `leumi` | Bank Leumi | בנק לאומי |
| `discount` | Bank Discount | בנק דיסקונט |

> **Demo mode** — the current connectors return realistic mock data. They do **not**
> connect to real banking systems. See *Production notes* below for how to wire up
> a real scraper.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ISRAEL_BANKS_SECRET_KEY` | (auto-generated) | AES-256 key used to encrypt stored credentials. Set a stable value in production so credentials survive server restarts. |
| `ISRAEL_BANKS_SYNC_HOURS` | `6` | How often (in hours) the background scheduler re-syncs all connected accounts. |

### Security – credential storage

* Credentials are encrypted with **AES-256-GCM** (Python `cryptography.fernet`) before
  being written to the database.
* The encryption key is derived from `ISRAEL_BANKS_SECRET_KEY` using SHA-256.
* Plain-text credentials are **never** persisted; they exist in memory only during the
  login / sync flow.
* Set `ISRAEL_BANKS_SECRET_KEY` to a random 32+ character string and keep it secret.

### API endpoints

All endpoints require the standard FlowIQ auth headers (`Authorization: Bearer <token>`
in Supabase mode, or `X-User-Id` in development mode).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/banks/israel/supported` | List supported institutions |
| `GET` | `/api/banks/israel/connections` | List current user's connections |
| `POST` | `/api/banks/israel/connect` | Connect a bank (body: `{bank_id, username, password}`) |
| `POST` | `/api/banks/israel/disconnect` | Disconnect a bank (body: `{bank_id}`) |
| `GET` | `/api/banks/israel/accounts` | List all linked accounts with balances |
| `POST` | `/api/banks/israel/sync` | Trigger manual sync (body: `{bank_id}`) |

### Database tables required

**Supabase** – run the following SQL once:

```sql
create table if not exists bank_connections (
  id text primary key,
  user_id text not null,
  bank_id text not null,
  bank_name text,
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

1. Fetches all `status=connected` connections from the DB.
2. Decrypts credentials.
3. Calls `login → fetch_accounts → fetch_transactions` (incremental, since `last_synced_at`).
4. Normalises and upserts transactions (de-duplicated by `external_id`).
5. Handles transient errors with exponential back-off (up to 5 retries).

### Production notes

To integrate a real bank you would:

1. Create a new file `backend/integrations/israel_banks/connectors/my_bank.py`
   that extends `BankConnector`.
2. Implement `login`, `logout`, `fetch_accounts`, `fetch_transactions` using
   an HTTP client (e.g. `httpx`, Playwright) against the bank's web portal.
3. Register the class in `_BANK_CONNECTORS` in `server.py` and add metadata to
   `SUPPORTED_BANKS` in `connector.py`.

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
