import { NavLink } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Upload, Building2, User } from "lucide-react";

const tabs = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/transactions", label: "History", icon: ArrowLeftRight },
  { path: "/upload", label: "Upload", icon: Upload },
  { path: "/banks", label: "Banks", icon: Building2 },
  { path: "/profile", label: "Profile", icon: User },
];

const BottomNav = () => (
  <nav
    className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/90 dark:bg-stone-900/90 backdrop-blur-xl border-t border-stone-200/70 dark:border-stone-700/70 pb-safe"
    data-testid="bottom-nav"
  >
    <div className="flex h-16 items-stretch">
      {tabs.map(({ path, label, icon: Icon }) => (
        <NavLink
          key={path}
          to={path}
          end={path === "/"}
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-400 dark:text-stone-500"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <Icon className={`w-5 h-5 ${isActive ? "text-stone-900 dark:text-stone-100" : "text-stone-400 dark:text-stone-500"}`} />
              <span className="text-[10px] font-medium leading-tight">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </div>
  </nav>
);

export default BottomNav;
