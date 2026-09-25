import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Award, FileText } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import NoGroupState from "@/components/NoGroupState";

type ResultSummary = Tables<"result_summaries"> & { candidate_name?: string; position_title?: string };

const MemberResults = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [elections, setElections] = useState<Tables<"election_cycles">[]>([]);
  const [results, setResults] = useState<ResultSummary[]>([]);
  const [positions, setPositions] = useState<Tables<"positions">[]>([]);
  const [loading, setLoading] = useState(true);
  const [ties, setTies] = useState<Tables<"tie_resolutions">[]>([]);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    const load = async () => {
      try {
        const { data: els } = await supabase
          .from("election_cycles")
          .select("*")
          .eq("group_id", groupId)
          .eq("status", "published")
          .order("created_at", { ascending: false });
        setElections(els || []);

        if (els && els.length > 0) {
          const elIds = els.map(e => e.id);

          const { data: pos } = await supabase
            .from("positions")
            .select("*")
            .in("election_cycle_id", elIds);
          setPositions(pos || []);

          const { data: tr } = await supabase.from("tie_resolutions").select("*").in("election_cycle_id", elIds);
          setTies(tr || []);

          const { data: res } = await supabase
            .from("result_summaries")
            .select("*, candidate_selections!result_summaries_candidate_id_fkey(member_id, members!candidate_selections_member_id_fkey(full_name))")
            .eq("group_id", groupId)
            .in("election_cycle_id", elIds)
            .order("rank");

          if (res) {
            setResults(res.map((r: any) => ({
              ...r,
              candidate_name: r.candidate_selections?.members?.full_name || "Unknown",
              position_title: pos?.find(p => p.id === r.position_id)?.title,
            })));
          }
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, groupLoading]);

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading results">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!groupId) return <NoGroupState title="Election Results" />;

  if (elections.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold sm:text-2xl">Published Results</h1>
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <FileText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No results have been published yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Published Results</h1>
        <p className="text-sm text-muted-foreground">View the outcomes of completed elections.</p>
      </div>

      {elections.map((election) => {
        const elPositions = positions.filter(p => p.election_cycle_id === election.id);
        return (
          <div key={election.id} className="space-y-4">
            <h2 className="text-lg font-semibold">{election.title}</h2>

            {elPositions.map((pos) => {
              const posResults = results.filter(r => r.position_id === pos.id);
              return (
                <div key={pos.id} className="glass-card p-5 space-y-3">
                  <p className="font-semibold">{pos.title}</p>
                  {posResults.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No results available.</p>
                  ) : (
                    <ol className="space-y-2">
                      {posResults.map((r, i) => (
                        <li
                          key={r.id}
                          className={`flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 ${
                            r.is_winner ? "bg-accent/10 border border-accent/20" : "bg-muted/50"
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                              r.is_winner ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
                            }`}>
                              {r.rank || i + 1}
                            </div>
                            <span className="break-words font-medium">{r.candidate_name}</span>
                            {r.is_winner && <Trophy className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{r.vote_count} votes</span>
                            {r.is_winner && <Badge className="bg-accent text-accent-foreground">Winner</Badge>}
                          </div>
                        </li>
                      ))}
                    </ol>
                  )}
                  {ties.find(t => t.position_id === pos.id) && (
                    <p className="text-sm text-muted-foreground">
                      Tie resolved by the organisation: {ties.find(t => t.position_id === pos.id)!.reason}
                    </p>
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

export default MemberResults;
