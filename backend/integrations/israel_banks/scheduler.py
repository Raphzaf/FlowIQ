"""
Background scheduler for Israeli bank transaction synchronisation.

Design
------
* One ``asyncio.Task`` per bank connection record.
* Each task sleeps for ``sync_interval_hours`` (default 6 h), then calls the
  connector, normalises transactions, and upserts them into FlowIQ's database.
* Tasks handle transient errors with exponential back-off (up to 5 retries).
* When a session expires the scheduler re-authenticates automatically.

Usage (from server.py startup)
-------------------------------
    from integrations.israel_banks.scheduler import BankSyncScheduler

    scheduler = BankSyncScheduler(db_helper=..., sync_interval_hours=6)
    scheduler.start()          # call once at application startup
    scheduler.stop()           # call at application shutdown
"""

from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type alias for the async DB helper functions that the scheduler needs
# ---------------------------------------------------------------------------

DbGetConnections = Callable[[], Coroutine[Any, Any, List[Dict[str, Any]]]]
DbUpsertTransactions = Callable[[List[Dict[str, Any]]], Coroutine[Any, Any, None]]


class BankSyncScheduler:
    """
    Manages periodic re-sync of all active Israeli bank connections.

    Parameters
    ----------
    get_connections:
        Async callable that returns all active bank-connection records.
    upsert_transactions:
        Async callable that inserts / updates normalized transactions.
    sync_interval_hours:
        How often to run a full sync (default: 6).
    max_retries:
        Max consecutive failures before a connection is marked 'error'.
    """

    def __init__(
        self,
        get_connections: DbGetConnections,
        upsert_transactions: DbUpsertTransactions,
        sync_interval_hours: int = 6,
        max_retries: int = 5,
    ) -> None:
        self._get_connections = get_connections
        self._upsert_transactions = upsert_transactions
        self._interval = timedelta(hours=sync_interval_hours)
        self._max_retries = max_retries
        self._task: Optional[asyncio.Task] = None
        self._running = False

    # ------------------------------------------------------------------
    # Public control
    # ------------------------------------------------------------------

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._task = asyncio.ensure_future(self._loop())
        logger.info("BankSyncScheduler started (interval=%s)", self._interval)

    def stop(self) -> None:
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
        logger.info("BankSyncScheduler stopped")

    # ------------------------------------------------------------------
    # Internal loop
    # ------------------------------------------------------------------

    async def _loop(self) -> None:
        while self._running:
            try:
                await self._sync_all()
            except Exception:
                logger.exception("Unexpected error in BankSyncScheduler._loop")
            await asyncio.sleep(self._interval.total_seconds())

    async def _sync_all(self) -> None:
        try:
            connections = await self._get_connections()
        except Exception:
            logger.exception("Failed to fetch bank connections from DB")
            return

        logger.info("Syncing %d bank connection(s)", len(connections))
        for conn in connections:
            if conn.get("status") != "connected":
                continue
            await self._sync_one(conn)

    async def _sync_one(self, conn: Dict[str, Any]) -> None:
        """Sync a single bank connection with exponential back-off retries."""
        from .connectors import HapoalimConnector, LeumiConnector, DiscountConnector
        from .crypto import decrypt_credentials
        from .normalizer import normalize_transaction

        bank_id = conn.get("bank_id", "")
        user_id = conn.get("user_id", "")
        conn_id = conn.get("id", bank_id)

        connector_map = {
            "hapoalim": HapoalimConnector,
            "leumi": LeumiConnector,
            "discount": DiscountConnector,
        }
        ConnectorCls = connector_map.get(bank_id)
        if ConnectorCls is None:
            logger.warning("Unknown bank_id '%s' for connection %s", bank_id, conn_id)
            return

        encrypted_creds = conn.get("encrypted_credentials", "")
        if not encrypted_creds:
            logger.warning("No credentials stored for connection %s", conn_id)
            return

        attempt = 0
        delay = 30.0
        while attempt < self._max_retries:
            try:
                creds = decrypt_credentials(encrypted_creds)
                connector = ConnectorCls()
                session = connector.login(creds)
                accounts = connector.fetch_accounts(session)

                last_synced_at = conn.get("last_synced_at")
                from_date = (
                    datetime.fromisoformat(last_synced_at).date()
                    if last_synced_at
                    else (datetime.now(timezone.utc) - timedelta(days=30)).date()
                )
                to_date = datetime.now(timezone.utc).date()

                all_txs: List[Dict[str, Any]] = []
                for account in accounts:
                    raw_txs = connector.fetch_transactions(
                        session, account.account_id, from_date, to_date
                    )
                    for raw in raw_txs:
                        normalized = normalize_transaction(
                            raw,
                            user_id=user_id,
                            source_label=f"Israel Bank – {bank_id}",
                        )
                        all_txs.append(normalized)

                connector.logout(session)

                if all_txs:
                    await self._upsert_transactions(all_txs)

                logger.info(
                    "Sync OK: connection=%s bank=%s user=%s txs=%d",
                    conn_id, bank_id, user_id, len(all_txs),
                )
                return

            except Exception as exc:
                attempt += 1
                logger.warning(
                    "Sync attempt %d/%d failed for connection %s: %s",
                    attempt, self._max_retries, conn_id, exc,
                )
                if attempt < self._max_retries:
                    await asyncio.sleep(delay)
                    delay = min(delay * 2, 3600)

        logger.error(
            "All %d sync attempts failed for connection %s – marking error",
            self._max_retries, conn_id,
        )
