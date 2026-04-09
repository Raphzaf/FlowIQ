import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import StepLayout from "../StepLayout";

const CURRENCIES = [
  { code: "USD", label: "US Dollar", symbol: "$" },
  { code: "EUR", label: "Euro", symbol: "€" },
  { code: "GBP", label: "British Pound", symbol: "£" },
  { code: "ILS", label: "Israeli Shekel", symbol: "₪" },
  { code: "CAD", label: "Canadian Dollar", symbol: "CA$" },
  { code: "AUD", label: "Australian Dollar", symbol: "A$" },
  { code: "CHF", label: "Swiss Franc", symbol: "CHF" },
  { code: "JPY", label: "Japanese Yen", symbol: "¥" },
];

const Step1Profile = ({ initialCurrency = "USD", onNext, loading }) => {
  const [currency, setCurrency] = useState(initialCurrency);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!currency) {
      toast.error("Please select a currency.");
      return;
    }
    onNext({ currency });
  };

  return (
    <StepLayout
      currentStep={1}
      title="Set up your profile"
      subtitle="Choose your currency to get accurate financial insights."
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Currency selector */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">
            Currency
          </label>
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900/20 focus:border-stone-400"
            data-testid="currency-select"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {c.label} ({c.code})
              </option>
            ))}
          </select>
          <p className="text-xs text-stone-400 mt-1.5">
            You can change this later in your profile settings.
          </p>
        </div>

        {/* Selected currency preview */}
        <div className="bg-stone-50 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center text-lg font-bold flex-shrink-0">
            {CURRENCIES.find((c) => c.code === currency)?.symbol || "$"}
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">
              {CURRENCIES.find((c) => c.code === currency)?.label}
            </p>
            <p className="text-xs text-stone-500">
              {currency} · Your default currency
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
          data-testid="step1-next"
        >
          {loading ? (
            "Saving..."
          ) : (
            <>
              Continue
              <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>
    </StepLayout>
  );
};

export default Step1Profile;
