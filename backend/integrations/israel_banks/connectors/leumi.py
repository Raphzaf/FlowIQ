"""
Bank Leumi demo connector.

This is a *demonstration* connector that returns mock data.
It does NOT connect to real Bank Leumi systems.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

from ..connector import BankAccount, BankConnector, BankSession, RawTransaction


class LeumiConnector(BankConnector):
    bank_id = "leumi"

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
            session_data={"token": f"demo-leumi-{uuid.uuid4().hex[:16]}"},
            expires_at=expires_at,
        )

    def logout(self, session: BankSession) -> None:
        self._log(f"Logging out session for {session.user_id}")

    def fetch_accounts(self, session: BankSession) -> List[BankAccount]:
        self._log("Fetching accounts (demo mode)")
        return [
            BankAccount(
                account_id=f"{self.bank_id}-001",
                account_number="10-800-123456",
                bank_id=self.bank_id,
                balance=7_850.30,
                currency="ILS",
                name="חשבון עו\"ש",
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
            (-180.00, "רמי לוי מחסני השוק", "Food & Dining"),
            (-25.00, "קפה ארומה", "Food & Dining"),
            (-290.00, "דור אלון דלק", "Transport"),
            (-14.99, "Spotify Premium", "Subscriptions"),
            (9_200.00, "משכורת", "Income"),
            (-2_100.00, "שכר דירה", "Bills & Utilities"),
            (-95.00, "חברת חשמל", "Bills & Utilities"),
            (-200.00, "זארה", "Shopping"),
            (-80.00, "מכבי שירותי בריאות", "Health"),
            (-50.00, "HOT מובייל", "Bills & Utilities"),
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
