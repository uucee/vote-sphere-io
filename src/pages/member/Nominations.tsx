import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, CheckCircle2 } from "lucide-react";
import NoGroupState from "@/components/NoGroupState";
import { rpcErrorMessage } from "@/lib/rpcErrors";
import type { Tables } from "@/integrations/supabase/types";

type Position = Tables<"positions">;
type Member = Tables<"members">;

const MemberNominations = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const { user } = useAuth();
  const [elections, setElections] = useState<Tables<"election_cycles">[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [myNominations, setMyNominations] = useState<Tables<"nominations">[]>([]);
  const [selectedNominees, setSelectedNominees] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const loadMyNominations = useCallback(async (memberId: string) => {
    const { data } = await supabase
      .from("nominations")
      .select("*")
      .eq("nominated_by_member_id", memberId)
      .eq("is_valid", true);
    setMyNominations(data || []);
  }, []);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId || !user) { setLoading(false); return; }
    const load = async () => {
      try {
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
          .eq("status", "nominations_open");
        setElections(els || []);

        if (els && els.length > 0) {
          const { data: pos } = await supabase
            .from("positions")
            .select("*")
            .in("election_cycle_id", els.map((e) => e.id))
            .eq("is_active", true);
          setPositions(pos || []);
          if (me) await loadMyNominations(me.id);
        }

        const { data: mems } = await supabase
          .from("members")
          .select("*")
          .eq("group_id", groupId)
          .eq("status", "active");
        setMembers(mems || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, groupLoading, user, loadMyNominations]);

  const handleNominate = async (positionId: string) => {
    const nomineeId = selectedNominees[positionId];
    if (!nomineeId) return;

    setSubmitting(positionId);
    const { error } = await supabase.rpc("submit_nomination", {
      p_position_id: positionId,
      p_nominee_member_id: nomineeId,
    });
    if (error) {
      const msg = rpcErrorMessage(error);
      toast.error(msg);
      setAnnouncement(`Your nomination was not submitted. ${msg}`);
    } else {
      toast.success("Your nomination has been submitted.");
      setAnnouncement("Your nomination has been submitted.");
      setSelectedNominees((prev) => ({ ...prev, [positionId]: "" }));
      if (myMemberId) await loadMyNominations(myMemberId);
    }
    setSubmitting(null);
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

  if (!groupId) return <NoGroupState title="Nominations" />;

  if (elections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl">Nominations</h1>
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <Users className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No elections are currently accepting nominations.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Nominations</h1>
        <p className="text-sm text-muted-foreground">Nominate candidates for open positions.</p>
      </div>

      {elections.map((election) => {
        const elPositions = positions.filter((p) => p.election_cycle_id === election.id);
        return (
          <div key={election.id} className="space-y-4">
            <h2 className="text-lg font-semibold">{election.title}</h2>
            {elPositions.map((pos) => {
              const posNominations = myNominations.filter((n) => n.position_id === pos.id);
              const selectId = `nominee-${pos.id}`;
              return (
                <div key={pos.id} className="glass-card p-5 space-y-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="font-semibold">{pos.title}</p>
                      {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">Top {pos.max_candidates} will be shortlisted</span>
                  </div>

                  {posNominations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Your nominations</p>
                      {posNominations.map((n) => {
                        const nominee = members.find((m) => m.id === n.nominee_member_id);
                        return (
                          <div key={n.id} className="flex items-center gap-2 rounded-lg bg-accent/5 px-3 py-2">
                            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                            <span className="text-sm break-words">{nominee?.full_name || nominee?.email || "Unknown"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-2">
                      <Label htmlFor={selectId}>Member to nominate</Label>
                      <Select
                        value={selectedNominees[pos.id] || ""}
                        onValueChange={(v) => setSelectedNominees((prev) => ({ ...prev, [pos.id]: v }))}
                      >
                        <SelectTrigger id={selectId} className="min-h-[44px]">
                          <SelectValue placeholder="Select a member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.full_name || m.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      className="min-h-[44px] w-full sm:w-auto"
                      onClick={() => handleNominate(pos.id)}
                      disabled={!selectedNominees[pos.id] || submitting === pos.id}
                    >
                      {submitting === pos.id ? "Submitting…" : "Nominate"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

export default MemberNominations;
