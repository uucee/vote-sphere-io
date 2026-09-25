import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGroupContext } from "@/hooks/useGroupContext";
import type { Tables } from "@/integrations/supabase/types";
import NoGroupState from "@/components/NoGroupState";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtDate, fmtMoney, humanise } from "@/lib/format";
import { CreditCard, Receipt } from "lucide-react";

const GROUP_STATUS: Record<string, string> = {
  pending_payment: "Pending payment", active: "Active", suspended: "Suspended", closed: "Closed", terminated: "Terminated",
};
const TX_TYPE: Record<string, string> = { registration: "Registration fee", registration_fee: "Registration fee", subscription: "Subscription", renewal: "Renewal" };
const INTERVAL: Record<string, string> = { day: "per day", daily: "per day", month: "per month", monthly: "per month" };

const Billing = () => {
  const { groupId, loading: groupLoading } = useGroupContext();
  const [group, setGroup] = useState<Tables<"groups"> | null>(null);
  const [sub, setSub] = useState<Tables<"subscriptions"> | null>(null);
  const [plans, setPlans] = useState<Tables<"subscription_plans">[]>([]);
  const [txs, setTxs] = useState<Tables<"payment_transactions">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (groupLoading) return;
    if (!groupId) { setLoading(false); return; }
    (async () => {
      const [g, s, p, t] = await Promise.all([
        supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
        supabase.from("subscriptions").select("*").eq("group_id", groupId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("subscription_plans").select("*").eq("is_active", true).order("price_cents"),
        supabase.from("payment_transactions").select("*").eq("group_id", groupId).order("created_at", { ascending: false }),
      ]);
      setGroup(g.data); setSub(s.data); setPlans(p.data || []); setTxs(t.data || []);
      setLoading(false);
    })();
  }, [groupId, groupLoading]);

  if (groupLoading || loading) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading billing">
        <Skeleton className="h-8 w-48" /><Skeleton className="h-28 w-full" /><Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (!groupId) return <NoGroupState title="Billing" />;

  const planName = plans.find((p) => p.id === sub?.plan_id)?.name ?? "Plan";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold sm:text-2xl">Billing &amp; subscription</h1>
        <p className="text-sm text-muted-foreground">Your organisation's status, plan and payments.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="glass-card space-y-2 p-5" aria-labelledby="org-status">
          <h2 id="org-status" className="font-semibold">Organisation status</h2>
          <Badge variant={group?.status === "active" ? "default" : "outline"}>{GROUP_STATUS[group?.status ?? ""] ?? "Unknown"}</Badge>
          <p className="text-sm text-muted-foreground">
            Registration fee: {group?.registration_fee_paid ? "Paid" : "Not paid"}
          </p>
        </section>
        <section className="glass-card space-y-2 p-5" aria-labelledby="cur-sub">
          <h2 id="cur-sub" className="font-semibold">Current subscription</h2>
          {sub ? (
            <>
              <p className="flex flex-wrap items-center gap-2 font-medium">{planName} <Badge variant="outline">{humanise(sub.status)}</Badge></p>
              <p className="text-sm text-muted-foreground">Current period ends: {fmtDate(sub.current_period_end)}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">No active subscription</p>
          )}
        </section>
      </div>

      <section className="space-y-3" aria-labelledby="plans">
        <h2 id="plans" className="text-lg font-semibold">Available plans</h2>
        {plans.length === 0 ? (
          <p className="text-sm text-muted-foreground">No plans are available right now.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((p) => (
              <div key={p.id} className="glass-card flex flex-col gap-3 p-5">
                <CreditCard className="h-6 w-6 text-primary" aria-hidden="true" />
                <h3 className="font-semibold">{p.name}</h3>
                <p><span className="text-2xl font-bold">{fmtMoney(p.price_cents, p.currency)}</span>{" "}
                  <span className="text-sm text-muted-foreground">{INTERVAL[p.interval] ?? `per ${p.interval}`}</span></p>
                <Button className="mt-auto min-h-[44px] w-full" disabled>Online payment coming soon</Button>
              </div>
            ))}
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          <Link to="/contact" className="inline-flex min-h-[44px] items-center font-medium text-primary underline underline-offset-4">
            Contact us to activate a plan in the meantime
          </Link>
        </p>
      </section>

      <section className="space-y-3" aria-labelledby="history">
        <h2 id="history" className="text-lg font-semibold">Payment history</h2>
        {txs.length === 0 ? (
          <div className="glass-card flex flex-col items-center py-12 text-center">
            <Receipt className="h-10 w-10 text-muted-foreground" aria-hidden="true" />
            <p className="mt-3 text-muted-foreground">No payments yet.</p>
          </div>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {txs.map((t) => (
                <li key={t.id} className="glass-card space-y-1 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-medium">{TX_TYPE[t.type] ?? humanise(t.type)}</p>
                    <Badge variant="outline">{humanise(t.status)}</Badge>
                  </div>
                  <p className="text-sm">{fmtMoney(t.amount_cents, t.currency)}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</p>
                </li>
              ))}
            </ul>
            <div className="glass-card hidden overflow-hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date</TableHead><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {txs.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{fmtDate(t.created_at)}</TableCell>
                      <TableCell>{TX_TYPE[t.type] ?? humanise(t.type)}</TableCell>
                      <TableCell>{fmtMoney(t.amount_cents, t.currency)}</TableCell>
                      <TableCell><Badge variant="outline">{humanise(t.status)}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};

export default Billing;
