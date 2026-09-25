import { Skeleton } from "@/components/ui/skeleton";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Vote, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";
import NoGroupState from "@/components/NoGroupState";

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
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    const load = async () => {
      try {
        const { data } = await supabase
          .from("election_cycles")
          .select("*")
          .eq("group_id", groupId)
          .order("created_at", { ascending: false });
        setElections(data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [groupId, groupLoading]);

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!groupId) return <NoGroupState title="Elections" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Elections</h1>
          <p className="text-sm text-muted-foreground">Create and manage election cycles.</p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/group/elections/new"><Plus className="mr-2 h-4 w-4" />New Election</Link>
        </Button>
      </div>

      {elections.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center py-16">
          <Vote className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No elections yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {elections.map((e) => (
            <Link
              key={e.id}
              to={`/group/elections/${e.id}`}
              className="glass-card flex flex-col gap-3 p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:p-5"
            >
              <div className="min-w-0 space-y-1">
                <p className="break-words font-semibold">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  Created {format(new Date(e.created_at), "MMM d, yyyy")}
                  {e.voting_start && ` · Voting ${format(new Date(e.voting_start), "MMM d")} – ${e.voting_end ? format(new Date(e.voting_end), "MMM d") : "TBD"}`}
                </p>
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
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
