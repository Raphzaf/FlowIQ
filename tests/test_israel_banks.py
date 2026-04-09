"""
Unit tests for the Israeli bank integration module.

These tests use only mock data and do NOT require real bank credentials
or an external database.
"""

import sys
import os

# Add the backend directory to the path so we can import the integration
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

import asyncio
import unittest
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

from integrations.israel_banks.connector import (
    BankAccount,
    BankSession,
    RawTransaction,
    SUPPORTED_BANKS,
)
from integrations.israel_banks.normalizer import (
    normalize_transaction,
    normalize_account,
    _guess_category,
)
from integrations.israel_banks.connectors.hapoalim import HapoalimConnector
from integrations.israel_banks.connectors.leumi import LeumiConnector
from integrations.israel_banks.connectors.discount import DiscountConnector
from integrations.israel_banks.crypto import encrypt_credentials, decrypt_credentials
from integrations.israel_banks.scheduler import BankSyncScheduler


# ---------------------------------------------------------------------------
# Normalizer tests
# ---------------------------------------------------------------------------


class TestNormalizeTransaction(unittest.TestCase):
    def _make_raw(self, amount, description="שופרסל", category=None, account_id="acc-1", external_id="ext-1"):
        return RawTransaction(
            external_id=external_id,
            date="2024-01-15",
            description=description,
            amount=amount,
            currency="ILS",
            category=category,
            account_id=account_id,
        )

    def test_expense_negative_amount(self):
        raw = self._make_raw(amount=-250.0)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["type"], "expense")
        self.assertAlmostEqual(result["amount"], 250.0)

    def test_income_positive_amount(self):
        raw = self._make_raw(amount=8500.0, description="משכורת")
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["type"], "income")
        self.assertAlmostEqual(result["amount"], 8500.0)

    def test_zero_amount_is_income(self):
        raw = self._make_raw(amount=0.0)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["type"], "income")
        self.assertAlmostEqual(result["amount"], 0.0)

    def test_category_provided_is_preserved(self):
        raw = self._make_raw(amount=-10.0, category="Transport")
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["category"], "Transport")

    def test_category_inferred_from_description_hebrew(self):
        raw = self._make_raw(amount=-50.0, description="קפה ג'ו", category=None)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["category"], "Food & Dining")

    def test_category_inferred_from_description_english(self):
        raw = self._make_raw(amount=-9.99, description="Netflix subscription", category=None)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["category"], "Subscriptions")

    def test_unknown_category_falls_back_to_uncategorized(self):
        raw = self._make_raw(amount=-1.0, description="XYZ unknown vendor", category=None)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["category"], "Uncategorized")

    def test_description_truncated_to_100_chars(self):
        long_desc = "A" * 200
        raw = self._make_raw(amount=-1.0, description=long_desc)
        result = normalize_transaction(raw, user_id="user-1")
        self.assertLessEqual(len(result["merchant"]), 100)

    def test_user_id_attached(self):
        raw = self._make_raw(amount=-5.0)
        result = normalize_transaction(raw, user_id="user-42")
        self.assertEqual(result["user_id"], "user-42")

    def test_external_id_present(self):
        raw = self._make_raw(amount=-5.0, external_id="unique-123")
        result = normalize_transaction(raw, user_id="user-1")
        self.assertEqual(result["external_id"], "unique-123")

    def test_stable_id_for_same_inputs(self):
        raw1 = self._make_raw(amount=-5.0, account_id="acc-99", external_id="ext-99")
        raw2 = self._make_raw(amount=-5.0, account_id="acc-99", external_id="ext-99")
        r1 = normalize_transaction(raw1, user_id="u")
        r2 = normalize_transaction(raw2, user_id="u")
        self.assertEqual(r1["id"], r2["id"])

    def test_different_ids_for_different_external_ids(self):
        raw1 = self._make_raw(amount=-5.0, account_id="acc-1", external_id="ext-A")
        raw2 = self._make_raw(amount=-5.0, account_id="acc-1", external_id="ext-B")
        r1 = normalize_transaction(raw1, user_id="u")
        r2 = normalize_transaction(raw2, user_id="u")
        self.assertNotEqual(r1["id"], r2["id"])

    def test_amount_rounded_to_2_decimals(self):
        raw = self._make_raw(amount=-123.456789)
        result = normalize_transaction(raw, user_id="u")
        self.assertEqual(result["amount"], round(123.456789, 2))


class TestNormalizeAccount(unittest.TestCase):
    def test_basic_fields(self):
        acc = BankAccount(
            account_id="hapoalim-001",
            account_number="12-345-678901",
            bank_id="hapoalim",
            balance=5000.75,
            currency="ILS",
            name="עו\"ש ראשי",
        )
        result = normalize_account(acc)
        self.assertEqual(result["account_id"], "hapoalim-001")
        self.assertEqual(result["bank_id"], "hapoalim")
        self.assertAlmostEqual(result["balance"], 5000.75)
        self.assertEqual(result["currency"], "ILS")
        self.assertEqual(result["name"], "עו\"ש ראשי")

    def test_name_falls_back_to_account_number(self):
        acc = BankAccount(
            account_id="acc-1",
            account_number="99-000-111",
            bank_id="leumi",
            balance=100.0,
            currency="ILS",
            name=None,
        )
        result = normalize_account(acc)
        self.assertEqual(result["name"], "99-000-111")

    def test_balance_rounded(self):
        acc = BankAccount(
            account_id="acc-1",
            account_number="99",
            bank_id="leumi",
            balance=1234.5678,
            currency="ILS",
        )
        result = normalize_account(acc)
        self.assertEqual(result["balance"], round(1234.5678, 2))


# ---------------------------------------------------------------------------
# SUPPORTED_BANKS registry tests
# ---------------------------------------------------------------------------


class TestSupportedBanks(unittest.TestCase):
    def test_all_expected_banks_present(self):
        for bank_id in ("hapoalim", "leumi", "discount"):
            self.assertIn(bank_id, SUPPORTED_BANKS)

    def test_each_bank_has_required_fields(self):
        required = {"name", "name_he", "requires_otp", "website"}
        for bank_id, info in SUPPORTED_BANKS.items():
            missing = required - set(info.keys())
            self.assertFalse(missing, f"{bank_id} is missing fields: {missing}")


# ---------------------------------------------------------------------------
# Demo connector tests
# ---------------------------------------------------------------------------


class TestHapoalimConnector(unittest.TestCase):
    def setUp(self):
        self.connector = HapoalimConnector()

    def test_login_returns_session(self):
        session = self.connector.login({"username": "test", "password": "secret"})
        self.assertIsInstance(session, BankSession)
        self.assertEqual(session.bank_id, "hapoalim")

    def test_login_missing_credentials_raises(self):
        with self.assertRaises(ValueError):
            self.connector.login({"username": "", "password": "x"})
        with self.assertRaises(ValueError):
            self.connector.login({"username": "x", "password": ""})

    def test_fetch_accounts(self):
        session = self.connector.login({"username": "u", "password": "p"})
        accounts = self.connector.fetch_accounts(session)
        self.assertTrue(len(accounts) >= 1)
        for acc in accounts:
            self.assertIsInstance(acc, BankAccount)

    def test_fetch_transactions(self):
        session = self.connector.login({"username": "u", "password": "p"})
        from_d = date(2024, 1, 1)
        to_d = date(2024, 1, 31)
        txs = self.connector.fetch_transactions(session, "hapoalim-001", from_d, to_d)
        self.assertTrue(len(txs) > 0)
        for tx in txs:
            self.assertIsInstance(tx, RawTransaction)
            self.assertIsNotNone(tx.external_id)
            self.assertTrue(tx.date >= "2024-01-01")
            self.assertTrue(tx.date <= "2024-01-31")

    def test_logout_does_not_raise(self):
        session = self.connector.login({"username": "u", "password": "p"})
        self.connector.logout(session)  # should not raise


class TestLeumiConnector(unittest.TestCase):
    def setUp(self):
        self.connector = LeumiConnector()

    def test_login_and_fetch(self):
        session = self.connector.login({"username": "u", "password": "p"})
        accounts = self.connector.fetch_accounts(session)
        self.assertTrue(len(accounts) >= 1)
        txs = self.connector.fetch_transactions(
            session, accounts[0].account_id, date(2024, 1, 1), date(2024, 1, 15)
        )
        self.assertTrue(len(txs) > 0)


class TestDiscountConnector(unittest.TestCase):
    def setUp(self):
        self.connector = DiscountConnector()

    def test_login_and_fetch(self):
        session = self.connector.login({"username": "u", "password": "p"})
        accounts = self.connector.fetch_accounts(session)
        self.assertTrue(len(accounts) >= 1)
        txs = self.connector.fetch_transactions(
            session, accounts[0].account_id, date(2024, 2, 1), date(2024, 2, 28)
        )
        self.assertTrue(len(txs) > 0)


# ---------------------------------------------------------------------------
# Crypto tests
# ---------------------------------------------------------------------------


class TestCrypto(unittest.TestCase):
    def test_encrypt_decrypt_roundtrip(self):
        creds = {"username": "alice", "password": "s3cr3t!"}
        token = encrypt_credentials(creds)
        self.assertIsInstance(token, str)
        recovered = decrypt_credentials(token)
        self.assertEqual(recovered, creds)

    def test_encrypted_value_differs_each_call(self):
        creds = {"username": "alice", "password": "pw"}
        t1 = encrypt_credentials(creds)
        t2 = encrypt_credentials(creds)
        # Fernet adds a nonce so ciphertexts differ
        self.assertNotEqual(t1, t2)

    def test_tampered_token_raises(self):
        token = encrypt_credentials({"username": "x", "password": "y"})
        tampered = token[:-4] + "XXXX"
        with self.assertRaises(Exception):
            decrypt_credentials(tampered)


# ---------------------------------------------------------------------------
# Scheduler tests
# ---------------------------------------------------------------------------


class TestBankSyncScheduler(unittest.IsolatedAsyncioTestCase):
    async def test_sync_all_skips_non_connected(self):
        get_conn = AsyncMock(return_value=[
            {"id": "c1", "bank_id": "hapoalim", "user_id": "u1", "status": "error", "encrypted_credentials": "x"},
        ])
        upsert = AsyncMock()

        scheduler = BankSyncScheduler(
            get_connections=get_conn,
            upsert_transactions=upsert,
        )
        await scheduler._sync_all()
        upsert.assert_not_called()

    async def test_sync_all_calls_upsert_for_connected(self):
        from integrations.israel_banks.crypto import encrypt_credentials

        creds_token = encrypt_credentials({"username": "u", "password": "p"})
        conn = {
            "id": "c1",
            "bank_id": "hapoalim",
            "user_id": "user-1",
            "status": "connected",
            "encrypted_credentials": creds_token,
            "last_synced_at": None,
        }
        get_conn = AsyncMock(return_value=[conn])
        upsert = AsyncMock()

        scheduler = BankSyncScheduler(
            get_connections=get_conn,
            upsert_transactions=upsert,
        )
        await scheduler._sync_all()
        upsert.assert_called_once()
        # Transactions passed to upsert should all belong to "user-1"
        txs = upsert.call_args[0][0]
        self.assertTrue(len(txs) > 0)
        for tx in txs:
            self.assertEqual(tx["user_id"], "user-1")

    async def test_sync_skips_unknown_bank(self):
        conn = {
            "id": "c2",
            "bank_id": "unknown_bank",
            "user_id": "u",
            "status": "connected",
            "encrypted_credentials": "some_token",
        }
        get_conn = AsyncMock(return_value=[conn])
        upsert = AsyncMock()

        scheduler = BankSyncScheduler(get_connections=get_conn, upsert_transactions=upsert)
        await scheduler._sync_all()
        upsert.assert_not_called()

    def test_start_stop(self):
        scheduler = BankSyncScheduler(
            get_connections=AsyncMock(return_value=[]),
            upsert_transactions=AsyncMock(),
            sync_interval_hours=99,
        )
        loop = asyncio.new_event_loop()
        try:
            loop.run_until_complete(asyncio.sleep(0))
            scheduler._task = loop.create_task(asyncio.sleep(9999))
            scheduler._running = True
            scheduler.stop()
            self.assertFalse(scheduler._running)
        finally:
            loop.close()


if __name__ == "__main__":
    unittest.main()
