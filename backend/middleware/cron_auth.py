"""
Cron authentication helper for /api/banks/sync-all.

Production detection: ENV, NODE_ENV or APP_ENV set to "production".
- prod + CRON_SECRET absent  → 500 (endpoint refuses to run)
- prod + CRON_SECRET present → X-Cron-Secret header required, compared via secrets.compare_digest
- dev  + CRON_SECRET absent  → permissive (no check)
"""
import hmac
import os
from fastapi import HTTPException


def _is_production() -> bool:
    for var in ("ENV", "NODE_ENV", "APP_ENV"):
        if os.environ.get(var, "").strip().lower() == "production":
            return True
    return False


def verify_cron_secret(x_cron_secret: str | None) -> None:
    """Raise HTTPException if the cron secret check fails."""
    expected = os.environ.get("CRON_SECRET", "").strip()
    prod = _is_production()

    if not expected:
        if prod:
            raise HTTPException(
                status_code=500,
                detail="CRON_SECRET must be set in production",
            )
        # dev/staging without secret: permissive
        return

    if x_cron_secret is None:
        raise HTTPException(status_code=401, detail="Invalid or missing X-Cron-Secret")
    if not hmac.compare_digest(expected.encode(), x_cron_secret.encode()):
        raise HTTPException(status_code=401, detail="Invalid or missing X-Cron-Secret")
