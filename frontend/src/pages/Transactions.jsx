import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../components/ui/dialog";
import {
  Coffee,
  Car,
  ShoppingBag,
  CreditCard,
  Film,
  Zap,
  Heart,
  Plane,
  Receipt,
  Trash2,
  Edit3,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { WeeklyBudgetWidget } from "./QuickEntry";
import TransactionFilters from "../components/transactions/TransactionFilters";
import useTransactionFilters from "../hooks/useTransactionFilters";

const CATEGORIES = [
  { name: "Food & Dining", icon: Coffee, color: "#F43F5E", emoji: "🍕" },
  { name: "Transport", icon: Car, color: "#6366F1", emoji: "🚗" },
  { name: "Shopping", icon: ShoppingBag, color: "#10B981", emoji: "🛍️" },
  { name: "Subscriptions", icon: CreditCard, color: "#F59E0B", emoji: "📱" },
  { name: "Entertainment", icon: Film, color: "#EC4899", emoji: "🎬" },
  { name: "Bills & Utilities", icon: Zap, color: "#8B5CF6", emoji: "💡" },
  { name: "Health", icon: Heart, color: "#14B8A6", emoji: "💊" },
  { name: "Travel", icon: Plane, color: "#0EA5E9", emoji: "✈️" },
  { name: "Income", icon: ArrowUpRight, color: "#10B981", emoji: "💰" },
];

const CATEGORY_MAP = CATEGORIES.reduce((accumulator, category) => {
  accumulator[category.name] = category;
  return accumulator;
}, {});

const TYPE_MAP = {
  expense: "debit",
  debit: "debit",
  income: "credit",
  credit: "credit",
};

const normalizeType = (value) => TYPE_MAP[String(value || "debit").toLowerCase()] || "debit";

const getMerchantName = (transaction) =>
  transaction?.merchant_name || transaction?.merchant || "Unknown merchant";

const getAmount = (transaction) => Math.abs(Number(transaction?.amount) || 0);

const parseDateFromParam = (value) => {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseNumberFromParam = (value) => {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(parsed) : "";
};

const toDateParam = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseFiltersFromSearchParams = (searchParams) => {
  const readArray = (key) => {
    const value = searchParams.get(key);
    return value
      ? value
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  };

  const type = searchParams.get("type");
  const parsedType = type === "debit" || type === "credit" ? type : "all";

  return {
    search: searchParams.get("search") || "",
    categories: readArray("categories"),
    dateRange: {
      from: parseDateFromParam(searchParams.get("from")),
      to: parseDateFromParam(searchParams.get("to")),
    },
    amountRange: {
      min: parseNumberFromParam(searchParams.get("min")),
      max: parseNumberFromParam(searchParams.get("max")),
    },
    banks: readArray("banks"),
    type: parsedType,
  };
};

const createSearchParamsFromFilters = (filters) => {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.categories.length > 0) {
    params.set("categories", filters.categories.join(","));
  }

  if (filters.banks.length > 0) {
    params.set("banks", filters.banks.join(","));
  }

  if (filters.dateRange.from) {
    params.set("from", toDateParam(filters.dateRange.from));
  }

  if (filters.dateRange.to) {
    params.set("to", toDateParam(filters.dateRange.to));
  }

  if (filters.amountRange.min !== "") {
    params.set("min", String(filters.amountRange.min));
  }

  if (filters.amountRange.max !== "") {
    params.set("max", String(filters.amountRange.max));
  }

  if (filters.type !== "all") {
    params.set("type", filters.type);
  }

  return params;
};

const Skeleton = ({ className }) => <div className={`skeleton ${className}`} />;

const TransactionRow = ({ transaction, onEdit, onDelete }) => {
  const category = CATEGORY_MAP[transaction.category];
  const Icon = category?.icon || Receipt;
  const color = category?.color || "#78716C";
  const isCredit = normalizeType(transaction.type) === "credit";

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IL", { month: "short", day: "numeric" });
  };

  return (
    <div
      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-100 hover:shadow-premium transition-all group animate-fade-in"
      data-testid={`transaction-row-${transaction.id}`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-900 truncate">{getMerchantName(transaction)}</p>
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span>{transaction.category}</span>
          <span>•</span>
          <span>{formatDate(transaction.date)}</span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p
          className={`font-semibold text-lg tabular-nums ${
            isCredit ? "text-emerald-600" : "text-stone-900"
          }`}
        >
          {isCredit ? "+" : "-"}₪
          {getAmount(transaction).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(transaction)}
          className="p-2 rounded-xl hover:bg-stone-100 transition-colors"
          title="Edit"
          data-testid={`edit-${transaction.id}`}
        >
          <Edit3 className="w-4 h-4 text-stone-400 hover:text-stone-600" />
        </button>
        <button
          onClick={() => onDelete(transaction)}
          className="p-2 rounded-xl hover:bg-rose-50 transition-colors"
          title="Delete"
          data-testid={`delete-${transaction.id}`}
        >
          <Trash2 className="w-4 h-4 text-stone-400 hover:text-rose-500" />
        </button>
      </div>
    </div>
  );
};

const EditModal = ({ transaction, open, onClose, onSave }) => {
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [category, setCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAmount(transaction?.amount?.toString() || "");
    setMerchant(getMerchantName(transaction));
    setCategory(transaction?.category || "");
  }, [transaction]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...transaction,
        amount: parseFloat(amount),
        merchant,
        merchant_name: merchant,
        category,
      });
      onClose();
      toast.success("Transaction updated!");
    } catch (error) {
      toast.error("Failed to update transaction");
    } finally {
      setSaving(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-3xl border-0 shadow-premium-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Edit Transaction</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-amount"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Merchant</label>
            <Input
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-merchant"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter((item) => item.name !== "Income").map((item) => (
                <button
                  key={item.name}
                  onClick={() => setCategory(item.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    category === item.name
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-stone-900 hover:bg-stone-800"
            data-testid="save-edit-btn"
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteModal = ({ transaction, open, onClose, onConfirm }) => {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onConfirm(transaction);
      onClose();
      toast.success("Transaction deleted");
    } catch (error) {
      toast.error("Failed to delete transaction");
    } finally {
      setDeleting(false);
    }
  };

  if (!transaction) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm rounded-3xl border-0 shadow-premium-lg">
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <DialogTitle className="font-heading text-xl mb-2">Delete Transaction?</DialogTitle>
          <p className="text-stone-500 text-sm">
            This will permanently delete the ₪{getAmount(transaction).toLocaleString()} expense from{" "}
            {getMerchantName(transaction)}.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1 rounded-xl">
            Cancel
          </Button>
          <Button
            onClick={handleDelete}
            disabled={deleting}
            className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-600 text-white"
            data-testid="confirm-delete-btn"
          >
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const Transactions = () => {
  const { API, transactions = [], loading, refreshData } = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  const initialFilters = useMemo(
    () => parseFiltersFromSearchParams(searchParams),
    [searchParams]
  );

  const {
    filters,
    setFilters,
    clearFilters,
    filtered,
    totalCount,
    totalAmount,
    activeFilterCount,
  } = useTransactionFilters(transactions, initialFilters);

  useEffect(() => {
    setFilters(initialFilters);
  }, [initialFilters, setFilters]);

  useEffect(() => {
    const params = createSearchParamsFromFilters(filters);
    if (params.toString() !== searchParams.toString()) {
      setSearchParams(params, { replace: true });
    }
  }, [filters, searchParams, setSearchParams]);

  const categories = useMemo(() => {
    const unique = Array.from(
      new Set(transactions.map((transaction) => transaction.category).filter(Boolean))
    );

    return unique.map((name) => ({
      name,
      emoji: CATEGORY_MAP[name]?.emoji || "🏷️",
    }));
  }, [transactions]);

  const banks = useMemo(() => {
    const unique = Array.from(
      new Set(
        transactions
          .map((transaction) => transaction.bank_id)
          .filter((bankId) => bankId !== null && bankId !== undefined && bankId !== "")
      )
    );

    return unique.map((id) => ({ id: String(id), name: `Bank ${id}` }));
  }, [transactions]);

  const groupedTransactions = useMemo(() => {
    const groups = {};
    filtered.forEach((transaction) => {
      if (!groups[transaction.date]) {
        groups[transaction.date] = [];
      }
      groups[transaction.date].push(transaction);
    });
    return groups;
  }, [filtered]);

  const handleEdit = async (updatedTransaction) => {
    await axios.put(`${API}/transactions/${updatedTransaction.id}`, {
      date: updatedTransaction.date,
      amount: updatedTransaction.amount,
      category: updatedTransaction.category,
      merchant: updatedTransaction.merchant,
      type: updatedTransaction.type,
    });
    refreshData();
  };

  const handleDelete = async (transaction) => {
    await axios.delete(`${API}/transactions/${transaction.id}`);
    refreshData();
  };

  const totals = useMemo(() => {
    const expenses = filtered
      .filter((transaction) => normalizeType(transaction.type) === "debit")
      .reduce((sum, transaction) => sum + getAmount(transaction), 0);
    const income = filtered
      .filter((transaction) => normalizeType(transaction.type) === "credit")
      .reduce((sum, transaction) => sum + getAmount(transaction), 0);
    return { expenses, income, net: income - expenses };
  }, [filtered]);

  const formatDateHeader = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-IL", {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div data-testid="transactions-loading">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((item) => (
            <Skeleton key={item} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="transactions-page">
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
          Transaction History
        </h1>
        <p className="text-stone-500">View, edit, and manage all your transactions</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="space-y-4 animate-fade-in-up">
            <TransactionFilters
              filters={filters}
              setFilters={setFilters}
              clearFilters={clearFilters}
              categories={categories}
              banks={banks}
              activeFilterCount={activeFilterCount}
            />

            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600 px-1">
              <span>{totalCount} results</span>
              <span className="font-medium">Filtered expenses: ₪{totalAmount.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-6">
            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <Receipt className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="font-heading text-lg font-semibold text-stone-900 mb-2">
                  No transactions match your filters
                </h3>
                <Button variant="outline" className="rounded-xl" onClick={clearFilters}>
                  Clear filters
                </Button>
              </div>
            ) : (
              Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
                <div key={date} className="animate-fade-in-up">
                  <h3 className="font-medium text-stone-500 text-sm mb-3 px-1">
                    {formatDateHeader(date)}
                  </h3>
                  <div className="space-y-2">
                    {dayTransactions.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                        onEdit={setEditingTransaction}
                        onDelete={setDeletingTransaction}
                      />
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="card-premium rounded-3xl animate-fade-in-up" data-testid="summary-card">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-stone-900 mb-4">Summary</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-stone-600">Income</span>
                  </div>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    +₪{totals.income.toLocaleString()}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center">
                      <ArrowDownRight className="w-4 h-4 text-rose-600" />
                    </div>
                    <span className="text-sm text-stone-600">Expenses</span>
                  </div>
                  <span className="font-semibold text-rose-600 tabular-nums">
                    -₪{totals.expenses.toLocaleString()}
                  </span>
                </div>

                <div className="pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-900">Net</span>
                    <span
                      className={`font-bold text-lg tabular-nums ${
                        totals.net >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      {totals.net >= 0 ? "+" : "-"}₪{Math.abs(totals.net).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="animate-fade-in-up delay-100">
            <WeeklyBudgetWidget transactions={transactions} />
          </div>

          <Card className="card-premium rounded-3xl animate-fade-in-up delay-150">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-stone-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Total transactions</span>
                  <span className="font-semibold text-stone-900">{totalCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Avg. expense</span>
                  <span className="font-semibold text-stone-900 tabular-nums">
                    ₪
                    {filtered.filter((transaction) => normalizeType(transaction.type) === "debit")
                      .length > 0
                      ? (
                          totals.expenses /
                          filtered.filter(
                            (transaction) => normalizeType(transaction.type) === "debit"
                          ).length
                        ).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditModal
        transaction={editingTransaction}
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleEdit}
      />

      <DeleteModal
        transaction={deletingTransaction}
        open={!!deletingTransaction}
        onClose={() => setDeletingTransaction(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Transactions;
