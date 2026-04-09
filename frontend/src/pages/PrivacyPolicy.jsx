import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-[#FAF9F7] px-4 py-10">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-stone-900">Politique de confidentialité</h1>
            <p className="text-sm text-stone-500">Dernière mise à jour : avril 2025</p>
          </div>
        </div>

        <div className="space-y-6 text-stone-700 text-sm leading-relaxed">
          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">1. Responsable du traitement</h2>
            <p>
              FlowIQ est édité par Raphael Zafrani. Pour toute question relative à vos données
              personnelles, contactez-nous à : <a href="mailto:contact@flowiq.app" className="underline">contact@flowiq.app</a>
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">2. Données collectées</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Adresse e-mail (pour l'authentification via Supabase)</li>
              <li>Données financières importées (transactions, soldes) — stockées dans votre compte Supabase</li>
              <li>
                Données d'utilisation et enregistrements de session, <strong>uniquement si vous avez accepté</strong> les cookies analytics (PostHog)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">3. Finalités et base légale</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Authentification :</strong> exécution du contrat (article 6.1.b RGPD)
              </li>
              <li>
                <strong>Stockage des données financières :</strong> exécution du contrat
              </li>
              <li>
                <strong>Analytics / PostHog :</strong> intérêt légitime à améliorer le service, soumis à votre
                consentement préalable (opt-in)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">4. Cookies et analytics (PostHog)</h2>
            <p>
              FlowIQ utilise <a href="https://posthog.com" target="_blank" rel="noopener noreferrer" className="underline">PostHog</a> pour
              analyser l'utilisation de l'application (pages visitées, actions, enregistrement de session). PostHog
              n'est chargé et initialisé <strong>qu'après votre consentement explicite</strong>. Vous pouvez
              retirer votre consentement à tout moment (voir section 7).
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">5. Conservation des données</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Données de compte : jusqu'à suppression du compte</li>
              <li>Données PostHog : 1 an maximum (politique PostHog)</li>
            </ul>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">6. Transferts hors UE</h2>
            <p>
              PostHog héberge ses données aux États-Unis (région <code>us.i.posthog.com</code>).
              Ce transfert est encadré par les clauses contractuelles types de la Commission européenne.
              Supabase propose des régions européennes — consultez la documentation Supabase pour votre
              configuration spécifique.
            </p>
          </section>

          <section>
            <h2 className="font-semibold text-stone-900 text-base mb-2">7. Vos droits &amp; gestion du consentement</h2>
            <p className="mb-2">
              Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement,
              de portabilité et d'opposition. Contactez-nous à <a href="mailto:contact@flowiq.app" className="underline">contact@flowiq.app</a>.
            </p>
            <p>
              Pour modifier votre choix concernant les cookies analytics, cliquez sur le bouton ci-dessous :
            </p>
            <ResetConsentButton />
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-stone-200">
          <Link to="/" className="text-sm text-stone-500 hover:text-stone-900 underline">
            ← Retour à l'application
          </Link>
        </div>
      </div>
    </div>
  );
}

function ResetConsentButton() {
  const handleReset = () => {
    try {
      localStorage.removeItem("posthog_consent");
    } catch {
      // localStorage unavailable
    }
    window.location.reload();
  };

  return (
    <button
      onClick={handleReset}
      data-testid="reset-consent-btn"
      className="mt-3 px-4 py-2 rounded-xl text-sm font-medium bg-stone-900 text-white hover:bg-stone-800 transition-colors"
    >
      Réinitialiser mon choix de cookies
    </button>
  );
}
