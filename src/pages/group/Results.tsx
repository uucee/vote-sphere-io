import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import type { Tables } from "@/integrations/supabase/types";
import NoGroupState from "@/components/NoGroupState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { rpcErrorMessage } from "@/lib/rpcErrors";
import { downloadCsv, fmtDate, slugify } from "@/lib/format";
import { AlertTriangle, Download, FileText, Trophy } from "lucide-react";

type Election = Tables<"election_cycles">;
type Position = Tables<"positions">;
type Result = Tables<"result_summaries"> & { candidate_name: string };
type Tie = Tables<"tie_resolutions">;
type Turnout = { voters: number; eligible: number };

export function tieInfo(pos: Position, rows: Result[]) {
  const winners = rows.filter((r) => r.is_winner);
  if (winners.length <= pos.max_winners) return null;
  const cutoff = Math.max(...winners.map((w) => w.rank ?? 0));
  const tied = winners.filter((w) => (w.rank ?? 0) === cutoff);
  const better = winners.filter((w) => (w.rank ?? 0) < cutoff).length;
  return { tied, needed: pos.max_winners - better };
}

const GroupResults = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [elections, setElections] = useState<Election[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [ties, setTies] = useState<Tie[]>([]);
  const [turnout, setTurnout] = useState<Record<string, Turnout>>({});
  const [loading, setLoading] = useState(true);
  const [announcement, setAnnouncement] = useState("");

  const [tieTarget, setTieTarget] = useState<{ pos: Position; tied: Result[]; needed: number } | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    const { data: els } = await supabase
      .from("election_cycles").select("*").eq("group_id", groupId)
      .in("status", ["result_review", "published"]).order("created_at", { ascending: false });
    const list = els || [];
    setElections(list);
    if (list.length) {
      const ids = list.map((e) => e.id);
      const [pos, res, tr, ...turn] = await Promise.all([
        supabase.from("positions").select("*").in("election_cycle_id", ids).eq("is_active", true).order("created_at"),
        supabase
          .from("result_summaries")
          .select("*, candidate_selections!result_summaries_candidate_id_fkey(member_id, members!candidate_selections_member_id_fkey(full_name))")
          .in("election_cycle_id", ids).order("rank"),
        supabase.from("tie_resolutions").select("*").in("election_cycle_id", ids),
        ...ids.map((id) => supabase.rpc("get_turnout", { p_election_id: id })),
      ]);
      setPositions(pos.data || []);
      setResults(((res.data as any[]) || []).map((r) => ({ ...r, candidate_name: r.candidate_selections?.members?.full_name || "Unknown" })));
      setTies(tr.data || []);
      const map: Record<string, Turnout> = {};
      turn.forEach((t) => ((t.data as any[]) || []).forEach((row) => {
        map[row.position_id] = { voters: Number(row.voters), eligible: Number(row.eligible) };
      }));
      setTurnout(map);
    }
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    load();
  }, [groupId, groupLoading, load]);

  const openTie = (pos: Position, tied: Result[], needed: number) => {
    setTieTarget({ pos, tied, needed });
    setChosen([]);
    setReason("");
  };

  const toggle = (id: string, on: boolean) => {
    if (!tieTarget) return;
    setChosen((c) => (on ? (c.length < tieTarget.needed ? [...c, id] : c) : c.filter((x) => x !== id)));
  };

  const submitTie = async () => {
    if (!tieTarget) return;
    setBusy(true);
    const { error } = await supabase.rpc("resolve_tie", {
      p_position_id: tieTarget.pos.id, p_winner_candidate_ids: chosen, p_reason: reason.trim(),
    });
    setBusy(false);
    if (error) {
      const msg = rpcErrorMessage(error);
      toast.error(msg); setAnnouncement(msg); return;
    }
    const msg = `Tie resolved for ${tieTarget.pos.title}.`;
    toast.success(msg); setAnnouncement(msg);
    setTieTarget(null);
    load();
  };

  const exportCsv = (el: Election) => {
    const rows: unknown[][] = [];
    positions.filter((p) => p.election_cycle_id === el.id).forEach((p) =>
      results.filter((r) => r.position_id === p.id).forEach((r) =>
        rows.push([p.title, r.candidate_name, r.vote_count, r.rank ?? "", r.is_winner ? "Yes" : "No"])));
    downloadCsv(`results-${slugify(el.title)}.csv`, ["Position", "Candidate", "Votes", "Rank", "Winner"], rows);
  };

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading results">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!groupId) return <NoGroupState title="Results" />;

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Results</h1>
        <p className="text-sm text-muted-foreground">Review results, resolve ties and export the figures.</p>
      </div>

      {elections.length === 0 ? (
        <div className="glass-card flex flex-col items-center px-4 py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 max-w-md text-muted-foreground">Results appear here once voting has closed and results have been generated.</p>
        </div>
      ) : elections.map((el) => {
        const inReview = el.status === "result_review";
        const elPositions = positions.filter((p) => p.election_cycle_id === el.id);
        return (
          <section key={el.id} className="space-y-4" aria-labelledby={`el-${el.id}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 id={`el-${el.id}`} className="break-words text-lg font-semibold">{el.title}</h2>
                <Badge variant={inReview ? "outline" : "default"}>{inReview ? "Under review" : "Published"}</Badge>
              </div>
              <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={() => exportCsv(el)}>
                <Download className="mr-2 h-4 w-4" aria-hidden="true" />Download CSV
              </Button>
            </div>

            {inReview && (
              <div className="rounded-lg border bg-muted/40 p-4 text-sm">
                <p>Publishing is blocked until all ties are resolved.</p>
                <Link to={`/group/elections/${el.id}`} className="mt-1 inline-flex min-h-[44px] items-center font-medium text-primary underline underline-offset-4">
                  Go to election to publish
                </Link>
              </div>
            )}

            {elPositions.map((pos) => {
              const rows = results.filter((r) => r.position_id === pos.id);
              const total = rows.reduce((s, r) => s + r.vote_count, 0);
              const resolution = ties.find((t) => t.position_id === pos.id);
              const tie = resolution ? null : tieInfo(pos, rows);
              const t = turnout[pos.id];
              return (
                <div key={pos.id} className="glass-card space-y-3 p-4 sm:p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-semibold">{pos.title}</h3>
                    {t && <p className="text-sm text-muted-foreground">{t.voters} of {t.eligible} members voted</p>}
                  </div>

                  {tie && (
                    <div role="alert" className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
                      <p className="flex items-start gap-2 font-medium">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Tie – needs resolving
                      </p>
                      {inReview && (
                        <Button size="sm" className="min-h-[44px]" onClick={() => openTie(pos, tie.tied, tie.needed)}>Resolve tie</Button>
                      )}
                    </div>
                  )}

                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No results available.</p>
                  ) : (
                    <ol className="space-y-2">
                      {rows.map((r) => {
                        const pct = total ? Math.round((r.vote_count / total) * 1000) / 10 : 0;
                        return (
                          <li key={r.id} className="space-y-1.5 rounded-lg bg-muted/40 px-3 py-2.5">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-2">
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold" aria-label={`Rank ${r.rank ?? "–"}`}>{r.rank ?? "–"}</span>
                                <span className="break-words font-medium">{r.candidate_name}</span>
                                {r.is_winner && !tie && <Badge className="bg-accent text-accent-foreground"><Trophy className="mr-1 h-3 w-3" aria-hidden="true" />Winner</Badge>}
                              </div>
                              <span className="text-sm text-muted-foreground">{r.vote_count} votes · {pct}%</span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}

                  {resolution && (
                    <p className="text-sm text-muted-foreground">Tie resolved on {fmtDate(resolution.resolved_at)}: {resolution.reason}</p>
                  )}
                </div>
              );
            })}
          </section>
        );
      })}

      <Dialog open={!!tieTarget} onOpenChange={(o) => !o && setTieTarget(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resolve tie – {tieTarget?.pos.title}</DialogTitle>
            <DialogDescription>
              Choose {tieTarget?.needed} of the tied candidates to fill the remaining {tieTarget?.needed === 1 ? "seat" : "seats"}.
            </DialogDescription>
          </DialogHeader>
          <fieldset className="space-y-2">
            <legend className="sr-only">Tied candidates</legend>
            {tieTarget?.tied.map((c) => {
              const checked = chosen.includes(c.candidate_id);
              const disabled = !checked && chosen.length >= (tieTarget?.needed ?? 0);
              return (
                <label key={c.candidate_id} className={`flex min-h-[44px] items-center gap-3 rounded-md border px-3 ${disabled ? "opacity-50" : "cursor-pointer"}`}>
                  <Checkbox checked={checked} disabled={disabled} onCheckedChange={(v) => toggle(c.candidate_id, v === true)} />
                  <span className="break-words">{c.candidate_name}</span>
                  <span className="ml-auto text-sm text-muted-foreground">{c.vote_count} votes</span>
                </label>
              );
            })}
          </fieldset>
          <p className="text-sm text-muted-foreground" aria-live="polite">{chosen.length} of {tieTarget?.needed} chosen</p>
          <div className="space-y-1.5">
            <Label htmlFor="tie-reason">Reason for this decision</Label>
            <Textarea id="tie-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Drawing of lots at the AGM" className="text-base md:text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setTieTarget(null)}>Cancel</Button>
            <Button className="min-h-[44px]" onClick={submitTie}
              disabled={busy || chosen.length !== tieTarget?.needed || !reason.trim()}>
              {busy ? "Saving…" : "Resolve tie"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GroupResults;
