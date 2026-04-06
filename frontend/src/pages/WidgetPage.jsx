import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { 
  Plus, 
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
  Trophy,
  Flame,
  Target,
  Star,
  TrendingUp,
  ArrowRight,
  X
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import confetti from 'canvas-confetti';

const API = (process.env.REACT_APP_BACKEND_URL || "") + "/api";

// Category configuration with emojis for fun
const CATEGORIES = [
  { name: "Food & Dining", icon: Coffee, color: "#F43F5E", emoji: "🍕", shortcut: "F" },
  { name: "Transport", icon: Car, color: "#6366F1", emoji: "🚗", shortcut: "T" },
  { name: "Shopping", icon: ShoppingBag, color: "#10B981", emoji: "🛍️", shortcut: "S" },
  { name: "Subscriptions", icon: CreditCard, color: "#F59E0B", emoji: "📱", shortcut: "B" },
  { name: "Entertainment", icon: Film, color: "#EC4899", emoji: "🎬", shortcut: "E" },
  { name: "Bills & Utilities", icon: Zap, color: "#8B5CF6", emoji: "💡", shortcut: "U" },
  { name: "Health", icon: Heart, color: "#14B8A6", emoji: "💊", shortcut: "H" },
  { name: "Travel", icon: Plane, color: "#0EA5E9", emoji: "✈️", shortcut: "V" },
];

// Quick amounts
const QUICK_AMOUNTS = [5, 10, 15, 20, 25, 50, 75, 100];

// Fun success messages
const SUCCESS_MESSAGES = [
  { text: "Tracked!", emoji: "✅", points: 10 },
  { text: "Nice one!", emoji: "👍", points: 10 },
  { text: "Got it!", emoji: "📝", points: 10 },
  { text: "Logged!", emoji: "✨", points: 15 },
  { text: "Smart move!", emoji: "🧠", points: 15 },
];

// Streak messages
const STREAK_MESSAGES = [
  { min: 3, text: "3-day streak!", emoji: "🔥" },
  { min: 7, text: "Week warrior!", emoji: "💪" },
  { min: 14, text: "Two weeks!", emoji: "⭐" },
  { min: 30, text: "Monthly master!", emoji: "🏆" },
];

// Confetti burst function
const triggerConfetti = () => {
  confetti({
    particleCount: 100,
    spread: 70,
    origin: { y: 0.6 },
    colors: ['#10B981', '#6366F1', '#F59E0B', '#EC4899']
  });
};

// Mini confetti for quick saves
const miniConfetti = () => {
  confetti({
    particleCount: 30,
    spread: 50,
    origin: { y: 0.8 },
    colors: ['#10B981', '#1C1917']
  });
};

// Widget Page Component
const WidgetPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successData, setSuccessData] = useState(null);
  const [todayTotal, setTodayTotal] = useState(0);
  const [streak, setStreak] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [showStats, setShowStats] = useState(false);
  const inputRef = useRef(null);

  // Fetch today's stats
  useEffect(() => {
    fetchTodayStats();
  }, []);

  // Auto-focus amount input
  useEffect(() => {
    if (inputRef.current && !showSuccess) {
      inputRef.current.focus();
    }
  }, [showSuccess]);

  const fetchTodayStats = async () => {
    try {
      const res = await axios.get(`${API}/transactions`);
      const transactions = res.data;
      const today = new Date().toISOString().split("T")[0];
      
      // Today's total
      const todayExpenses = transactions.filter(
        t => t.date === today && t.type === "expense"
      );
      setTodayTotal(todayExpenses.reduce((sum, t) => sum + t.amount, 0));
      setTodayCount(todayExpenses.length);
      
      // Calculate streak (days with at least one expense)
      const dates = [...new Set(transactions.map(t => t.date))].sort().reverse();
      let currentStreak = 0;
      const checkDate = new Date();
      
      for (let i = 0; i < 30; i++) {
        const dateStr = checkDate.toISOString().split("T")[0];
        if (dates.includes(dateStr)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (i > 0) {
          break;
        } else {
          checkDate.setDate(checkDate.getDate() - 1);
        }
      }
      setStreak(currentStreak);
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const handleAmountChange = (value) => {
    // Only allow numbers and one decimal point
    const sanitized = value.replace(/[^0-9.]/g, '');
    const parts = sanitized.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(sanitized);
  };

  const handleQuickAmount = (value) => {
    setAmount(value.toString());
    // Auto-vibrate on mobile if supported
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleCategorySelect = (category) => {
    setSelectedCategory(category);
    if (navigator.vibrate) {
      navigator.vibrate(10);
    }
  };

  const handleSave = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter an amount first!");
      return;
    }
    if (!selectedCategory) {
      toast.error("Pick a category!");
      return;
    }

    setSaving(true);

    try {
      const today = new Date().toISOString().split("T")[0];
      
      await axios.post(`${API}/transactions`, {
        date: today,
        amount: parseFloat(amount),
        category: selectedCategory.name,
        merchant: selectedCategory.name,
        type: "expense",
      });

      // Calculate points and show success
      const message = SUCCESS_MESSAGES[Math.floor(Math.random() * SUCCESS_MESSAGES.length)];
      const isFirstToday = todayCount === 0;
      const isMilestone = (todayCount + 1) % 5 === 0;
      
      setSuccessData({
        ...message,
        amount: parseFloat(amount),
        category: selectedCategory,
        isFirstToday,
        isMilestone,
        bonusPoints: isFirstToday ? 20 : isMilestone ? 15 : 0,
      });
      
      setShowSuccess(true);
      
      // Trigger confetti for milestones
      if (isFirstToday || isMilestone) {
        triggerConfetti();
      } else {
        miniConfetti();
      }

      // Update stats
      setTodayTotal(prev => prev + parseFloat(amount));
      setTodayCount(prev => prev + 1);

      // Reset form
      setAmount("");
      setSelectedCategory(null);

    } catch (error) {
      console.error("Error saving:", error);
      toast.error("Oops! Try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSuccessContinue = () => {
    setShowSuccess(false);
    setSuccessData(null);
    // Ensure form is reset
    setAmount("");
    setSelectedCategory(null);
    // Focus input after a brief delay to ensure DOM is ready
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const goToFullApp = () => {
    navigate("/");
  };

  // Success Screen
  if (showSuccess && successData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 flex flex-col items-center justify-center p-6 text-white">
        {/* Emoji */}
        <div className="text-7xl mb-4 animate-bounce">
          {successData.category.emoji}
        </div>
        
        {/* Message */}
        <h1 className="font-heading text-3xl font-bold mb-2">
          {successData.text}
        </h1>
        
        {/* Amount */}
        <p className="text-5xl font-bold text-emerald-400 mb-6 tabular-nums">
          ${successData.amount.toFixed(2)}
        </p>
        
        {/* Points earned */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-2 bg-white/10 rounded-full px-4 py-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="font-semibold">+{successData.points} pts</span>
          </div>
          {successData.bonusPoints > 0 && (
            <div className="flex items-center gap-2 bg-emerald-500/20 rounded-full px-4 py-2 animate-pulse">
              <Trophy className="w-5 h-5 text-emerald-400" />
              <span className="font-semibold text-emerald-400">+{successData.bonusPoints} bonus!</span>
            </div>
          )}
        </div>
        
        {/* First today message */}
        {successData.isFirstToday && (
          <p className="text-white/60 mb-6">
            🌟 First expense today! Keep tracking!
          </p>
        )}
        
        {/* Milestone message */}
        {successData.isMilestone && !successData.isFirstToday && (
          <p className="text-white/60 mb-6">
            🎯 {todayCount} expenses logged today! Amazing!
          </p>
        )}
        
        {/* Actions */}
        <div className="flex gap-4 w-full max-w-xs">
          <button
            onClick={handleSuccessContinue}
            className="flex-1 h-14 rounded-2xl bg-white text-stone-900 font-semibold text-lg transition-transform active:scale-95"
            data-testid="add-another-btn"
          >
            Add Another
          </button>
          <button
            onClick={goToFullApp}
            className="h-14 px-6 rounded-2xl bg-white/10 text-white font-medium transition-transform active:scale-95"
          >
            <ArrowRight className="w-6 h-6" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col" data-testid="widget-page">
      {/* Header */}
      <div className="bg-stone-900 text-white px-6 py-5 rounded-b-3xl shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="font-heading font-bold text-xl">FlowIQ</span>
          </div>
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center gap-2 bg-white/10 rounded-full px-3 py-1.5"
          >
            <Flame className={`w-4 h-4 ${streak > 0 ? 'text-orange-400' : 'text-white/50'}`} />
            <span className="text-sm font-semibold">{streak} day{streak !== 1 ? 's' : ''}</span>
          </button>
        </div>
        
        {/* Today's stats */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/60 text-sm">Today's spending</p>
            <p className="text-2xl font-bold tabular-nums">${todayTotal.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-white/60 text-sm">Expenses logged</p>
            <p className="text-2xl font-bold">{todayCount}</p>
          </div>
        </div>
        
        {/* Streak banner */}
        {showStats && streak >= 3 && (
          <div className="mt-4 p-3 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-2xl flex items-center gap-3 animate-fade-in">
            <span className="text-2xl">
              {STREAK_MESSAGES.find(s => streak >= s.min)?.emoji || "🔥"}
            </span>
            <div>
              <p className="font-semibold">
                {STREAK_MESSAGES.find(s => streak >= s.min)?.text || `${streak}-day streak!`}
              </p>
              <p className="text-sm text-white/60">Keep it going!</p>
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 px-6 py-6 space-y-6">
        {/* Amount input */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-stone-500 mb-3">
            How much?
          </label>
          <div className="relative">
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-4xl font-bold text-stone-300">
              $
            </span>
            <input
              ref={inputRef}
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              placeholder="0.00"
              className="w-full pl-10 text-5xl font-bold text-stone-900 bg-transparent border-0 focus:outline-none focus:ring-0 placeholder:text-stone-200 tabular-nums"
              data-testid="widget-amount-input"
            />
          </div>
          
          {/* Quick amounts */}
          <div className="flex flex-wrap gap-2 mt-4">
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                onClick={() => handleQuickAmount(val)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                  parseFloat(amount) === val
                    ? "bg-stone-900 text-white shadow-md"
                    : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                }`}
                data-testid={`widget-quick-${val}`}
              >
                ${val}
              </button>
            ))}
          </div>
        </div>

        {/* Category selection */}
        <div className="bg-white rounded-3xl p-6 shadow-sm">
          <label className="block text-sm font-medium text-stone-500 mb-4">
            What for?
          </label>
          <div className="grid grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory?.name === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => handleCategorySelect(cat)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95 ${
                    isSelected
                      ? "bg-stone-900 text-white shadow-lg scale-105"
                      : "bg-stone-50 text-stone-600 hover:bg-stone-100"
                  }`}
                  data-testid={`widget-cat-${cat.shortcut}`}
                >
                  <div 
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isSelected ? "bg-white/20" : ""
                    }`}
                    style={{ backgroundColor: isSelected ? undefined : `${cat.color}15` }}
                  >
                    {isSelected ? (
                      <span className="text-xl">{cat.emoji}</span>
                    ) : (
                      <Icon className="w-5 h-5" style={{ color: cat.color }} />
                    )}
                  </div>
                  <span className="text-xs font-medium text-center leading-tight">
                    {cat.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="px-6 pb-8 pt-2">
        <button
          onClick={handleSave}
          disabled={saving || !amount || !selectedCategory}
          className={`w-full h-16 rounded-2xl font-semibold text-lg flex items-center justify-center gap-3 transition-all active:scale-98 ${
            saving || !amount || !selectedCategory
              ? "bg-stone-200 text-stone-400"
              : "bg-stone-900 text-white shadow-lg hover:shadow-xl"
          }`}
          data-testid="widget-save-btn"
        >
          {saving ? (
            <span className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <Check className="w-6 h-6" />
              Save Expense
            </>
          )}
        </button>
        
        {/* Link to full app */}
        <button
          onClick={goToFullApp}
          className="w-full mt-3 py-3 text-sm text-stone-500 font-medium hover:text-stone-700 transition-colors"
        >
          Open full dashboard →
        </button>
      </div>
    </div>
  );
};

export default WidgetPage;
