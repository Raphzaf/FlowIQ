"""In-memory fixed-window rate limiting middleware for FastAPI/Starlette."""

import time
from collections import defaultdict
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import re


# Rule: (path_pattern, max_requests, window_seconds)
_RULES = [
    (re.compile(r"^/api/banks/[^/]+/connect$"), 5, 60),    # connect: 5/min
    (re.compile(r"^/api/upload-csv$"), 10, 300),            # upload-csv: 10/5min
    (re.compile(r"^/api/banks/sync-all$"), 2, 60),          # sync-all: 2/min
]

_MAX_WINDOW = max(w for _, _, w in _RULES)

# {(ip, rule_index): [window_start, count]}
_windows: dict = defaultdict(lambda: [0.0, 0])


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def _evict_expired(now: float) -> None:
    expired = [k for k, v in _windows.items() if now - v[0] >= _MAX_WINDOW]
    for k in expired:
        del _windows[k]


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        ip = _get_client_ip(request)
        now = time.time()

        _evict_expired(now)

        for idx, (pattern, max_req, window_sec) in enumerate(_RULES):
            if not pattern.match(path):
                continue

            key = (ip, idx)
            window_start, count = _windows[key]

            if now - window_start >= window_sec:
                _windows[key] = [now, 1]
            else:
                if count >= max_req:
                    retry_after = int(window_sec - (now - window_start)) + 1
                    return Response(
                        content="Too Many Requests",
                        status_code=429,
                        headers={"Retry-After": str(retry_after)},
                    )
                _windows[key][1] += 1
            break

        return await call_next(request)
