import { useState, useEffect, useRef } from "react";
import { 
  Plus, 
  X, 
  Coffee, 
  Car, 
  ShoppingBag, 
  CreditCard, 
  Film, 
  Zap, 
  Heart, 
  Plane,
  Check,
  Sparkles,
  Receipt,
  TrendingUp,
  ChevronRight,
  Edit3,
  Trash2
} from "lucide-react";
import { 
  Drawer, 
  DrawerContent, 
  DrawerHeader, 
  DrawerTitle,
  DrawerClose 
} from "../components/ui/drawer";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { useApi } from "../App";

// Category configuration with icons and colors
const CATEGORIES = [
  { name: "Food & Dining", icon: Coffee, color: "#F43F5E", emoji: "🍕" },
  { name: "Transport", icon: Car, color: "#6366F1", emoji: "🚗" },
  { name: "Shopping", icon: ShoppingBag, color: "#10B981", emoji: "🛍️" },
  { name: "Subscriptions", icon: CreditCard, color: "#F59E0B", emoji: "📱" },
  { name: "Entertainment", icon: Film, color: "#EC4899", emoji: "🎬" },
  { name: "Bills & Utilities", icon: Zap, color: "#8B5CF6", emoji: "💡" },
  { name: "Health", icon: Heart, color: "#14B8A6", emoji: "💊" },
  { name: "Travel", icon: Plane, color: "#0EA5E9", emoji: "✈️" },
];

// Quick amount suggestions
const QUICK_AMOUNTS = [5, 10, 20, 50, 100];

// Success messages with emoji
const SUCCESS_MESSAGES = [
  { text: "Got it!", emoji: "✅" },
  { text: "Tracked!", emoji: "📝" },
  { text: "Saved!", emoji: "💾" },
  { text: "Done!", emoji: "✨" },
  { text: "Logged!", emoji: "📊" },
];

// Category-specific messages
const CATEGORY_MESSAGES = {
  "Food & Dining": ["Coffee run tracked! ☕", "Yum! Expense saved 🍕", "Meal logged! 🍔"],
  "Transport": ["Ride tracked! 🚗", "On the move! 🚕", "Trip saved! 🛣️"],
  "Shopping": ["Nice find! 🛍️", "Retail therapy logged 🛒", "Purchase tracked! 💳"],
  "Subscriptions": ["Subscription noted! 📱", "Recurring expense saved 🔄"],
  "Entertainment": ["Fun tracked! 🎬", "Good times logged! 🎮"],
  "Bills & Utilities": ["Bill noted! 💡", "Utility tracked! ⚡"],
  "Health": ["Self-care logged! 💊", "Health expense saved! 🏥"],
  "Travel": ["Adventure tracked! ✈️", "Journey logged! 🗺️"],
};

// Floating Action Button Component
export const QuickEntryFAB = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-6 z-40 w-14 h-14 rounded-full bg-stone-900 text-white shadow-premium-lg hover:shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 group md:bottom-6"
      data-testid="quick-entry-fab"
    >
      <Plus className="w-6 h-6 group-hover:rotate-90 transition-transform duration-300" />
      <span className="absolute -top-10 right-0 bg-stone-900 text-white text-xs font-medium px-3 py-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
        Add Expense
      </span>
    </button>
  );
};

// Category Chip Component
const CategoryChip = ({ category, selected, onClick, frequent }) => {
  const Icon = category.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
        selected
          ? "bg-stone-900 text-white shadow-md scale-105"
          : "bg-stone-100 text-stone-700 hover:bg-stone-200"
      }`}
      data-testid={`category-${category.name.toLowerCase().replace(/ & /g, '-')}`}
    >
      <Icon className="w-4 h-4" />
      <span>{category.name}</span>
      {frequent && !selected && (
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Frequently used" />
      )}
    </button>
  );
};

// Amount Input with Quick Suggestions
const AmountInput = ({ value, onChange, suggestions }) => {
  const inputRef = useRef(null);

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-stone-400">
          $
        </span>
        <input
          ref={inputRef}
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0.00"
          className="w-full h-16 pl-10 pr-4 text-3xl font-bold text-stone-900 bg-stone-50 border-0 rounded-2xl focus:ring-2 focus:ring-stone-900/10 focus:bg-white transition-all placeholder:text-stone-300 tabular-nums"
          data-testid="amount-input"
        />
      </div>
      
      {/* Quick amount buttons */}
      <div className="flex gap-2 flex-wrap">
        {suggestions.map((amount) => (
          <button
            key={amount}
            onClick={() => onChange(amount.toString())}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
              parseFloat(value) === amount
                ? "bg-stone-900 text-white"
                : "bg-stone-100 text-stone-600 hover:bg-stone-200"
            }`}
            data-testid={`quick-amount-${amount}`}
          >
            ${amount}
          </button>
        ))}
      </div>
    </div>
  );
};

// Success Animation Component
const SuccessAnimation = ({ message, emoji, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm animate-fade-in">
      <div className="text-center animate-scale-in">
        <div className="text-6xl mb-4 animate-bounce">{emoji}</div>
        <p className="font-heading text-2xl font-bold text-stone-900">{message}</p>
      </div>
    </div>
  );
};

// Main Quick Entry Drawer Component
export const QuickEntryDrawer = ({ open, onOpenChange, onSuccess }) => {
  const { API, transactions } = useApi();
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState({ text: "", emoji: "" });
  const [frequentCategories, setFrequentCategories] = useState([]);
  const [suggestedMerchants, setSuggestedMerchants] = useState([]);

  // Calculate frequent categories from transaction history
  useEffect(() => {
    if (transactions && transactions.length > 0) {
      const categoryCounts = {};
      transactions.forEach((t) => {
        if (t.type === "expense") {
          categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
        }
      });
      const sorted = Object.entries(categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);
      setFrequentCategories(sorted);
    }
  }, [transactions]);

  // Get suggested merchants based on selected category
  useEffect(() => {
    if (selectedCategory && transactions) {
      const merchants = transactions
        .filter((t) => t.category === selectedCategory.name && t.type === "expense")
        .map((t) => t.merchant);
      const uniqueMerchants = [...new Set(merchants)].slice(0, 5);
      setSuggestedMerchants(uniqueMerchants);
    } else {
      setSuggestedMerchants([]);
    }
  }, [selectedCategory, transactions]);

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter an amount");
      return;
    }
    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    setSaving(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      
      await axios.post(`${API}/transactions`, {
        date: today,
        amount: parseFloat(amount),
        category: selectedCategory.name,
        merchant: note || selectedCategory.name,
        type: "expense",
      });

      // Get a fun success message
      const categoryMessages = CATEGORY_MESSAGES[selectedCategory.name] || [];
      const randomMessage = categoryMessages.length > 0
        ? { text: categoryMessages[Math.floor(Math.random() * categoryMessages.length)], emoji: selectedCategory.emoji }
        : SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      
      setSuccessMessage(randomMessage);
      setShowSuccess(true);

      // Reset form
      setAmount("");
      setSelectedCategory(null);
      setNote("");

    } catch (error) {
      console.error("Error saving expense:", error);
      toast.error("Failed to save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessComplete = () => {
    setShowSuccess(false);
    onOpenChange(false);
    onSuccess?.();
    toast.success("Expense added to your dashboard!");
  };

  const resetForm = () => {
    setAmount("");
    setSelectedCategory(null);
    setNote("");
  };

  // Sort categories with frequent ones first
  const sortedCategories = [...CATEGORIES].sort((a, b) => {
    const aFreq = frequentCategories.indexOf(a.name);
    const bFreq = frequentCategories.indexOf(b.name);
    if (aFreq === -1 && bFreq === -1) return 0;
    if (aFreq === -1) return 1;
    if (bFreq === -1) return -1;
    return aFreq - bFreq;
  });

  return (
    <>
      {showSuccess && (
        <SuccessAnimation 
          message={successMessage.text || successMessage.emoji}
          emoji={successMessage.emoji || "✅"}
          onComplete={handleSuccessComplete}
        />
      )}
      
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh] rounded-t-3xl border-0 bg-white">
          <div className="mx-auto mt-4 h-1.5 w-12 rounded-full bg-stone-200" />
          
          <DrawerHeader className="px-6 pt-4 pb-2">
            <div className="flex items-center justify-between">
              <DrawerTitle className="font-heading text-xl font-bold text-stone-900">
                Quick Expense
              </DrawerTitle>
              <DrawerClose asChild>
                <button className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center hover:bg-stone-200 transition-colors">
                  <X className="w-4 h-4 text-stone-500" />
                </button>
              </DrawerClose>
            </div>
          </DrawerHeader>

          <div className="px-6 pb-8 space-y-6 overflow-y-auto">
            {/* Amount Input */}
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-2">
                Amount
              </label>
              <AmountInput 
                value={amount} 
                onChange={setAmount}
                suggestions={QUICK_AMOUNTS}
              />
            </div>

            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-3">
                Category
              </label>
              <div className="flex flex-wrap gap-2">
                {sortedCategories.map((category) => (
                  <CategoryChip
                    key={category.name}
                    category={category}
                    selected={selectedCategory?.name === category.name}
                    onClick={() => setSelectedCategory(category)}
                    frequent={frequentCategories.includes(category.name)}
                  />
                ))}
              </div>
            </div>

            {/* Merchant Suggestions */}
            {suggestedMerchants.length > 0 && (
              <div className="animate-fade-in">
                <label className="block text-sm font-medium text-stone-500 mb-2">
                  Recent merchants
                </label>
                <div className="flex flex-wrap gap-2">
                  {suggestedMerchants.map((merchant) => (
                    <button
                      key={merchant}
                      onClick={() => setNote(merchant)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        note === merchant
                          ? "bg-stone-900 text-white"
                          : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {merchant}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Note / Merchant Input */}
            <div>
              <label className="block text-sm font-medium text-stone-500 mb-2">
                Note (optional)
              </label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g., Lunch with team"
                className="h-12 rounded-xl border-stone-200 bg-stone-50 focus:bg-white"
                data-testid="note-input"
              />
            </div>

            {/* Save Button */}
            <Button
              onClick={handleSave}
              disabled={saving || !amount || !selectedCategory}
              className="w-full h-14 rounded-2xl bg-stone-900 hover:bg-stone-800 text-white font-medium text-base shadow-premium hover:shadow-premium-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="save-expense-btn"
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Check className="w-5 h-5" />
                  Save Expense
                </span>
              )}
            </Button>

            {/* Quick tip */}
            <p className="text-center text-xs text-stone-400">
              Tip: Tap a category to auto-suggest merchants
            </p>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

// Transaction History Item Component
export const TransactionItem = ({ transaction, onEdit, onDelete }) => {
  const category = CATEGORIES.find((c) => c.name === transaction.category);
  const Icon = category?.icon || Receipt;
  const color = category?.color || "#78716C";

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
      className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-100 hover:shadow-premium transition-all group"
      data-testid={`transaction-${transaction.id}`}
    >
      {/* Icon */}
      <div 
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: `${color}15` }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-stone-900 truncate">
          {transaction.merchant}
        </p>
        <p className="text-sm text-stone-500">
          {transaction.category} • {formatDate(transaction.date)}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right">
        <p className={`font-semibold tabular-nums ${
          transaction.type === "income" ? "text-emerald-600" : "text-stone-900"
        }`}>
          {transaction.type === "income" ? "+" : "-"}${transaction.amount.toLocaleString()}
        </p>
      </div>

      {/* Actions (visible on hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit?.(transaction)}
          className="p-2 rounded-lg hover:bg-stone-100 transition-colors"
          title="Edit"
        >
          <Edit3 className="w-4 h-4 text-stone-400" />
        </button>
        <button
          onClick={() => onDelete?.(transaction)}
          className="p-2 rounded-lg hover:bg-rose-50 transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4 text-stone-400 hover:text-rose-500" />
        </button>
      </div>
    </div>
  );
};

// Weekly Budget Progress Component
export const WeeklyBudgetWidget = ({ transactions, weeklyBudget = 500 }) => {
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  
  const weeklySpending = transactions
    ?.filter((t) => {
      const date = new Date(t.date);
      return t.type === "expense" && date >= startOfWeek;
    })
    .reduce((sum, t) => sum + t.amount, 0) || 0;

  const percentage = Math.min((weeklySpending / weeklyBudget) * 100, 100);
  const remaining = Math.max(weeklyBudget - weeklySpending, 0);
  const isOverBudget = weeklySpending > weeklyBudget;

  return (
    <div className="p-5 bg-white rounded-2xl border border-stone-100" data-testid="weekly-budget-widget">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-stone-400" />
          <span className="text-sm font-medium text-stone-600">Weekly Budget</span>
        </div>
        <span className={`text-sm font-semibold ${isOverBudget ? 'text-rose-600' : 'text-emerald-600'}`}>
          ${remaining.toFixed(0)} left
        </span>
      </div>
      
      {/* Progress bar */}
      <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-500 ${
            isOverBudget ? 'bg-rose-500' : percentage > 75 ? 'bg-amber-500' : 'bg-emerald-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between mt-2 text-xs text-stone-400">
        <span>${weeklySpending.toFixed(0)} spent</span>
        <span>${weeklyBudget} budget</span>
      </div>
    </div>
  );
};

export default QuickEntryDrawer;
