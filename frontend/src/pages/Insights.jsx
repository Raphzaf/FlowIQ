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
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";
import axios from "axios";

// Loading skeleton component
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Icon mapping for insights
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

// Get insight styling based on type
const getInsightConfig = (type) => {
  switch (type) {
    case 'critical':
      return {
        bgColor: 'bg-gradient-to-br from-red-50 to-rose-50',
        borderColor: 'border-l-4 border-l-rose-500',
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        badgeColor: 'bg-rose-100 text-rose-700',
      };
    case 'warning':
      return {
        bgColor: 'bg-gradient-to-br from-amber-50 to-orange-50',
        borderColor: 'border-l-4 border-l-amber-500',
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        badgeColor: 'bg-amber-100 text-amber-700',
      };
    case 'positive':
      return {
        bgColor: 'bg-gradient-to-br from-emerald-50 to-teal-50',
        borderColor: 'border-l-4 border-l-emerald-500',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        badgeColor: 'bg-emerald-100 text-emerald-700',
      };
    case 'tip':
      return {
        bgColor: 'bg-gradient-to-br from-violet-50 to-purple-50',
        borderColor: 'border-l-4 border-l-violet-500',
        iconBg: 'bg-violet-100',
        iconColor: 'text-violet-600',
        badgeColor: 'bg-violet-100 text-violet-700',
      };
    default:
      return {
        bgColor: 'bg-gradient-to-br from-blue-50 to-indigo-50',
        borderColor: 'border-l-4 border-l-indigo-500',
        iconBg: 'bg-indigo-100',
        iconColor: 'text-indigo-600',
        badgeColor: 'bg-indigo-100 text-indigo-700',
      };
  }
};

// Type badge labels
const TYPE_LABELS = {
  critical: 'Urgent',
  warning: 'Attention',
  positive: 'Good News',
  tip: 'Tip',
  info: 'Insight',
};

// Single Advanced Insight Card
const InsightCard = ({ insight, index }) => {
  const config = getInsightConfig(insight.type);
  const IconComponent = ICON_MAP[insight.icon] || Info;

  return (
    <Card 
      className={`rounded-3xl border-0 ${config.borderColor} ${config.bgColor} overflow-hidden animate-fade-in card-hover cursor-default`}
      style={{ animationDelay: `${index * 80}ms` }}
      data-testid={`insight-card-${insight.id}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={`w-12 h-12 rounded-2xl ${config.iconBg} flex items-center justify-center flex-shrink-0 shadow-sm`}>
            <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Badge & Title Row */}
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${config.badgeColor}`}>
                {TYPE_LABELS[insight.type] || 'Insight'}
              </span>
            </div>
            
            {/* Headline */}
            <h3 className="font-heading font-semibold text-lg text-stone-900 mb-1">
              {insight.headline}
            </h3>
            
            {/* Description */}
            <p className="text-stone-600 leading-relaxed text-sm">
              {insight.description}
            </p>
            
            {/* Data Points (if available) */}
            {insight.data && Object.keys(insight.data).length > 0 && (
              <div className="mt-4 pt-4 border-t border-stone-200/50">
                <div className="flex flex-wrap gap-4">
                  {insight.data.change_pct !== undefined && (
                    <div className="text-sm">
                      <span className="text-stone-500">Change:</span>
                      <span className={`ml-1 font-semibold ${insight.data.change_pct > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {insight.data.change_pct > 0 ? '+' : ''}{insight.data.change_pct}%
                      </span>
                    </div>
                  )}
                  {insight.data.monthly_savings && (
                    <div className="text-sm">
                      <span className="text-stone-500">Potential savings:</span>
                      <span className="ml-1 font-semibold text-emerald-600">
                        ${insight.data.monthly_savings.toLocaleString()}/mo
                      </span>
                    </div>
                  )}
                  {insight.data.total_monthly && (
                    <div className="text-sm">
                      <span className="text-stone-500">Monthly cost:</span>
                      <span className="ml-1 font-semibold text-stone-900">
                        ${insight.data.total_monthly.toLocaleString()}
                      </span>
                    </div>
                  )}
                  {insight.data.ratio && (
                    <div className="text-sm">
                      <span className="text-stone-500">Ratio:</span>
                      <span className="ml-1 font-semibold text-stone-900">
                        {insight.data.ratio}x
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Spending Personality Card
const PersonalityCard = ({ personality }) => {
  if (!personality || personality.type === 'unknown') {
    return null;
  }

  const personalityColors = {
    comfort_spender: {
      bg: 'bg-gradient-to-br from-amber-500 to-orange-600',
      accent: 'bg-amber-400/20',
    },
    impulse_buyer: {
      bg: 'bg-gradient-to-br from-rose-500 to-pink-600',
      accent: 'bg-rose-400/20',
    },
    disciplined_saver: {
      bg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
      accent: 'bg-emerald-400/20',
    },
    lifestyle_spender: {
      bg: 'bg-gradient-to-br from-violet-500 to-purple-600',
      accent: 'bg-violet-400/20',
    },
  };

  const colors = personalityColors[personality.type] || personalityColors.comfort_spender;

  return (
    <Card 
      className={`rounded-3xl border-0 ${colors.bg} text-white overflow-hidden shadow-xl`}
      data-testid="personality-card"
    >
      <CardContent className="p-8">
        <div className="flex items-start gap-4 mb-6">
          <div className={`w-16 h-16 rounded-2xl ${colors.accent} flex items-center justify-center`}>
            <Brain className="w-8 h-8 text-white" />
          </div>
          <div>
            <p className="text-white/70 text-sm font-medium uppercase tracking-wider mb-1">
              Your Spending Personality
            </p>
            <h2 className="font-heading text-3xl font-bold flex items-center gap-2">
              {personality.emoji} {personality.label}
            </h2>
          </div>
        </div>

        <p className="text-white/90 leading-relaxed mb-6">
          {personality.description}
        </p>

        {/* Traits */}
        <div className="flex flex-wrap gap-2 mb-6">
          {personality.traits?.map((trait, i) => (
            <span 
              key={i}
              className={`px-3 py-1 rounded-full text-sm font-medium ${colors.accent} text-white`}
            >
              {trait}
            </span>
          ))}
        </div>

        {/* Recommendations */}
        <div className="space-y-3">
          <p className="text-white/70 text-sm font-medium uppercase tracking-wider">
            Personalized Tips
          </p>
          {personality.recommendations?.map((rec, i) => (
            <div key={i} className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-white/70 flex-shrink-0 mt-0.5" />
              <p className="text-white/90 text-sm">{rec}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

// Financial Health Score Card
const HealthScoreCard = ({ healthScore }) => {
  if (!healthScore || healthScore.score === 0) {
    return null;
  }

  const getScoreColor = (score) => {
    if (score >= 80) return { text: 'text-emerald-600', bg: 'bg-emerald-500', ring: 'ring-emerald-500/20' };
    if (score >= 60) return { text: 'text-amber-600', bg: 'bg-amber-500', ring: 'ring-amber-500/20' };
    return { text: 'text-rose-600', bg: 'bg-rose-500', ring: 'ring-rose-500/20' };
  };

  const scoreColors = getScoreColor(healthScore.score);

  const getFactorColor = (status) => {
    switch (status) {
      case 'excellent': return 'text-emerald-600';
      case 'good': return 'text-emerald-500';
      case 'moderate':
      case 'building': return 'text-amber-500';
      default: return 'text-rose-500';
    }
  };

  return (
    <Card className="rounded-3xl border-stone-100 bg-white overflow-hidden shadow-lg" data-testid="health-score-card">
      <CardContent className="p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-rose-100 to-pink-100 flex items-center justify-center">
            <Heart className="w-6 h-6 text-rose-500" />
          </div>
          <div>
            <h3 className="font-heading font-semibold text-xl text-stone-900">
              Financial Health Score
            </h3>
            <p className="text-sm text-stone-500">Based on your spending patterns</p>
          </div>
        </div>

        {/* Score Circle */}
        <div className="flex items-center justify-center mb-8">
          <div className={`relative w-40 h-40 rounded-full ${scoreColors.ring} ring-8 flex items-center justify-center bg-white shadow-inner`}>
            <div className="text-center">
              <p className={`font-heading text-5xl font-bold ${scoreColors.text}`}>
                {healthScore.score}
              </p>
              <p className="text-stone-500 font-medium">{healthScore.grade}</p>
            </div>
          </div>
        </div>

        {/* Description */}
        <p className="text-center text-stone-600 mb-6">
          {healthScore.description}
        </p>

        {/* Factors */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-stone-500 uppercase tracking-wider">
            Score Breakdown
          </p>
          {healthScore.factors?.map((factor, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">{factor.name}</span>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium ${getFactorColor(factor.status)}`}>
                    {factor.status}
                  </span>
                  <span className="text-sm text-stone-500">
                    {factor.score}/{factor.max}
                  </span>
                </div>
              </div>
              <Progress 
                value={(factor.score / factor.max) * 100} 
                className="h-2"
              />
              <p className="text-xs text-stone-500">{factor.detail}</p>
            </div>
          ))}
        </div>

        {/* Improvement Tip */}
        {healthScore.improvement_tip && (
          <div className="mt-6 p-4 rounded-2xl bg-stone-50">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-stone-600 flex-shrink-0 mt-0.5" />
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
  <div className="text-center py-16" data-testid="insights-empty">
    <div className="w-20 h-20 rounded-3xl bg-stone-100 flex items-center justify-center mx-auto mb-6">
      <Lightbulb className="w-10 h-10 text-stone-400" />
    </div>
    <h3 className="font-heading text-xl font-semibold text-stone-900 mb-2">
      No Insights Yet
    </h3>
    <p className="text-stone-500 max-w-md mx-auto mb-6">
      Upload your bank statement to get personalized financial insights and recommendations.
    </p>
    <Link to="/upload">
      <Button 
        className="rounded-full bg-stone-900 hover:bg-stone-800 text-white px-6"
        data-testid="upload-from-insights-btn"
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload Statement
      </Button>
    </Link>
  </div>
);

// Loading State
const LoadingState = () => (
  <div className="space-y-6" data-testid="insights-loading">
    {/* Personality Skeleton */}
    <Skeleton className="h-64 w-full rounded-3xl" />
    
    {/* Health Score Skeleton */}
    <Skeleton className="h-96 w-full rounded-3xl" />
    
    {/* Insights Skeleton */}
    {[1, 2, 3].map((i) => (
      <Skeleton key={i} className="h-32 w-full rounded-3xl" />
    ))}
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
    <div className="animate-fade-in" data-testid="insights-page">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mb-2">
            Smart Insights
          </h1>
          <p className="text-stone-500">
            AI-powered analysis of your financial patterns
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAdvancedInsights}
          className="rounded-full"
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Insights */}
          <div className="lg:col-span-7 space-y-4">
            <h2 className="font-heading text-lg font-semibold text-stone-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              Your Financial Insights
            </h2>
            
            {data.insights.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index} />
            ))}
          </div>

          {/* Right Column - Personality & Health */}
          <div className="lg:col-span-5 space-y-6">
            {/* Spending Personality */}
            <PersonalityCard personality={data.personality} />
            
            {/* Health Score */}
            <HealthScoreCard healthScore={data.health_score} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Insights;
