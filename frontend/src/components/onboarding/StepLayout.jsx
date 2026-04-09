import { TrendingUp } from "lucide-react";
import StepProgress from "./StepProgress";

const StepLayout = ({ currentStep, totalSteps = 3, title, subtitle, children }) => {
  return (
    <div className="min-h-screen bg-[#FAF9F7] flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-8 justify-center">
          <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <span className="font-heading font-bold text-xl text-stone-900">FlowIQ</span>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <StepProgress currentStep={currentStep} totalSteps={totalSteps} />
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-sm border border-stone-100 p-6 sm:p-8 animate-fade-in-up">
          {/* Step header */}
          <div className="mb-6">
            <p className="text-xs font-semibold text-stone-400 uppercase tracking-widest mb-1">
              Step {currentStep} of {totalSteps}
            </p>
            <h2 className="font-heading text-2xl font-bold text-stone-900">{title}</h2>
            {subtitle && (
              <p className="text-stone-500 text-sm mt-1">{subtitle}</p>
            )}
          </div>

          {/* Step content */}
          {children}
        </div>
      </div>
    </div>
  );
};

export default StepLayout;
