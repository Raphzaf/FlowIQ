"""
Background scheduler for Israeli bank transaction synchronisation.

Design
------
* One ``asyncio.Task`` runs a periodic loop.
* Each iteration calls the FastAPI ``/api/banks/sync-all`` cron endpoint,
  which uses the Node.js scraper microservice to fetch real transactions.
* Alternatively, in environments where the cron endpoint is not reachable,
  the scheduler falls back to calling the scraper service directly via
  ``_sync_one_via_scraper``.

Usage (from server.py startup)
-------------------------------
    from integrations.israel_banks.scheduler import BankSyncScheduler

    scheduler = BankSyncScheduler(
        get_connections=db_helper_fn,
        upsert_transactions=db_upsert_fn,
        call_scraper=call_scraper_fn,
        sync_interval_hours=6,
    )
    scheduler.start()   # call once at application startup
    scheduler.stop()    # call at application shutdown
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Type aliases
# ---------------------------------------------------------------------------

DbGetConnections = Callable[[], Coroutine[Any, Any, List[Dict[str, Any]]]]
DbUpsertTransactions = Callable[[List[Dict[str, Any]]], Coroutine[Any, Any, None]]
CallScraper = Callable[[str, Dict[str, Any]], Coroutine[Any, Any, Dict[str, Any]]]


class BankSyncScheduler:
    """
    Manages periodic re-sync of all active Israeli bank connections.

    Parameters
    ----------
    get_connections:
        Async callable that returns all active bank-connection records.
    upsert_transactions:
        Async callable that inserts / updates normalized transactions.
    call_scraper:
        Async callable that POSTs to the scraper microservice.
        Signature: ``(endpoint: str, payload: dict) -> dict``
    sync_interval_hours:
        How often to run a full sync (default: 6).
    max_retries:
        Max consecutive failures before a connection is logged as error.
    """

    def __init__(
        self,
        get_connections: DbGetConnections,
        upsert_transactions: DbUpsertTransactions,
        call_scraper: Optional[CallScraper] = None,
        sync_interval_hours: int = 6,
        max_retries: int = 5,
    ) -> None:
        self._get_connections = get_connections
        self._upsert_transactions = upsert_transactions
        self._call_scraper = call_scraper
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
        if self._call_scraper is None:
            logger.warning(
                "BankSyncScheduler: call_scraper not configured – skipping background sync. "
                "Use the /api/banks/sync-all cron endpoint instead."
            )
            return

        try:
            connections = await self._get_connections()
        except Exception:
            logger.exception("Failed to fetch bank connections from DB")
            return

        # Only sync Israeli bank connections (not Woob – handled separately)
        israel_connections = [
            c for c in connections
            if c.get("status") == "connected" and c.get("connector_type") != "woob"
        ]
        logger.info("Syncing %d Israeli bank connection(s)", len(israel_connections))
        for conn in israel_connections:
            await self._sync_one(conn)

    async def _sync_one(self, conn: Dict[str, Any]) -> None:
        """Sync a single bank connection via the scraper microservice."""
        from .crypto import decrypt_credentials

        bank_id = conn.get("bank_id", "")
        user_id = conn.get("user_id", "")
        conn_id = conn.get("id", bank_id)

        encrypted_creds = conn.get("encrypted_credentials", "")
        if not encrypted_creds:
            logger.warning("No credentials stored for connection %s", conn_id)
            return

        attempt = 0
        delay = 30.0
        while attempt < self._max_retries:
            try:
                from .crypto import decrypt_credentials
                from .normalizer import normalize_scraper_transaction

                creds = decrypt_credentials(encrypted_creds)

                last_synced_at = conn.get("last_synced_at")
                from_date = (
                    datetime.fromisoformat(last_synced_at).date().isoformat()
                    if last_synced_at
                    else (datetime.now(timezone.utc) - timedelta(days=30)).date().isoformat()
                )

                scraper_result = await self._call_scraper("transactions", {
                    "company_id": bank_id,
                    "credentials": creds,
                    "start_date": from_date,
                })

                raw_accounts = scraper_result.get("accounts", [])
                all_txs: List[Dict[str, Any]] = []

                for account in raw_accounts:
                    acct_num = account.get("accountNumber", "unknown")
                    for txn in account.get("txns", []):
                        normalized = normalize_scraper_transaction(txn, acct_num, bank_id, user_id)
                        if normalized:
                            all_txs.append(normalized)

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
