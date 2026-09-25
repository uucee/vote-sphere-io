import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import NoGroupState from "@/components/NoGroupState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { rpcErrorMessage } from "@/lib/rpcErrors";
import { downloadCsv, fmtDate, humanise } from "@/lib/format";
import { ScrollText, Download } from "lucide-react";

type Entry = {
  id: string; created_at: string; action: string; entity_type: string | null; entity_id: string | null;
  details: Record<string, unknown> | null; actor_name: string | null; actor_email: string | null; total_count: number;
};

const PAGE = 50;
const EXPORT_CAP = 10000;

const ACTION_LABELS: Record<string, string> = {
  organisation_created: "Created the organisation",
  election_status_changed: "Moved an election",
  vote_cast: "Cast a vote",
  vote_changed: "Changed a vote",
  candidacy_accepted: "Accepted a candidacy",
  candidacy_declined: "Declined a candidacy",
  members_invited: "Invited members",
  invitation_resent: "Resent an invitation",
  invitation_revoked: "Revoked an invitation",
  invitation_accepted: "Joined the organisation",
  member_status_changed: "Changed a member's status",
  member_renamed: "Renamed a member",
  tie_resolved: "Resolved a tie",
};

const s = (v: unknown) => (v === null || v === undefined ? "" : String(v));

function summary(e: Entry): string {
  const d = e.details || {};
  switch (e.action) {
    case "organisation_created": return "Created the organisation";
    case "election_status_changed": return `Moved an election from ${humanise(s(d.from))} to ${humanise(s(d.to))}`;
    case "vote_cast": return "Cast a vote";
    case "vote_changed": return "Changed a vote";
    case "candidacy_accepted": return "Accepted a candidacy";
    case "candidacy_declined": return "Declined a candidacy";
    case "members_invited": {
      const n = Number(d.count ?? 0);
      return `Invited ${n} member${n === 1 ? "" : "s"}`;
    }
    case "invitation_resent": return `Resent the invitation to ${s(d.email)}`;
    case "invitation_revoked": return `Revoked the invitation to ${s(d.email)}`;
    case "invitation_accepted": return "Joined the organisation";
    case "member_status_changed": return `Changed a member's status from ${humanise(s(d.from))} to ${humanise(s(d.to))}`;
    case "member_renamed": return `Renamed a member from ${s(d.from)} to ${s(d.to)}`;
    case "tie_resolved": return `Resolved a tie: ${s(d.reason)}`;
    default: return humanise(e.action);
  }
}

const actor = (e: Entry) => e.actor_name || e.actor_email || "Unknown user";

const plain = (v: unknown): string => {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.map(plain).join(", ");
  if (typeof v === "object") return Object.entries(v as Record<string, unknown>).map(([k, x]) => `${humanise(k)}: ${plain(x)}`).join("; ");
  return String(v);
};

const AuditLogs = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const params = useCallback(() => {
    const toNext = to ? new Date(`${to}T00:00:00`) : null;
    if (toNext) toNext.setDate(toNext.getDate() + 1);
    return {
      p_group_id: groupId as string,
      p_action: action === "all" ? null : action,
      p_from: from ? new Date(`${from}T00:00:00`).toISOString() : null,
      p_to: toNext ? toNext.toISOString() : null,
    };
  }, [groupId, action, from, to]);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("list_audit_logs", { ...params(), p_limit: PAGE, p_offset: page * PAGE } as any);
    if (error) {
      const msg = rpcErrorMessage(error);
      toast.error(msg); setAnnouncement(msg);
    }
    const rows = (data as unknown as Entry[]) || [];
    setEntries(rows);
    setTotal(rows.length ? Number(rows[0].total_count) : 0);
    setLoading(false);
  }, [groupId, params, page]);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    load();
  }, [groupId, groupLoading, load]);

  useEffect(() => { setPage(0); }, [action, from, to]);

  const clear = () => { setAction("all"); setFrom(""); setTo(""); };

  const exportCsv = async () => {
    if (!groupId) return;
    setExporting(true);
    const all: Entry[] = [];
    let offset = 0;
    let capped = false;
    while (true) {
      const { data, error } = await supabase.rpc("list_audit_logs", { ...params(), p_limit: 200, p_offset: offset } as any);
      if (error) {
        const msg = rpcErrorMessage(error);
        toast.error(msg); setAnnouncement(msg); setExporting(false); return;
      }
      const rows = (data as unknown as Entry[]) || [];
      all.push(...rows);
      offset += rows.length;
      const tot = rows.length ? Number(rows[0].total_count) : 0;
      if (all.length >= EXPORT_CAP) { capped = tot > EXPORT_CAP; all.length = EXPORT_CAP; break; }
      if (rows.length < 200 || offset >= tot) break;
    }
    downloadCsv("audit-log.csv", ["Date", "Actor", "Action", "Summary"],
      all.map((e) => [fmtDate(e.created_at), actor(e), humanise(e.action), summary(e)]));
    const msg = capped
      ? "Export limited to the first 10,000 entries. Narrow the filters to export the rest."
      : `Exported ${all.length} entries.`;
    (capped ? toast.warning : toast.success)(msg);
    setAnnouncement(msg);
    setExporting(false);
  };

  if (groupLoading) return <Skeleton className="h-40 w-full" />;
  if (!groupId) return <NoGroupState title="Audit log" />;

  const start = total ? page * PAGE + 1 : 0;
  const end = Math.min((page + 1) * PAGE, total);

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Audit log</h1>
          <p className="text-sm text-muted-foreground">Audit entries are permanent and cannot be edited.</p>
        </div>
        <Button variant="outline" className="min-h-[44px] w-full sm:w-auto" onClick={exportCsv} disabled={exporting || total === 0}>
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />{exporting ? "Exporting…" : "Export CSV"}
        </Button>
      </div>

      <div className="glass-card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
        <div className="space-y-1.5">
          <Label htmlFor="audit-action">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger id="audit-action" className="min-h-[44px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {Object.entries(ACTION_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-from">From</Label>
          <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="audit-to">To</Label>
          <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
        </div>
        <Button variant="ghost" className="min-h-[44px]" onClick={clear}>Clear filters</Button>
      </div>

      {loading ? (
        <div className="space-y-3" role="status" aria-label="Loading audit log">
          <Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" />
        </div>
      ) : entries.length === 0 ? (
        <div className="glass-card flex flex-col items-center py-16 text-center">
          <ScrollText className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
          <p className="mt-4 text-muted-foreground">No audit entries match these filters.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {entries.map((e) => {
              const keys = Object.entries(e.details || {});
              return (
                <li key={e.id} className="glass-card space-y-1 p-4">
                  <p className="break-words font-medium">{summary(e)}</p>
                  <p className="break-words text-sm text-muted-foreground">{actor(e)} · {fmtDate(e.created_at)}</p>
                  {keys.length > 0 && (
                    <details className="text-sm">
                      <summary className="flex min-h-[44px] cursor-pointer items-center text-primary">Details</summary>
                      <dl className="grid gap-x-4 gap-y-1 pb-1 sm:grid-cols-[max-content_1fr]">
                        {keys.map(([k, v]) => (
                          <div key={k} className="contents">
                            <dt className="font-medium">{humanise(k)}</dt>
                            <dd className="break-words text-muted-foreground">{plain(v)}</dd>
                          </div>
                        ))}
                      </dl>
                    </details>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
            <p className="text-sm text-muted-foreground">Showing {start}–{end} of {total}</p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="outline" className="min-h-[44px] flex-1" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" className="min-h-[44px] flex-1" disabled={end >= total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AuditLogs;
