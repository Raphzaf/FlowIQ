import { useApi } from "../App";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  AlertTriangle,
  CheckCircle2
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
  Legend
} from "recharts";
import { Link } from "react-router-dom";

// Category colors
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

// Loading skeleton component
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

// Balance Card Component
const BalanceCard = ({ data, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-8 rounded-3xl border-stone-100 bg-white relative overflow-hidden" data-testid="balance-card-loading">
        <CardContent className="p-8">
          <Skeleton className="h-4 w-24 mb-4" />
          <Skeleton className="h-12 w-48 mb-6" />
          <div className="flex gap-8">
            <Skeleton className="h-16 w-32" />
            <Skeleton className="h-16 w-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-full lg:col-span-8 rounded-3xl border-stone-100 bg-white relative overflow-hidden balance-card" data-testid="balance-card">
      <CardContent className="p-8">
        <p className="text-sm font-medium text-stone-500 uppercase tracking-wider mb-2">Total Balance</p>
        <h2 className="font-heading text-5xl font-bold text-stone-900 tabular-nums mb-6">
          {formatCurrency(data?.total_balance || 0)}
        </h2>
        
        <div className="flex flex-wrap gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-income-light flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-income" />
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wider">Income</p>
              <p className="font-heading font-semibold text-lg text-stone-900 tabular-nums">
                {formatCurrency(data?.total_income || 0)}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-expense-light flex items-center justify-center">
              <TrendingDown className="w-5 h-5 text-expense" />
            </div>
            <div>
              <p className="text-xs text-stone-500 uppercase tracking-wider">Expenses</p>
              <p className="font-heading font-semibold text-lg text-stone-900 tabular-nums">
                {formatCurrency(data?.total_expenses || 0)}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Cashflow Prediction Card
const CashflowCard = ({ cashflow, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-4 rounded-3xl border-stone-100 bg-white" data-testid="cashflow-card-loading">
        <CardContent className="p-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-8 w-24 mb-4" />
          <Skeleton className="h-16 w-full" />
        </CardContent>
      </Card>
    );
  }

  const isWarning = cashflow?.is_warning;

  return (
    <Card className={`col-span-full lg:col-span-4 rounded-3xl border-stone-100 bg-white ${isWarning ? 'glow-expense' : 'glow-income'}`} data-testid="cashflow-card">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">Month-End Forecast</p>
          {isWarning ? (
            <div className="w-8 h-8 rounded-full bg-expense-light flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-expense" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-income-light flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-income" />
            </div>
          )}
        </div>
        
        <h3 className={`font-heading text-3xl font-bold tabular-nums mb-2 ${isWarning ? 'text-expense' : 'text-income'}`}>
          {formatCurrency(cashflow?.predicted_end_balance || 0)}
        </h3>
        
        <p className="text-sm text-stone-600 leading-relaxed">
          {cashflow?.message}
        </p>
        
        <div className="mt-4 pt-4 border-t border-stone-100">
          <div className="flex justify-between text-sm">
            <span className="text-stone-500">Daily avg spending</span>
            <span className="font-medium text-stone-900 tabular-nums">
              {formatCurrency(cashflow?.daily_average_spending || 0)}
            </span>
          </div>
          <div className="flex justify-between text-sm mt-2">
            <span className="text-stone-500">Days remaining</span>
            <span className="font-medium text-stone-900">{cashflow?.days_remaining || 0} days</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Spending Chart Component
const SpendingChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-8 rounded-3xl border-stone-100 bg-white" data-testid="spending-chart-loading">
        <CardHeader className="p-6 pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = data?.spending_by_month || [];

  return (
    <Card className="col-span-full lg:col-span-8 rounded-3xl border-stone-100 bg-white" data-testid="spending-chart">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="font-heading text-xl font-semibold text-stone-900">
          Monthly Spending
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height={256}>
            <BarChart data={chartData} barCategoryGap="20%">
              <XAxis 
                dataKey="month" 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#78716C', fontSize: 12 }}
              />
              <YAxis 
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#78716C', fontSize: 12 }}
                tickFormatter={(value) => `$${value / 1000}k`}
              />
              <Tooltip 
                formatter={(value) => [formatCurrency(value), 'Spending']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #E7E5E4',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Bar 
                dataKey="amount" 
                fill="#1C1917" 
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Category Breakdown Chart
const CategoryChart = ({ data, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full lg:col-span-4 rounded-3xl border-stone-100 bg-white" data-testid="category-chart-loading">
        <CardHeader className="p-6 pb-2">
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <Skeleton className="h-64 w-full rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const categories = data?.categories || {};
  const chartData = Object.entries(categories)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <Card className="col-span-full lg:col-span-4 rounded-3xl border-stone-100 bg-white" data-testid="category-chart">
      <CardHeader className="p-6 pb-2">
        <CardTitle className="font-heading text-xl font-semibold text-stone-900">
          By Category
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height={256}>
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
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
                  border: '1px solid #E7E5E4',
                  borderRadius: '12px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
                }}
              />
              <Legend 
                verticalAlign="bottom"
                height={36}
                formatter={(value) => <span className="text-xs text-stone-600">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};

// Quick Insights Preview
const QuickInsights = ({ insights, loading }) => {
  if (loading) {
    return (
      <Card className="col-span-full rounded-3xl border-stone-100 bg-white" data-testid="quick-insights-loading">
        <CardHeader className="p-6 pb-2">
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="p-6 pt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const topInsights = insights?.slice(0, 3) || [];

  const getInsightStyle = (type) => {
    switch (type) {
      case 'warning': return 'insight-warning bg-warning-light/30';
      case 'positive': return 'insight-positive bg-income-light/30';
      case 'tip': return 'insight-tip bg-stone-100';
      default: return 'insight-info bg-insight-light/30';
    }
  };

  return (
    <Card className="col-span-full rounded-3xl border-stone-100 bg-white" data-testid="quick-insights">
      <CardHeader className="p-6 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="font-heading text-xl font-semibold text-stone-900">
          Quick Insights
        </CardTitle>
        <Link 
          to="/insights" 
          className="flex items-center gap-1 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors"
          data-testid="view-all-insights-link"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </CardHeader>
      <CardContent className="p-6 pt-2">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {topInsights.map((insight, index) => (
            <div
              key={insight.id}
              className={`p-4 rounded-2xl ${getInsightStyle(insight.type)} animate-fade-in`}
              style={{ animationDelay: `${index * 100}ms` }}
              data-testid={`insight-card-${index}`}
            >
              <h4 className="font-heading font-semibold text-stone-900 mb-1">
                {insight.title}
              </h4>
              <p className="text-sm text-stone-600 line-clamp-2">
                {insight.description}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Main Dashboard Component
const Dashboard = () => {
  const { dashboardData, insights, cashflow, loading } = useApi();

  return (
    <div className="animate-fade-in" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mb-2">
          Dashboard
        </h1>
        <p className="text-stone-500">
          Your financial overview at a glance
        </p>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Balance Card - Large */}
        <BalanceCard data={dashboardData} loading={loading} />
        
        {/* Cashflow Prediction */}
        <CashflowCard cashflow={cashflow} loading={loading} />
        
        {/* Spending Chart */}
        <SpendingChart data={dashboardData} loading={loading} />
        
        {/* Category Breakdown */}
        <CategoryChart data={dashboardData} loading={loading} />
        
        {/* Quick Insights */}
        <QuickInsights insights={insights} loading={loading} />
      </div>
    </div>
  );
};

export default Dashboard;
