import { useEffect, useState } from "react";
import axios from "axios";
import { UserRound, Save, Globe2, Wallet, Clock3, Fingerprint, BriefcaseBusiness, Home, Repeat2, Landmark } from "lucide-react";
import { toast } from "sonner";
import { useApi } from "../App";
import { Card, CardContent } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "CHF", "JPY"];
const TIMEZONES = [
  "UTC",
  "Europe/Paris",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Tokyo",
  "Asia/Singapore",
];

const Profile = () => {
  const { API, userId, userProfile, refreshData } = useApi();
  const [displayName, setDisplayName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [monthlyIncome, setMonthlyIncome] = useState("");
  const [monthlyIncomeDay, setMonthlyIncomeDay] = useState("1");
  const [monthlyRent, setMonthlyRent] = useState("");
  const [monthlyRentDay, setMonthlyRentDay] = useState("1");
  const [monthlySubscriptions, setMonthlySubscriptions] = useState("");
  const [monthlySubscriptionsDay, setMonthlySubscriptionsDay] = useState("1");
  const [monthlyOtherFixedExpenses, setMonthlyOtherFixedExpenses] = useState("");
  const [monthlyOtherFixedExpensesDay, setMonthlyOtherFixedExpensesDay] = useState("1");
  const [timezone, setTimezone] = useState("UTC");
  const [saving, setSaving] = useState(false);
  const [applyingPlan, setApplyingPlan] = useState(false);

  useEffect(() => {
    if (!userProfile) return;

    setDisplayName(userProfile.display_name || "");
    setCurrency(userProfile.currency || "USD");
    setTimezone(userProfile.timezone || "UTC");
    setMonthlyBudget(
      userProfile.monthly_budget === null || userProfile.monthly_budget === undefined
        ? ""
        : String(userProfile.monthly_budget)
    );
    setMonthlyIncome(
      userProfile.monthly_income === null || userProfile.monthly_income === undefined
        ? ""
        : String(userProfile.monthly_income)
    );
    setMonthlyIncomeDay(String(userProfile.monthly_income_day || 1));
    setMonthlyRent(
      userProfile.monthly_rent === null || userProfile.monthly_rent === undefined
        ? ""
        : String(userProfile.monthly_rent)
    );
    setMonthlyRentDay(String(userProfile.monthly_rent_day || 1));
    setMonthlySubscriptions(
      userProfile.monthly_subscriptions === null || userProfile.monthly_subscriptions === undefined
        ? ""
        : String(userProfile.monthly_subscriptions)
    );
    setMonthlySubscriptionsDay(String(userProfile.monthly_subscriptions_day || 1));
    setMonthlyOtherFixedExpenses(
      userProfile.monthly_other_fixed_expenses === null || userProfile.monthly_other_fixed_expenses === undefined
        ? ""
        : String(userProfile.monthly_other_fixed_expenses)
    );
    setMonthlyOtherFixedExpensesDay(String(userProfile.monthly_other_fixed_expenses_day || 1));
  }, [userProfile]);

  const parseOptionalAmount = (value) => {
    if (value === "") return null;
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return undefined;
    return parsed;
  };

  const parseDay = (value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 31) return undefined;
    return parsed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const cleanName = displayName.trim();
    if (!cleanName) {
      toast.error("Le nom est requis.");
      return;
    }

    const parsedBudget = parseOptionalAmount(monthlyBudget);
    const parsedIncome = parseOptionalAmount(monthlyIncome);
    const parsedRent = parseOptionalAmount(monthlyRent);
    const parsedSubscriptions = parseOptionalAmount(monthlySubscriptions);
    const parsedOtherFixedExpenses = parseOptionalAmount(monthlyOtherFixedExpenses);
    const parsedIncomeDay = parseDay(monthlyIncomeDay);
    const parsedRentDay = parseDay(monthlyRentDay);
    const parsedSubscriptionsDay = parseDay(monthlySubscriptionsDay);
    const parsedOtherFixedExpensesDay = parseDay(monthlyOtherFixedExpensesDay);

    if (
      parsedBudget === undefined ||
      parsedIncome === undefined ||
      parsedRent === undefined ||
      parsedSubscriptions === undefined ||
      parsedOtherFixedExpenses === undefined ||
      parsedIncomeDay === undefined ||
      parsedRentDay === undefined ||
      parsedSubscriptionsDay === undefined ||
      parsedOtherFixedExpensesDay === undefined
    ) {
      toast.error("Les montants doivent etre positifs et les jours entre 1 et 31.");
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${API}/profile`, {
        display_name: cleanName,
        currency,
        monthly_budget: parsedBudget,
        monthly_income: parsedIncome,
        monthly_income_day: parsedIncomeDay,
        monthly_rent: parsedRent,
        monthly_rent_day: parsedRentDay,
        monthly_subscriptions: parsedSubscriptions,
        monthly_subscriptions_day: parsedSubscriptionsDay,
        monthly_other_fixed_expenses: parsedOtherFixedExpenses,
        monthly_other_fixed_expenses_day: parsedOtherFixedExpensesDay,
        timezone,
      });
      await refreshData();
      toast.success("Profil mis a jour.");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Impossible de sauvegarder le profil.");
    } finally {
      setSaving(false);
    }
  };

  const handleApplyMonthlyPlan = async () => {
    try {
      setApplyingPlan(true);
      const { data } = await axios.post(`${API}/monthly-plan/apply`);
      await refreshData();

      if (data.created_count > 0) {
        toast.success(`Plan mensuel applique: ${data.created_count} operation(s) creee(s).`);
      } else {
        toast.message("Aucune nouvelle operation a creer ce mois-ci.");
      }
    } catch (error) {
      console.error("Error applying monthly plan:", error);
      toast.error("Impossible d'appliquer le plan mensuel.");
    } finally {
      setApplyingPlan(false);
    }
  };

  return (
    <div data-testid="profile-page" className="space-y-6">
      <div className="animate-fade-in">
        <h1 className="font-heading text-3xl lg:text-4xl font-bold text-stone-900 mb-2">
          Mon profil
        </h1>
        <p className="text-stone-500">
          Personnalisez vos preferences financieres et votre identite utilisateur.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        <Card className="card-premium rounded-3xl animate-fade-in-up lg:col-span-8" data-testid="profile-form-card">
          <CardContent className="p-6 lg:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                  <UserRound className="w-4 h-4" />
                  Nom
                </label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 rounded-xl"
                  placeholder="Ex: Raphael"
                  data-testid="profile-name-input"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    <Globe2 className="w-4 h-4" />
                    Devise
                  </label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="h-12 rounded-xl" data-testid="profile-currency-select">
                      <SelectValue placeholder="Choisir une devise" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((code) => (
                        <SelectItem key={code} value={code}>
                          {code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Budget mensuel
                  </label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    className="h-12 rounded-xl"
                    placeholder="Ex: 2500"
                    data-testid="profile-budget-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                  <Clock3 className="w-4 h-4" />
                  Timezone
                </label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger className="h-12 rounded-xl" data-testid="profile-timezone-select">
                    <SelectValue placeholder="Choisir un fuseau horaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((zone) => (
                      <SelectItem key={zone} value={zone}>
                        {zone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 space-y-4">
                <h2 className="font-heading text-lg font-semibold text-stone-900">Revenus et charges mensuels</h2>
                <p className="text-sm text-stone-500">
                  Definissez vos montants fixes, puis appliquez-les une fois par mois pour creer automatiquement les ecritures.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 rounded-xl border border-stone-200 p-3">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <BriefcaseBusiness className="w-4 h-4" />
                      Salaire mensuel
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyIncome}
                      onChange={(e) => setMonthlyIncome(e.target.value)}
                      className="h-12 rounded-xl"
                      placeholder="Ex: 3200"
                      data-testid="profile-monthly-income-input"
                    />
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">Jour du versement</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={monthlyIncomeDay}
                        onChange={(e) => setMonthlyIncomeDay(e.target.value)}
                        className="h-10 rounded-xl"
                        data-testid="profile-monthly-income-day-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-stone-200 p-3">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Home className="w-4 h-4" />
                      Loyer appartement
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyRent}
                      onChange={(e) => setMonthlyRent(e.target.value)}
                      className="h-12 rounded-xl"
                      placeholder="Ex: 980"
                      data-testid="profile-monthly-rent-input"
                    />
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">Jour du prelevement</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={monthlyRentDay}
                        onChange={(e) => setMonthlyRentDay(e.target.value)}
                        className="h-10 rounded-xl"
                        data-testid="profile-monthly-rent-day-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-stone-200 p-3">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Repeat2 className="w-4 h-4" />
                      Abonnements mensuels
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlySubscriptions}
                      onChange={(e) => setMonthlySubscriptions(e.target.value)}
                      className="h-12 rounded-xl"
                      placeholder="Ex: 89"
                      data-testid="profile-monthly-subscriptions-input"
                    />
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">Jour du prelevement</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={monthlySubscriptionsDay}
                        onChange={(e) => setMonthlySubscriptionsDay(e.target.value)}
                        className="h-10 rounded-xl"
                        data-testid="profile-monthly-subscriptions-day-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2 rounded-xl border border-stone-200 p-3">
                    <label className="text-sm font-medium text-stone-700 flex items-center gap-2">
                      <Landmark className="w-4 h-4" />
                      Autres charges fixes
                    </label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={monthlyOtherFixedExpenses}
                      onChange={(e) => setMonthlyOtherFixedExpenses(e.target.value)}
                      className="h-12 rounded-xl"
                      placeholder="Ex: 150"
                      data-testid="profile-monthly-other-fixed-input"
                    />
                    <div className="space-y-1">
                      <label className="text-xs text-stone-500">Jour du prelevement</label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        step="1"
                        value={monthlyOtherFixedExpensesDay}
                        onChange={(e) => setMonthlyOtherFixedExpensesDay(e.target.value)}
                        className="h-10 rounded-xl"
                        data-testid="profile-monthly-other-fixed-day-input"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl bg-stone-50 border border-stone-200 p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <p className="text-sm text-stone-600">
                    Action mensuelle: cree les lignes de salaire et charges fixes du mois en evitant les doublons.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleApplyMonthlyPlan}
                    disabled={applyingPlan}
                    className="rounded-xl"
                    data-testid="profile-apply-monthly-plan-btn"
                  >
                    {applyingPlan ? "Application..." : "Appliquer ce mois"}
                  </Button>
                </div>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-stone-900 hover:bg-stone-800 h-11 px-5"
                  data-testid="profile-save-btn"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="card-premium rounded-3xl animate-fade-in-up lg:col-span-4" data-testid="profile-meta-card">
          <CardContent className="p-6 lg:p-7 space-y-4">
            <h2 className="font-heading text-xl font-semibold text-stone-900">Identifiant</h2>
            <div className="rounded-2xl bg-stone-100 p-4">
              <p className="text-xs text-stone-500 mb-2 flex items-center gap-2">
                <Fingerprint className="w-3.5 h-3.5" />
                User ID courant
              </p>
              <p className="text-sm font-mono text-stone-800 break-all" data-testid="profile-user-id">
                {userId}
              </p>
            </div>
            <p className="text-xs text-stone-500 leading-relaxed">
              Cet identifiant provient de Supabase Auth et est valide par le backend pour isoler les donnees utilisateur.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Profile;
