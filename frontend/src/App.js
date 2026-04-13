import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation, Navigate } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { supabase, hasSupabaseEnv, supabaseConfigError } from "./lib/supabaseClient";
import { 
  LayoutDashboard, 
  Lightbulb, 
  Upload, 
  TrendingUp,
  Menu,
  X,
  History,
  User,
  LogOut,
  ShieldCheck,
  Building2,
  PlayCircle
} from "lucide-react";
import { useDemoMode } from "./hooks/useDemoMode";
import BottomNav from "./components/layout/BottomNav";
import {
  demoTransactions,
  demoDashboardData,
  demoCashflow,
  demoInsights,
  demoUserProfile,
} from "./data/demoData";

// Pages
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import UploadPage from "./pages/Upload";
import Transactions from "./pages/Transactions";
import WidgetPage from "./pages/WidgetPage";
import Profile from "./pages/Profile";
import IsraeliBank from "./pages/IsraeliBank";
import WoobBanks from "./pages/WoobBanks";
import OnboardingPage from "./pages/OnboardingPage";
import { QuickEntryFAB, QuickEntryDrawer } from "./pages/QuickEntry";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import CookieConsentBanner from "./components/CookieConsentBanner";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "";
const API = `${BACKEND_URL}/api`;

// Create API context
export const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Demo banner shown at top of app when in demo mode
const DemoBanner = ({ onExit }) => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between gap-4" data-testid="demo-banner">
      <p className="text-sm text-amber-800 font-medium">
        🎭 Demo mode — data is fictional and read-only.{" "}
        <button onClick={onExit} className="underline hover:no-underline ml-1">
          Exit demo
        </button>
      </p>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-900 flex-shrink-0"
        aria-label="Dismiss demo banner"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Premium Navigation component
const Navigation = ({ onSignOut, isDemoMode, onExitDemo }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  
  // Detect scroll for nav styling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/insights", label: "Insights", icon: Lightbulb },
    { path: "/transactions", label: "History", icon: History },
    { path: "/upload", label: "Upload", icon: Upload },
    { path: "/banks", label: "IL Banks", icon: Building2 },
    { path: "/banks/woob", label: "EU Banks", icon: Building2 },
    { path: "/profile", label: "Profile", icon: User },
  ];

  return (
    <header 
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        scrolled 
          ? 'bg-white/80 backdrop-blur-xl shadow-sm border-b border-stone-200/50' 
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 lg:h-18 items-center justify-between">
          {/* Logo */}
          <NavLink 
            to="/" 
            className="flex items-center gap-2.5 group" 
            data-testid="logo-link"
          >
            <div className="w-8 h-8 lg:w-9 lg:h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-lg lg:text-xl text-stone-900">
              FlowIQ
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-2">
            <nav className="flex items-center gap-1 bg-stone-100/80 backdrop-blur-sm rounded-full p-1" data-testid="desktop-nav">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  data-testid={`nav-${item.label.toLowerCase()}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-white text-stone-900 shadow-sm"
                      : "text-stone-600 hover:text-stone-900"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </NavLink>
              );
            })}
            </nav>
            <button
              onClick={isDemoMode ? onExitDemo : onSignOut}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-100 transition-all"
              data-testid="signout-btn"
            >
              <LogOut className="w-4 h-4" />
              {isDemoMode ? "Exit Demo" : "Logout"}
            </button>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden w-10 h-10 rounded-xl flex items-center justify-center hover:bg-stone-100 transition-colors"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            data-testid="mobile-menu-btn"
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5 text-stone-700" />
            ) : (
              <Menu className="w-5 h-5 text-stone-700" />
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <nav 
            className="md:hidden py-4 border-t border-stone-200 animate-fade-in" 
            data-testid="mobile-nav"
          >
            <div className="space-y-1">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    data-testid={`mobile-nav-${item.label.toLowerCase()}`}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? "bg-stone-900 text-white"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {item.label}
                  </NavLink>
                );
              })}
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (isDemoMode) {
                    onExitDemo();
                  } else {
                    onSignOut();
                  }
                }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-stone-600 hover:bg-stone-100 transition-all"
                data-testid="mobile-signout-btn"
              >
                <LogOut className="w-5 h-5" />
                {isDemoMode ? "Exit Demo" : "Logout"}
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

const ResetPasswordScreen = ({ onDone }) => {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated! You are now signed in.");
      onDone();
    } catch (error) {
      console.error("Password update error:", error);
      toast.error(error?.message || "Failed to update password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md card-premium rounded-3xl p-6 sm:p-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-stone-900">New password</h1>
            <p className="text-sm text-stone-500">Choose a strong password</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
              placeholder="At least 6 characters"
              data-testid="reset-password"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
              placeholder="Repeat your password"
              data-testid="reset-confirm"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-60"
            data-testid="reset-submit"
          >
            {loading ? "Updating..." : "Set new password"}
          </button>
        </form>
      </div>
    </div>
  );
};

const AuthScreen = ({ onDemoEnter }) => {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async (e) => {
    e.preventDefault();

    if (mode === "forgot") {
      if (!email) {
        toast.error("Please enter your email address.");
        return;
      }
      try {
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin,
        });
        if (error) throw error;
        setResetSent(true);
        toast.success("Reset link sent! Check your inbox.");
      } catch (error) {
        console.error("Reset error:", error);
        toast.error(error?.message || "Failed to send reset email.");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!email || !password) {
      toast.error("Email and password are required.");
      return;
    }

    try {
      setLoading(true);
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Welcome back.");
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        toast.success("Account created. Check your inbox if email confirmation is enabled.");
      }
    } catch (error) {
      console.error("Auth error:", error);
      if (error?.message === "Invalid login credentials") {
        toast.error("Invalid email or password. If this is a new account, create one first.");
      } else {
        toast.error(error?.message || "Authentication failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF9F7] px-4 py-8 flex items-center justify-center">
      <div className="w-full max-w-md card-premium rounded-3xl p-6 sm:p-8 animate-fade-in-up">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-heading text-2xl font-bold text-stone-900">
              {mode === "forgot" ? "Reset password" : "FlowIQ Auth"}
            </h1>
            <p className="text-sm text-stone-500">
              {mode === "forgot" ? "We'll send you a reset link" : "Secure access with Supabase"}
            </p>
          </div>
        </div>

        {mode === "forgot" && resetSent ? (
          <div className="text-center py-4 space-y-3">
            <p className="text-stone-700 text-sm">
              A password reset link has been sent to <strong>{email}</strong>. Click the link in your inbox to choose a new password.
            </p>
            <button
              onClick={() => { setMode("signin"); setResetSent(false); setEmail(""); }}
              className="text-sm text-stone-600 hover:text-stone-900 underline"
            >
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
                  placeholder="you@example.com"
                  data-testid="auth-email"
                />
              </div>
              {mode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-stone-700">Password</label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => { setMode("forgot"); setResetSent(false); }}
                        className="text-xs text-stone-500 hover:text-stone-800"
                        data-testid="auth-forgot-link"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-stone-200 bg-white"
                    placeholder="Your password"
                    data-testid="auth-password"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-stone-900 text-white font-medium hover:bg-stone-800 disabled:opacity-60"
                data-testid="auth-submit"
              >
                {loading
                  ? "Please wait..."
                  : mode === "signin"
                  ? "Sign in"
                  : mode === "forgot"
                  ? "Send reset link"
                  : "Create account"}
              </button>
            </form>

            {mode === "forgot" ? (
              <button
                onClick={() => { setMode("signin"); setResetSent(false); }}
                className="w-full mt-3 text-sm text-stone-600 hover:text-stone-900"
                data-testid="auth-back-to-signin"
              >
                Back to sign in
              </button>
            ) : (
              <button
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="w-full mt-3 text-sm text-stone-600 hover:text-stone-900"
                data-testid="auth-switch-mode"
              >
                {mode === "signin" ? "No account? Create one" : "Already have an account? Sign in"}
              </button>
            )}

            {onDemoEnter && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-stone-200" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-white px-2 text-stone-400">or</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onDemoEnter}
                  data-testid="auth-demo-btn"
                  className="w-full h-11 rounded-xl border border-stone-300 text-stone-700 font-medium hover:bg-stone-50 flex items-center justify-center gap-2 transition-colors"
                >
                  <PlayCircle className="w-4 h-4" />
                  Try Demo — no account needed
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

function App() {
  const { isDemoMode, enterDemoMode, exitDemoMode } = useDemoMode();
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userId, setUserId] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [advancedInsights, setAdvancedInsights] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);

  useEffect(() => {
    if (!hasSupabaseEnv || !supabase) {
      toast.error("Missing Supabase frontend env vars.");
      setAuthLoading(false);
      return;
    }

    let mounted = true;

    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!mounted) return;
        setSession(data.session || null);
      } catch (error) {
        console.error("Unable to get auth session:", error);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (_event === "PASSWORD_RECOVERY") {
        setPasswordRecovery(true);
      } else {
        setPasswordRecovery(false);
      }
      setSession(nextSession || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    const authUserId = session?.user?.id || null;

    if (accessToken) {
      axios.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }

    if (authUserId) {
      axios.defaults.headers.common["X-User-Id"] = authUserId;
      setUserId(authUserId);
    } else {
      delete axios.defaults.headers.common["X-User-Id"];
      setUserId(null);
      setUserProfile(null);
      setDashboardData(null);
      setInsights([]);
      setAdvancedInsights(null);
      setCashflow(null);
      setTransactions([]);
      setLoading(false);
    }
  }, [session]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      toast.success("Signed out.");
    } catch (error) {
      console.error("Sign out failed:", error);
      toast.error("Unable to sign out.");
    }
  };

  // Fetch all data
  const fetchData = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      
      // Fetch all data in parallel (no auto-seeding: let users import their own data)
      const [profileRes, dashRes, insightsRes, advancedInsightsRes, cashflowRes, newTransRes] = await Promise.all([
        axios.get(`${API}/profile`),
        axios.get(`${API}/dashboard`),
        axios.get(`${API}/insights`),
        axios.get(`${API}/insights-advanced`),
        axios.get(`${API}/cashflow-prediction`),
        axios.get(`${API}/transactions`),
      ]);
      
      setUserProfile(profileRes.data);
      setDashboardData(dashRes.data);
      setInsights(insightsRes.data);
      setAdvancedInsights(advancedInsightsRes.data);
      setCashflow(cashflowRes.data);
      setTransactions(newTransRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchData();
    }
  }, [session?.access_token]);

  const apiValue = {
    API,
    userId: isDemoMode ? "demo-user" : userId,
    userProfile: isDemoMode ? demoUserProfile : userProfile,
    dashboardData: isDemoMode ? demoDashboardData : dashboardData,
    insights: isDemoMode ? demoInsights : insights,
    advancedInsights: isDemoMode ? null : advancedInsights,
    cashflow: isDemoMode ? demoCashflow : cashflow,
    transactions: isDemoMode ? demoTransactions : transactions,
    loading: isDemoMode ? false : loading,
    refreshData: isDemoMode ? () => {} : fetchData,
    signOut,
    isDemoMode,
    exitDemoMode,
  };

  // Determine onboarding state:
  // - Wait until profile has loaded (userProfile !== null) before deciding
  // - null/undefined onboarding_status (existing users without onboarding data) → treat as completed
  // - "not_started" or "in_progress" → redirect to onboarding
  // - "completed" → allow access to the full app
  const onboardingStatus = userProfile?.onboarding_status;
  const onboardingCompleted =
    isDemoMode || (userProfile !== null && (!onboardingStatus || onboardingStatus === "completed"));

  if (!hasSupabaseEnv && !isDemoMode) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] p-6 text-stone-800">
        <h1 className="font-heading text-2xl font-bold mb-2">Supabase env missing</h1>
        <p className="text-stone-600">{supabaseConfigError || "Set REACT_APP_SUPABASE_URL and REACT_APP_SUPABASE_ANON_KEY in frontend env."}</p>
      </div>
    );
  }

  if (authLoading && !isDemoMode) {
    return (
      <div className="min-h-screen bg-[#FAF9F7] p-6 flex items-center justify-center text-stone-600">
        Loading authentication...
      </div>
    );
  }

  if (passwordRecovery && session) {
    return (
      <>
        <ResetPasswordScreen onDone={() => setPasswordRecovery(false)} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  if (!session && !isDemoMode) {
    return (
      <>
        <AuthScreen onDemoEnter={enterDemoMode} />
        <Toaster position="bottom-right" />
      </>
    );
  }

  return (
    <ApiContext.Provider value={apiValue}>
      <div className="min-h-screen bg-[#FAF9F7]">
        <BrowserRouter>
          {/* Demo banner — shown when in demo mode */}
          {isDemoMode && (
            <DemoBanner onExit={() => { exitDemoMode(); window.location.reload(); }} />
          )}
          {/* Show nav only when onboarding is done */}
          {onboardingCompleted && (
            <Navigation
              onSignOut={signOut}
              isDemoMode={isDemoMode}
              onExitDemo={() => { exitDemoMode(); window.location.reload(); }}
            />
          )}
          <main className={onboardingCompleted ? "max-w-7xl mx-auto px-3 sm:px-5 lg:px-8 py-6 lg:py-10 pb-24 md:pb-10" : ""}>
            <Routes>
              {/* Onboarding route — always accessible */}
              <Route path="/onboarding" element={<OnboardingPage />} />

              {/* Always-accessible routes */}
              <Route path="/profile" element={<Profile />} />
              <Route path="/widget" element={<WidgetPage />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />

              {onboardingCompleted ? (
                <>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/transactions" element={<Transactions />} />
                  <Route path="/upload" element={<UploadPage />} />
                  <Route path="/banks" element={<IsraeliBank />} />
                  <Route path="/banks/woob" element={<WoobBanks />} />
                </>
              ) : loading ? (
                // Wait for profile to load before redirecting (prevents redirect loop)
                <Route
                  path="*"
                  element={
                    <div className="min-h-screen bg-[#FAF9F7] flex items-center justify-center text-stone-500">
                      Loading your profile...
                    </div>
                  }
                />
              ) : (
                // Onboarding not completed: redirect everything to /onboarding
                <Route path="*" element={<Navigate to="/onboarding" replace />} />
              )}
            </Routes>
          </main>
          
          {/* Quick Entry FAB and Drawer — only when onboarding is done */}
          {onboardingCompleted && (
            <>
              <BottomNav />
              <QuickEntryFAB onClick={() => setQuickEntryOpen(true)} />
              <QuickEntryDrawer 
                open={quickEntryOpen} 
                onOpenChange={setQuickEntryOpen}
                onSuccess={fetchData}
              />
            </>
          )}

          {/* GDPR consent banner — shown until user makes a choice */}
          <CookieConsentBanner />

          {/* Minimal footer with Privacy Policy link */}
          <footer className="mt-auto py-4 text-center text-xs text-stone-400">
            <NavLink to="/privacy-policy" className="hover:text-stone-600 underline">
              Politique de confidentialité
            </NavLink>
          </footer>
        </BrowserRouter>
        <Toaster 
          position="bottom-right" 
          toastOptions={{
            style: {
              background: '#1C1917',
              color: '#fff',
              borderRadius: '16px',
              padding: '16px 20px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            },
          }}
        />
      </div>
    </ApiContext.Provider>
  );
}

export default App;
