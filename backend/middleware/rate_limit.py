"""
Fixed-window rate limiting middleware.

Uses Upstash Redis when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
are set; falls back to an in-memory dict silently when either variable is absent
or when the Upstash packages are not installed.

Key: client IP + rule name.
Response on limit exceeded: 429 Too Many Requests + Retry-After header.

Rules applied:
  /api/banks/*/connect  →  5 req / 60 s / IP
  /api/upload-csv       → 10 req / 300 s / IP
  /api/banks/sync-all   →  2 req / 60 s / IP
"""
import os
import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# (rule_name, max_requests, window_seconds)
_RULES: list[tuple[str, int, int]] = [
    ("/api/banks/sync-all", 2, 60),
    ("/api/upload-csv", 10, 300),
    ("/api/banks/", 5, 60),        # matches any /api/banks/<id>/connect
]

# {(ip, rule_path): [window_start, count]}
_counters: dict[tuple[str, str], list] = defaultdict(lambda: [0.0, 0])

# ---------------------------------------------------------------------------
# Upstash Redis setup (optional — graceful fallback when env vars are absent)
# ---------------------------------------------------------------------------
_upstash_limiters: dict[str, object] = {}

def _init_upstash() -> bool:
    """Try to initialise one Ratelimit instance per rule. Returns True on success."""
    url = os.environ.get("UPSTASH_REDIS_REST_URL", "")
    token = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
    if not url or not token:
        return False
    try:
        from upstash_redis import Redis
        from upstash_ratelimit import Ratelimit, FixedWindow

        redis = Redis(url=url, token=token)
        _upstash_limiters["/api/banks/sync-all"] = Ratelimit(
            redis=redis,
            limiter=FixedWindow(max_requests=2, window=60),
            prefix="rl:sync-all",
        )
        _upstash_limiters["/api/upload-csv"] = Ratelimit(
            redis=redis,
            limiter=FixedWindow(max_requests=10, window=300),
            prefix="rl:upload-csv",
        )
        _upstash_limiters["/api/banks/"] = Ratelimit(
            redis=redis,
            limiter=FixedWindow(max_requests=5, window=60),
            prefix="rl:banks-connect",
        )
        return True
    except Exception:
        _upstash_limiters.clear()
        return False

_use_upstash: bool = _init_upstash()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _match_rule(path: str) -> tuple[str, int, int] | None:
    """Return the first matching rule or None."""
    # Exact matches first
    for rule_path, max_req, window in _RULES:
        if path == rule_path:
            return rule_path, max_req, window

    # Connect sub-path: /api/banks/<anything>/connect
    if path.startswith("/api/banks/") and path.endswith("/connect"):
        return _RULES[2]  # 5 req / 60 s

    return None


# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------

class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rule = _match_rule(request.url.path)
        if rule is None:
            return await call_next(request)

        rule_path, max_req, window = rule
        ip = _client_ip(request)

        if _use_upstash:
            try:
                limiter = _upstash_limiters[rule_path]
                result = limiter.limit(f"{ip}:{rule_path}")
                if not result.allowed:
                    return Response(
                        content='{"detail":"Too Many Requests"}',
                        status_code=429,
                        media_type="application/json",
                        headers={"Retry-After": str(window)},
                    )
                return await call_next(request)
            except Exception:
                pass  # Fall through to in-memory logic on any Upstash error

        # In-memory fallback
        key = (ip, rule_path)
        now = time.monotonic()
        state = _counters[key]

        if now - state[0] >= window:
            state[0] = now
            state[1] = 0

        if state[1] >= max_req:
            retry_after = int(window - (now - state[0])) + 1
            return Response(
                content='{"detail":"Too Many Requests"}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(retry_after)},
            )

        state[1] += 1
        return await call_next(request)
