import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { rpcErrorCode, rpcErrorMessage } from "@/lib/rpcErrors";
import { MailCheck, AlertTriangle } from "lucide-react";

type Preview = { group_name: string; email_hint: string; usable: boolean };

const InvitePage = () => {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading, signUp, signOut, refreshRoles } = useAuth();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [signedUp, setSignedUp] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.rpc("get_invitation_preview", { p_token: token });
      const row = ((data as Preview[]) || [])[0];
      setPreview(row && row.usable ? row : null);
      setLoading(false);
    })();
  }, [token]);

  const fail = (error: unknown) => {
    const msg = rpcErrorMessage(error);
    setErrorCode(rpcErrorCode(error));
    toast.error(msg);
    setAnnouncement(msg);
  };

  const accept = async () => {
    setBusy(true);
    setErrorCode(null);
    const { error } = await supabase.rpc("accept_invitation", { p_token: token });
    if (error) { setBusy(false); return fail(error); }
    await refreshRoles();
    toast.success(`Welcome to ${preview?.group_name ?? "your organisation"}.`);
    navigate("/member", { replace: true });
  };

  const register = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      const msg = "Your password must be at least 8 characters.";
      toast.error(msg); setAnnouncement(msg); return;
    }
    setBusy(true);
    const { error } = await signUp(email.trim(), password, fullName.trim(), undefined, `${window.location.origin}/invite/${token}`);
    setBusy(false);
    if (error) {
      const msg = "We couldn't create your account. Please check your details and try again.";
      toast.error(msg); setAnnouncement(msg); return;
    }
    setSignedUp(true);
    setAnnouncement("Check your email to confirm your address, then return to this page.");
  };

  const switchAccount = async () => {
    await signOut();
    setErrorCode(null);
  };

  if (loading || authLoading) {
    return (
      <div className="mx-auto max-w-md space-y-4 px-4 py-12" role="status" aria-label="Loading invitation">
        <Skeleton className="h-8 w-3/4" /><Skeleton className="h-5 w-1/2" /><Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-10 sm:py-16">
      <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
      <div className="glass-card space-y-5 p-5 sm:p-8">
        {!preview ? (
          <>
            <AlertTriangle className="h-10 w-10 text-destructive" aria-hidden="true" />
            <h1 className="text-xl font-bold">Invitation unavailable</h1>
            <p className="text-muted-foreground">
              This invitation link has expired or is no longer valid. Ask your organisation's administrator for a new one.
            </p>
          </>
        ) : (
          <>
            <div>
              <h1 className="text-xl font-bold break-words sm:text-2xl">You've been invited to join {preview.group_name}</h1>
              <p className="mt-2 break-words text-sm text-muted-foreground">This invitation was sent to {preview.email_hint}</p>
            </div>

            {user ? (
              <div className="space-y-4">
                {errorCode === "INVITATION_EMAIL_MISMATCH" && (
                  <div role="alert" className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
                    <p>This invitation was sent to a different email address. Sign in with that address to accept it.</p>
                    <p className="break-words">You're signed in as <strong>{user.email}</strong>; the invitation was sent to <strong>{preview.email_hint}</strong>.</p>
                    <Button variant="outline" className="min-h-[44px] w-full" onClick={switchAccount}>Sign out and switch account</Button>
                  </div>
                )}
                {errorCode === "EMAIL_NOT_CONFIRMED" && (
                  <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
                    You need to confirm your email address before you can join. Open the confirmation email we sent you, then come back to this page.
                  </div>
                )}
                <Button className="min-h-[44px] w-full" onClick={accept} disabled={busy}>
                  {busy ? "Joining…" : "Accept invitation"}
                </Button>
              </div>
            ) : signedUp ? (
              <div className="flex items-start gap-3 rounded-lg bg-accent/10 p-4 text-sm" role="status">
                <MailCheck className="h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
                <p>Check your email to confirm your address, then return to this page.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button asChild className="min-h-[44px] w-full">
                  <Link to="/login" state={{ from: { pathname: `/invite/${token}` } }}>I already have an account</Link>
                </Button>
                {!showSignup ? (
                  <Button variant="outline" className="min-h-[44px] w-full" onClick={() => setShowSignup(true)}>Create an account</Button>
                ) : (
                  <form onSubmit={register} className="space-y-3 border-t pt-4">
                    <h2 className="font-semibold">Create an account</h2>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-fullname">Full name</Label>
                      <Input id="inv-fullname" required autoComplete="name" value={fullName}
                        onChange={(e) => setFullName(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-signup-email">Email address</Label>
                      <Input id="inv-signup-email" type="email" required autoComplete="email" inputMode="email" value={email}
                        onChange={(e) => setEmail(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="inv-password">Password</Label>
                      <Input id="inv-password" type="password" required minLength={8} autoComplete="new-password"
                        aria-describedby="inv-password-hint" value={password}
                        onChange={(e) => setPassword(e.target.value)} className="min-h-[44px] text-base md:text-sm" />
                      <p id="inv-password-hint" className="text-xs text-muted-foreground">At least 8 characters.</p>
                    </div>
                    <Button type="submit" className="min-h-[44px] w-full" disabled={busy}>
                      {busy ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default InvitePage;
