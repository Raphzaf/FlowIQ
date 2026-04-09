"""
Woob bank module registry.

Provides a curated static list of banking institutions accessible through
Woob's CapBank capability.  The static registry is used as-is if Woob is
not installed or its upstream repository is unreachable; otherwise the list
is extended dynamically with any additional CapBank modules found online.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Dict

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Curated static registry
# ---------------------------------------------------------------------------

WOOB_STATIC_BANKS: Dict[str, Dict[str, Any]] = {
    "boursorama": {
        "name": "Boursorama Banque",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/8/80/Boursorama.svg/200px-Boursorama.svg.png",
        "requires_otp": True,
        "website": "https://www.boursorama.com",
        "description": "Banque en ligne française (Groupe Société Générale)",
        "login_label": "Identifiant client",
    },
    "caissedepargne": {
        "name": "Caisse d'Épargne",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/d/dc/Caisse_d%27Epargne_logo_2021.svg/200px-Caisse_d%27Epargne_logo_2021.svg.png",
        "requires_otp": True,
        "website": "https://www.caisse-epargne.fr",
        "description": "Réseau bancaire coopératif français",
        "login_label": "Identifiant",
    },
    "lcl": {
        "name": "LCL – Crédit Lyonnais",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/0/04/Logo_LCL_2020.svg/200px-Logo_LCL_2020.svg.png",
        "requires_otp": False,
        "website": "https://www.lcl.fr",
        "description": "Banque de détail du groupe Crédit Agricole",
        "login_label": "Identifiant",
    },
    "societegenerale": {
        "name": "Société Générale",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/c/cc/Logo_Soci%C3%A9t%C3%A9_G%C3%A9n%C3%A9rale.svg/200px-Logo_Soci%C3%A9t%C3%A9_G%C3%A9n%C3%A9rale.svg.png",
        "requires_otp": True,
        "website": "https://particuliers.societegenerale.fr",
        "description": "Grande banque de détail française",
        "login_label": "Numéro de client",
    },
    "bnporc": {
        "name": "BNP Paribas",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/f/f0/BNP_Paribas_logo.svg/200px-BNP_Paribas_logo.svg.png",
        "requires_otp": True,
        "website": "https://mabanque.bnpparibas.fr",
        "description": "Première banque française",
        "login_label": "Numéro client",
    },
    "creditmutuel": {
        "name": "Crédit Mutuel",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/9/9a/Logo_credit-mutuel.svg/200px-Logo_credit-mutuel.svg.png",
        "requires_otp": True,
        "website": "https://www.creditmutuel.fr",
        "description": "Banque coopérative française",
        "login_label": "Identifiant",
    },
    "cic": {
        "name": "CIC",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/5/50/Logo_CIC.svg/200px-Logo_CIC.svg.png",
        "requires_otp": True,
        "website": "https://www.cic.fr",
        "description": "Filiale bancaire du Crédit Mutuel",
        "login_label": "Identifiant",
    },
    "fortuneo": {
        "name": "Fortuneo",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/6/6c/Logo_Fortuneo.svg/200px-Logo_Fortuneo.svg.png",
        "requires_otp": False,
        "website": "https://www.fortuneo.fr",
        "description": "Banque en ligne (Groupe Arkéa)",
        "login_label": "Identifiant",
    },
    "hellobank": {
        "name": "Hello bank!",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/2/2e/Hello_bank_logo.svg",
        "requires_otp": True,
        "website": "https://www.hellobank.fr",
        "description": "Banque 100 % mobile de BNP Paribas",
        "login_label": "Identifiant",
    },
    "ing": {
        "name": "ING France",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/49/ING_Group_N.V._Logo.svg/200px-ING_Group_N.V._Logo.svg.png",
        "requires_otp": True,
        "website": "https://www.ing.fr",
        "description": "Banque en ligne (groupe néerlandais ING)",
        "login_label": "Numéro client",
    },
    "banquepostale": {
        "name": "La Banque Postale",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/2/2e/La_Banque_postale_logo.svg/200px-La_Banque_postale_logo.svg.png",
        "requires_otp": True,
        "website": "https://www.labanquepostale.fr",
        "description": "Filiale bancaire du Groupe La Poste",
        "login_label": "Identifiant",
    },
    "creditagricole": {
        "name": "Crédit Agricole",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/fr/thumb/5/50/Cr%C3%A9dit_Agricole_logo.svg/200px-Cr%C3%A9dit_Agricole_logo.svg.png",
        "requires_otp": True,
        "website": "https://www.credit-agricole.fr",
        "description": "Premier réseau bancaire français",
        "login_label": "Identifiant",
    },
    "hsbc": {
        "name": "HSBC France",
        "country": "FR",
        "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/aa/HSBC_logo_%282018%29.svg/200px-HSBC_logo_%282018%29.svg.png",
        "requires_otp": True,
        "website": "https://www.hsbc.fr",
        "description": "Banque internationale (groupe HSBC)",
        "login_label": "Identifiant",
    },
    "revolut": {
        "name": "Revolut",
        "country": "EU",
        "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/81/Revolut_logo.svg/200px-Revolut_logo.svg.png",
        "requires_otp": True,
        "website": "https://www.revolut.com",
        "description": "Application bancaire européenne",
        "login_label": "E-mail",
    },
    "n26": {
        "name": "N26",
        "country": "EU",
        "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8c/N26_logo_2019.svg/200px-N26_logo_2019.svg.png",
        "requires_otp": True,
        "website": "https://n26.com/fr-fr",
        "description": "Banque mobile européenne",
        "login_label": "E-mail",
    },
    "paypal": {
        "name": "PayPal",
        "country": "US",
        "logo": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b5/PayPal.svg/200px-PayPal.svg.png",
        "requires_otp": False,
        "website": "https://www.paypal.com",
        "description": "Portefeuille électronique international",
        "login_label": "E-mail",
    },
}


def get_supported_banks() -> Dict[str, Dict[str, Any]]:
    """
    Return the full registry of supported Woob bank modules.

    Each entry includes its ``id`` key for convenient iteration.  The static
    registry is returned immediately; an optional dynamic extension is
    attempted in the background only when Woob is installed and reachable.
    """
    banks: Dict[str, Dict[str, Any]] = {
        bid: {"id": bid, **info} for bid, info in WOOB_STATIC_BANKS.items()
    }

    try:
        banks = _merge_woob_dynamic(banks)
    except Exception as exc:
        logger.debug("Woob dynamic module discovery skipped: %s", exc)

    return banks


# ---------------------------------------------------------------------------
# Optional dynamic extension
# ---------------------------------------------------------------------------


def _merge_woob_dynamic(
    existing: Dict[str, Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    """Extend *existing* with CapBank modules discovered from Woob's repo."""
    from woob.capabilities.bank import CapBank  # noqa: PLC0415
    from woob.core import Woob  # noqa: PLC0415

    woob_dir = os.environ.get("WOOB_DATA_DIR", "/tmp/woob")
    os.makedirs(woob_dir, exist_ok=True)

    w = Woob(workdir=woob_dir, datadir=woob_dir)
    result: Dict[str, Dict[str, Any]] = dict(existing)

    for name, info in w.repositories.get_all_modules_info().items():
        if CapBank not in getattr(info, "capabilities", []):
            continue
        if name in result:
            continue  # static entry takes priority
        result[name] = {
            "id": name,
            "name": getattr(info, "name", None) or name,
            "country": "??",
            "logo": None,
            "requires_otp": False,
            "website": None,
            "description": getattr(info, "description", "") or "",
            "login_label": "Identifiant",
        }

    return result
