"""Cron authentication helper for /api/banks/sync-all."""

import os
import secrets
from fastapi import HTTPException


def _is_production() -> bool:
    return os.environ.get("ENV") == "production" or \
        os.environ.get("NODE_ENV") == "production" or \
        os.environ.get("APP_ENV") == "production"


def validate_cron_secret(x_cron_secret: str | None) -> None:
    """Validate the X-Cron-Secret header.

    In production, CRON_SECRET must be set; if absent the endpoint is refused
    (misconfigured deployment). In dev, a missing CRON_SECRET is permissive.
    Raises HTTPException on failure.
    """
    expected = os.environ.get("CRON_SECRET", "")

    if not expected:
        if _is_production():
            # Refuse explicitly – misconfigured production deployment.
            raise HTTPException(
                status_code=500,
                detail="CRON_SECRET is not configured on this server",
            )
        # Dev/staging: no secret set → open access tolerated.
        return

    if not x_cron_secret or not secrets.compare_digest(x_cron_secret, expected):
        raise HTTPException(
            status_code=401,
            detail="Invalid or missing X-Cron-Secret",
        )
