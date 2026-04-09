import { useNavigate } from "react-router-dom";
import { LayoutDashboard, Lightbulb, Sparkles, ChevronLeft, PartyPopper } from "lucide-react";
import StepLayout from "../StepLayout";

const Step3Explore = ({ onBack, onComplete, loading }) => {
  const navigate = useNavigate();

  const handleComplete = async () => {
    await onComplete();
    navigate("/", { replace: true });
  };

  const features = [
    {
      icon: LayoutDashboard,
      title: "Dashboard",
      desc: "See your balance, spending trends, and month-end forecast.",
    },
    {
      icon: Lightbulb,
      title: "Insights",
      desc: "AI-powered analysis of your financial habits and opportunities.",
    },
    {
      icon: Sparkles,
      title: "Quick Entry",
      desc: "Log cash transactions in seconds from any page.",
    },
  ];

  return (
    <StepLayout
      currentStep={3}
      title="You're all set!"
      subtitle="FlowIQ is ready to help you understand and improve your finances."
    >
      <div className="space-y-5">
        {/* Celebration */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-700 rounded-2xl p-6 text-white text-center">
          <PartyPopper className="w-10 h-10 mx-auto mb-2 text-yellow-300" />
          <h3 className="font-heading font-bold text-lg mb-1">Welcome to FlowIQ!</h3>
          <p className="text-stone-300 text-sm">
            Your financial dashboard is ready. Start exploring your data.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="space-y-2">
          {features.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-stone-50 hover:bg-stone-100 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-stone-200 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-stone-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-stone-900">{title}</p>
                <p className="text-xs text-stone-500 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            disabled={loading}
            className="h-11 px-4 rounded-xl border border-stone-200 text-stone-600 font-medium hover:bg-stone-50 disabled:opacity-60 flex items-center gap-1.5 transition-colors"
            data-testid="step3-back"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>
          <button
            type="button"
            onClick={handleComplete}
            disabled={loading}
            className="flex-1 h-11 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-60 flex items-center justify-center gap-2 transition-colors"
            data-testid="step3-complete"
          >
            {loading ? "Setting up..." : "Go to Dashboard"}
          </button>
        </div>
      </div>
    </StepLayout>
  );
};

export default Step3Explore;
