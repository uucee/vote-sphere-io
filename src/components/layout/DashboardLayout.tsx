import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Vote, LayoutDashboard, Users, Building2, CreditCard, FileText, Settings, Shield, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

interface DashboardLayoutProps {
  role: "global-admin" | "group-admin" | "member";
}

const navConfig = {
  "global-admin": {
    title: "Global Admin",
    basePath: "/admin",
    items: [
      { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { label: "Groups", href: "/admin/groups", icon: Building2 },
      { label: "Plans & Pricing", href: "/admin/plans", icon: CreditCard },
      { label: "Payments", href: "/admin/payments", icon: FileText },
      { label: "Audit Logs", href: "/admin/audit", icon: Shield },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
  "group-admin": {
    title: "Group Admin",
    basePath: "/group",
    items: [
      { label: "Dashboard", href: "/group", icon: LayoutDashboard },
      { label: "Members", href: "/group/members", icon: Users },
      { label: "Elections", href: "/group/elections", icon: Vote },
      { label: "Results", href: "/group/results", icon: FileText },
      { label: "Billing", href: "/group/billing", icon: CreditCard },
      { label: "Audit Logs", href: "/group/audit", icon: Shield },
      { label: "Settings", href: "/group/settings", icon: Settings },
    ],
  },
  member: {
    title: "Member",
    basePath: "/member",
    items: [
      { label: "Dashboard", href: "/member", icon: LayoutDashboard },
      { label: "Nominations", href: "/member/nominations", icon: Users },
      { label: "Vote", href: "/member/vote", icon: Vote },
      { label: "Results", href: "/member/results", icon: FileText },
      { label: "Profile", href: "/member/profile", icon: Settings },
    ],
  },
};

const DashboardLayout = ({ role }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, profile } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const config = navConfig[role];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
            <Vote className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && <span className="text-lg font-bold">BallotBox</span>}
        </div>

        {/* Role badge */}
        {!collapsed && (
          <div className="px-4 py-3">
            <span className="badge-status bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {config.title}
            </span>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
          {config.items.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom actions */}
        <div className="border-t border-sidebar-border p-2 space-y-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            {!collapsed && "Collapse"}
          </button>
          <button
            onClick={handleSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50"
          >
            <LogOut className="h-4 w-4" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("flex-1 transition-all duration-200", collapsed ? "ml-16" : "ml-60")}>
        <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-md px-6">
          <h2 className="text-sm font-medium text-muted-foreground">{config.title} Portal</h2>
        </header>
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
