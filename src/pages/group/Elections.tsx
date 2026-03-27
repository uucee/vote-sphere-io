import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Vote, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

type Election = Tables<"election_cycles">;

const statusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  nominations_open: "bg-primary/10 text-primary",
  nominations_closed: "bg-secondary text-secondary-foreground",
  candidate_review: "bg-secondary text-secondary-foreground",
  candidate_acceptance: "bg-secondary text-secondary-foreground",
  ready_for_voting: "bg-accent/10 text-accent",
  voting_open: "bg-accent text-accent-foreground",
  voting_closed: "bg-muted text-muted-foreground",
  result_review: "bg-muted text-muted-foreground",
  published: "bg-primary text-primary-foreground",
  cancelled: "bg-destructive/10 text-destructive",
};

const statusLabel = (s: string) => s.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

const GroupElections = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    const load = async () => {
      const { data } = await supabase
        .from("election_cycles")
        .select("*")
        .eq("group_id", groupId)
        .order("created_at", { ascending: false });
      setElections(data || []);
      setLoading(false);
    };
    load();
  }, [groupId]);

  if (groupLoading || loading) {
    return <div className="flex items-center justify-center py-20"><span className="text-muted-foreground">Loading…</span></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Elections</h1>
          <p className="text-sm text-muted-foreground">Create and manage election cycles.</p>
        </div>
        <Button asChild>
          <Link to="/group/elections/new"><Plus className="mr-2 h-4 w-4" />New Election</Link>
        </Button>
      </div>

      {elections.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <Vote className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">No elections yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elections.map((e) => (
            <Link
              key={e.id}
              to={`/group/elections/${e.id}`}
              className="glass-card flex items-center justify-between p-5 transition-colors hover:bg-muted/50"
            >
              <div className="space-y-1">
                <p className="font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(e.created_at), "MMM d, yyyy")}
                  {e.voting_start && ` · Voting ${format(new Date(e.voting_start), "MMM d")} – ${e.voting_end ? format(new Date(e.voting_end), "MMM d") : "TBD"}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge className={statusColors[e.status] || ""}>{statusLabel(e.status)}</Badge>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupElections;
