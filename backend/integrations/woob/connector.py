"""
Woob bank connector implementing FlowIQ's BankConnector interface.

Each ``WoobBankConnector`` instance wraps a single Woob backend (bank module)
and exposes the standard ``login / logout / fetch_accounts / fetch_transactions``
interface required by the rest of the application.

Design notes
------------
* The connector is **synchronous** to match the existing ``BankConnector`` ABC.
  FastAPI handlers that call it must use ``asyncio.to_thread()`` to avoid
  blocking the event loop (see the server endpoints).
* Woob ``Woob()`` objects are created lazily and bound to the connector
  instance.  They are **not** shared across instances to avoid thread-safety
  issues.
* Re-authentication happens on every sync call (stateless, compatible with
  serverless / ephemeral deployments).
* ``WOOB_DATA_DIR`` (default ``/tmp/woob``) is used for woob's module cache.
  Vercel and similar platforms provide writable ``/tmp`` space.
"""

from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ..israel_banks.connector import (
    BankAccount,
    BankConnector,
    BankSession,
    RawTransaction,
)

logger = logging.getLogger(__name__)

_WOOB_DATA_DIR = os.environ.get("WOOB_DATA_DIR", "/tmp/woob")


class WoobBankConnector(BankConnector):
    """
    Connects FlowIQ to any bank supported by Woob's CapBank capability.

    Example::

        connector = WoobBankConnector("boursorama")
        session   = connector.login({"login": "me@example.com", "password": "s3cr3t"})
        accounts  = connector.fetch_accounts(session)
        txs       = connector.fetch_transactions(
                        session, accounts[0].account_id, from_date, to_date)
        connector.logout(session)
    """

    def __init__(self, bank_id: str) -> None:
        self.bank_id = bank_id
        self._woob: Any = None
        self._backend: Any = None

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_woob(self) -> Any:
        """Return (and lazily create) the Woob instance."""
        if self._woob is None:
            try:
                from woob.core import Woob  # noqa: PLC0415
            except ImportError as exc:
                raise RuntimeError(
                    "Woob is not installed. Add 'woob' to requirements.txt and "
                    "run 'pip install -r requirements.txt'."
                ) from exc

            os.makedirs(_WOOB_DATA_DIR, exist_ok=True)
            self._woob = Woob(workdir=_WOOB_DATA_DIR, datadir=_WOOB_DATA_DIR)

        return self._woob

    @property
    def _backend_name(self) -> str:
        return f"flowiq_{self.bank_id}"

    def _unload_backend(self) -> None:
        """Remove backend from Woob instance if loaded."""
        try:
            w = self._get_woob()
            if self._backend_name in getattr(w, "backends", {}):
                w.unload_backend(self._backend_name)
        except Exception:
            pass
        self._backend = None

    # ------------------------------------------------------------------
    # BankConnector ABC
    # ------------------------------------------------------------------

    def login(self, credentials: Dict[str, str]) -> BankSession:
        """
        Authenticate with the bank via the corresponding Woob module.

        Parameters
        ----------
        credentials:
            ``{"login": "...", "password": "..."}`` — Woob uses ``login``; the
            frontend also accepts ``username`` and we normalise it here.
        """
        self._log(f"Authenticating via Woob module '{self.bank_id}'")

        # Normalise: FlowIQ UI may send "username"; Woob expects "login".
        params: Dict[str, str] = dict(credentials)
        if "username" in params and "login" not in params:
            params["login"] = params.pop("username")

        if not params.get("login"):
            raise ValueError("'login' / 'username' credential is required")
        if not params.get("password"):
            raise ValueError("'password' credential is required")

        w = self._get_woob()
        self._unload_backend()  # ensure clean state

        # Load the Woob backend (module).
        try:
            backend = w.load_backend(self.bank_id, self._backend_name, params=params)
        except KeyError:
            # Module not found locally — attempt to install from repository.
            backend = self._install_and_load(w, params)
        except Exception as exc:
            raise ValueError(
                f"Failed to initialise Woob module '{self.bank_id}': {exc}"
            ) from exc

        self._backend = backend

        # Validate credentials with a lightweight network call so that bad
        # credentials surface immediately rather than during the first sync.
        self._validate_credentials()

        expires_at = (datetime.now(timezone.utc) + timedelta(hours=6)).isoformat()
        return BankSession(
            bank_id=self.bank_id,
            user_id=params["login"],
            session_data={"backend_name": self._backend_name, "params": params},
            expires_at=expires_at,
        )

    def _install_and_load(self, w: Any, params: Dict[str, str]) -> Any:
        """Download and install the Woob module then load it."""
        try:
            all_modules = w.repositories.get_all_modules_info()
            if self.bank_id not in all_modules:
                raise ValueError(
                    f"Woob module '{self.bank_id}' is not available in the repository."
                )
            w.repositories.install(all_modules[self.bank_id])
            return w.load_backend(self.bank_id, self._backend_name, params=params)
        except Exception as exc:
            raise ValueError(
                f"Cannot install/load Woob module '{self.bank_id}': {exc}"
            ) from exc

    def _validate_credentials(self) -> None:
        """Call iter_accounts() once to surface auth errors early."""
        if self._backend is None:
            logger.warning(
                "_validate_credentials called without an active backend for '%s'",
                self.bank_id,
            )
            return
        try:
            next(self._backend.iter_accounts(), None)
        except Exception as exc:
            msg = str(exc).lower()
            auth_keywords = (
                "password",
                "login",
                "wrong",
                "invalid",
                "incorrect",
                "denied",
                "unauthorized",
                "forbidden",
                "mot de passe",
                "identifiant",
            )
            if any(kw in msg for kw in auth_keywords):
                self._unload_backend()
                raise ValueError(f"Authentication failed: {exc}") from exc
            # Non-auth errors (2FA prompt, transient network) — keep the session;
            # the caller can retry or surface the error gracefully.
            logger.warning(
                "Woob login warning for '%s': %s", self.bank_id, exc
            )

    def logout(self, session: BankSession) -> None:
        """Release the Woob backend resources."""
        self._log(f"Logging out Woob session for {session.user_id}")
        self._unload_backend()

    def fetch_accounts(self, session: BankSession) -> List[BankAccount]:
        """Return all accounts visible to the authenticated session."""
        self._log("Fetching accounts via Woob")
        if self._backend is None:
            raise RuntimeError("Not authenticated – call login() first.")

        accounts: List[BankAccount] = []
        for woob_acc in self._backend.iter_accounts():
            try:
                balance = (
                    float(woob_acc.balance)
                    if woob_acc.balance is not None
                    else 0.0
                )
                currency = str(woob_acc.currency) if woob_acc.currency else "EUR"
                label = str(woob_acc.label or woob_acc.id)
                accounts.append(
                    BankAccount(
                        account_id=str(woob_acc.id),
                        account_number=str(woob_acc.id),
                        bank_id=self.bank_id,
                        balance=balance,
                        currency=currency,
                        name=label,
                        raw={"type": str(getattr(woob_acc, "type", ""))},
                    )
                )
            except Exception as exc:
                logger.warning("Skipping malformed Woob account: %s", exc)

        return accounts

    def fetch_transactions(
        self,
        session: BankSession,
        account_id: str,
        from_date: date,
        to_date: date,
    ) -> List[RawTransaction]:
        """
        Return transactions for *account_id* in the half-open interval
        ``[from_date, to_date]``.

        Woob modules return transactions in reverse-chronological order; we
        stop iteration once ``tx.date`` falls before *from_date*.
        """
        self._log(
            f"Fetching transactions for {account_id} "
            f"({from_date} → {to_date}) via Woob"
        )
        if self._backend is None:
            raise RuntimeError("Not authenticated – call login() first.")

        # Locate the Woob account object by id.
        target_account: Optional[Any] = None
        for woob_acc in self._backend.iter_accounts():
            if str(woob_acc.id) == account_id:
                target_account = woob_acc
                break

        if target_account is None:
            logger.warning(
                "Account '%s' not found in Woob backend for '%s'",
                account_id, self.bank_id,
            )
            return []

        transactions: List[RawTransaction] = []
        try:
            for tx in self._backend.iter_history(target_account):
                # Normalise date to ``datetime.date``.
                tx_date: date
                if hasattr(tx.date, "date"):
                    tx_date = tx.date.date()
                elif isinstance(tx.date, date):
                    tx_date = tx.date
                else:
                    continue  # unparseable — skip

                if tx_date < from_date:
                    break  # all subsequent entries are older
                if tx_date > to_date:
                    continue

                amount = float(tx.amount) if tx.amount is not None else 0.0
                label = str(tx.label or getattr(tx, "raw", "") or "")
                tx_id = (
                    str(tx.id)
                    if getattr(tx, "id", None)
                    else f"{account_id}-{tx_date.isoformat()}-{amount}"
                )

                transactions.append(
                    RawTransaction(
                        external_id=tx_id,
                        date=tx_date.isoformat(),
                        description=label[:200],
                        amount=amount,  # signed: negative = debit
                        currency=str(getattr(tx, "currency", None) or "EUR"),
                        category=None,
                        account_id=account_id,
                        raw={},
                    )
                )
        except StopIteration:
            pass
        except Exception as exc:
            logger.error(
                "Error fetching Woob transactions for '%s' / '%s': %s",
                self.bank_id, account_id, exc,
            )
            raise RuntimeError(f"Failed to fetch transactions: {exc}") from exc

        return transactions
