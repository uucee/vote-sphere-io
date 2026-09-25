import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Vote, FileText, Bell, UserCircle, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rpcErrorMessage } from "@/lib/rpcErrors";
import type { Tables } from "@/integrations/supabase/types";

type Candidacy = { id: string; positionTitle: string; electionTitle: string };

const MemberDashboard = () => {
  const { user } = useAuth();
  const { groupId, loading: groupLoading } = useGroupContext();
  const [loading, setLoading] = useState(true);
  const [openCount, setOpenCount] = useState(0);
  const [publishedCount, setPublishedCount] = useState(0);
  const [notifications, setNotifications] = useState<Tables<"notifications">[]>([]);
  const [candidacies, setCandidacies] = useState<Candidacy[]>([]);
  const [responding, setResponding] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Candidacy | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const loadCandidacies = useCallback(async () => {
    if (!user) return;
    const { data: mine } = await supabase.from("members").select("id").eq("user_id", user.id).eq("status", "active");
    const ids = (mine || []).map((m) => m.id);
    if (ids.length === 0) { setCandidacies([]); return; }
    const { data } = await supabase
      .from("candidate_selections")
      .select("id, status, positions!candidate_selections_position_id_fkey(title, election_cycles!positions_election_cycle_id_fkey(title, status))")
      .in("member_id", ids)
      .eq("status", "pending");
    setCandidacies(
      ((data as any[]) || [])
        .filter((c) => c.positions?.election_cycles?.status === "candidate_acceptance")
        .map((c) => ({
          id: c.id,
          positionTitle: c.positions?.title ?? "",
          electionTitle: c.positions?.election_cycles?.title ?? "",
        }))
    );
  }, [user]);

  useEffect(() => {
    if (groupLoading) return;
    if (!user) { setLoading(false); return; }
    const load = async () => {
      try {
        const tasks: Promise<unknown>[] = [
          loadCandidacies(),
          (async () => {
            const { data } = await supabase
              .from("notifications")
              .select("*")
              .eq("user_id", user.id)
              .order("created_at", { ascending: false })
              .limit(5);
            setNotifications(data || []);
          })(),
        ];
        if (groupId) {
          tasks.push(
            (async () => {
              const { count } = await supabase
                .from("election_cycles")
                .select("id", { count: "exact", head: true })
                .eq("group_id", groupId)
                .eq("status", "voting_open");
              setOpenCount(count || 0);
            })(),
            (async () => {
              const { count } = await supabase
                .from("election_cycles")
                .select("id", { count: "exact", head: true })
                .eq("group_id", groupId)
                .eq("status", "published");
              setPublishedCount(count || 0);
            })()
          );
        }
        await Promise.all(tasks);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user, groupId, groupLoading, loadCandidacies]);

  const respond = async (c: Candidacy, accept: boolean) => {
    setDeclineTarget(null);
    setResponding(c.id);
    const { error } = await supabase.rpc("respond_to_candidacy", { p_candidate_id: c.id, p_accept: accept });
    if (error) {
      const msg = rpcErrorMessage(error);
      toast.error(msg);
      setAnnouncement(msg);
    } else {
      const msg = accept
        ? `You have accepted your candidacy for ${c.positionTitle}.`
        : `You have declined your candidacy for ${c.positionTitle}.`;
      toast.success(msg);
      setAnnouncement(msg);
    }
    await loadCandidacies();
    setResponding(null);
  };

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Welcome back</h1>
        <p className="text-sm text-muted-foreground">View your elections, nominations and voting activity.</p>
      </div>

      {candidacies.length > 0 && (
        <section className="glass-card p-5" aria-labelledby="candidacies-heading">
          <h2 id="candidacies-heading" className="flex items-center gap-2 font-semibold">
            <Award className="h-5 w-5 text-accent" aria-hidden="true" /> Your candidacies
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">You have been shortlisted. Please accept or decline.</p>
          <ul className="mt-4 space-y-3">
            {candidacies.map((c) => (
              <li key={c.id} className="flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="font-medium break-words">{c.positionTitle}</p>
                  <p className="text-sm text-muted-foreground break-words">{c.electionTitle}</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button className="min-h-[44px] w-full sm:w-auto" disabled={responding === c.id} onClick={() => respond(c, true)}>
                    Accept
                  </Button>
                  <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" disabled={responding === c.id} onClick={() => setDeclineTarget(c)}>
                    Decline
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AlertDialog open={!!declineTarget} onOpenChange={(o) => !o && setDeclineTarget(null)}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this candidacy?</AlertDialogTitle>
            <AlertDialogDescription>
              You will not appear on the ballot for {declineTarget?.positionTitle}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Keep candidacy</AlertDialogCancel>
            <AlertDialogAction className="min-h-[44px]" onClick={() => declineTarget && respond(declineTarget, false)}>
              Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10">
              <Vote className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Open for voting</p>
              <p className="text-lg font-bold">{openCount}</p>
            </div>
          </div>
        </div>
        <div className="glass-card p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Published results</p>
              <p className="text-lg font-bold">{publishedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <section className="glass-card p-5" aria-labelledby="notifications-heading">
        <h2 id="notifications-heading" className="font-semibold">Notifications</h2>
        {notifications.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">You have no notifications.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 border-b border-border/50 pb-3 last:border-0">
                <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${n.is_read ? "text-muted-foreground" : "text-accent"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium break-words">{n.title}</p>
                  <p className="text-sm break-words">{n.message}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass-card p-5" aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="font-semibold">Quick actions</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: "Cast vote", icon: Vote, to: "/member/vote" },
            { label: "View results", icon: FileText, to: "/member/results" },
            { label: "My profile", icon: UserCircle, to: "/member/profile" },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="flex items-center gap-3 rounded-lg border border-border min-h-[44px] p-4 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <a.icon className="h-5 w-5 text-primary" aria-hidden="true" />
              <span className="text-sm font-medium">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
};

export default MemberDashboard;
