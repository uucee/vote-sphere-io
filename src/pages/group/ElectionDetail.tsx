import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, Users, Vote, CheckCircle2, Play, Square, Eye } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Election = Tables<"election_cycles">;
type Position = Tables<"positions">;
type CandidateSelection = Tables<"candidate_selections">;

const statusFlow: Record<string, { next: string; label: string; icon: any }> = {
  draft: { next: "nominations_open", label: "Open Nominations", icon: Play },
  nominations_open: { next: "nominations_closed", label: "Close Nominations", icon: Square },
  nominations_closed: { next: "candidate_review", label: "Start Candidate Review", icon: Eye },
  candidate_review: { next: "candidate_acceptance", label: "Select Top Candidates", icon: Users },
  candidate_acceptance: { next: "ready_for_voting", label: "Finalize Candidates", icon: CheckCircle2 },
  ready_for_voting: { next: "voting_open", label: "Open Voting", icon: Vote },
  voting_open: { next: "voting_closed", label: "Close Voting", icon: Square },
  voting_closed: { next: "result_review", label: "Review Results", icon: Eye },
  result_review: { next: "published", label: "Publish Results", icon: CheckCircle2 },
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const ElectionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { groupId } = useGroupContext();
  const [election, setElection] = useState<Election | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [candidates, setCandidates] = useState<(CandidateSelection & { member_name?: string })[]>([]);
  const [nominationCounts, setNominationCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [advancing, setAdvancing] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    const [elRes, posRes] = await Promise.all([
      supabase.from("election_cycles").select("*").eq("id", id).single(),
      supabase.from("positions").select("*").eq("election_cycle_id", id).order("created_at"),
    ]);
    setElection(elRes.data);
    setPositions(posRes.data || []);

    // Load candidates
    const { data: cands } = await supabase
      .from("candidate_selections")
      .select("*, members!candidate_selections_member_id_fkey(full_name)")
      .eq("group_id", elRes.data?.group_id || "");
    
    if (cands) {
      setCandidates(cands.map((c: any) => ({ ...c, member_name: c.members?.full_name })));
    }

    // Load nomination counts per position
    if (posRes.data) {
      for (const pos of posRes.data) {
        const { count } = await supabase
          .from("nominations")
          .select("*", { count: "exact", head: true })
          .eq("position_id", pos.id)
          .eq("is_valid", true);
        setNominationCounts(prev => ({ ...prev, [pos.id]: count || 0 }));
      }
    }

    setLoading(false);
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const advanceStatus = async () => {
    if (!election || !id) return;
    const flow = statusFlow[election.status];
    if (!flow) return;

    setAdvancing(true);
    try {
      // If moving to candidate_acceptance, auto-select top N candidates
      if (flow.next === "candidate_acceptance") {
        await selectTopCandidates();
      }

      const { error } = await supabase
        .from("election_cycles")
        .update({ status: flow.next as any })
        .eq("id", id);
      if (error) throw error;

      toast.success(`Election moved to: ${statusLabel(flow.next)}`);
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setAdvancing(false);
    }
  };

  const selectTopCandidates = async () => {
    if (!groupId) return;
    for (const pos of positions) {
      // Get top N nominees by nomination count
      const { data: noms } = await supabase
        .from("nominations")
        .select("nominee_member_id")
        .eq("position_id", pos.id)
        .eq("is_valid", true);

      if (!noms || noms.length === 0) continue;

      // Count nominations per nominee
      const counts: Record<string, number> = {};
      noms.forEach(n => { counts[n.nominee_member_id] = (counts[n.nominee_member_id] || 0) + 1; });

      // Sort by count descending and take top N
      const topN = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, pos.max_candidates);

      // Upsert candidate_selections
      for (const [memberId, count] of topN) {
        // Check if already exists
        const { data: existing } = await supabase
          .from("candidate_selections")
          .select("id")
          .eq("position_id", pos.id)
          .eq("member_id", memberId)
          .maybeSingle();

        if (!existing) {
          await supabase.from("candidate_selections").insert({
            position_id: pos.id,
            member_id: memberId,
            group_id: groupId,
            nomination_count: count,
            status: "pending",
          });
        }
      }
    }
  };

  if (loading || !election) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const flow = statusFlow[election.status];

  return (
    <div className="max-w-4xl space-y-6">
      <button onClick={() => navigate("/group/elections")} className="flex min-h-[44px] items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Elections
      </button>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">{election.title}</h1>
          {election.description && <p className="mt-1 text-sm text-muted-foreground">{election.description}</p>}
        </div>
        <Badge className="text-sm">{statusLabel(election.status)}</Badge>
      </div>

      {/* Schedule info */}
      <div className="glass-card p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Nomination Start", value: election.nomination_start },
          { label: "Nomination End", value: election.nomination_end },
          { label: "Voting Start", value: election.voting_start },
          { label: "Voting End", value: election.voting_end },
        ].map((item) => (
          <div key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="text-sm font-medium">{item.value ? format(new Date(item.value), "MMM d, yyyy HH:mm") : "Not set"}</p>
          </div>
        ))}
      </div>

      {/* Advance status */}
      {flow && (
        <div className="glass-card flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-medium">Next Step</p>
            <p className="text-sm text-muted-foreground">{flow.label}</p>
          </div>
          <Button onClick={advanceStatus} disabled={advancing}>
            <flow.icon className="mr-2 h-4 w-4" />
            {advancing ? "Processing…" : flow.label}
          </Button>
        </div>
      )}

      {/* Positions */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold">Positions</h3>
        {positions.map((pos) => {
          const posCandidates = candidates.filter(c => c.position_id === pos.id);
          return (
            <div key={pos.id} className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{pos.title}</p>
                  {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>Top {pos.max_candidates} candidates · {pos.max_winners} winner(s)</p>
                  <p>{nominationCounts[pos.id] || 0} nominations</p>
                </div>
              </div>

              {posCandidates.length > 0 && (
                <div className="border-t border-border pt-3">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Selected Candidates</p>
                  <div className="space-y-2">
                    {posCandidates.map((c) => (
                      <div key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm font-medium">{c.member_name || "Unknown"}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{c.nomination_count} nominations</span>
                          <Badge variant={c.status === "accepted" ? "default" : "secondary"}>
                            {c.status}
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
