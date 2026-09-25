import { Vote, FileText, Bell, UserCircle, Key } from "lucide-react";

const MemberDashboard = () => (
  <div className="space-y-6">
    <div>
      <h1 className="text-xl font-bold sm:text-2xl">Welcome Back</h1>
      <p className="text-sm text-muted-foreground">View your elections, nominations, and voting activity.</p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Key className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Your Voting Code</p>
            <p className="text-lg font-mono font-bold tracking-wider">VX-29A-84K</p>
          </div>
        </div>
      </div>
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
            <Vote className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Open Elections</p>
            <p className="text-lg font-bold">2 active</p>
          </div>
        </div>
      </div>
      <div className="glass-card p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Published Results</p>
            <p className="text-lg font-bold">3 available</p>
          </div>
        </div>
      </div>
    </div>

    <div className="glass-card p-5">
      <h2 className="font-semibold">Notifications</h2>
      <div className="mt-4 space-y-3">
        {[
          { msg: "You've been nominated for Vice President", time: "1 hour ago", urgent: true },
          { msg: "Board Elections voting is now open", time: "3 hours ago", urgent: true },
          { msg: "Committee Selection results published", time: "2 days ago", urgent: false },
        ].map((n, i) => (
          <div key={i} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
            <Bell className={`h-4 w-4 mt-0.5 shrink-0 ${n.urgent ? "text-accent" : "text-muted-foreground"}`} />
            <div className="flex-1">
              <p className="text-sm">{n.msg}</p>
              <p className="text-xs text-muted-foreground">{n.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="glass-card p-5">
      <h2 className="font-semibold">Quick Actions</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { label: "Cast Vote", icon: Vote },
          { label: "View Results", icon: FileText },
          { label: "My Profile", icon: UserCircle },
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

export default MemberDashboard;
