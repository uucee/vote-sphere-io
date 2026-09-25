import { Users, Vote, BarChart3, Bell, Clock, CheckCircle2 } from "lucide-react";

const stats = [
  { label: "Total Members", value: "156", icon: Users, sub: "12 pending invites" },
  { label: "Active Elections", value: "2", icon: Vote, sub: "1 in voting phase" },
  { label: "Voter Turnout", value: "78%", icon: BarChart3, sub: "Last election" },
  { label: "Pending Actions", value: "5", icon: Bell, sub: "Requires attention" },
];

const timeline = [
  { title: "Board Elections 2026", status: "Voting Open", statusColor: "bg-accent text-accent-foreground", date: "Closes Apr 5" },
  { title: "Committee Selection", status: "Nominations Open", statusColor: "bg-primary text-primary-foreground", date: "Closes Mar 30" },
  { title: "Treasurer Election", status: "Published", statusColor: "bg-muted text-muted-foreground", date: "Mar 15" },
];

const GroupDashboard = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">Group Dashboard</h1>
      <p className="text-sm text-muted-foreground">Manage your organisation's elections and members.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="glass-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">{s.label}</span>
            <s.icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="mt-2 text-2xl font-bold">{s.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
        </div>
      ))}
    </div>

    <div className="glass-card p-5">
      <h3 className="font-semibold">Election Timeline</h3>
      <div className="mt-4 space-y-3">
        {timeline.map((t, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0">
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.date}</p>
              </div>
            </div>
            <span className={`badge-status ${t.statusColor}`}>{t.status}</span>
          </div>
        ))}
      </div>
    </div>

    <div className="glass-card p-5">
      <h3 className="font-semibold">Quick Actions</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Invite Members", icon: Users },
          { label: "Create Election", icon: Vote },
          { label: "View Results", icon: CheckCircle2 },
        ].map((a) => (
          <button key={a.label} className="flex items-center gap-3 rounded-lg border border-border min-h-[44px] p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <a.icon className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium">{a.label}</span>
          </button>
        ))}
      </div>
    </div>
  </div>
);

export default GroupDashboard;
