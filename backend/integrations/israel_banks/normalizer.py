"""
Transaction normalisation helpers.

Converts RawTransaction objects (from bank connectors) into FlowIQ's
internal transaction format.
"""

from __future__ import annotations

import uuid
from typing import Any, Dict, Optional

from .connector import BankAccount, RawTransaction

# ---------------------------------------------------------------------------
# Category mapping (best-effort, Hebrew + English keywords)
# ---------------------------------------------------------------------------

_KEYWORD_TO_CATEGORY: Dict[str, str] = {
    # Food
    "מסעדה": "Food & Dining",
    "קפה": "Food & Dining",
    "סופר": "Food & Dining",
    "שופרסל": "Food & Dining",
    "רמי לוי": "Food & Dining",
    "מקדונלד": "Food & Dining",
    "burger": "Food & Dining",
    "restaurant": "Food & Dining",
    "cafe": "Food & Dining",
    "pizza": "Food & Dining",
    # Transport
    "דלק": "Transport",
    "תחבורה": "Transport",
    "רכבת": "Transport",
    "אגד": "Transport",
    "מונית": "Transport",
    "uber": "Transport",
    "waze": "Transport",
    "fuel": "Transport",
    "parking": "Transport",
    "חניה": "Transport",
    # Utilities / Bills
    "חשמל": "Bills & Utilities",
    "מים": "Bills & Utilities",
    "ארנונה": "Bills & Utilities",
    "גז": "Bills & Utilities",
    "בזק": "Bills & Utilities",
    "הוט": "Bills & Utilities",
    "yes ": "Bills & Utilities",
    "cellcom": "Bills & Utilities",
    "orange": "Bills & Utilities",
    "partner": "Bills & Utilities",
    # Shopping
    "אמזון": "Shopping",
    "amazon": "Shopping",
    "ikea": "Shopping",
    "h&m": "Shopping",
    "zara": "Shopping",
    "ksp": "Shopping",
    # Subscriptions
    "netflix": "Subscriptions",
    "spotify": "Subscriptions",
    "apple": "Subscriptions",
    "google": "Subscriptions",
    "microsoft": "Subscriptions",
    "adobe": "Subscriptions",
    # Health
    "אופטיקה": "Health",
    "רופא": "Health",
    "מכבי": "Health",
    "כללית": "Health",
    "ביטוח": "Health",
    "pharmacy": "Health",
    "בית מרקחת": "Health",
    # Entertainment
    "קולנוע": "Entertainment",
    "הצגה": "Entertainment",
    "steam": "Entertainment",
    "playstation": "Entertainment",
    # Travel
    "airbnb": "Travel",
    "booking": "Travel",
    "אל על": "Travel",
    "el al": "Travel",
    "airport": "Travel",
    "hotel": "Travel",
    # Income
    "משכורת": "Income",
    "salary": "Income",
    "העברה": "Income",
    "זיכוי": "Income",
}


def _guess_category(description: str, provided: Optional[str]) -> str:
    if provided:
        return provided
    desc_lower = description.lower()
    for keyword, category in _KEYWORD_TO_CATEGORY.items():
        if keyword.lower() in desc_lower:
            return category
    return "Uncategorized"


# ---------------------------------------------------------------------------
# Public helpers
# ---------------------------------------------------------------------------


def normalize_transaction(
    raw: RawTransaction,
    user_id: str,
    source_label: str = "Israel Bank",
) -> Dict[str, Any]:
    """
    Convert a RawTransaction to FlowIQ's internal transaction document.

    FlowIQ stores amounts as *positive* floats and uses a ``type`` field
    (``"income"`` / ``"expense"``) to distinguish credits from debits.
    """
    amount = raw.amount
    tx_type = "income" if amount >= 0 else "expense"
    abs_amount = round(abs(amount), 2)

    category = _guess_category(raw.description, raw.category)

    return {
        "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"{raw.account_id}:{raw.external_id}")),
        "date": raw.date,
        "amount": abs_amount,
        "category": category,
        "merchant": raw.description[:100],
        "type": tx_type,
        "user_id": user_id,
        "source": source_label,
        "currency": raw.currency,
        "external_id": raw.external_id,
    }


def normalize_account(account: BankAccount) -> Dict[str, Any]:
    """Convert a BankAccount to a serialisable dict."""
    return {
        "account_id": account.account_id,
        "account_number": account.account_number,
        "bank_id": account.bank_id,
        "balance": round(account.balance, 2),
        "currency": account.currency,
        "name": account.name or account.account_number,
    }
