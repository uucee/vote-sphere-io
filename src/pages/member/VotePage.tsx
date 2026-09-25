import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, CheckCircle2, User, Lock } from "lucide-react";
import NoGroupState from "@/components/NoGroupState";
import { rpcErrorMessage } from "@/lib/rpcErrors";
import type { Tables } from "@/integrations/supabase/types";

type CandidateSelection = Tables<"candidate_selections"> & { member_name?: string };
type BallotRow = { position_id: string; candidate_id: string; cast_at: string };

const MemberVotePage = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const { user } = useAuth();
  const [elections, setElections] = useState<Tables<"election_cycles">[]>([]);
  const [positions, setPositions] = useState<Tables<"positions">[]>([]);
  const [candidates, setCandidates] = useState<CandidateSelection[]>([]);
  const [ballot, setBallot] = useState<BallotRow[]>([]);
  const [editingAllowed, setEditingAllowed] = useState<Record<string, boolean>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const loadBallot = useCallback(async (electionIds: string[]) => {
    const results = await Promise.all(
      electionIds.map((id) => supabase.rpc("get_my_ballot", { p_election_id: id }))
    );
    const rows: BallotRow[] = results.flatMap((r) => (r.data as BallotRow[] | null) || []);
    setBallot(rows);
    return rows;
  }, []);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId || !user) { setLoading(false); return; }
    const load = async () => {
      try {
        const { data: els } = await supabase
          .from("election_cycles")
          .select("*")
          .eq("group_id", groupId)
          .eq("status", "voting_open");
        setElections(els || []);
        if (!els || els.length === 0) return;
        const elIds = els.map((e) => e.id);

        const { data: pos } = await supabase
          .from("positions")
          .select("*")
          .in("election_cycle_id", elIds)
          .eq("is_active", true);
        setPositions(pos || []);
        const positionIds = (pos || []).map((p) => p.id);

        if (positionIds.length > 0) {
          const { data: cands } = await supabase
            .from("candidate_selections")
            .select("*, members!candidate_selections_member_id_fkey(full_name)")
            .in("position_id", positionIds)
            .in("status", ["accepted", "qualified"]);
          setCandidates((cands || []).map((c: any) => ({ ...c, member_name: c.members?.full_name })));
        }

        const [rows, editing] = await Promise.all([
          loadBallot(elIds),
          Promise.all(
            elIds.map(async (id) => {
              const { data } = await supabase.rpc("vote_editing_allowed", { p_election_id: id });
              return [id, data === true] as const;
            })
          ),
        ]);
        setEditingAllowed(Object.fromEntries(editing));
        const sel: Record<string, string> = {};
        rows.forEach((v) => { sel[v.position_id] = v.candidate_id; });
        setSelections(sel);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, groupLoading, user, loadBallot]);

  const handleVote = async (positionId: string) => {
    const candidateId = selections[positionId];
    if (!candidateId) return;

    setSubmitting(positionId);
    const { error } = await supabase.rpc("cast_vote", {
      p_position_id: positionId,
      p_candidate_id: candidateId,
    });
    if (error) {
      const msg = rpcErrorMessage(error);
      toast.error(msg);
      setAnnouncement(`Your vote was not recorded. ${msg}`);
    } else {
      toast.success("Your vote has been recorded.");
      setAnnouncement("Your vote has been recorded.");
    }
    await loadBallot(elections.map((e) => e.id));
    setSubmitting(null);
  };

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading ballot">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!groupId) return <NoGroupState title="Cast Your Vote" />;

  if (elections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl">Cast Your Vote</h1>
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <Vote className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No elections are currently open for voting.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Cast Your Vote</h1>
        <p className="text-sm text-muted-foreground">Select your preferred candidate for each position.</p>
      </div>

      {elections.map((election) => {
        const elPositions = positions.filter((p) => p.election_cycle_id === election.id);
        const canEdit = editingAllowed[election.id] === true;
        return (
          <div key={election.id} className="space-y-4">
            <h2 className="text-lg font-semibold">{election.title}</h2>

            {elPositions.map((pos) => {
              const posCandidates = candidates.filter((c) => c.position_id === pos.id);
              const recorded = ballot.find((v) => v.position_id === pos.id);
              const hasVoted = !!recorded;
              const locked = hasVoted && !canEdit;
              const matchesRecorded = hasVoted && selections[pos.id] === recorded!.candidate_id;

              return (
                <div key={pos.id} className="glass-card p-5 space-y-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{pos.title}</p>
                      {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                    </div>
                    {hasVoted && (
                      <Badge className="self-start bg-accent/10 text-accent">
                        <CheckCircle2 className="mr-1 h-3 w-3" aria-hidden="true" /> Voted
                      </Badge>
                    )}
                  </div>

                  {posCandidates.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No candidates available for this position.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {posCandidates.map((cand) => {
                        const isSelected = selections[pos.id] === cand.id;
                        return (
                          <button
                            key={cand.id}
                            type="button"
                            aria-pressed={isSelected}
                            disabled={locked}
                            onClick={() => setSelections((prev) => ({ ...prev, [pos.id]: cand.id }))}
                            className={`flex items-center gap-3 rounded-lg border-2 min-h-[64px] p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none disabled:cursor-not-allowed ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/30 hover:bg-muted/50 disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-transparent"
                            }`}
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              <User className="h-5 w-5" aria-hidden="true" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium break-words">{cand.member_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{cand.nomination_count} nominations</p>
                            </div>
                            {isSelected && <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-primary" aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {locked && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Lock className="h-4 w-4 shrink-0" aria-hidden="true" /> Your vote has been recorded.
                    </p>
                  )}

                  {posCandidates.length > 0 && !locked && (
                    <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border/50 bg-card/95 px-5 py-3 pb-safe backdrop-blur sm:static sm:m-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        onClick={() => handleVote(pos.id)}
                        disabled={!selections[pos.id] || submitting === pos.id || matchesRecorded}
                      >
                        {submitting === pos.id ? "Submitting…" : hasVoted ? "Change vote" : "Cast vote"}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default MemberVotePage;
