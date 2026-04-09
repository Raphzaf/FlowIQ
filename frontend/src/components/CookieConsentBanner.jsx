import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

const POSTHOG_KEY = "phc_xAvL2Iq4tFmANRE7kzbKwaSqp1HJjN7x48s3vr0CMjs";
const POSTHOG_HOST = "https://us.i.posthog.com";
const CONSENT_KEY = "posthog_consent";

export function initPostHog() {
  if (window.posthog && typeof window.posthog.init === "function" && !window.posthog.__loaded) {
    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      disable_session_recording: false,
      session_recording: {
        recordCrossOriginIframes: true,
        capturePerformance: false,
      },
    });
    window.posthog.__loaded = true;
  }
}

export function getConsent() {
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    return null;
  }
}

export function setConsent(value) {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // localStorage unavailable
  }
}

export function resetConsent() {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // localStorage unavailable
  }
}

export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getConsent();
    if (consent === "accepted") {
      initPostHog();
    } else if (!consent) {
      setVisible(true);
    }
    // "rejected" → do nothing, banner stays hidden
  }, []);

  const handleAccept = () => {
    setConsent("accepted");
    initPostHog();
    setVisible(false);
  };

  const handleReject = () => {
    setConsent("rejected");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      data-testid="cookie-consent-banner"
      className="fixed bottom-0 left-0 right-0 z-50 p-4 sm:p-6"
    >
      <div className="max-w-2xl mx-auto bg-stone-900 text-white rounded-2xl shadow-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
        <p className="text-sm text-stone-300 flex-1">
          🍪 Nous utilisons PostHog pour analyser l'utilisation de l'app et améliorer votre expérience.
          Aucune donnée n'est collectée sans votre accord.{" "}
          <Link to="/privacy-policy" className="underline text-white hover:text-stone-200">
            Politique de confidentialité
          </Link>
        </p>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={handleReject}
            data-testid="cookie-reject"
            className="px-4 py-2 rounded-xl text-sm font-medium text-stone-300 hover:text-white hover:bg-stone-700 transition-colors"
          >
            Refuser
          </button>
          <button
            onClick={handleAccept}
            data-testid="cookie-accept"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white text-stone-900 hover:bg-stone-100 transition-colors"
          >
            Accepter
          </button>
        </div>
      </div>
    </div>
  );
}
