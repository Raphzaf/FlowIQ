"""
Abstract BankConnector interface for Israeli bank integrations.

Inspired by eshaham/israeli-bank-scrapers (MIT licence).
No code from that project was copied; only the public API shape is referenced.
"""

from __future__ import annotations

import abc
import logging
from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Supported bank registry
# ---------------------------------------------------------------------------

SUPPORTED_BANKS: Dict[str, Dict[str, str]] = {
    "hapoalim": {
        "name": "Bank Hapoalim",
        "name_he": "בנק הפועלים",
        "logo": "https://upload.wikimedia.org/wikipedia/he/thumb/a/a8/Bank_Hapoalim_Logo.svg/200px-Bank_Hapoalim_Logo.svg.png",
        "requires_otp": False,
        "website": "https://www.bankhapoalim.co.il",
    },
    "leumi": {
        "name": "Bank Leumi",
        "name_he": "בנק לאומי",
        "logo": "https://upload.wikimedia.org/wikipedia/he/thumb/2/2e/Bank_Leumi_logo.svg/200px-Bank_Leumi_logo.svg.png",
        "requires_otp": False,
        "website": "https://www.leumi.co.il",
    },
    "discount": {
        "name": "Bank Discount",
        "name_he": "בנק דיסקונט",
        "logo": "https://upload.wikimedia.org/wikipedia/he/thumb/5/5b/Discount_Bank_Logo.svg/200px-Discount_Bank_Logo.svg.png",
        "requires_otp": False,
        "website": "https://www.discountbank.co.il",
    },
}


# ---------------------------------------------------------------------------
# Data shapes
# ---------------------------------------------------------------------------


@dataclass
class BankAccount:
    account_id: str
    account_number: str
    bank_id: str
    balance: float
    currency: str = "ILS"
    name: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class RawTransaction:
    external_id: str
    date: str                   # ISO-8601  "YYYY-MM-DD"
    description: str
    amount: float               # signed: positive = credit, negative = debit
    currency: str = "ILS"
    category: Optional[str] = None
    account_id: Optional[str] = None
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class BankSession:
    bank_id: str
    user_id: str
    session_data: Dict[str, Any] = field(default_factory=dict)
    expires_at: Optional[str] = None    # ISO-8601 or None


# ---------------------------------------------------------------------------
# Abstract connector
# ---------------------------------------------------------------------------


class BankConnector(abc.ABC):
    """
    Common interface every bank connector must implement.

    All methods that touch the network are *synchronous* in this demo
    implementation.  In a production integration they should be made async.
    """

    bank_id: str = ""

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def login(self, credentials: Dict[str, str]) -> BankSession:
        """
        Authenticate with the bank.

        Parameters
        ----------
        credentials:
            Dictionary whose keys depend on the institution, e.g.
            ``{"username": "...", "password": "..."}`` or
            ``{"id": "...", "password": "...", "otp": "..."}``.

        Returns
        -------
        BankSession
            An opaque session object that is passed to subsequent calls.
        """

    @abc.abstractmethod
    def logout(self, session: BankSession) -> None:
        """Gracefully terminate a bank session."""

    # ------------------------------------------------------------------
    # Data retrieval
    # ------------------------------------------------------------------

    @abc.abstractmethod
    def fetch_accounts(self, session: BankSession) -> List[BankAccount]:
        """Return the list of accounts associated with the session."""

    @abc.abstractmethod
    def fetch_transactions(
        self,
        session: BankSession,
        account_id: str,
        from_date: date,
        to_date: date,
    ) -> List[RawTransaction]:
        """
        Return transactions for *account_id* in the given date range.

        Amounts are *signed*: positive = money credited, negative = money debited.
        """

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _log(self, msg: str) -> None:
        logger.info("[%s] %s", self.bank_id, msg)
