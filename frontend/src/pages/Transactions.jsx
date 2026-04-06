import { useState, useMemo } from "react";
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
  Search, 
  Filter, 
  Calendar,
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
  X,
  Check,
  AlertTriangle
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { WeeklyBudgetWidget } from "./QuickEntry";

// Category configuration
const CATEGORIES = [
  { name: "Food & Dining", icon: Coffee, color: "#F43F5E" },
  { name: "Transport", icon: Car, color: "#6366F1" },
  { name: "Shopping", icon: ShoppingBag, color: "#10B981" },
  { name: "Subscriptions", icon: CreditCard, color: "#F59E0B" },
  { name: "Entertainment", icon: Film, color: "#EC4899" },
  { name: "Bills & Utilities", icon: Zap, color: "#8B5CF6" },
  { name: "Health", icon: Heart, color: "#14B8A6" },
  { name: "Travel", icon: Plane, color: "#0EA5E9" },
  { name: "Income", icon: ArrowUpRight, color: "#10B981" },
];

// Skeleton
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Transaction Row Component
const TransactionRow = ({ transaction, onEdit, onDelete }) => {
  const category = CATEGORIES.find((c) => c.name === transaction.category);
  const Icon = category?.icon || Receipt;
  const color = category?.color || "#78716C";
  const isIncome = transaction.type === "income";

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div 
      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-100 hover:shadow-premium transition-all group animate-fade-in"
      data-testid={`transaction-row-${transaction.id}`}
    >
      {/* Icon */}
      <div 
        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-900 truncate">
          {transaction.merchant}
        </p>
        <div className="flex items-center gap-2 text-sm text-stone-500">
          <span>{transaction.category}</span>
          <span>•</span>
          <span>{formatDate(transaction.date)}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`font-semibold text-lg tabular-nums ${
          isIncome ? "text-emerald-600" : "text-stone-900"
        }`}>
          {isIncome ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Actions */}
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

// Edit Transaction Modal
const EditModal = ({ transaction, open, onClose, onSave }) => {
  const [amount, setAmount] = useState(transaction?.amount?.toString() || "");
  const [merchant, setMerchant] = useState(transaction?.merchant || "");
  const [category, setCategory] = useState(transaction?.category || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        ...transaction,
        amount: parseFloat(amount),
        merchant,
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
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-amount"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Merchant</label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-merchant"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c.name !== "Income").map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    category === cat.name
                      ? "bg-stone-900 text-white"
                      : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  }`}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.name}
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

// Delete Confirmation Modal
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
            This will permanently delete the ${transaction.amount} expense from {transaction.merchant}.
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

// Filter Chip
const FilterChip = ({ label, active, onClick, icon: Icon }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
      active
        ? "bg-stone-900 text-white"
        : "bg-white text-stone-600 border border-stone-200 hover:bg-stone-50"
    }`}
  >
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {label}
  </button>
);

// Main Transactions Page
const Transactions = () => {
  const { API, transactions, loading, refreshData } = useApi();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [dateFilter, setDateFilter] = useState("all"); // all, week, month
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    
    let filtered = [...transactions];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.merchant.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }
    
    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((t) => t.category === selectedCategory);
    }
    
    // Date filter
    const today = new Date();
    if (dateFilter === "week") {
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);
      filtered = filtered.filter((t) => new Date(t.date) >= weekAgo);
    } else if (dateFilter === "month") {
      const monthAgo = new Date(today);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      filtered = filtered.filter((t) => new Date(t.date) >= monthAgo);
    }
    
    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    return filtered;
  }, [transactions, searchQuery, selectedCategory, dateFilter]);

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups = {};
    filteredTransactions.forEach((t) => {
      const date = t.date;
      if (!groups[date]) groups[date] = [];
      groups[date].push(t);
    });
    return groups;
  }, [filteredTransactions]);

  // Handle edit
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

  // Handle delete
  const handleDelete = async (transaction) => {
    await axios.delete(`${API}/transactions/${transaction.id}`);
    refreshData();
  };

  // Calculate totals
  const totals = useMemo(() => {
    const expenses = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);
    const income = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);
    return { expenses, income, net: income - expenses };
  }, [filteredTransactions]);

  const formatDateHeader = (dateStr) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div data-testid="transactions-loading">
        <Skeleton className="h-10 w-64 mb-8" />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-testid="transactions-page">
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
          Transaction History
        </h1>
        <p className="text-stone-500">
          View, edit, and manage all your transactions
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Main Content */}
        <div className="lg:col-span-8 space-y-6">
          {/* Search & Filters */}
          <div className="space-y-4 animate-fade-in-up">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search transactions..."
                className="h-12 pl-12 rounded-xl border-stone-200 bg-white"
                data-testid="search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-stone-400" />
                </button>
              )}
            </div>

            {/* Filter Chips */}
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label="All Time"
                active={dateFilter === "all"}
                onClick={() => setDateFilter("all")}
                icon={Calendar}
              />
              <FilterChip
                label="This Week"
                active={dateFilter === "week"}
                onClick={() => setDateFilter("week")}
              />
              <FilterChip
                label="This Month"
                active={dateFilter === "month"}
                onClick={() => setDateFilter("month")}
              />
              <div className="w-px h-6 bg-stone-200 mx-1" />
              {CATEGORIES.slice(0, 4).map((cat) => (
                <FilterChip
                  key={cat.name}
                  label={cat.name}
                  active={selectedCategory === cat.name}
                  onClick={() => setSelectedCategory(selectedCategory === cat.name ? null : cat.name)}
                  icon={cat.icon}
                />
              ))}
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-6">
            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <Receipt className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="font-heading text-lg font-semibold text-stone-900 mb-2">
                  No transactions found
                </h3>
                <p className="text-stone-500 text-sm">
                  {searchQuery || selectedCategory
                    ? "Try adjusting your filters"
                    : "Add your first expense using the + button"}
                </p>
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

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Summary Card */}
          <Card className="card-premium rounded-3xl animate-fade-in-up" data-testid="summary-card">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-stone-900 mb-4">
                Summary
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-stone-600">Income</span>
                  </div>
                  <span className="font-semibold text-emerald-600 tabular-nums">
                    +${totals.income.toLocaleString()}
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
                    -${totals.expenses.toLocaleString()}
                  </span>
                </div>
                
                <div className="pt-4 border-t border-stone-100">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-900">Net</span>
                    <span className={`font-bold text-lg tabular-nums ${
                      totals.net >= 0 ? "text-emerald-600" : "text-rose-600"
                    }`}>
                      {totals.net >= 0 ? "+" : ""}{totals.net.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Budget Widget */}
          <div className="animate-fade-in-up delay-100">
            <WeeklyBudgetWidget transactions={transactions} />
          </div>

          {/* Quick Stats */}
          <Card className="card-premium rounded-3xl animate-fade-in-up delay-150">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-stone-900 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Total transactions</span>
                  <span className="font-semibold text-stone-900">{filteredTransactions.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500">Avg. expense</span>
                  <span className="font-semibold text-stone-900 tabular-nums">
                    ${filteredTransactions.filter(t => t.type === "expense").length > 0
                      ? (totals.expenses / filteredTransactions.filter(t => t.type === "expense").length).toFixed(2)
                      : "0.00"}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Modal */}
      <EditModal
        transaction={editingTransaction}
        open={!!editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={handleEdit}
      />

      {/* Delete Modal */}
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
