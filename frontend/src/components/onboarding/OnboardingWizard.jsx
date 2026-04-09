import { useState } from "react";
import { toast } from "sonner";
import axios from "axios";
import Step1Profile from "./steps/Step1Profile";
import Step2Import from "./steps/Step2Import";
import Step3Explore from "./steps/Step3Explore";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

/**
 * OnboardingWizard — 3-step wizard:
 *  1. Profile: currency selection
 *  2. Import: CSV upload or bank connection
 *  3. Explore: activation / completion
 *
 * Props:
 *  - initialStep (number): step to start on (1-3), from persisted onboarding_step
 *  - initialCurrency (string): pre-fill currency from profile
 *  - onComplete (function): called when onboarding finishes (to refresh profile in parent)
 */
const OnboardingWizard = ({ initialStep = 1, initialCurrency = "USD", onComplete }) => {
  const [step, setStep] = useState(Math.max(1, Math.min(3, initialStep)));
  const [saving, setSaving] = useState(false);

  const persistStep = async (stepNum, extraFields = {}) => {
    try {
      await axios.patch(`${API}/onboarding`, {
        onboarding_status: stepNum >= 3 ? "in_progress" : "in_progress",
        onboarding_step: stepNum,
        ...extraFields,
      });
    } catch (err) {
      console.error("Failed to persist onboarding step:", err);
    }
  };

  // Step 1 → 2: save currency + advance step
  const handleStep1Next = async ({ currency }) => {
    try {
      setSaving(true);
      await axios.patch(`${API}/onboarding`, {
        onboarding_status: "in_progress",
        onboarding_step: 2,
        currency,
      });
      setStep(2);
    } catch (err) {
      console.error("Failed to save profile step:", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Step 2 → 3
  const handleStep2Next = async () => {
    try {
      setSaving(true);
      await persistStep(3);
      setStep(3);
    } catch (err) {
      console.error("Failed to advance to step 3:", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Step 3: mark onboarding completed
  const handleComplete = async () => {
    try {
      setSaving(true);
      await axios.patch(`${API}/onboarding`, {
        onboarding_status: "completed",
        onboarding_step: 3,
      });
      toast.success("Welcome to FlowIQ! Your dashboard is ready.");
      if (onComplete) await onComplete();
    } catch (err) {
      console.error("Failed to complete onboarding:", err);
      toast.error("Failed to complete setup. Please try again.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  if (step === 1) {
    return (
      <Step1Profile
        initialCurrency={initialCurrency}
        onNext={handleStep1Next}
        loading={saving}
      />
    );
  }

  if (step === 2) {
    return (
      <Step2Import
        onNext={handleStep2Next}
        onBack={() => setStep(1)}
        loading={saving}
      />
    );
  }

  return (
    <Step3Explore
      onBack={() => setStep(2)}
      onComplete={handleComplete}
      loading={saving}
    />
  );
};

export default OnboardingWizard;
