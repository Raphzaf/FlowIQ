"""
Bank Discount demo connector.

This is a *demonstration* connector that returns mock data.
It does NOT connect to real Bank Discount systems.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

from ..connector import BankAccount, BankConnector, BankSession, RawTransaction


class DiscountConnector(BankConnector):
    bank_id = "discount"

    def login(self, credentials: Dict[str, str]) -> BankSession:
        self._log("Authenticating (demo mode)")
        if not credentials.get("username") or not credentials.get("password"):
            raise ValueError("username and password are required")

        expires_at = (
            datetime.now(timezone.utc) + timedelta(hours=6)
        ).isoformat()

        return BankSession(
            bank_id=self.bank_id,
            user_id=credentials["username"],
            session_data={"token": f"demo-discount-{uuid.uuid4().hex[:16]}"},
            expires_at=expires_at,
        )

    def logout(self, session: BankSession) -> None:
        self._log(f"Logging out session for {session.user_id}")

    def fetch_accounts(self, session: BankSession) -> List[BankAccount]:
        self._log("Fetching accounts (demo mode)")
        return [
            BankAccount(
                account_id=f"{self.bank_id}-001",
                account_number="11-222-333444",
                bank_id=self.bank_id,
                balance=5_340.10,
                currency="ILS",
                name="עו\"ש",
            ),
            BankAccount(
                account_id=f"{self.bank_id}-002",
                account_number="11-222-333445",
                bank_id=self.bank_id,
                balance=10_000.00,
                currency="ILS",
                name="פיקדון",
            ),
        ]

    def fetch_transactions(
        self,
        session: BankSession,
        account_id: str,
        from_date: date,
        to_date: date,
    ) -> List[RawTransaction]:
        self._log(
            f"Fetching transactions for {account_id} "
            f"from {from_date} to {to_date} (demo mode)"
        )

        transactions: List[RawTransaction] = []
        current = from_date
        idx = 0
        demo_rows = [
            (-145.00, "יינות ביתן", "Food & Dining"),
            (-30.00, "גלידה וכיף", "Food & Dining"),
            (-195.00, "פז דלק", "Transport"),
            (-12.99, "Apple Music", "Subscriptions"),
            (7_800.00, "שכר עבודה", "Income"),
            (-1_600.00, "שכירות", "Bills & Utilities"),
            (-110.00, "חשמל ומים", "Bills & Utilities"),
            (-240.00, "IKEA", "Shopping"),
            (-70.00, "כללית מושלם", "Health"),
            (-45.00, "פארק שעשועים", "Entertainment"),
        ]
        while current <= to_date:
            row = demo_rows[idx % len(demo_rows)]
            transactions.append(
                RawTransaction(
                    external_id=f"{account_id}-{current.isoformat()}-{idx}",
                    date=current.isoformat(),
                    description=row[1],
                    amount=row[0],
                    currency="ILS",
                    category=row[2],
                    account_id=account_id,
                )
            )
            current += timedelta(days=3)
            idx += 1

        return transactions
