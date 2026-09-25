import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import type { Tables } from "@/integrations/supabase/types";
import NoGroupState from "@/components/NoGroupState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { rpcErrorCode, rpcErrorMessage } from "@/lib/rpcErrors";
import { fmtDate } from "@/lib/format";
import { Lock, Mail, Copy, RefreshCw, Ban, UserPlus, Users, Pencil } from "lucide-react";

type Member = Tables<"members">;
type Invitation = Tables<"invitations">;
type MemberFilter = "all" | "active" | "suspended" | "inactive" | "invited";
type InviteFilter = "all" | "pending" | "expired" | "accepted" | "cancelled";

const MEMBER_LABEL: Record<string, string> = {
  active: "Active", suspended: "Suspended", inactive: "Removed", invited: "Awaiting acceptance",
};
const MEMBER_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default", suspended: "destructive", inactive: "secondary", invited: "outline",
};
const INVITE_LABEL: Record<string, string> = {
  pending: "Pending", expired: "Expired", accepted: "Accepted", cancelled: "Cancelled",
};
const OUTCOME_LABEL: Record<string, [string, string]> = {
  invited: ["invited", "Invited"],
  already_member: ["already members", "Already members"],
  already_invited: ["already invited", "Already invited"],
  previously_removed: ["previously removed", "Previously removed"],
  invalid_email: ["invalid emails", "Invalid email"],
};
const EMAIL_RE = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;
const MAX_ENTRIES = 500;

const inviteStatus = (i: Invitation) =>
  i.status === "pending" && new Date(i.expires_at).getTime() < Date.now() ? "expired" : i.status;

type ParsedLine = { line: number; raw: string; email: string; full_name?: string; valid: boolean };

function parseBulk(text: string): ParsedLine[] {
  return text
    .split(/\r?\n/)
    .map((raw, idx) => ({ raw: raw.trim(), idx }))
    .filter((l) => l.raw.length > 0)
    .map(({ raw, idx }) => {
      const comma = raw.indexOf(",");
      const email = (comma === -1 ? raw : raw.slice(0, comma)).trim();
      const name = comma === -1 ? "" : raw.slice(comma + 1).trim();
      return { line: idx + 1, raw, email, full_name: name || undefined, valid: EMAIL_RE.test(email) };
    });
}

type Confirm =
  | { kind: "suspend" | "remove"; member: Member }
  | { kind: "resend" | "revoke"; invitation: Invitation }
  | null;

const GroupMembers = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groupName, setGroupName] = useState("your organisation");
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [inviteFilter, setInviteFilter] = useState<InviteFilter>("all");

  const [confirm, setConfirm] = useState<Confirm>(null);
  const [renameTarget, setRenameTarget] = useState<Member | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const [inviteOpen, setInviteOpen] = useState(false);
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [singleEmail, setSingleEmail] = useState("");
  const [singleName, setSingleName] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [inviteResults, setInviteResults] = useState<{ email: string; outcome: string }[] | null>(null);

  const announce = (msg: string, ok: boolean) => {
    (ok ? toast.success : toast.error)(msg);
    setAnnouncement(msg);
  };

  const load = useCallback(async () => {
    if (!groupId) return;
    const [m, i, g, v] = await Promise.all([
      supabase.from("members").select("*").eq("group_id", groupId).order("full_name"),
      supabase.from("invitations").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      supabase.from("groups").select("name").eq("id", groupId).maybeSingle(),
      supabase.rpc("group_voting_in_progress", { _group_id: groupId }),
    ]);
    setMembers(m.data || []);
    setInvitations(i.data || []);
    if (g.data?.name) setGroupName(g.data.name);
    setLocked(Boolean(v.data));
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    load();
  }, [groupId, groupLoading, load]);

  const handleError = (error: unknown) => {
    if (rpcErrorCode(error) === "MEMBERSHIP_LOCKED_DURING_VOTING") setLocked(true);
    announce(rpcErrorMessage(error), false);
  };

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (memberFilter !== "all" && m.status !== memberFilter) return false;
      if (!q) return true;
      return (m.full_name || "").toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [members, search, memberFilter]);

  const filteredInvites = useMemo(
    () => invitations.filter((i) => inviteFilter === "all" || inviteStatus(i) === inviteFilter),
    [invitations, inviteFilter]
  );

  const setStatus = async (member: Member, status: "active" | "suspended" | "inactive") => {
    setBusy(true);
    const { error } = await supabase.rpc("set_member_status", { p_member_id: member.id, p_status: status });
    setBusy(false);
    if (error) return handleError(error);
    const name = member.full_name || member.email;
    announce(
      status === "active" ? `${name} has been reactivated.` : status === "suspended" ? `${name} has been suspended.` : `${name} has been removed.`,
      true
    );
    load();
  };

  const doRename = async () => {
    if (!renameTarget) return;
    if (!renameValue.trim()) return announce("Please enter a name.", false);
    setBusy(true);
    const { error } = await supabase.rpc("update_member_name", { p_member_id: renameTarget.id, p_full_name: renameValue.trim() });
    setBusy(false);
    if (error) return handleError(error);
    announce("Name updated.", true);
    setRenameTarget(null);
    load();
  };

  const doResend = async (inv: Invitation) => {
    setBusy(true);
    const { error } = await supabase.rpc("resend_invitation", { p_invitation_id: inv.id });
    setBusy(false);
    if (error) return handleError(error);
    announce(`A new invitation link has been created for ${inv.email}.`, true);
    load();
  };

  const doRevoke = async (inv: Invitation) => {
    setBusy(true);
    const { error } = await supabase.rpc("revoke_invitation", { p_invitation_id: inv.id });
    setBusy(false);
    if (error) return handleError(error);
    announce(`The invitation to ${inv.email} has been revoked.`, true);
    load();
  };

  const runConfirm = async () => {
    const c = confirm;
    setConfirm(null);
    if (!c) return;
    if (c.kind === "suspend") await setStatus(c.member, "suspended");
    if (c.kind === "remove") await setStatus(c.member, "inactive");
    if (c.kind === "resend") await doResend(c.invitation);
    if (c.kind === "revoke") await doRevoke(c.invitation);
  };

  const inviteLink = (inv: Invitation) => `${window.location.origin}/invite/${inv.token}`;

  const copyLink = async (inv: Invitation) => {
    try {
      await navigator.clipboard.writeText(inviteLink(inv));
      announce(`Invitation link for ${inv.email} copied.`, true);
    } catch {
      announce("Couldn't copy the link. Please try again.", false);
    }
  };

  const mailtoFor = (inv: Invitation) => {
    const subject = `You're invited to join ${groupName} on VoteWell Secure`;
    const body = `Hello,\n\nYou've been invited to join ${groupName} on VoteWell Secure. Open this link to accept your invitation:\n\n${inviteLink(inv)}\n\nThank you.`;
    return `mailto:${encodeURIComponent(inv.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const bulkParsed = useMemo(() => parseBulk(bulkText), [bulkText]);
  const bulkValid = bulkParsed.filter((l) => l.valid);
  const bulkTooMany = bulkParsed.length > MAX_ENTRIES;

  const openInvite = () => {
    setInviteResults(null);
    setSingleEmail(""); setSingleName(""); setBulkText(""); setMode("single");
    setInviteOpen(true);
  };

  const submitInvites = async () => {
    if (!groupId) return;
    let entries: { email: string; full_name?: string }[];
    if (mode === "single") {
      if (!EMAIL_RE.test(singleEmail.trim())) return announce("Please enter a valid email address.", false);
      entries = [{ email: singleEmail.trim(), ...(singleName.trim() ? { full_name: singleName.trim() } : {}) }];
    } else {
      if (bulkTooMany) return announce("You can invite up to 500 people at a time.", false);
      if (bulkValid.length === 0) return announce("Add at least one email address.", false);
      entries = bulkValid.map((l) => ({ email: l.email, ...(l.full_name ? { full_name: l.full_name } : {}) }));
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("invite_members", { p_group_id: groupId, p_entries: entries });
    setBusy(false);
    if (error) return handleError(error);
    const rows = (data || []) as { email: string; outcome: string }[];
    setInviteResults(rows);
    announce(summarise(rows), true);
    load();
  };

  const summarise = (rows: { email: string; outcome: string }[]) => {
    const counts: Record<string, number> = {};
    rows.forEach((r) => { counts[r.outcome] = (counts[r.outcome] || 0) + 1; });
    const parts = Object.entries(counts).map(([o, n]) => `${n} ${OUTCOME_LABEL[o]?.[0] ?? o.replace(/_/g, " ")}`);
    return parts.length ? parts.join(" · ") : "No invitations were sent.";
  };

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading members">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (!groupId) return <NoGroupState title="Members" />;

  const memberActions = (m: Member) => {
    if (m.status === "invited") return <span className="text-xs text-muted-foreground">Manage from Invitations</span>;
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="min-h-[44px]" disabled={locked || busy}
          onClick={() => { setRenameTarget(m); setRenameValue(m.full_name || ""); }}>
          <Pencil className="mr-1 h-4 w-4" aria-hidden="true" />Rename
        </Button>
        {m.status === "active" ? (
          <Button size="sm" variant="outline" className="min-h-[44px]" disabled={locked || busy}
            onClick={() => setConfirm({ kind: "suspend", member: m })}>Suspend</Button>
        ) : (
          <Button size="sm" variant="outline" className="min-h-[44px]" disabled={locked || busy}
            onClick={() => setStatus(m, "active")}>Reactivate</Button>
        )}
        {m.status !== "inactive" && (
          <Button size="sm" variant="outline" className="min-h-[44px] text-destructive" disabled={locked || busy}
            onClick={() => setConfirm({ kind: "remove", member: m })}>Remove</Button>
        )}
      </div>
    );
  };

  const inviteActions = (inv: Invitation) => {
    const st = inviteStatus(inv);
    if (st !== "pending" && st !== "expired") return <span className="text-xs text-muted-foreground">No actions</span>;
    return (
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" className="min-h-[44px]" onClick={() => copyLink(inv)}>
          <Copy className="mr-1 h-4 w-4" aria-hidden="true" />Copy link
        </Button>
        <Button size="sm" variant="outline" className="min-h-[44px]" asChild>
          <a href={mailtoFor(inv)}><Mail className="mr-1 h-4 w-4" aria-hidden="true" />Email link</a>
        </Button>
        <Button size="sm" variant="outline" className="min-h-[44px]" disabled={locked || busy}
          onClick={() => setConfirm({ kind: "resend", invitation: inv })}>
          <RefreshCw className="mr-1 h-4 w-4" aria-hidden="true" />Resend
        </Button>
        <Button size="sm" variant="outline" className="min-h-[44px] text-destructive" disabled={busy}
          onClick={() => setConfirm({ kind: "revoke", invitation: inv })}>
          <Ban className="mr-1 h-4 w-4" aria-hidden="true" />Revoke
        </Button>
      </div>
    );
  };

  const groupedResults = inviteResults
    ? Object.entries(
        inviteResults.reduce<Record<string, string[]>>((acc, r) => {
          (acc[r.outcome] ||= []).push(r.email);
          return acc;
        }, {})
      )
    : [];

  return (
    <div className="space-y-6">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Members</h1>
          <p className="text-sm text-muted-foreground">Invite people and manage who can take part.</p>
        </div>
        <Button className="min-h-[44px] w-full sm:w-auto" onClick={openInvite} disabled={locked}>
          <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />Invite members
        </Button>
      </div>

      {locked && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Voting is open, so membership is frozen until voting closes.</p>
        </div>
      )}

      <Tabs defaultValue="members">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="members" className="min-h-[44px]">Members ({members.length})</TabsTrigger>
          <TabsTrigger value="invitations" className="min-h-[44px]">Invitations ({invitations.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="flex-1">
              <Label htmlFor="member-search" className="sr-only">Search members</Label>
              <Input id="member-search" type="search" placeholder="Search by name or email" value={search}
                onChange={(e) => setSearch(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
            </div>
            <div className="sm:w-56">
              <Label htmlFor="member-filter" className="sr-only">Filter by status</Label>
              <Select value={memberFilter} onValueChange={(v) => setMemberFilter(v as MemberFilter)}>
                <SelectTrigger id="member-filter" className="min-h-[44px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="inactive">Removed</SelectItem>
                  <SelectItem value="invited">Awaiting acceptance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filteredMembers.length === 0 ? (
            <div className="glass-card flex flex-col items-center py-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-muted-foreground">{members.length === 0 ? "No members yet. Invite people to get started." : "No members match your search."}</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {filteredMembers.map((m) => (
                  <li key={m.id} className="glass-card space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="break-words font-medium">{m.full_name || "No name"}</p>
                        <p className="break-all text-sm text-muted-foreground">{m.email}</p>
                      </div>
                      <Badge variant={MEMBER_VARIANT[m.status]}>{MEMBER_LABEL[m.status]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{m.user_id ? "Joined" : "Not joined yet"}</p>
                    {memberActions(m)}
                  </li>
                ))}
              </ul>
              <div className="glass-card hidden overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Status</TableHead>
                      <TableHead>Joined</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">{m.full_name || "No name"}</TableCell>
                        <TableCell className="break-all">{m.email}</TableCell>
                        <TableCell><Badge variant={MEMBER_VARIANT[m.status]}>{MEMBER_LABEL[m.status]}</Badge></TableCell>
                        <TableCell>{m.user_id ? "Yes" : "No"}</TableCell>
                        <TableCell>{memberActions(m)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="invitations" className="space-y-4">
          <div className="sm:w-56">
            <Label htmlFor="invite-filter" className="sr-only">Filter invitations by status</Label>
            <Select value={inviteFilter} onValueChange={(v) => setInviteFilter(v as InviteFilter)}>
              <SelectTrigger id="invite-filter" className="min-h-[44px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All invitations</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="accepted">Accepted</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {filteredInvites.length === 0 ? (
            <div className="glass-card flex flex-col items-center py-12 text-center">
              <Mail className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
              <p className="mt-3 text-muted-foreground">No invitations to show.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-3 md:hidden">
                {filteredInvites.map((inv) => (
                  <li key={inv.id} className="glass-card space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="min-w-0 break-all font-medium">{inv.email}</p>
                      <Badge variant="outline">{INVITE_LABEL[inviteStatus(inv)]}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Sent {fmtDate(inv.created_at)} · Expires {fmtDate(inv.expires_at)}</p>
                    {inviteActions(inv)}
                  </li>
                ))}
              </ul>
              <div className="glass-card hidden overflow-hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead><TableHead>Status</TableHead><TableHead>Sent</TableHead>
                      <TableHead>Expires</TableHead><TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvites.map((inv) => (
                      <TableRow key={inv.id}>
                        <TableCell className="break-all font-medium">{inv.email}</TableCell>
                        <TableCell><Badge variant="outline">{INVITE_LABEL[inviteStatus(inv)]}</Badge></TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(inv.created_at)}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(inv.expires_at)}</TableCell>
                        <TableCell>{inviteActions(inv)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{inviteResults ? "Invitation results" : "Invite members"}</DialogTitle>
            <DialogDescription>
              {inviteResults ? summarise(inviteResults) : "Each person gets a personal link. Copy or email it to them from the Invitations tab."}
            </DialogDescription>
          </DialogHeader>

          {inviteResults ? (
            <div className="space-y-4">
              {groupedResults.map(([outcome, emails]) => (
                <div key={outcome}>
                  <p className="font-medium">{OUTCOME_LABEL[outcome]?.[1] ?? outcome} ({emails.length})</p>
                  <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
                    {emails.map((e) => <li key={e} className="break-all">{e}</li>)}
                  </ul>
                  {outcome === "previously_removed" && (
                    <p className="mt-1 text-xs text-muted-foreground">These people were removed earlier. Reactivate them from the Members tab instead.</p>
                  )}
                </div>
              ))}
              <DialogFooter>
                <Button className="min-h-[44px] w-full sm:w-auto" onClick={() => setInviteOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <Tabs value={mode} onValueChange={(v) => setMode(v as "single" | "bulk")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single" className="min-h-[44px]">One person</TabsTrigger>
                  <TabsTrigger value="bulk" className="min-h-[44px]">Several people</TabsTrigger>
                </TabsList>
                <TabsContent value="single" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-email">Email address</Label>
                    <Input id="inv-email" type="email" autoComplete="off" inputMode="email" value={singleEmail}
                      onChange={(e) => setSingleEmail(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-name">Full name (optional)</Label>
                    <Input id="inv-name" autoComplete="off" value={singleName}
                      onChange={(e) => setSingleName(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
                  </div>
                </TabsContent>
                <TabsContent value="bulk" className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="inv-bulk">One person per line</Label>
                    <p id="inv-bulk-hint" className="text-xs text-muted-foreground">Use "email" or "email, full name". Up to 500 lines.</p>
                    <Textarea id="inv-bulk" aria-describedby="inv-bulk-hint" rows={6} value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)} className="text-base md:text-sm"
                      placeholder={"jane@example.com, Jane Smith\njohn@example.com"} />
                  </div>
                  {bulkParsed.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm">
                        {bulkValid.length} ready · {bulkParsed.length - bulkValid.length} invalid
                      </p>
                      {bulkTooMany && <p role="alert" className="text-sm text-destructive">You can invite up to 500 people at a time.</p>}
                      <ul className="max-h-48 space-y-1 overflow-y-auto rounded-md border p-2 text-sm">
                        {bulkParsed.slice(0, MAX_ENTRIES).map((l) => (
                          <li key={l.line} className={`break-all ${l.valid ? "" : "text-destructive"}`}>
                            {l.valid ? `${l.email}${l.full_name ? ` — ${l.full_name}` : ""}` : `Line ${l.line}: invalid email "${l.raw}"`}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              <DialogFooter className="gap-2">
                <Button variant="outline" className="min-h-[44px]" onClick={() => setInviteOpen(false)}>Cancel</Button>
                <Button className="min-h-[44px]" onClick={submitInvites} disabled={busy || locked}>
                  {busy ? "Sending…" : "Send invitations"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(o) => !o && setRenameTarget(null)}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-1.5rem)] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rename member</DialogTitle>
            <DialogDescription>{renameTarget?.email}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="rename">Full name</Label>
            <Input id="rename" autoComplete="off" value={renameValue} onChange={(e) => setRenameValue(e.target.value)}
              className="min-h-[44px] text-base md:text-sm" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="min-h-[44px]" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button className="min-h-[44px]" onClick={doRename} disabled={busy || locked}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmations */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent className="w-[calc(100vw-1.5rem)] max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "suspend" && "Suspend this member?"}
              {confirm?.kind === "remove" && "Remove this member?"}
              {confirm?.kind === "resend" && "Resend this invitation?"}
              {confirm?.kind === "revoke" && "Revoke this invitation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "suspend" && "They won't be able to nominate or vote until you reactivate them."}
              {confirm?.kind === "remove" && "They'll lose access to this organisation. You can reactivate them later."}
              {confirm?.kind === "resend" && "A new link will be created and the previous link will stop working."}
              {confirm?.kind === "revoke" && "The invitation link will stop working straight away."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-[44px]">Cancel</AlertDialogCancel>
            <AlertDialogAction className="min-h-[44px]" onClick={runConfirm}>Confirm</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default GroupMembers;
