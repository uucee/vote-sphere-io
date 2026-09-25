import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Users, CheckCircle2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Position = Tables<"positions">;
type Member = Tables<"members">;

const MemberNominations = () => {
  const { groupId } = useGroupContext();
  const { user } = useAuth();
  const [elections, setElections] = useState<Tables<"election_cycles">[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [myMemberId, setMyMemberId] = useState<string | null>(null);
  const [myNominations, setMyNominations] = useState<Tables<"nominations">[]>([]);
  const [selectedNominees, setSelectedNominees] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !user) return;
    const load = async () => {
      // Get my member record
      const { data: me } = await supabase
        .from("members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", user.id)
        .eq("status", "active")
        .maybeSingle();
      setMyMemberId(me?.id || null);

      // Get elections with nominations_open
      const { data: els } = await supabase
        .from("election_cycles")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "nominations_open");
      setElections(els || []);

      if (els && els.length > 0) {
        const elIds = els.map(e => e.id);
        
        const { data: pos } = await supabase
          .from("positions")
          .select("*")
          .in("election_cycle_id", elIds)
          .eq("is_active", true);
        setPositions(pos || []);

        // Get my existing nominations
        if (me) {
          const { data: noms } = await supabase
            .from("nominations")
            .select("*")
            .eq("nominated_by_member_id", me.id)
            .eq("is_valid", true);
          setMyNominations(noms || []);
        }
      }

      // Get all group members for nominee selection
      const { data: mems } = await supabase
        .from("members")
        .select("*")
        .eq("group_id", groupId)
        .eq("status", "active");
      setMembers(mems || []);

      setLoading(false);
    };
    load();
  }, [groupId, user]);

  const handleNominate = async (positionId: string) => {
    const nomineeId = selectedNominees[positionId];
    if (!nomineeId || !myMemberId || !groupId) return;

    // Check if already nominated this person for this position
    const existing = myNominations.find(
      n => n.position_id === positionId && n.nominee_member_id === nomineeId
    );
    if (existing) {
      toast.error("You already nominated this person for this position");
      return;
    }

    setSubmitting(positionId);
    try {
      const { error } = await supabase.from("nominations").insert({
        position_id: positionId,
        nominee_member_id: nomineeId,
        nominated_by_member_id: myMemberId,
        group_id: groupId,
      });
      if (error) throw error;

      toast.success("Nomination submitted!");
      // Refresh nominations
      const { data: noms } = await supabase
        .from("nominations")
        .select("*")
        .eq("nominated_by_member_id", myMemberId)
        .eq("is_valid", true);
      setMyNominations(noms || []);
      setSelectedNominees(prev => ({ ...prev, [positionId]: "" }));
    } catch (err: any) {
      toast.error(err.message || "Failed to nominate");
    } finally {
      setSubmitting(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

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
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Nominations</h1>
        <p className="text-sm text-muted-foreground">Nominate candidates for open positions.</p>
      </div>

      {elections.map((election) => {
        const elPositions = positions.filter(p => p.election_cycle_id === election.id);
        return (
          <div key={election.id} className="space-y-4">
            <h2 className="text-lg font-semibold">{election.title}</h2>
            {elPositions.map((pos) => {
              const posNominations = myNominations.filter(n => n.position_id === pos.id);
              return (
                <div key={pos.id} className="glass-card p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{pos.title}</p>
                      {pos.description && <p className="text-sm text-muted-foreground">{pos.description}</p>}
                    </div>
                    <span className="text-xs text-muted-foreground">Top {pos.max_candidates} will be selected</span>
                  </div>

                  {/* My nominations for this position */}
                  {posNominations.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Your Nominations</p>
                      {posNominations.map((n) => {
                        const nominee = members.find(m => m.id === n.nominee_member_id);
                        return (
                          <div key={n.id} className="flex items-center gap-2 rounded-lg bg-accent/5 px-3 py-2">
                            <CheckCircle2 className="h-4 w-4 text-accent" />
                            <span className="text-sm">{nominee?.full_name || nominee?.email || "Unknown"}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Nominate form */}
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Select
                        value={selectedNominees[pos.id] || ""}
                        onValueChange={(v) => setSelectedNominees(prev => ({ ...prev, [pos.id]: v }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a member to nominate" />
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
