import { useState, useCallback } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  BookOpen,
  Calendar as CalendarIcon,
  Sparkles,
  User,
  Menu,
  X,
  LogOut,
  Bot,
  Settings as SettingsIcon,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { NotificationPanel } from "./NotificationPanel";

// ── Nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { path: "/dashboard/planner", label: "Study Planner", icon: BookOpen },
  { path: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { path: "/dashboard/insights", label: "AI Insights", icon: Sparkles },
  { path: "/dashboard/ai-agents", label: "AI Agents", icon: Bot },
];

const BOTTOM_NAV = [
  { path: "/dashboard", label: "Home", icon: LayoutDashboard, exact: true },
  { path: "/dashboard/planner", label: "Planner", icon: BookOpen },
  { path: "/dashboard/calendar", label: "Calendar", icon: CalendarIcon },
  { path: "/dashboard/insights", label: "Insights", icon: Sparkles },
  { path: "/dashboard/ai-agents", label: "Agents", icon: Bot },
];

// ── Active check ─────────────────────────────────────────────────────────────

function isActive(path: string, currentPath: string, exact?: boolean): boolean {
  if (exact) return currentPath === path;
  return currentPath === path || currentPath.startsWith(path + "/");
}

// ── Logo ─────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="h-8 w-8 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
        style={{
          background: "linear-gradient(135deg, #6366f1, #06b6d4)",
          boxShadow: "0 0 12px rgba(99,102,241,0.4)",
        }}
      >
        <div className="w-4 h-4 rounded-full border-2 border-white/80 flex items-center justify-center relative">
          <div className="w-1.5 h-1.5 bg-white rounded-sm rotate-45 animate-pulse" />
        </div>
      </div>
      <span className="text-base font-bold tracking-tight text-white hidden xl:block">
        HALO
      </span>
    </div>
  );
}

// ── Nav link (sidebar) ────────────────────────────────────────────────────────

function SideNavLink({
  item,
  active,
  onClick,
}: {
  item: typeof NAV_ITEMS[number];
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
        transition-all duration-200 group relative
        ${active
          ? "text-white"
          : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
        }
      `}
      style={
        active
          ? {
            background: "linear-gradient(135deg, rgba(99,102,241,0.2), rgba(6,182,212,0.1))",
            boxShadow: "inset 0 0 0 1px rgba(99,102,241,0.3)",
          }
          : undefined
      }
    >
      {active && (
        <span
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
          style={{ background: "linear-gradient(to bottom, #6366f1, #06b6d4)" }}
        />
      )}
      <Icon
        size={17}
        className={active ? "text-indigo-400" : "text-slate-600 group-hover:text-slate-400 transition-colors"}
      />
      <span>{item.label}</span>
      {active && <ChevronRight size={12} className="ml-auto text-indigo-400/60" />}
    </Link>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    signOut();
    navigate("/");
  };

  const getInitials = () => {
    if (user?.name) {
      const parts = user.name.split(" ");
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return parts[0].substring(0, 2).toUpperCase();
    }
    return "U";
  };

  const handleUnreadChange = useCallback((n: number) => {
    setUnreadCount(n);
  }, []);

  return (
    <div
      className="min-h-screen"
      style={{ background: "#0a0f1e" }}
    >
      {/* ── Top Navbar ── */}
      <nav
        className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl"
        style={{ background: "rgba(10,15,30,0.85)" }}
      >
        <div className="px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            {/* Left: Mobile hamburger + Logo */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8 transition-all"
              >
                {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
              <Logo />
            </div>

            {/* Right actions */}
            <div className="flex items-center gap-1.5">
              {/* Notifications */}
              <NotificationPanel
                unreadCount={unreadCount}
                onUnreadChange={handleUnreadChange}
              />

              {/* Avatar dropdown */}
              <div className="relative group">
                <button
                  id="user-avatar-btn"
                  className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold text-white transition-all hover:scale-105"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #a855f7)",
                    boxShadow: "0 0 10px rgba(99,102,241,0.3)",
                  }}
                >
                  {getInitials()}
                </button>

                {/* Dropdown */}
                <div
                  className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl shadow-black/60 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto transition-all duration-200 origin-top-right z-50"
                >
                  {/* User info */}
                  <div className="px-4 py-3.5 border-b border-white/8">
                    <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
                    <p className="text-xs text-slate-500 truncate">{user?.email}</p>
                  </div>

                  {/* Menu items */}
                  <div className="p-2 space-y-0.5">
                    <button
                      onClick={() => navigate("/dashboard/profile")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                    >
                      <User size={15} className="text-slate-500" /> Profile
                    </button>
                    <button
                      onClick={() => navigate("/dashboard/settings")}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-all text-left"
                    >
                      <SettingsIcon size={15} className="text-slate-500" /> Settings
                    </button>
                    <div className="border-t border-white/5 my-1" />
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-red-400 hover:text-red-300 hover:bg-red-500/8 transition-all text-left"
                    >
                      <LogOut size={15} /> Log out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* ── Sidebar — Desktop ── */}
        <aside
          className="hidden lg:flex flex-col w-56 border-r border-white/5 sticky top-14 h-[calc(100vh-3.5rem)]"
          style={{ background: "rgba(10,15,30,0.6)" }}
        >
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {NAV_ITEMS.map((item) => (
              <SideNavLink
                key={item.path}
                item={item}
                active={isActive(item.path, location.pathname, item.exact)}
              />
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="p-3 border-t border-white/5 space-y-1">
            <Link
              to="/dashboard/settings"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive("/dashboard/settings", location.pathname)
                ? "text-white bg-white/8"
                : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`}
            >
              <SettingsIcon size={16} className="text-slate-500" />
              Settings
            </Link>
            <Link
              to="/dashboard/profile"
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${isActive("/dashboard/profile", location.pathname)
                ? "text-white bg-white/8"
                : "text-slate-500 hover:text-slate-200 hover:bg-white/5"
                }`}
            >
              <User size={16} className="text-slate-500" />
              Profile
            </Link>
          </div>
        </aside>

        {/* ── Mobile Sidebar Overlay ── */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              className="lg:hidden fixed left-0 top-14 bottom-0 z-50 w-64 border-r border-white/8 flex flex-col"
              style={{ background: "#0d1117" }}
            >
              <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
                {NAV_ITEMS.map((item) => (
                  <SideNavLink
                    key={item.path}
                    item={item}
                    active={isActive(item.path, location.pathname, item.exact)}
                    onClick={() => setSidebarOpen(false)}
                  />
                ))}
                <div className="border-t border-white/5 my-2" />
                <SideNavLink
                  item={{ path: "/dashboard/settings", label: "Settings", icon: SettingsIcon }}
                  active={isActive("/dashboard/settings", location.pathname)}
                  onClick={() => setSidebarOpen(false)}
                />
                <SideNavLink
                  item={{ path: "/dashboard/profile", label: "Profile", icon: User }}
                  active={isActive("/dashboard/profile", location.pathname)}
                  onClick={() => setSidebarOpen(false)}
                />
              </nav>

              {/* Mobile logout */}
              <div className="p-3 border-t border-white/5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/8 transition-all"
                >
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            </aside>
          </>
        )}

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-7xl">
          <Outlet />
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ── */}
      <div
        className="lg:hidden fixed bottom-0 left-0 right-0 border-t border-white/8 z-40"
        style={{ background: "rgba(10,15,30,0.95)", backdropFilter: "blur(20px)" }}
      >
        <nav className="flex items-center px-2 py-1">
          {BOTTOM_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path, location.pathname, item.exact);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-0.5 flex-1 py-2 rounded-xl transition-all ${active ? "text-indigo-400" : "text-slate-600 active:text-slate-400"
                  }`}
              >
                <Icon
                  size={18}
                  className={active ? "text-indigo-400" : "text-slate-600"}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}