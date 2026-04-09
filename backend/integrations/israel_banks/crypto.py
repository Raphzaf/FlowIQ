"""
Credential encryption helpers.

Credentials are encrypted with AES-256-GCM (Fernet from the cryptography
library) before being stored in the database.  The key is derived from the
ISRAEL_BANKS_SECRET_KEY environment variable.

In **production** (ENV/APP_ENV/NODE_ENV == "production") the key is mandatory:
the server will refuse to start if it is absent, to prevent in-memory key
generation that would silently invalidate all stored credentials on restart.

Never store the secret key in source control.
"""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import os
from typing import Dict

from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)

_KEY_ENV = "ISRAEL_BANKS_SECRET_KEY"

_fernet: Fernet | None = None


def _is_production() -> bool:
    return any(
        os.environ.get(v, "").strip().lower() == "production"
        for v in ("ENV", "APP_ENV", "NODE_ENV")
    )


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    raw_key = os.environ.get(_KEY_ENV, "")
    if not raw_key:
        if _is_production():
            raise RuntimeError(
                f"{_KEY_ENV} is not set. "
                "This variable is required in production to avoid losing encrypted "
                "bank credentials on server restart. "
                "Set it to a long random string (e.g. `openssl rand -base64 32`)."
            )
        logger.warning(
            "%s is not set. Generating an in-process key. "
            "Credentials will not survive server restarts. "
            "Set %s in production.",
            _KEY_ENV,
            _KEY_ENV,
        )
        raw_key = base64.urlsafe_b64encode(os.urandom(32)).decode()

    # Derive a 32-byte key from whatever string was provided, then base64-encode
    # it to produce a valid Fernet key.
    derived = hashlib.sha256(raw_key.encode()).digest()
    fernet_key = base64.urlsafe_b64encode(derived)
    _fernet = Fernet(fernet_key)
    return _fernet


def encrypt_credentials(credentials: Dict[str, str]) -> str:
    """Encrypt a credentials dict and return a base64-safe string."""
    plaintext = json.dumps(credentials).encode()
    token = _get_fernet().encrypt(plaintext)
    return token.decode()


def decrypt_credentials(token: str) -> Dict[str, str]:
    """Decrypt a previously encrypted credentials string."""
    plaintext = _get_fernet().decrypt(token.encode())
    return json.loads(plaintext.decode())
