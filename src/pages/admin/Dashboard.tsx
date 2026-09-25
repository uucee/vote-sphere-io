import { BarChart3, Users, Building2, CreditCard, TrendingUp, AlertCircle } from "lucide-react";

const stats = [
  { label: "Total Groups", value: "127", icon: Building2, change: "+12 this month" },
  { label: "Active Groups", value: "98", icon: Users, change: "77% active" },
  { label: "Revenue (MTD)", value: "$4,280", icon: CreditCard, change: "+18% vs last month" },
  { label: "Active Elections", value: "34", icon: BarChart3, change: "Across 22 groups" },
];

const recentActivity = [
  { action: "New group registered", group: "Tech Alumni Association", time: "2 hours ago" },
  { action: "Payment received", group: "Church Council", time: "4 hours ago" },
  { action: "Group suspended", group: "Inactive Club", time: "1 day ago" },
  { action: "Subscription renewed", group: "Engineers Union", time: "2 days ago" },
];

const AdminDashboard = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">Platform Overview</h1>
      <p className="text-sm text-muted-foreground">Monitor all groups, payments, and platform activity.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{s.value}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="h-3 w-3 text-accent" />
            {s.change}
          </p>
        </div>
      ))}
    </div>

    <div className="grid gap-6 lg:grid-cols-2">
      <div className="glass-card p-5">
        <h3 className="font-semibold">Recent Activity</h3>
        <div className="mt-4 space-y-3">
          {recentActivity.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0">
              <div>
                <p className="text-sm font-medium">{a.action}</p>
                <p className="text-xs text-muted-foreground">{a.group}</p>
              </div>
              <span className="text-xs text-muted-foreground">{a.time}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-5">
        <h3 className="font-semibold">Alerts</h3>
        <div className="mt-4 space-y-3">
          <div className="flex items-start gap-3 rounded-lg bg-destructive/5 p-3">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">3 groups with overdue payments</p>
              <p className="text-xs text-muted-foreground">Action required — review and suspend if needed</p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-lg bg-amber/5 p-3">
            <AlertCircle className="h-4 w-4 text-amber mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium">5 subscriptions expiring this week</p>
              <p className="text-xs text-muted-foreground">Renewal reminders sent</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default AdminDashboard;
