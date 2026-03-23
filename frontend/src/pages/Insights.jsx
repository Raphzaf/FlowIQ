import { useState, useEffect } from "react";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { 
  TrendingUp, 
  TrendingDown, 
  CreditCard, 
  PieChart, 
  Lightbulb,
  Calendar,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Info,
  AlertCircle,
  Coins,
  PiggyBank,
  Minus,
  Target,
  Brain,
  Heart,
  Sparkles,
  RefreshCw,
  Zap
} from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

// Premium Skeleton
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Icon mapping
const ICON_MAP = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'trending-flat': Minus,
  'credit-card': CreditCard,
  'pie-chart': PieChart,
  'lightbulb': Lightbulb,
  'calendar': Calendar,
  'upload': Upload,
  'alert-triangle': AlertTriangle,
  'alert-circle': AlertCircle,
  'check-circle': CheckCircle2,
  'coins': Coins,
  'piggy-bank': PiggyBank,
  'info': Info,
};

// Insight styling config
const getInsightConfig = (type) => {
  switch (type) {
    case 'critical':
      return {
        cardClass: 'insight-critical',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        badge: 'badge-error',
        badgeText: 'Urgent',
      };
    case 'warning':
      return {
        cardClass: 'insight-warning',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        badge: 'badge-warning',
        badgeText: 'Attention',
      };
    case 'positive':
      return {
        cardClass: 'insight-positive',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        badge: 'badge-success',
        badgeText: 'Good News',
      };
    case 'tip':
      return {
        cardClass: 'insight-tip',
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        badge: 'badge-info',
        badgeText: 'Tip',
      };
    default:
      return {
        cardClass: 'insight-info',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        badge: 'badge-neutral',
        badgeText: 'Insight',
      };
  }
};

// Advanced Insight Card
const InsightCard = ({ insight, index }) => {
  const config = getInsightConfig(insight.type);
  const IconComponent = ICON_MAP[insight.icon] || Info;

  return (
    <div 
      className={`insight-card ${config.cardClass} animate-fade-in-up hover-lift`}
      style={{ animationDelay: `${index * 60}ms` }}
      data-testid={`insight-card-${insight.id}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
          <IconComponent className={`w-5 h-5 ${config.iconColor}`} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Badge */}
          <span className={`badge ${config.badge} mb-2`}>
            {config.badgeText}
          </span>
          
          {/* Headline */}
          <h3 className="font-heading font-semibold text-stone-900 mb-1">
            {insight.headline}
          </h3>
          
          {/* Description */}
          <p className="text-sm text-stone-600 leading-relaxed">
            {insight.description}
          </p>
          
          {/* Data Points */}
          {insight.data && Object.keys(insight.data).length > 0 && (
            <div className="mt-4 pt-3 border-t border-black/5 flex flex-wrap gap-4">
              {insight.data.change_pct !== undefined && (
                <div className="text-sm">
                  <span className="text-stone-500">Change: </span>
                  <span className={`font-semibold ${insight.data.change_pct > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {insight.data.change_pct > 0 ? '+' : ''}{insight.data.change_pct}%
                  </span>
                </div>
              )}
              {insight.data.monthly_savings && (
                <div className="text-sm">
                  <span className="text-stone-500">Save: </span>
                  <span className="font-semibold text-emerald-600">
                    ${insight.data.monthly_savings.toLocaleString()}/mo
                  </span>
                </div>
              )}
              {insight.data.total_monthly && (
                <div className="text-sm">
                  <span className="text-stone-500">Cost: </span>
                  <span className="font-semibold text-stone-900">
                    ${insight.data.total_monthly.toLocaleString()}/mo
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Spending Personality Card - Premium Gradient
const PersonalityCard = ({ personality }) => {
  if (!personality || personality.type === 'unknown') {
    return null;
  }

  const gradients = {
    comfort_spender: 'from-amber-500 via-orange-500 to-red-500',
    impulse_buyer: 'from-rose-500 via-pink-500 to-fuchsia-500',
    disciplined_saver: 'from-emerald-500 via-teal-500 to-cyan-500',
    lifestyle_spender: 'from-violet-500 via-purple-500 to-indigo-500',
  };

  const gradient = gradients[personality.type] || gradients.comfort_spender;

  return (
    <div 
      className={`rounded-3xl bg-gradient-to-br ${gradient} p-8 text-white shadow-premium-lg animate-fade-in-up`}
      data-testid="personality-card"
    >
      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
          <Brain className="w-7 h-7 text-white" />
        </div>
        <div>
          <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-1">
            Your Spending Personality
          </p>
          <h2 className="font-heading text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <span>{personality.emoji}</span>
            <span>{personality.label}</span>
          </h2>
        </div>
      </div>

      {/* Description */}
      <p className="text-white/80 leading-relaxed mb-6">
        {personality.description}
      </p>

      {/* Traits */}
      <div className="flex flex-wrap gap-2 mb-6">
        {personality.traits?.map((trait, i) => (
          <span 
            key={i}
            className="px-3 py-1.5 rounded-full text-sm font-medium bg-white/15 backdrop-blur-sm text-white"
          >
            {trait}
          </span>
        ))}
      </div>

      {/* Recommendations */}
      <div className="pt-6 border-t border-white/10">
        <p className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-4">
          Personalized Tips
        </p>
        <div className="space-y-3">
          {personality.recommendations?.slice(0, 2).map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <Zap className="w-4 h-4 text-white/70 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-white/90 leading-relaxed">{rec}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Financial Health Score Card
const HealthScoreCard = ({ healthScore }) => {
  if (!healthScore || healthScore.score === 0) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 80) return { ring: 'ring-emerald-200', text: 'text-emerald-600', bg: 'bg-emerald-500' };
    if (score >= 60) return { ring: 'ring-amber-200', text: 'text-amber-600', bg: 'bg-amber-500' };
    return { ring: 'ring-rose-200', text: 'text-rose-600', bg: 'bg-rose-500' };
  };

  const colors = getScoreColor(healthScore.score);

  const getFactorColor = (status) => {
    switch (status) {
      case 'excellent': return { text: 'text-emerald-600', bg: 'bg-emerald-500' };
      case 'good': return { text: 'text-emerald-500', bg: 'bg-emerald-400' };
      case 'moderate':
      case 'building': return { text: 'text-amber-500', bg: 'bg-amber-400' };
      default: return { text: 'text-rose-500', bg: 'bg-rose-400' };
    }
  };

  return (
    <Card className="card-premium rounded-3xl overflow-hidden animate-fade-in-up delay-100" data-testid="health-score-card">
      <CardContent className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
            <Heart className="w-5 h-5 text-rose-500" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-lg text-stone-900">
              Financial Health
            </h3>
            <p className="text-sm text-stone-500">Based on your patterns</p>
          </div>
        </div>

        {/* Score Circle */}
        <div className="flex justify-center mb-8">
          <div className={`relative w-36 h-36 rounded-full ring-8 ${colors.ring} flex items-center justify-center bg-white shadow-inner`}>
            <div className="text-center">
              <p className={`font-heading text-5xl font-bold ${colors.text} tabular-nums`}>
                {healthScore.score}
              </p>
              <p className="text-stone-500 text-sm font-semibold">{healthScore.grade}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-center text-stone-600 text-sm mb-8">
          {healthScore.description}
        </p>

        {/* Factors */}
        <div className="space-y-4">
          <p className="text-xs font-semibold text-stone-500 uppercase tracking-wider">
            Score Breakdown
          </p>
          {healthScore.factors?.map((factor, i) => {
            const factorColors = getFactorColor(factor.status);
            const percentage = (factor.score / factor.max) * 100;
            return (
              <div key={i} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">{factor.name}</span>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-semibold ${factorColors.text} capitalize`}>
                      {factor.status}
                    </span>
                    <span className="text-xs text-stone-400 tabular-nums">
                      {factor.score}/{factor.max}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${factorColors.bg} rounded-full transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Improvement Tip */}
        {healthScore.improvement_tip && (
          <div className="mt-6 p-4 rounded-2xl bg-stone-50">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-stone-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-stone-600">{healthScore.improvement_tip}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// Empty State
const EmptyState = () => (
  <div className="text-center py-20 animate-fade-in" data-testid="insights-empty">
    <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mx-auto mb-6">
      <Lightbulb className="w-10 h-10 text-stone-400" />
    </div>
    <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
      No Insights Yet
    </h3>
    <p className="text-stone-500 max-w-sm mx-auto mb-8">
      Upload your bank statement to unlock personalized financial insights and recommendations.
    </p>
    <Link to="/upload">
      <Button 
        className="rounded-full bg-stone-900 hover:bg-stone-800 text-white px-8 h-12 text-base font-medium shadow-premium hover:shadow-premium-lg transition-all hover:-translate-y-0.5"
        data-testid="upload-from-insights-btn"
      >
        <Upload className="w-5 h-5 mr-2" />
        Upload Statement
      </Button>
    </Link>
  </div>
);

// Loading State
const LoadingState = () => (
  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" data-testid="insights-loading">
    <div className="lg:col-span-7 space-y-4">
      <Skeleton className="h-8 w-48 mb-6" />
      {[1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-2xl" />
      ))}
    </div>
    <div className="lg:col-span-5 space-y-6">
      <Skeleton className="h-80 w-full rounded-3xl" />
      <Skeleton className="h-96 w-full rounded-3xl" />
    </div>
  </div>
);

// Main Insights Page
const Insights = () => {
  const { API } = useApi();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  const fetchAdvancedInsights = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/insights-advanced`);
      setData(response.data);
    } catch (error) {
      console.error("Error fetching advanced insights:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdvancedInsights();
  }, [API]);

  const hasData = data && data.insights && data.insights.length > 0 && data.insights[0].id !== 'no_data';

  return (
    <div data-testid="insights-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4 animate-fade-in">
        <div>
          <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
            Smart Insights
          </h1>
          <p className="text-stone-500">
            AI-powered analysis of your financial patterns
          </p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAdvancedInsights}
          className="rounded-full border-stone-200 hover:bg-stone-50 self-start sm:self-auto"
          data-testid="refresh-insights-btn"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {loading ? (
        <LoadingState />
      ) : !hasData ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          {/* Left Column - Insights */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center gap-2 mb-4 animate-fade-in">
              <Sparkles className="w-5 h-5 text-violet-500" />
              <h2 className="font-heading text-lg font-semibold text-stone-900">
                Your Financial Insights
              </h2>
            </div>
            
            {data.insights.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index} />
            ))}
          </div>

          {/* Right Column - Personality & Health */}
          <div className="lg:col-span-5 space-y-6">
            <PersonalityCard personality={data.personality} />
            <HealthScoreCard healthScore={data.health_score} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Insights;
