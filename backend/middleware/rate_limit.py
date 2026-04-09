"""
In-memory fixed-window rate limiting middleware (no external dependencies).

Key: client IP + rule name.
Response on limit exceeded: 429 Too Many Requests + Retry-After header.

Rules applied:
  /api/banks/*/connect  →  5 req / 60 s / IP
  /api/upload-csv       → 10 req / 300 s / IP
  /api/banks/sync-all   →  2 req / 60 s / IP
"""
import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


# (max_requests, window_seconds)
_RULES: list[tuple[str, int, int]] = [
    ("/api/banks/sync-all", 2, 60),
    ("/api/upload-csv", 10, 300),
    ("/api/banks/", 5, 60),        # matches any /api/banks/<id>/connect
]

# {(ip, rule_path): [window_start, count]}
_counters: dict[tuple[str, str], list] = defaultdict(lambda: [0.0, 0])


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


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rule = _match_rule(request.url.path)
        if rule is None:
            return await call_next(request)

        rule_path, max_req, window = rule
        ip = _client_ip(request)
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
