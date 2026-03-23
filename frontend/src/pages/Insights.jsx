import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
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
  Info
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/button";

// Loading skeleton component
const Skeleton = ({ className }) => (
  <div className={`skeleton ${className}`} />
);

// Icon mapping
const ICON_MAP = {
  'trending-up': TrendingUp,
  'trending-down': TrendingDown,
  'credit-card': CreditCard,
  'pie-chart': PieChart,
  'lightbulb': Lightbulb,
  'calendar': Calendar,
  'upload': Upload,
};

// Get insight styling based on type
const getInsightConfig = (type) => {
  switch (type) {
    case 'warning':
      return {
        bgColor: 'bg-warning-light/50',
        borderColor: 'border-l-warning',
        iconBg: 'bg-warning-light',
        iconColor: 'text-warning-dark',
        Icon: AlertTriangle,
      };
    case 'positive':
      return {
        bgColor: 'bg-income-light/50',
        borderColor: 'border-l-income',
        iconBg: 'bg-income-light',
        iconColor: 'text-income-dark',
        Icon: CheckCircle2,
      };
    case 'tip':
      return {
        bgColor: 'bg-stone-100',
        borderColor: 'border-l-stone-900',
        iconBg: 'bg-stone-200',
        iconColor: 'text-stone-700',
        Icon: Lightbulb,
      };
    default:
      return {
        bgColor: 'bg-insight-light/50',
        borderColor: 'border-l-insight',
        iconBg: 'bg-insight-light',
        iconColor: 'text-insight-dark',
        Icon: Info,
      };
  }
};

// Single Insight Card
const InsightCard = ({ insight, index }) => {
  const config = getInsightConfig(insight.type);
  const IconComponent = ICON_MAP[insight.icon] || config.Icon;

  return (
    <Card 
      className={`rounded-3xl border-stone-100 border-l-4 ${config.borderColor} ${config.bgColor} overflow-hidden animate-fade-in card-hover`}
      style={{ animationDelay: `${index * 100}ms` }}
      data-testid={`insight-detail-${index}`}
    >
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl ${config.iconBg} flex items-center justify-center flex-shrink-0`}>
            <IconComponent className={`w-6 h-6 ${config.iconColor}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-semibold text-lg text-stone-900 mb-2">
              {insight.title}
            </h3>
            <p className="text-stone-600 leading-relaxed">
              {insight.description}
            </p>
          </div>
        </div>
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
  <div className="space-y-4" data-testid="insights-loading">
    {[1, 2, 3, 4].map((i) => (
      <Card key={i} className="rounded-3xl border-stone-100 bg-white">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl flex-shrink-0" />
            <div className="flex-1">
              <Skeleton className="h-6 w-48 mb-3" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        </CardContent>
      </Card>
    ))}
  </div>
);

// Main Insights Page
const Insights = () => {
  const { insights, loading } = useApi();

  return (
    <div className="animate-fade-in" data-testid="insights-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-stone-900 mb-2">
          Smart Insights
        </h1>
        <p className="text-stone-500">
          Personalized recommendations to optimize your finances
        </p>
      </div>

      {/* Insights Grid */}
      <div className="max-w-3xl">
        {loading ? (
          <LoadingState />
        ) : insights && insights.length > 0 ? (
          <div className="space-y-4">
            {insights.map((insight, index) => (
              <InsightCard key={insight.id} insight={insight} index={index} />
            ))}
          </div>
        ) : (
          <EmptyState />
        )}
      </div>

      {/* Tips Section */}
      {!loading && insights && insights.length > 0 && (
        <div className="mt-12 max-w-3xl" data-testid="tips-section">
          <h2 className="font-heading text-xl font-semibold text-stone-900 mb-4">
            Financial Tips
          </h2>
          <Card className="rounded-3xl border-stone-100 bg-gradient-to-br from-stone-900 to-stone-800 text-white overflow-hidden">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center flex-shrink-0">
                  <Lightbulb className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="font-heading font-semibold text-lg mb-2">
                    The 50/30/20 Rule
                  </h3>
                  <p className="text-stone-300 leading-relaxed">
                    Consider allocating 50% of your income to needs (rent, utilities, groceries), 
                    30% to wants (entertainment, dining out), and 20% to savings and debt repayment. 
                    This simple framework can help you maintain financial balance.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default Insights;
