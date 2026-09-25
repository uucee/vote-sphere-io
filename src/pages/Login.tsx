import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Vote } from "lucide-react";
import { useState } from "react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { rpcErrorMessage } from "@/lib/rpcErrors";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const { signIn, refreshRoles } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = (location.state as { from?: { pathname: string } })?.from?.pathname;

  const destinationFor = (roles: AppRole[]) => {
    if (from && from !== "/") return from;
    if (roles.includes("global_admin")) return "/admin";
    if (roles.includes("group_admin")) return "/group";
    if (roles.includes("member")) return "/member";
    return "/unauthorized";
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      setLoading(false);
      const msg = /confirm/i.test(error.message)
        ? "Please confirm your email address first."
        : "Your email or password is incorrect.";
      toast.error(msg);
      setAnnouncement(msg);
      return;
    }

    let roles = await refreshRoles();
    if (roles.length === 0) {
      const { data } = await supabase.auth.getUser();
      if (data.user?.user_metadata?.org_name) {
        const { error: orgErr } = await supabase.rpc("create_organisation");
        if (orgErr) {
          const msg = rpcErrorMessage(orgErr);
          toast.error(msg);
          setAnnouncement(msg);
        }
        roles = await refreshRoles();
      }
    }
    setLoading(false);
    toast.success("Welcome back!");
    navigate(destinationFor(roles), { replace: true });
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Vote className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Welcome Back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Sign in to your VoteWell Secure account</p>
        </div>

        <div className="glass-card mt-8 p-6 sm:p-8">
          <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Signing in…" : "Sign In"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Don't have an account?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Register your group
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
