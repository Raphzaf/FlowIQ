import { useState, useEffect, useCallback } from "react";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Building2,
  RefreshCw,
  Unlink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  ShieldCheck,
  Landmark,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

// ─── Bank card ──────────────────────────────────────────────────────────────
const BankCard = ({ bank, connected, onConnect, onDisconnect, onSync, syncing }) => {
  const [expanded, setExpanded] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    if (!username || !password) {
      toast.error("Please enter your credentials");
      return;
    }
    setLoading(true);
    try {
      await onConnect(bank.id, username, password);
      setExpanded(false);
      setUsername("");
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
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-stone-900 text-sm">{bank.name}</p>
              <p className="text-xs text-stone-500" dir="rtl">{bank.name_he}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-full">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs"
                  onClick={() => onSync(bank.id)}
                  disabled={syncing}
                >
                  {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
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
                Connect
                <ChevronRight className={`w-3 h-3 ml-1 transition-transform ${expanded ? "rotate-90" : ""}`} />
              </Button>
            )}
          </div>
        </div>

        {/* Credential form */}
        {expanded && !connected && (
          <div className="mt-4 pt-4 border-t border-stone-100 space-y-3">
            <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 rounded-lg p-3">
              <ShieldCheck className="w-4 h-4 text-stone-400 shrink-0" />
              <span>
                Your credentials are encrypted before being stored and are never
                shared with third parties. This is a <strong>demo</strong> – no real
                banking system is accessed.
              </span>
            </div>
            <Input
              placeholder="Username / ID"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="h-9 text-sm"
              autoComplete="off"
            />
            <Input
              type="password"
              placeholder="Password"
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
                Connect
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-9 px-4 text-sm"
                onClick={() => { setExpanded(false); setUsername(""); setPassword(""); }}
              >
                Cancel
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
      <p className="text-xs text-stone-500">{account.bank_name} · {account.account_number}</p>
    </div>
    <div className="text-right">
      <p className={`text-sm font-semibold ${account.balance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
        {account.currency} {account.balance.toLocaleString()}
      </p>
    </div>
  </div>
);

// ─── Main page ────────────────────────────────────────────────────────────────
export default function IsraeliBank() {
  const { headers } = useApi();

  const [banks, setBanks] = useState([]);
  const [connections, setConnections] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [syncingBank, setSyncingBank] = useState(null);
  const [loadingPage, setLoadingPage] = useState(true);
  const [supportedBankMap, setSupportedBankMap] = useState({});

  const fetchAll = useCallback(async () => {
    try {
      const [banksRes, connRes, accRes] = await Promise.all([
        axios.get(`${API}/banks/israel/supported`, { headers }),
        axios.get(`${API}/banks/israel/connections`, { headers }),
        axios.get(`${API}/banks/israel/accounts`, { headers }),
      ]);

      const KNOWN_IDS = ["hapoalim", "leumi", "discount"];
      const map = {};
      banksRes.data.forEach((b, i) => {
        if (i < KNOWN_IDS.length) {
          map[KNOWN_IDS[i]] = { ...b, id: KNOWN_IDS[i] };
        }
      });
      setSupportedBankMap(map);

      setBanks(banksRes.data);
      setConnections(connRes.data);
      setAccounts(accRes.data);
    } catch (err) {
      console.error("Failed to load banks", err);
    } finally {
      setLoadingPage(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const connectedBankIds = new Set(connections.map((c) => c.bank_id));

  const handleConnect = async (bankId, username, password) => {
    try {
      await axios.post(
        `${API}/banks/israel/connect`,
        { bank_id: bankId, username, password },
        { headers }
      );
      toast.success("Bank connected successfully! Running first sync…");
      await fetchAll();
      // Trigger immediate sync
      await handleSync(bankId);
    } catch (err) {
      const msg = err.response?.data?.detail || "Connection failed";
      toast.error(msg);
      throw err;
    }
  };

  const handleDisconnect = async (bankId) => {
    try {
      await axios.post(
        `${API}/banks/israel/disconnect`,
        { bank_id: bankId },
        { headers }
      );
      toast.success("Bank disconnected");
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || "Disconnect failed";
      toast.error(msg);
    }
  };

  const handleSync = async (bankId) => {
    setSyncingBank(bankId);
    try {
      const res = await axios.post(
        `${API}/banks/israel/sync`,
        { bank_id: bankId },
        { headers }
      );
      toast.success(
        `Sync complete – ${res.data.transaction_count} transaction(s) imported`
      );
      await fetchAll();
    } catch (err) {
      const msg = err.response?.data?.detail || "Sync failed";
      toast.error(msg);
    } finally {
      setSyncingBank(null);
    }
  };

  const banksWithIds = Object.values(supportedBankMap);

  if (loadingPage) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-lg">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-900">Israeli Banks</h1>
            <p className="text-sm text-stone-500">
              Connect your bank to sync transactions automatically
            </p>
          </div>
        </div>
      </div>

      {/* Connected accounts */}
      {accounts.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-stone-700 uppercase tracking-wide mb-3">
            Linked Accounts
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
          Supported Institutions
        </h2>
        <div className="space-y-3">
          {banksWithIds.length === 0 ? (
            <p className="text-sm text-stone-500">Loading…</p>
          ) : (
            banksWithIds.map((bank) => (
              <BankCard
                key={bank.id}
                bank={bank}
                connected={connectedBankIds.has(bank.id)}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                onSync={handleSync}
                syncing={syncingBank === bank.id}
              />
            ))
          )}
        </div>
      </section>

      {/* Info note */}
      <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800">
        <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">Demo Mode</p>
          <p>
            This integration uses mock data and does not connect to real banking
            systems. Credentials are encrypted with AES-256 and never stored in
            plain text. See the README for production deployment guidance.
          </p>
        </div>
      </div>
    </div>
  );
}
