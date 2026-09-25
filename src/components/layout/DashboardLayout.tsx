import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { Vote, LayoutDashboard, Users, Building2, CreditCard, FileText, Settings, Shield, LogOut, ChevronLeft, ChevronRight, Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface DashboardLayoutProps {
  role: "global-admin" | "group-admin" | "member";
}

const navConfig = {
  "global-admin": {
    title: "Global Admin",
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
  const { signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const config = navConfig[role];

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  const renderNav = (compact: boolean, onNavigate?: () => void) => (
    <>
      <div className="flex h-16 items-center gap-2.5 border-b border-sidebar-border px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary">
          <Vote className="h-4 w-4 text-sidebar-primary-foreground" aria-hidden="true" />
        </div>
        {!compact && <span className="text-lg font-bold">VoteWell Secure</span>}
      </div>

      {!compact && (
        <div className="px-4 py-3">
          <span className="badge-status bg-sidebar-accent text-sidebar-accent-foreground text-xs">{config.title}</span>
        </div>
      )}

      <nav aria-label={`${config.title} navigation`} className="flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {config.items.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              aria-label={compact ? item.label : undefined}
              title={compact ? item.label : undefined}
              className={cn(
                "flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {!compact && item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );

  const actionClass =
    "flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/80 hover:bg-sidebar-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-200 lg:flex",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {renderNav(collapsed)}
        <div className="space-y-1 border-t border-sidebar-border p-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={actionClass}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" aria-hidden="true" /> : <ChevronLeft className="h-4 w-4" aria-hidden="true" />}
            {!collapsed && "Collapse"}
          </button>
          <button onClick={handleSignOut} aria-label="Sign out" className={actionClass}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </aside>

      <div className={cn("min-w-0 flex-1 transition-all duration-200", collapsed ? "lg:ml-16" : "lg:ml-60")}>
        <header className="pt-safe sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex h-14 items-center gap-2 px-2 sm:px-4 lg:px-6">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  className="flex h-11 w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="flex w-72 flex-col border-sidebar-border bg-sidebar p-0 text-sidebar-foreground">
                <SheetTitle className="sr-only">Menu</SheetTitle>
                {renderNav(false, () => setMobileOpen(false))}
                <div className="pb-safe border-t border-sidebar-border p-2">
                  <button onClick={handleSignOut} className={actionClass}>
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </SheetContent>
            </Sheet>
            <p className="truncate text-sm font-medium text-muted-foreground">{config.title} Portal</p>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 pb-safe sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
