import { useState, useEffect, useCallback } from "react";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Globe,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Landmark,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

// ─── Country flag helper ──────────────────────────────────────────────────────
const countryFlag = (code) => {
  const flags = { FR: "🇫🇷", EU: "🇪🇺", US: "🇺🇸", DE: "🇩🇪", GB: "🇬🇧" };
  return flags[code] || "🏦";
};

// ─── Bank card ──────────────────────────────────────────────────────────────
const BankCard = ({ bank, connected, connectedSince, onConnect, onDisconnect, onSync, syncing }) => {
  const [expanded, setExpanded] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  const handleConnect = async () => {
    if (!login || !password) {
      toast.error("Veuillez saisir vos identifiants");
      return;
    }
    setLoading(true);
    try {
      await onConnect(bank.id, login, password);
      setExpanded(false);
      setLogin("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border border-stone-100 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl">
              {bank.logo && !logoError ? (
                <img
                  src={bank.logo}
                  alt={bank.name}
                  className="w-7 h-7 object-contain"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <Landmark className="w-5 h-5 text-indigo-600" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-stone-900 text-sm">{bank.name}</p>
                <span className="text-sm">{countryFlag(bank.country)}</span>
                {bank.requires_otp && (
                  <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                    2FA
                  </span>
                )}
              </div>
              {bank.description && (
                <p className="text-xs text-stone-500 mt-0.5">{bank.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {connected ? (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connecté
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => onSync(bank.id)}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  <span className="ml-1">Sync</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 px-3 text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
                  onClick={() => onDisconnect(bank.id)}
                >
                  <Unlink className="w-3 h-3" />
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                className="h-8 px-4 text-xs bg-stone-900 text-white hover:bg-stone-800"
                onClick={() => setExpanded((v) => !v)}
              >
                Connecter
                <ChevronRight
                  className={`w-3 h-3 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`}
                />
              </Button>
            )}
          </div>
        </div>

        {/* Credential form */}
        {expanded && !connected && (
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
            {bank.requires_otp && (
              <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 rounded-lg p-3">
                <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                <span>
                  Cette banque peut demander une authentification à deux facteurs
                  (SMS ou application). Si la connexion échoue, validez la
                  notification 2FA puis réessayez.
                </span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
              <span>
                Vos identifiants sont chiffrés (AES-256) avant stockage et ne
                sont jamais partagés avec des tiers.
              </span>
            </div>
            <Input
              placeholder={bank.login_label || "Identifiant"}
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              className="h-9 text-sm"
              autoComplete="off"
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-9 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 h-9 bg-stone-900 text-white hover:bg-stone-800 text-sm"
                onClick={handleConnect}
                disabled={loading}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Connecter
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-4 text-sm"
                onClick={() => {
                  setExpanded(false);
                  setLogin("");
                  setPassword("");
                }}
              >
                Annuler
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Account row ─────────────────────────────────────────────────────────────
const AccountRow = ({ account }) => (
  <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-stone-100">
    <div>
      <p className="text-sm font-medium text-stone-900">{account.name}</p>
      <p className="text-xs text-stone-500">
        {account.bank_name} · {account.account_number}
      </p>
    </div>
    <div className="text-right">
      <p
        className={`text-sm font-semibold ${
          account.balance >= 0 ? "text-emerald-600" : "text-red-500"
        }`}
      >
        {account.currency}{" "}
        {account.balance.toLocaleString("fr-FR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </p>
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function WoobBanks() {
  const { headers } = useApi();

  const [banks, setBanks] = useState([]);
  const [connections, setConnections] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [syncingBank, setSyncingBank] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoadingPage(true);
    try {
      const [banksRes, connRes, accRes] = await Promise.all([
        axios.get(`${API}/banks/woob/supported`, { headers }),
        axios.get(`${API}/banks/woob/connections`, { headers }),
        axios.get(`${API}/banks/woob/accounts`, { headers }),
      ]);
      setBanks(banksRes.data || []);
      setConnections(connRes.data || []);
      setAccounts(accRes.data || []);
    } catch (err) {
      if (err.response?.status === 503) {
        setUnavailable(true);
      } else {
        console.error("Failed to load Woob banks", err);
      }
    } finally {
      setLoadingPage(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const connectedBankIds = new Set(connections.map((c) => c.bank_id));
  const connectionMap = Object.fromEntries(connections.map((c) => [c.bank_id, c]));

  const handleConnect = async (bankId, login, password) => {
    try {
      await axios.post(
        `${API}/banks/woob/connect`,
        { bank_id: bankId, login, password },
        { headers }
      );
      toast.success("Banque connectée ! Synchronisation en cours…");
      await fetchAll();
      await handleSync(bankId);
    } catch (err) {
      const msg = err.response?.data?.detail || "Échec de la connexion";
      toast.error(msg);
      throw err;
    }
  };

  const handleDisconnect = async (bankId) => {
    try {
      await axios.post(
        `${API}/banks/woob/disconnect`,
        { bank_id: bankId },
        { headers }
      );
      toast.success("Banque déconnectée");
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || "Échec de la déconnexion";
      toast.error(msg);
    }
  };

  const handleSync = async (bankId) => {
    setSyncingBank(bankId);
    try {
      const res = await axios.post(
        `${API}/banks/woob/sync`,
        { bank_id: bankId },
        { headers }
      );
      toast.success(
        `Sync OK – ${res.data.transaction_count} transaction(s) importée(s)`
      );
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || "Échec de la synchronisation";
      toast.error(msg);
    } finally {
      setSyncingBank(null);
    }
  };

  if (loadingPage) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  if (unavailable) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl p-5 text-sm text-red-800">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold mb-1">Intégration Woob indisponible</p>
            <p>
              Le module Woob n'est pas installé sur ce serveur. Ajoutez{" "}
              <code className="bg-red-100 px-1 rounded">woob&gt;=3.6</code> dans{" "}
              <code className="bg-red-100 px-1 rounded">backend/requirements.txt</code>{" "}
              puis redéployez.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-lg">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Banques européennes</h1>
            <p className="text-sm text-stone-500">
              Connectez votre banque via Woob pour synchroniser vos transactions
            </p>
          </div>
        </div>
      </div>

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
            Comptes liés
          </h2>
          <div className="space-y-2">
            {accounts.map((acc) => (
              <AccountRow key={acc.account_id} account={acc} />
            ))}
          </div>
        </section>
      )}

      {/* Bank list */}
      <section>
        <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
          Établissements supportés
        </h2>
        {banks.length === 0 ? (
          <p className="text-sm text-stone-500">Chargement…</p>
        ) : (
          <div className="space-y-3">
            {banks.map((bank) => (
              <BankCard
                key={bank.id}
                bank={bank}
                connected={connectedBankIds.has(bank.id)}
                connectedSince={connectionMap[bank.id]?.created_at}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                syncing={syncingBank === bank.id}
              />
            ))}
          </div>
        )}
      </section>

      {/* Security note */}
      <div className="flex items-start gap-3 bg-stone-50 border border-stone-200 rounded-2xl p-4 text-sm text-stone-700">
        <ShieldCheck className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Sécurité</p>
          <p>
            Vos identifiants bancaires sont chiffrés avec AES-256-GCM avant
            d'être stockés. Ils ne transitent jamais en clair et ne sont jamais
            partagés. La synchronisation s'effectue directement entre le serveur
            FlowIQ et votre banque via Woob.
          </p>
        </div>
      </div>

      {/* Powered by Woob */}
      <p className="text-center text-xs text-stone-400">
        Propulsé par{" "}
        <a
          href="https://woob.tech"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-stone-600"
        >
          Woob
        </a>{" "}
        (LGPL-3.0) — open source, aucune donnée partagée
      </p>
    </div>
  );
}
