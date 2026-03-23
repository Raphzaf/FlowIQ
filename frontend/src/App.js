import { useEffect, useState, createContext, useContext } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import axios from "axios";
import { Toaster, toast } from "sonner";
import { 
  LayoutDashboard, 
  Lightbulb, 
  Upload, 
  TrendingUp,
  Menu,
  X,
  History
} from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import Insights from "./pages/Insights";
import UploadPage from "./pages/Upload";
import Transactions from "./pages/Transactions";
import { QuickEntryFAB, QuickEntryDrawer } from "./pages/QuickEntry";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Create API context
export const ApiContext = createContext();

export const useApi = () => useContext(ApiContext);

// Premium Navigation component
const Navigation = () => {
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
        <div className="flex h-16 lg:h-18 items-center justify-between">
          {/* Logo */}
          <NavLink 
            to="/" 
            className="flex items-center gap-2.5 group" 
            data-testid="logo-link"
          >
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform duration-200">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-bold text-xl text-stone-900">
              FlowIQ
            </span>
          </NavLink>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-stone-100/80 backdrop-blur-sm rounded-full p-1" data-testid="desktop-nav">
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
            </div>
          </nav>
        )}
      </div>
    </header>
  );
};

function App() {
  const [dashboardData, setDashboardData] = useState(null);
  const [insights, setInsights] = useState([]);
  const [advancedInsights, setAdvancedInsights] = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quickEntryOpen, setQuickEntryOpen] = useState(false);

  // Fetch all data
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Check if we need to seed demo data
      const transRes = await axios.get(`${API}/transactions`);
      
      if (transRes.data.length === 0) {
        // Seed demo data
        await axios.post(`${API}/seed-demo-data`);
        toast.success("Demo data loaded! Explore your financial dashboard.");
      }
      
      // Fetch all data in parallel
      const [dashRes, insightsRes, advancedInsightsRes, cashflowRes, newTransRes] = await Promise.all([
        axios.get(`${API}/dashboard`),
        axios.get(`${API}/insights`),
        axios.get(`${API}/insights-advanced`),
        axios.get(`${API}/cashflow-prediction`),
        axios.get(`${API}/transactions`),
      ]);
      
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
    fetchData();
  }, []);

  const apiValue = {
    API,
    dashboardData,
    insights,
    advancedInsights,
    cashflow,
    transactions,
    loading,
    refreshData: fetchData,
  };

  return (
    <ApiContext.Provider value={apiValue}>
      <div className="min-h-screen bg-[#FAF9F7]">
        <BrowserRouter>
          <Navigation />
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-10">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/upload" element={<UploadPage />} />
            </Routes>
          </main>
          
          {/* Quick Entry FAB and Drawer */}
          <QuickEntryFAB onClick={() => setQuickEntryOpen(true)} />
          <QuickEntryDrawer 
            open={quickEntryOpen} 
            onOpenChange={setQuickEntryOpen}
            onSuccess={fetchData}
          />
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
