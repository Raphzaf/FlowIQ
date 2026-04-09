import { useApi } from "../App";
import OnboardingWizard from "../components/onboarding/OnboardingWizard";

const OnboardingPage = () => {
  const { userProfile, refreshData } = useApi();

  const initialStep = userProfile?.onboarding_step || 1;
  const initialCurrency = userProfile?.currency || "USD";

  return (
    <OnboardingWizard
      initialStep={initialStep}
      initialCurrency={initialCurrency}
      onComplete={refreshData}
    />
  );
};

export default OnboardingPage;
