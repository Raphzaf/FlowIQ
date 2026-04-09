"""
Bank Hapoalim demo connector.

This is a *demonstration* connector that returns mock data.
It does NOT connect to real Bank Hapoalim systems.
In a production integration you would use a real HTTP client
(Playwright, requests, etc.) authenticated against the bank's portal.
"""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Dict, List

from ..connector import BankAccount, BankConnector, BankSession, RawTransaction


class HapoalimConnector(BankConnector):
    bank_id = "hapoalim"

    def login(self, credentials: Dict[str, str]) -> BankSession:
        self._log("Authenticating (demo mode)")
        if not credentials.get("username") or not credentials.get("password"):
            raise ValueError("username and password are required")

        # In a real implementation we would POST to the bank login endpoint.
        expires_at = (
            datetime.now(timezone.utc) + timedelta(hours=6)
        ).isoformat()

        return BankSession(
            bank_id=self.bank_id,
            user_id=credentials["username"],
            session_data={"token": f"demo-hapoalim-{uuid.uuid4().hex[:16]}"},
            expires_at=expires_at,
        )

    def logout(self, session: BankSession) -> None:
        self._log(f"Logging out session for {session.user_id}")

    def fetch_accounts(self, session: BankSession) -> List[BankAccount]:
        self._log("Fetching accounts (demo mode)")
        return [
            BankAccount(
                account_id=f"{self.bank_id}-001",
                account_number="12-345-678901",
                bank_id=self.bank_id,
                balance=12_450.75,
                currency="ILS",
                name="עו\"ש ראשי",
            ),
            BankAccount(
                account_id=f"{self.bank_id}-002",
                account_number="12-345-678902",
                bank_id=self.bank_id,
                balance=3_200.00,
                currency="ILS",
                name="חיסכון",
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

        # Generate deterministic demo transactions within the requested range
        transactions: List[RawTransaction] = []
        current = from_date
        idx = 0
        demo_rows = [
            (-250.00, "שופרסל ביג", "Food & Dining"),
            (-45.50, "קפה ג'ו", "Food & Dining"),
            (-320.00, "סונול דלק", "Transport"),
            (-9.99, "Netflix", "Subscriptions"),
            (8_500.00, "משכורת חודשית", "Income"),
            (-1_800.00, "שכר דירה", "Bills & Utilities"),
            (-120.00, "חשמל", "Bills & Utilities"),
            (-55.00, "פלאפון", "Bills & Utilities"),
            (-180.00, "אמזון", "Shopping"),
            (-35.00, "קולנוע סינמה סיטי", "Entertainment"),
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
