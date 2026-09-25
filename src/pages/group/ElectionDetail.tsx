import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { toast } from "sonner";
import { ArrowLeft, Users, Vote, CheckCircle2, Play, Square, Eye, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import NoGroupState from "@/components/NoGroupState";
import { rpcErrorCode, rpcErrorMessage } from "@/lib/rpcErrors";
import type { Tables, Database } from "@/integrations/supabase/types";

type Election = Tables<"election_cycles">;
type Position = Tables<"positions">;
type CandidateSelection = Tables<"candidate_selections">;
type ResultRow = Tables<"result_summaries">;
type ElectionStatus = Database["public"]["Enums"]["election_status"];
type Turnout = { position_id: string; voters: number; eligible: number };

const statusFlow: Record<string, { next: string; label: string; icon: any }> = {
  draft: { next: "nominations_open", label: "Open nominations", icon: Play },
  nominations_open: { next: "nominations_closed", label: "Close nominations", icon: Square },
  nominations_closed: { next: "candidate_review", label: "Start candidate review", icon: Eye },
  candidate_review: { next: "candidate_acceptance", label: "Shortlist top candidates", icon: Users },
  candidate_acceptance: { next: "ready_for_voting", label: "Finalise candidates", icon: CheckCircle2 },
  ready_for_voting: { next: "voting_open", label: "Open voting", icon: Vote },
  voting_open: { next: "voting_closed", label: "Close voting", icon: Square },
  voting_closed: { next: "result_review", label: "Review results", icon: Eye },
  result_review: { next: "published", label: "Publish results", icon: CheckCircle2 },
};

const IRREVERSIBLE: Record<string, string> = {
  nominations_open: "Closing nominations stops members from submitting any further nominations. This step cannot be undone.",
  voting_open: "Closing voting stops members from casting or changing votes. This step cannot be undone.",
  result_review: "Publishing makes the results visible to all members. This step cannot be undone.",
};

const TURNOUT_STATUSES: ElectionStatus[] = ["voting_open", "voting_closed", "result_review", "published"];

const statusLabel = (s: string) => {
  const t = s.replace(/_/g, " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

const ElectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groupId, loading: groupLoading } = useGroupContext();
  const [election, setElection] = useState<Election | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<(CandidateSelection & { member_name?: string })[]>([]);
  const [nominationCounts, setNominationCounts] = useState<Record<string, number>>({});
  const [turnout, setTurnout] = useState<Record<string, Turnout>>({});
  const [results, setResults] = useState<ResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [tieBlocked, setTieBlocked] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) { setLoading(false); return; }
    try {
      const [elRes, posRes] = await Promise.all([
        supabase.from("election_cycles").select("*").eq("id", id).maybeSingle(),
        supabase.from("positions").select("*").eq("election_cycle_id", id).order("created_at"),
      ]);
      const el = elRes.data;
      const pos = posRes.data || [];
      setElection(el);
      setPositions(pos);
      const positionIds = pos.map((p) => p.id);

      if (positionIds.length > 0) {
        const [candRes, nomRes] = await Promise.all([
          supabase
            .from("candidate_selections")
            .select("*, members!candidate_selections_member_id_fkey(full_name)")
            .in("position_id", positionIds),
          supabase.from("nominations").select("position_id").in("position_id", positionIds).eq("is_valid", true),
        ]);
        setCandidates((candRes.data || []).map((c: any) => ({ ...c, member_name: c.members?.full_name })));
        const counts: Record<string, number> = {};
        (nomRes.data || []).forEach((n) => { counts[n.position_id] = (counts[n.position_id] || 0) + 1; });
        setNominationCounts(counts);
      } else {
        setCandidates([]);
        setNominationCounts({});
      }

      if (el && TURNOUT_STATUSES.includes(el.status)) {
        const { data } = await supabase.rpc("get_turnout", { p_election_id: el.id });
        const map: Record<string, Turnout> = {};
        ((data as any[]) || []).forEach((t) => {
          map[t.position_id] = { position_id: t.position_id, voters: Number(t.voters), eligible: Number(t.eligible) };
        });
        setTurnout(map);
      } else {
        setTurnout({});
      }

      if (el && (el.status === "result_review" || el.status === "published")) {
        const { data } = await supabase
          .from("result_summaries")
          .select("*")
          .eq("election_cycle_id", el.id)
          .order("rank");
        setResults(data || []);
      } else {
        setResults([]);
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const advanceStatus = async () => {
    if (!election) return;
    setConfirmOpen(false);
    setAdvancing(true);
    const { data, error } = await supabase.rpc("advance_election", {
      p_election_id: election.id,
      p_expected_status: election.status,
    });
    if (error) {
      const msg = rpcErrorMessage(error);
      const code = rpcErrorCode(error);
      if (code === "UNRESOLVED_TIE") {
        toast.error(msg, { action: { label: "Go to results", onClick: () => navigate("/group/results") } });
        setTieBlocked(true);
      } else {
        toast.error(msg);
      }
      setAnnouncement(msg);
      if (code === "STATUS_CHANGED") await loadData();
    } else {
      const msg = `Election moved to: ${statusLabel(String(data))}.`;
      toast.success(msg);
      setAnnouncement(msg);
      await loadData();
    }
    setAdvancing(false);
  };

  const onAdvanceClick = () => {
    if (!election) return;
    if (IRREVERSIBLE[election.status]) setConfirmOpen(true);
    else advanceStatus();
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

  if (!groupId) return <NoGroupState title="Election" />;

  if (!election) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold sm:text-2xl">Election not found</h1>
        <Button variant="outline" className="min-h-[44px]" onClick={() => navigate("/group/elections")}>
          Back to elections
        </Button>
      </div>
    );
  }

  const flow = statusFlow[election.status];
  const showResults = election.status === "result_review" || election.status === "published";

  return (
    <div className="max-w-4xl space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      {tieBlocked && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-medium">Resolve all ties before publishing results.</p>
          <Link to="/group/results" className="mt-2 inline-flex min-h-[44px] items-center font-medium text-primary underline underline-offset-4">
            Go to results to resolve ties
          </Link>
        </div>
      )}
      <button onClick={() => navigate("/group/elections")} className="flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to elections
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold break-words sm:text-2xl">{election.title}</h1>
          {election.description && <p className="mt-1 text-sm text-muted-foreground">{election.description}</p>}
        </div>
        <Badge className="self-start text-sm">{statusLabel(election.status)}</Badge>
      </div>

      <div className="glass-card p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nominations open", value: election.nomination_start },
          { label: "Nominations close", value: election.nomination_end },
          { label: "Voting opens", value: election.voting_start },
          { label: "Voting closes", value: election.voting_end },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium">{item.value ? format(new Date(item.value), "d MMM yyyy, HH:mm") : "Not set"}</p>
          </div>
        ))}
      </div>

      {flow && (
        <div className="glass-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Next step</p>
            <p className="text-sm text-muted-foreground">{flow.label}</p>
          </div>
          <Button className="min-h-[44px] w-full sm:w-auto" onClick={onAdvanceClick} disabled={advancing}>
            <flow.icon className="mr-2 h-4 w-4" aria-hidden="true" />
            {advancing ? "Processing…" : flow.label}
          </Button>
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>{flow?.label}?</AlertDialogTitle>
            <AlertDialogDescription>{IRREVERSIBLE[election.status]}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="min-h-[44px]" onClick={advanceStatus}>
              {flow?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Positions</h2>
        {positions.map((pos) => {
          const posCandidates = candidates.filter((c) => c.position_id === pos.id);
          const t = turnout[pos.id];
          const posResults = results.filter((r) => r.position_id === pos.id);
          const winners = posResults.filter((r) => r.is_winner).length;
          const tie = winners > pos.max_winners;
          return (
            <div key={pos.id} className="glass-card p-5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="font-semibold">{pos.title}</p>
                  {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                </div>
                <div className="text-xs text-muted-foreground sm:text-right">
                  <p>Top {pos.max_candidates} candidates · {pos.max_winners} winner(s)</p>
                  <p>{nominationCounts[pos.id] || 0} nominations</p>
                  {t && <p className="font-medium text-foreground">{t.voters} of {t.eligible} members have voted</p>}
                </div>
              </div>

              {showResults && posResults.length > 0 ? (
                <div className="border-t border-border pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Results</p>
                  {tie && election.status === "result_review" && (
                    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive" role="alert">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Tie – needs resolving before publishing.</span>
                    </div>
                  )}
                  {posResults.map((r) => {
                    const cand = candidates.find((c) => c.id === r.candidate_id);
                    return (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm font-medium break-words">
                          {r.rank ? `${r.rank}. ` : ""}{cand?.member_name || "Unknown"}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{r.vote_count} votes</span>
                          {r.is_winner && <Badge>Winner</Badge>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : posCandidates.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Shortlisted candidates</p>
                  <div className="space-y-2">
                    {posCandidates.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm font-medium break-words">{c.member_name || "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{c.nomination_count} nominations</span>
                          <Badge variant={c.status === "accepted" ? "default" : "secondary"}>
                            {statusLabel(c.status)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ElectionDetail;
