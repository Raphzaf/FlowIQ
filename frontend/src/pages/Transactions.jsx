import { useState, useMemo, useCallback, useEffect } from "react";
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
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../components/ui/command";
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
import CategoryBadge, { CATEGORY_CONFIG } from "../components/transactions/CategoryBadge";

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

// Category emoji helper
const CATEGORY_EMOJIS = {
  "Food & Dining": "🍽️",
  "Supermarket": "🛒",
  "Restaurants": "🍴",
  "Transport": "🚗",
  "Shopping": "🛍️",
  "Entertainment": "🎬",
  "Bills & Utilities": "💡",
  "Health": "❤️",
  "Income": "💰",
  "Uncategorized": "📌",
};
const getCategoryEmoji = (cat) => CATEGORY_EMOJIS[cat] || "📌";

// Skeleton
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Transaction Row Component
const TransactionRow = ({ transaction, onEdit, onDelete, API, onCategoryChange }) => {
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
      className="flex items-center gap-4 p-4 bg-white dark:bg-[#1C1917] rounded-2xl border border-stone-100 dark:border-[#292524] hover:shadow-premium transition-all group animate-fade-in"
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
        <p className="font-medium text-stone-900 dark:text-stone-100 truncate">
          {transaction.merchant}
        </p>
        <div className="flex items-center gap-2 text-sm text-stone-500 dark:text-stone-400">
          <CategoryBadge
            transactionId={transaction.id || transaction._id}
            category={transaction.category || "Other"}
            userCategoryOverride={transaction.user_category_override}
            API={API}
            onCategoryChange={onCategoryChange}
          />
          <span>•</span>
          <span>{formatDate(transaction.date)}</span>
        </div>
      </div>

      {/* Amount */}
      <div className="text-right flex-shrink-0">
        <p className={`font-semibold text-lg tabular-nums ${
          isIncome ? "text-emerald-600" : "text-stone-900 dark:text-stone-100"
        }`}>
          {isIncome ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={() => onEdit(transaction)}
          className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors"
          title="Edit"
          data-testid={`edit-${transaction.id}`}
        >
          <Edit3 className="w-4 h-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300" />
        </button>
        <button
          onClick={() => onDelete(transaction)}
          className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors"
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
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-2">Amount</label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-amount"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-2">Merchant</label>
            <Input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              className="h-12 rounded-xl"
              data-testid="edit-merchant"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-stone-600 dark:text-stone-400 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.filter(c => c.name !== "Income").map((cat) => (
                <button
                  key={cat.name}
                  onClick={() => setCategory(cat.name)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    category === cat.name
                      ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
                      : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-700"
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
          <p className="text-stone-500 dark:text-stone-400 text-sm">
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
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all min-h-[44px] ${
      active
        ? "bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
        : "bg-white dark:bg-[#1C1917] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-[#292524] hover:bg-stone-50 dark:hover:bg-stone-800"
    }`}
  >
    {Icon && <Icon className="w-3.5 h-3.5" />}
    {label}
  </button>
);

// All categories for the multi-select filter
const ALL_FILTER_CATEGORIES = [
  "Supermarket", "Restaurants", "Transport", "Utilities", "Shopping",
  "Entertainment", "Health", "Housing", "Education", "Travel", "Income", "Other",
];

// Multi-select category filter popover
const CategoryMultiFilter = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);

  const label = value.length === 0
    ? "All categories"
    : value.length === 1
    ? value[0]
    : `${value.length} categories`;

  const toggle = (cat) => {
    onChange(value.includes(cat) ? value.filter(c => c !== cat) : [...value, cat]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border text-sm font-medium transition-all min-h-[44px] ${
            value.length > 0
              ? "border-stone-900 dark:border-stone-100 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900"
              : "border-stone-200 dark:border-[#292524] bg-white dark:bg-[#1C1917] text-stone-600 dark:text-stone-400 hover:border-stone-300 dark:hover:border-stone-600"
          }`}
          data-testid="category-multifilter-trigger"
        >
          <span>🏷️</span>
          <span className="max-w-[120px] truncate">{label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0 rounded-2xl shadow-lg border border-stone-200" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Search…" className="h-9 text-sm" />
          <CommandList>
            <CommandEmpty className="py-3 text-center text-sm text-stone-400">No results</CommandEmpty>
            <CommandGroup>
              {ALL_FILTER_CATEGORIES.map(cat => {
                const isSelected = value.includes(cat);
                const cfg = CATEGORY_CONFIG[cat] || { emoji: "📌" };
                return (
                  <CommandItem
                    key={cat}
                    value={cat}
                    onSelect={() => toggle(cat)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer rounded-xl mx-1 my-0.5 text-sm"
                    data-testid={`filter-category-${cat}`}
                  >
                    <span>{cfg.emoji}</span>
                    <span className="flex-1">{cat}</span>
                    {isSelected && <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {value.length > 0 && (
              <div className="p-1 border-t border-stone-100 dark:border-stone-700">
                <button
                  onClick={() => { onChange([]); setOpen(false); }}
                  className="w-full text-xs text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-200 py-1.5 px-3 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition-colors"
                  data-testid="category-filter-clear"
                >
                  Clear filter
                </button>
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// Main Transactions Page
const Transactions = () => {
  const { API, transactions, loading, refreshData } = useApi();
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [dateFilter, setDateFilter] = useState("all"); // all, week, month
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [deletingTransaction, setDeletingTransaction] = useState(null);

  // Local copy for optimistic category updates
  const [localTransactions, setLocalTransactions] = useState(transactions);

  // Keep localTransactions in sync when the source data changes
  useEffect(() => {
    setLocalTransactions(transactions);
  }, [transactions]);

  const handleCategoryChange = useCallback((txnId, newCategory) => {
    setLocalTransactions(prev =>
      (prev || []).map(t =>
        (t.id || t._id) === txnId
          ? { ...t, category: newCategory, user_category_override: newCategory }
          : t
      )
    );
  }, []);

  // Filter transactions
  const filteredTransactions = useMemo(() => {
    if (!localTransactions) return [];
    
    let filtered = [...localTransactions];
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.merchant.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query)
      );
    }
    
    // Category filter (multi-select)
    if (categoryFilter.length > 0) {
      filtered = filtered.filter((t) => categoryFilter.includes(t.category));
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
  }, [localTransactions, searchQuery, categoryFilter, dateFilter]);

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
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 dark:text-stone-100 mb-2">
          Transaction History
        </h1>
        <p className="text-stone-500 dark:text-stone-400">
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
                className="h-12 pl-12 rounded-xl border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1C1917] text-base"
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
              <div className="w-px h-6 bg-stone-200 dark:bg-stone-700 mx-1 self-center" />
              <CategoryMultiFilter value={categoryFilter} onChange={setCategoryFilter} />
            </div>
          </div>

          {/* Transaction List */}
          <div className="space-y-6">
            {Object.keys(groupedTransactions).length === 0 ? (
              <div className="text-center py-16 animate-fade-in">
                <Receipt className="w-16 h-16 text-stone-300 mx-auto mb-4" />
                <h3 className="font-heading text-lg font-semibold text-stone-900 dark:text-stone-100 mb-2">
                  No transactions found
                </h3>
                <p className="text-stone-500 dark:text-stone-400 text-sm">
                  {searchQuery || categoryFilter.length > 0
                    ? "Try adjusting your filters"
                    : "Add your first expense using the + button"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="sm:hidden space-y-2">
                  {filteredTransactions.map((transaction) => {
                    const isIncome = transaction.type === "income";
                    return (
                      <div
                        key={transaction.id}
                        className="flex items-center gap-3 p-3 bg-white dark:bg-[#1C1917] rounded-2xl border border-stone-100 dark:border-[#292524] animate-fade-in"
                        data-testid={`transaction-mobile-${transaction.id}`}
                      >
                        <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-stone-800 flex items-center justify-center flex-shrink-0 text-lg">
                          {getCategoryEmoji(transaction.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-stone-900 dark:text-stone-100 truncate text-sm">
                            {transaction.merchant}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <CategoryBadge
                              transactionId={transaction.id || transaction._id}
                              category={transaction.category || "Other"}
                              userCategoryOverride={transaction.user_category_override}
                              API={API}
                              onCategoryChange={(newCat) => handleCategoryChange(transaction.id || transaction._id, newCat)}
                            />
                            <span className="text-xs text-stone-400">· {transaction.date}</span>
                          </div>
                        </div>
                        <p className={`font-semibold text-sm tabular-nums flex-shrink-0 ${
                          isIncome ? "text-emerald-600" : "text-rose-600"
                        }`}>
                          {isIncome ? "+" : "-"}${transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop list view */}
                <div className="hidden sm:block overflow-x-auto">
                  {Object.entries(groupedTransactions).map(([date, dayTransactions]) => (
                    <div key={date} className="animate-fade-in-up">
                      <h3 className="font-medium text-stone-500 dark:text-stone-400 text-sm mb-3 px-1">
                        {formatDateHeader(date)}
                      </h3>
                      <div className="space-y-2">
                        {dayTransactions.map((transaction) => (
                          <TransactionRow
                            key={transaction.id}
                            transaction={transaction}
                            onEdit={setEditingTransaction}
                            onDelete={setDeletingTransaction}
                            API={API}
                            onCategoryChange={(newCat) => handleCategoryChange(transaction.id || transaction._id, newCat)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          {/* Summary Card */}
          <Card className="card-premium rounded-3xl animate-fade-in-up" data-testid="summary-card">
            <CardContent className="p-6">
              <h3 className="font-heading font-semibold text-stone-900 dark:text-stone-100 mb-4">
                Summary
              </h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-emerald-600" />
                    </div>
                    <span className="text-sm text-stone-600 dark:text-stone-400">Income</span>
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
                    <span className="text-sm text-stone-600 dark:text-stone-400">Expenses</span>
                  </div>
                  <span className="font-semibold text-rose-600 tabular-nums">
                    -${totals.expenses.toLocaleString()}
                  </span>
                </div>
                
                <div className="pt-4 border-t border-stone-100 dark:border-stone-700">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-stone-900 dark:text-stone-100">Net</span>
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
              <h3 className="font-heading font-semibold text-stone-900 dark:text-stone-100 mb-4">
                Quick Stats
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Total transactions</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100">{filteredTransactions.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-stone-500 dark:text-stone-400">Avg. expense</span>
                  <span className="font-semibold text-stone-900 dark:text-stone-100 tabular-nums">
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
