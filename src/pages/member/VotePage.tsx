import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { Vote, CheckCircle2, User } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type CandidateSelection = Tables<"candidate_selections"> & { member_name?: string };

const MemberVotePage = () => {
  const { groupId } = useGroupContext();
  const { user } = useAuth();
  const [elections, setElections] = useState<Tables<"election_cycles">[]>([]);
  const [positions, setPositions] = useState<Tables<"positions">[]>([]);
  const [candidates, setCandidates] = useState<CandidateSelection[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [myVotes, setMyVotes] = useState<Tables<"votes">[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!groupId || !user) return;
    const load = async () => {
      const { data: me } = await supabase
        .from("members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setMyMemberId(me?.id || null);

      const { data: els } = await supabase
        .from("election_cycles")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "voting_open");
      setElections(els || []);

      if (els && els.length > 0) {
        const elIds = els.map(e => e.id);

        const { data: pos } = await supabase
          .from("positions")
          .select("*")
          .in("election_cycle_id", elIds)
          .eq("is_active", true);
        setPositions(pos || []);

        // Get accepted candidates
        const { data: cands } = await supabase
          .from("candidate_selections")
          .select("*, members!candidate_selections_member_id_fkey(full_name)")
          .eq("group_id", groupId)
          .in("status", ["accepted", "qualified"]);

        if (cands) {
          setCandidates(cands.map((c: any) => ({ ...c, member_name: c.members?.full_name })));
        }

        // Get my existing votes
        if (me) {
          const { data: votes } = await supabase
            .from("votes")
            .select("*")
            .eq("member_id", me.id)
            .eq("is_latest", true);
          setMyVotes(votes || []);

          // Pre-select my current votes
          const sel: Record<string, string> = {};
          (votes || []).forEach(v => { sel[v.position_id] = v.candidate_id; });
          setSelections(sel);
        }
      }

      setLoading(false);
    };
    load();
  }, [groupId, user]);

  const handleVote = async (positionId: string, electionId: string) => {
    const candidateId = selections[positionId];
    if (!candidateId || !myMemberId || !groupId) return;

    setSubmitting(positionId);
    try {
      // Mark old votes as not latest
      await supabase
        .from("votes")
        .update({ is_latest: false })
        .eq("member_id", myMemberId)
        .eq("position_id", positionId);

      // Insert new vote
      const { error } = await supabase.from("votes").insert({
        election_cycle_id: electionId,
        position_id: positionId,
        candidate_id: candidateId,
        member_id: myMemberId,
        group_id: groupId,
        is_latest: true,
      });
      if (error) throw error;

      toast.success("Vote cast successfully!");
      setAnnouncement("Your vote was recorded successfully.");
      // Refresh votes
      const { data: votes } = await supabase
        .from("votes")
        .select("*")
        .eq("member_id", myMemberId)
        .eq("is_latest", true);
      setMyVotes(votes || []);
    } catch (err: any) {
      toast.error(err.message || "Failed to cast vote");
      setAnnouncement(`Your vote was not recorded: ${err.message || "please try again"}.`);
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading ballot">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

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
        const elPositions = positions.filter(p => p.election_cycle_id === election.id);
        return (
          <div key={election.id} className="space-y-4">
            <h2 className="text-lg font-semibold">{election.title}</h2>

            {elPositions.map((pos) => {
              const posCandidates = candidates.filter(c => c.position_id === pos.id);
              const existingVote = myVotes.find(v => v.position_id === pos.id);
              const hasVoted = !!existingVote;

              return (
                <div key={pos.id} className="glass-card p-5 space-y-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{pos.title}</p>
                      {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                    </div>
                    {hasVoted && (
                      <Badge className="bg-accent/10 text-accent">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Voted
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
                            onClick={() => setSelections(prev => ({ ...prev, [pos.id]: cand.id }))}
                            className={`flex items-center gap-3 rounded-lg border-2 min-h-[64px] p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none ${
                              isSelected
                                ? "border-primary bg-primary/5 shadow-sm"
                                : "border-border hover:border-primary/30 hover:bg-muted/50"
                            }`}
                          >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              <User className="h-5 w-5" />
                            </div>
                            <div>
                              <p className="font-medium">{cand.member_name || "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{cand.nomination_count} nominations</p>
                            </div>
                            {isSelected && <CheckCircle2 className="ml-auto h-5 w-5 text-primary" />}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {posCandidates.length > 0 && (
                    <div className="sticky bottom-0 -mx-5 -mb-5 border-t border-border/50 bg-card/95 px-5 py-3 pb-safe backdrop-blur sm:static sm:m-0 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0">
                      <Button
                        size="lg"
                        className="w-full sm:w-auto"
                        onClick={() => handleVote(pos.id, election.id)}
                        disabled={!selections[pos.id] || submitting === pos.id}
                      >
                        {submitting === pos.id ? "Submitting…" : hasVoted ? "Change Vote" : "Cast Vote"}
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
