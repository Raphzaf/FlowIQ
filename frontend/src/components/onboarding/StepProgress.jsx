import { CheckCircle2 } from "lucide-react";

const STEP_LABELS = ["Profile", "Import Data", "Explore"];

const StepProgress = ({ currentStep, totalSteps = 3 }) => {
  return (
    <div className="w-full" data-testid="step-progress">
      {/* Step indicators */}
      <div className="flex items-center justify-between mb-2">
        {STEP_LABELS.slice(0, totalSteps).map((label, idx) => {
          const stepNum = idx + 1;
          const isCompleted = stepNum < currentStep;
          const isActive = stepNum === currentStep;

          return (
            <div key={stepNum} className="flex flex-col items-center flex-1">
              <div className="flex items-center w-full">
                {/* Left connector */}
                {idx > 0 && (
                  <div
                    className={`flex-1 h-0.5 transition-colors duration-300 ${
                      stepNum <= currentStep ? "bg-stone-900" : "bg-stone-200"
                    }`}
                  />
                )}
                {/* Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300 ${
                    isCompleted
                      ? "bg-stone-900 text-white"
                      : isActive
                      ? "bg-stone-900 text-white ring-4 ring-stone-200"
                      : "bg-stone-100 text-stone-400"
                  }`}
                  data-testid={`step-circle-${stepNum}`}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <span className="text-sm font-semibold">{stepNum}</span>
                  )}
                </div>
                {/* Right connector */}
                {idx < totalSteps - 1 && (
                  <div
                    className={`flex-1 h-0.5 transition-colors duration-300 ${
                      stepNum < currentStep ? "bg-stone-900" : "bg-stone-200"
                    }`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Step labels */}
      <div className="flex items-start">
        {STEP_LABELS.slice(0, totalSteps).map((label, idx) => {
          const stepNum = idx + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;

          return (
            <div
              key={stepNum}
              className="flex-1 text-center"
            >
              <span
                className={`text-xs font-medium transition-colors ${
                  isActive
                    ? "text-stone-900"
                    : isCompleted
                    ? "text-stone-500"
                    : "text-stone-400"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 bg-stone-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-stone-900 rounded-full transition-all duration-500"
          style={{ width: `${((currentStep - 1) / (totalSteps - 1)) * 100}%` }}
          data-testid="progress-bar"
        />
      </div>
    </div>
  );
};

export default StepProgress;
