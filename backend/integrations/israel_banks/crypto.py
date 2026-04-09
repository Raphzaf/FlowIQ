"""
Credential encryption helpers.

Credentials are encrypted with AES-256-GCM (Fernet from the cryptography
library) before being stored in the database.  The key is derived from the
ISRAEL_BANKS_SECRET_KEY environment variable (or a generated fallback for
development).

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


def _get_fernet() -> Fernet:
    global _fernet
    if _fernet is not None:
        return _fernet

    raw_key = os.environ.get(_KEY_ENV, "")
    if not raw_key:
        logger.warning(
            "%s is not set. Generating an in-process key. "
            "Credentials will not survive server restarts.",
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
