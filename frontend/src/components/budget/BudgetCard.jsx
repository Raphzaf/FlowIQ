import { Edit3, Trash2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import BudgetProgress from "./BudgetProgress";

const CATEGORY_CONFIG = {
  "Food & Dining":    { emoji: "🍔", bg: "bg-rose-50",    text: "text-rose-700"    },
  "Supermarket":      { emoji: "🛒", bg: "bg-emerald-50", text: "text-emerald-700" },
  "Restaurants":      { emoji: "🍴", bg: "bg-orange-50",  text: "text-orange-700"  },
  "Transport":        { emoji: "🚗", bg: "bg-indigo-50",  text: "text-indigo-700"  },
  "Housing":          { emoji: "🏠", bg: "bg-stone-50",   text: "text-stone-700"   },
  "Shopping":         { emoji: "🛍️", bg: "bg-pink-50",    text: "text-pink-700"    },
  "Subscriptions":    { emoji: "💳", bg: "bg-amber-50",   text: "text-amber-700"   },
  "Entertainment":    { emoji: "🎬", bg: "bg-violet-50",  text: "text-violet-700"  },
  "Bills & Utilities":{ emoji: "💡", bg: "bg-yellow-50",  text: "text-yellow-700"  },
  "Health":           { emoji: "❤️", bg: "bg-teal-50",    text: "text-teal-700"    },
  "Travel":           { emoji: "✈️", bg: "bg-sky-50",     text: "text-sky-700"     },
  "Savings":          { emoji: "🐷", bg: "bg-lime-50",    text: "text-lime-700"    },
  "Income":           { emoji: "💰", bg: "bg-emerald-50", text: "text-emerald-700" },
};

const STATUS_BADGE = {
  ok:       { label: "On Track", className: "bg-emerald-100 text-emerald-700" },
  warning:  { label: "Warning",  className: "bg-amber-100 text-amber-700"    },
  exceeded: { label: "Exceeded", className: "bg-rose-100 text-rose-700"      },
};

const formatILS = (amount) =>
  amount.toLocaleString("he-IL", { style: "currency", currency: "ILS", minimumFractionDigits: 0, maximumFractionDigits: 0 });

const BudgetCard = ({ budget, onEdit, onDelete }) => {
  const config = CATEGORY_CONFIG[budget.category] || { emoji: "📊", bg: "bg-stone-50", text: "text-stone-700" };
  const badge  = STATUS_BADGE[budget.status]      || STATUS_BADGE.ok;

  return (
    <Card className="card-premium rounded-3xl relative group animate-fade-in-up" data-testid={`budget-card-${budget.id}`}>
      <CardContent className="p-5 sm:p-6 space-y-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl ${config.bg} flex items-center justify-center flex-shrink-0 text-xl`}>
              {config.emoji}
            </div>
            <div>
              <p className="font-heading font-semibold text-stone-900 dark:text-stone-100 leading-tight">{budget.category}</p>
              <span className={`inline-flex items-center mt-0.5 px-2 py-0.5 rounded-full text-xs font-semibold ${badge.className}`}>
                {badge.label}
              </span>
            </div>
          </div>
          {/* Edit/Delete buttons */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => onEdit(budget)} className="p-2 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" data-testid={`budget-edit-${budget.id}`}>
              <Edit3 className="w-4 h-4 text-stone-400 hover:text-stone-600 dark:hover:text-stone-300" />
            </button>
            <button onClick={() => onDelete(budget)} className="p-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center" data-testid={`budget-delete-${budget.id}`}>
              <Trash2 className="w-4 h-4 text-stone-400 hover:text-rose-500" />
            </button>
          </div>
        </div>

        {/* Amount row */}
        <div className="flex items-baseline justify-between">
          <div>
            <p className="text-2xl font-heading font-bold text-stone-900 dark:text-stone-100 tabular-nums">{formatILS(budget.spent_amount)}</p>
            <p className="text-sm text-stone-400 dark:text-stone-500">of {formatILS(budget.budget_amount)}</p>
          </div>
          <p className={`text-sm font-medium tabular-nums ${budget.remaining >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
            {budget.remaining >= 0 ? `${formatILS(budget.remaining)} left` : `${formatILS(Math.abs(budget.remaining))} over`}
          </p>
        </div>

        {/* Progress bar */}
        <BudgetProgress percentage={budget.percentage} status={budget.status} />
      </CardContent>
    </Card>
  );
};

export default BudgetCard;
