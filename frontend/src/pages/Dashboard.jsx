import { useEffect, useState, useRef } from "react";
import { useApi } from "../App";
import useWindowWidth from "../hooks/useWindowWidth";
import { Card, CardContent } from "../components/ui/card";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Smartphone,
  X,
  Download
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from "recharts";
import { Link } from "react-router-dom";

// Install App Banner Component
const InstallAppBanner = () => {
  const [show, setShow] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState(null);

  useEffect(() => {
    // Check if already installed or dismissed
    const dismissed = localStorage.getItem('installBannerDismissed');
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    
    if (dismissed || isStandalone) return;

    // Listen for install prompt
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    
    // Show banner on mobile after a delay
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile && !dismissed) {
      setTimeout(() => setShow(true), 3000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShow(false);
      }
      setDeferredPrompt(null);
    } else {
      // For iOS, show instructions
      alert('Tap the Share button, then "Add to Home Screen" to install FlowIQ');
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('installBannerDismissed', 'true');
  };

  if (!show) return null;

  return (
    <div className="col-span-full animate-fade-in-up" data-testid="install-banner">
      <div className="relative bg-gradient-to-r from-violet-600 to-indigo-600 rounded-3xl p-6 text-white overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-40 h-40 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white rounded-full blur-3xl" />
        </div>
        
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-7 h-7" />
          </div>
          
          <div className="flex-1">
            <h3 className="font-heading font-bold text-lg mb-1">
              Ajouter le widget sur votre téléphone
            </h3>
            <p className="text-white/80 text-sm">
              Suivez vos dépenses en 2 secondes depuis votre écran d'accueil
            </p>
          </div>
          
          <button
            onClick={handleInstall}
            className="flex items-center gap-2 bg-white text-indigo-600 px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-white/90 transition-colors flex-shrink-0"
            data-testid="install-btn"
          >
            <Download className="w-4 h-4" />
            Installer
          </button>
        </div>
      </div>
    </div>
  );
};

// Category colors - Premium palette
const MOBILE_BREAKPOINT = 768;

const CATEGORY_COLORS = {
  "Food & Dining": "#F43F5E",
  "Transport": "#6366F1",
  "Shopping": "#10B981",
  "Subscriptions": "#F59E0B",
  "Entertainment": "#EC4899",
  "Bills & Utilities": "#8B5CF6",
  "Health": "#14B8A6",
  "Travel": "#0EA5E9",
  "Income": "#10B981",
  "Uncategorized": "#78716C",
};

// Premium Skeleton Component
const Skeleton = ({ className, dark = false }) => (
  <div className={`${dark ? 'skeleton-dark' : 'skeleton'} ${className}`} />
);

// Animated Number Counter
const AnimatedNumber = ({ value, prefix = "", suffix = "", decimals = 0 }) => {
  const [displayValue, setDisplayValue] = useState(0);
  const countRef = useRef(null);
  
  useEffect(() => {
    const target = parseFloat(value) || 0;
    const duration = 1000;
    const startTime = Date.now();
    const startValue = displayValue;
    
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + (target - startValue) * easeOut;
      
      setDisplayValue(current);
      
      if (progress < 1) {
        countRef.current = requestAnimationFrame(animate);
      }
    };
    
    countRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (countRef.current) {
        cancelAnimationFrame(countRef.current);
      }
    };
  }, [value]);
  
  const formatNumber = (num) => {
    if (Math.abs(num) >= 1000) {
      return num.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      });
    }
    return num.toFixed(decimals);
  };
  
  return (
    <span className="tabular-nums">
      {prefix}{formatNumber(displayValue)}{suffix}
    </span>
  );
};

// Format currency helper
const formatCurrency = (amount, compact = false) => {
  if (compact && Math.abs(amount) >= 1000) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(amount);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Hero Balance Card - Premium Design
const HeroBalanceCard = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="col-span-full md:col-span-8 card-hero rounded-3xl p-5 sm:p-8 lg:p-10" data-testid="balance-card-loading">
        <Skeleton className="h-5 w-32 mb-4" dark />
        <Skeleton className="h-16 w-64 mb-8" dark />
        <div className="flex gap-8">
          <Skeleton className="h-20 w-36" dark />
          <Skeleton className="h-20 w-36" dark />
        </div>
      </div>
    );
  }

  const isPositive = (data?.total_balance || 0) >= 0;

  return (
    <div 
      className="col-span-full md:col-span-8 card-hero rounded-3xl p-5 sm:p-8 lg:p-10 text-white animate-fade-in-up"
      data-testid="balance-card"
    >
      <div className="relative z-10">
        {/* Label */}
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-5 h-5 text-white/60" />
          <p className="metric-label text-white/60">Total Balance</p>
        </div>
        
        {/* Balance Amount */}
        <h1 className="metric-value text-5xl lg:text-6xl text-white mb-8">
          <AnimatedNumber 
            value={Math.abs(data?.total_balance || 0)} 
            prefix={isPositive ? "$" : "-$"}
            decimals={0}
          />
        </h1>
        
        {/* Income / Expense Row */}
        <div className="flex flex-wrap gap-6 lg:gap-10">
          {/* Income */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 flex items-center justify-center backdrop-blur-sm">
              <ArrowUpRight className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-white/50 font-medium mb-0.5">Income</p>
              <p className="text-xl font-semibold text-white tabular-nums">
                <AnimatedNumber value={data?.total_income || 0} prefix="$" />
              </p>
            </div>
          </div>
          
          {/* Expenses */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center backdrop-blur-sm">
              <ArrowDownRight className="w-6 h-6 text-rose-400" />
            </div>
            <div>
              <p className="text-sm text-white/50 font-medium mb-0.5">Expenses</p>
              <p className="text-xl font-semibold text-white tabular-nums">
                <AnimatedNumber value={data?.total_expenses || 0} prefix="$" />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Cashflow Prediction Card - Compact Premium
const CashflowCard = ({ cashflow, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full md:col-span-4 card-premium rounded-3xl" data-testid="cashflow-card-loading">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-4 w-36 mb-6" />
          <Skeleton className="h-12 w-32 mb-4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isWarning = cashflow?.is_warning;
  const projectedBalance = cashflow?.predicted_end_balance || 0;

  return (
    <Card 
      className={`col-span-full md:col-span-4 card-premium rounded-3xl overflow-hidden animate-fade-in-up delay-100 ${
        isWarning ? 'ring-1 ring-rose-200' : ''
      }`}
      data-testid="cashflow-card"
    >
      <CardContent className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-stone-400" />
            <p className="text-sm font-medium text-stone-500">Month-End Forecast</p>
          </div>
          {isWarning ? (
            <span className="badge badge-error">Alert</span>
          ) : (
            <span className="badge badge-success">On Track</span>
          )}
        </div>
        
        {/* Projected Balance */}
        <div className="mb-6">
          <p className={`metric-value text-4xl ${isWarning ? 'text-rose-600' : 'text-emerald-600'}`}>
            <AnimatedNumber 
              value={Math.abs(projectedBalance)} 
              prefix={projectedBalance >= 0 ? "$" : "-$"}
            />
          </p>
          <p className="text-sm text-stone-500 mt-1">projected balance</p>
        </div>
        
        {/* Stats */}
        <div className="space-y-3 pt-4 border-t border-stone-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Daily average</span>
            <span className="text-sm font-semibold text-stone-900 tabular-nums">
              ${(cashflow?.daily_average_spending || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Days remaining</span>
            <span className="text-sm font-semibold text-stone-900">
              {cashflow?.days_remaining || 0} days
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Monthly Spending Chart - Premium Design
const SpendingChart = ({ data, loading }) => {
  const windowWidth = useWindowWidth();
  if (loading) {
    return (
      <Card className="col-span-full md:col-span-8 card-premium rounded-3xl" data-testid="spending-chart-loading">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-6 w-44 mb-8" />
          <Skeleton className="h-72 w-full rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.spending_by_month || [];

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-lg border border-stone-100 rounded-2xl px-4 py-3 shadow-premium">
          <p className="font-heading font-semibold text-stone-900 mb-1">{label}</p>
          <p className="text-sm text-stone-600">
            Spent: <span className="font-semibold text-stone-900">{formatCurrency(payload[0].value)}</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-full md:col-span-8 card-premium rounded-3xl animate-fade-in-up delay-150" data-testid="spending-chart">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            Monthly Spending
          </h3>
          <span className="text-sm text-stone-500">Last 6 months</span>
        </div>
        
        <div className="h-56 md:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="25%">
              <defs>
                <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#1C1917" stopOpacity={1}/>
                  <stop offset="100%" stopColor="#44403C" stopOpacity={1}/>
                </linearGradient>
              </defs>
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8A29E', fontSize: windowWidth < MOBILE_BREAKPOINT ? 10 : 12, fontWeight: 500 }}
                dy={8}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#A8A29E', fontSize: windowWidth < MOBILE_BREAKPOINT ? 10 : 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                dx={-8}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)', radius: 8 }} />
              <Bar 
                dataKey="amount" 
                fill="url(#barGradient)"
                radius={[10, 10, 10, 10]}
                maxBarSize={48}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Category Breakdown - Donut Chart
const CategoryChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full md:col-span-4 card-premium rounded-3xl" data-testid="category-chart-loading">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-6 w-36 mb-8" />
          <div className="flex justify-center">
            <Skeleton className="h-48 w-48 rounded-full" />
          </div>
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const categories = data?.categories || {};
  const chartData = Object.entries(categories)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
  
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  return (
    <Card className="col-span-full md:col-span-4 card-premium rounded-3xl animate-fade-in-up delay-200" data-testid="category-chart">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <h3 className="font-heading text-lg font-semibold text-stone-900 mb-6">
          Spending by Category
        </h3>
        
        {/* Donut Chart */}
        <div className="h-44 md:h-52 mb-4 md:mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[entry.name] || '#78716C'}
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.08)',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Legend */}
        <div className="space-y-3">
          {chartData.map((item, index) => {
            const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : 0;
            return (
              <div key={index} className="flex items-center justify-between group">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: CATEGORY_COLORS[item.name] || '#78716C' }}
                  />
                  <span className="text-sm text-stone-600 group-hover:text-stone-900 transition-colors">
                    {item.name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-stone-900 tabular-nums">
                    {formatCurrency(item.value)}
                  </span>
                  <span className="text-xs text-stone-400 w-8 text-right">{pct}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Insights Section
const QuickInsights = ({ insights, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full card-premium rounded-3xl" data-testid="quick-insights-loading">
        <CardContent className="p-4 sm:p-6 lg:p-8">
          <Skeleton className="h-6 w-40 mb-6" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-2xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const topInsights = insights?.slice(0, 3) || [];

  const getInsightStyle = (type) => {
    switch (type) {
      case 'warning':
      case 'critical':
        return 'insight-warning';
      case 'positive':
        return 'insight-positive';
      case 'tip':
        return 'insight-tip';
      default:
        return 'insight-info';
    }
  };

  const getInsightIcon = (type) => {
    switch (type) {
      case 'warning':
      case 'critical':
        return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'positive':
        return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      default:
        return <Sparkles className="w-5 h-5 text-indigo-600" />;
    }
  };

  return (
    <Card className="col-span-full card-premium rounded-3xl animate-fade-in-up delay-250" data-testid="quick-insights">
      <CardContent className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            Quick Insights
          </h3>
          <Link 
            to="/insights" 
            className="flex items-center gap-1.5 text-sm font-medium text-stone-500 hover:text-stone-900 transition-colors group"
            data-testid="view-all-insights-link"
          >
            View all 
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topInsights.map((insight, index) => (
            <div
              key={insight.id}
              className={`insight-card ${getInsightStyle(insight.type)} animate-fade-in-up`}
              style={{ animationDelay: `${(index + 3) * 80}ms` }}
              data-testid={`insight-preview-${index}`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  {getInsightIcon(insight.type)}
                </div>
                <div className="min-w-0">
                  <h4 className="font-semibold text-stone-900 text-sm mb-1 line-clamp-1">
                    {insight.title}
                  </h4>
                  <p className="text-sm text-stone-600 line-clamp-2 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Empty state shown when user has no transactions yet
const DashboardEmptyState = () => (
  <div
    className="col-span-full flex flex-col items-center justify-center py-20 text-center animate-fade-in-up"
    data-testid="dashboard-empty-state"
  >
    <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mb-6">
      <Wallet className="w-10 h-10 text-stone-300" />
    </div>
    <h2 className="font-heading text-2xl font-bold text-stone-900 mb-2">
      No transactions yet
    </h2>
    <p className="text-stone-500 mb-8 max-w-sm">
      Import a CSV or connect a bank to start seeing your financial insights here.
    </p>
    <div className="flex flex-col sm:flex-row gap-3">
      <Link
        to="/upload"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 transition-colors text-sm"
        data-testid="empty-goto-upload"
      >
        <ArrowRight className="w-4 h-4" />
        Import CSV
      </Link>
      <Link
        to="/banks"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors text-sm"
        data-testid="empty-goto-banks"
      >
        Connect a bank
      </Link>
      <Link
        to="/onboarding"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-medium hover:bg-stone-50 transition-colors text-sm"
        data-testid="empty-goto-onboarding"
      >
        Resume setup
      </Link>
    </div>
  </div>
);

// Main Dashboard Component
const Dashboard = () => {
  const { dashboardData, insights, cashflow, transactions, loading } = useApi();

  const hasTransactions = transactions && transactions.length > 0;

  return (
    <div data-testid="dashboard-page">
      {/* Page Header */}
      <div className="mb-8 animate-fade-in">
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
          Dashboard
        </h1>
        <p className="text-stone-500">
          Your financial overview at a glance
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 lg:gap-6">
        {/* Install App Banner */}
        <InstallAppBanner />

        {/* Show empty state if no transactions and not loading */}
        {!loading && !hasTransactions ? (
          <DashboardEmptyState />
        ) : (
          <>
            {/* Hero Balance Card - Spans 8 cols */}
            <HeroBalanceCard data={dashboardData} loading={loading} />
            
            {/* Cashflow Prediction - Spans 4 cols */}
            <CashflowCard cashflow={cashflow} loading={loading} />
            
            {/* Monthly Spending Chart - Spans 8 cols */}
            <SpendingChart data={dashboardData} loading={loading} />
            
            {/* Category Breakdown - Spans 4 cols */}
            <CategoryChart data={dashboardData} loading={loading} />
            
            {/* Quick Insights - Full width */}
            <QuickInsights insights={insights} loading={loading} />
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
