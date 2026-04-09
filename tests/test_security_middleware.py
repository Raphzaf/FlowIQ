"""
Unit tests for the backend security middleware:
  - middleware/cron_auth.py
  - middleware/rate_limit.py
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
import time
import unittest
from unittest.mock import MagicMock, patch

from fastapi import HTTPException


# ---------------------------------------------------------------------------
# cron_auth tests
# ---------------------------------------------------------------------------

class TestVerifyCronSecret(unittest.TestCase):
    def _call(self, env: dict, header: str | None):
        with patch.dict(os.environ, env, clear=False):
            # Remove keys not in env to avoid bleed-through from real env
            for k in ("ENV", "NODE_ENV", "APP_ENV", "CRON_SECRET"):
                if k not in env:
                    os.environ.pop(k, None)
            from middleware import cron_auth
            # Reload to pick up env changes at module level
            import importlib
            importlib.reload(cron_auth)
            cron_auth.verify_cron_secret(header)

    def test_dev_no_secret_permissive(self):
        """Dev mode without CRON_SECRET: no error."""
        self._call({}, None)

    def test_dev_with_secret_correct_header(self):
        """Dev mode with CRON_SECRET: correct header passes."""
        self._call({"CRON_SECRET": "mysecret"}, "mysecret")

    def test_dev_with_secret_wrong_header(self):
        """Dev mode with CRON_SECRET: wrong header raises 401."""
        with self.assertRaises(HTTPException) as ctx:
            self._call({"CRON_SECRET": "mysecret"}, "wrong")
        self.assertEqual(ctx.exception.status_code, 401)

    def test_prod_no_secret_raises_500(self):
        """Production without CRON_SECRET: raises 500."""
        with self.assertRaises(HTTPException) as ctx:
            self._call({"ENV": "production"}, None)
        self.assertEqual(ctx.exception.status_code, 500)

    def test_prod_with_secret_correct_header(self):
        """Production with CRON_SECRET: correct header passes."""
        self._call({"ENV": "production", "CRON_SECRET": "s3cr3t"}, "s3cr3t")

    def test_prod_with_secret_missing_header(self):
        """Production with CRON_SECRET: missing header raises 401."""
        with self.assertRaises(HTTPException) as ctx:
            self._call({"NODE_ENV": "production", "CRON_SECRET": "s3cr3t"}, None)
        self.assertEqual(ctx.exception.status_code, 401)

    def test_prod_with_secret_wrong_header(self):
        """Production with CRON_SECRET: wrong header raises 401."""
        with self.assertRaises(HTTPException) as ctx:
            self._call({"APP_ENV": "production", "CRON_SECRET": "s3cr3t"}, "bad")
        self.assertEqual(ctx.exception.status_code, 401)


# ---------------------------------------------------------------------------
# rate_limit tests
# ---------------------------------------------------------------------------

from middleware.rate_limit import _match_rule, _counters, RateLimitMiddleware


class TestMatchRule(unittest.TestCase):
    def test_sync_all(self):
        rule = _match_rule("/api/banks/sync-all")
        self.assertIsNotNone(rule)
        path, max_req, window = rule
        self.assertEqual(max_req, 2)
        self.assertEqual(window, 60)

    def test_upload_csv(self):
        rule = _match_rule("/api/upload-csv")
        self.assertIsNotNone(rule)
        _, max_req, window = rule
        self.assertEqual(max_req, 10)
        self.assertEqual(window, 300)

    def test_bank_connect(self):
        rule = _match_rule("/api/banks/israel/connect")
        self.assertIsNotNone(rule)
        _, max_req, window = rule
        self.assertEqual(max_req, 5)
        self.assertEqual(window, 60)

    def test_unmatched(self):
        self.assertIsNone(_match_rule("/api/transactions"))
        self.assertIsNone(_match_rule("/api/profile"))


class TestRateLimitMiddleware(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        _counters.clear()

    def _make_request(self, path: str, ip: str = "1.2.3.4"):
        req = MagicMock()
        req.url.path = path
        req.headers = {}
        req.client = MagicMock()
        req.client.host = ip
        return req

    async def _call_middleware(self, path: str, ip: str = "1.2.3.4"):
        middleware = RateLimitMiddleware(app=MagicMock())

        responses = []
        async def call_next(request):
            ok = MagicMock()
            ok.status_code = 200
            return ok

        req = self._make_request(path, ip)
        return await middleware.dispatch(req, call_next)

    async def test_under_limit_passes(self):
        for _ in range(2):
            resp = await self._call_middleware("/api/banks/sync-all")
            self.assertEqual(resp.status_code, 200)

    async def test_over_limit_rejected(self):
        for _ in range(2):
            await self._call_middleware("/api/banks/sync-all")
        resp = await self._call_middleware("/api/banks/sync-all")
        self.assertEqual(resp.status_code, 429)
        self.assertIn("Retry-After", resp.headers)

    async def test_different_ips_independent(self):
        for _ in range(2):
            await self._call_middleware("/api/banks/sync-all", ip="1.1.1.1")
        # Different IP should still pass
        resp = await self._call_middleware("/api/banks/sync-all", ip="2.2.2.2")
        self.assertEqual(resp.status_code, 200)

    async def test_unmatched_path_not_rate_limited(self):
        for _ in range(20):
            resp = await self._call_middleware("/api/transactions")
            self.assertEqual(resp.status_code, 200)


if __name__ == "__main__":
    unittest.main()
