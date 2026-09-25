import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Vote, ArrowRight, CheckCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const RegisterPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  // Form state
  const [orgName, setOrgName] = useState("");
  const [orgType, setOrgType] = useState("");
  const [orgSize, setOrgSize] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selectedPlan, setSelectedPlan] = useState("monthly");

  const { signUp } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleRegister = async () => {
    if (password.length < 8) {
      toast({ title: "Password too short", description: "Must be at least 8 characters", variant: "destructive" });
      return;
    }
    setLoading(true);
    const fullName = `${firstName} ${lastName}`.trim();
    const { error } = await signUp(email, password, fullName);
    setLoading(false);
    if (error) {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    } else {
      setSuccess(true);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">
          <CheckCircle className="mx-auto h-16 w-16 text-accent" />
          <h1 className="mt-4 text-2xl font-bold">Check Your Email</h1>
          <p className="mt-2 text-muted-foreground">
            We've sent a verification link to <strong>{email}</strong>. Please confirm your email to activate your account.
          </p>
          <Button className="mt-6" onClick={() => navigate("/login")}>
            Go to Sign In
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <Vote className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">Register Your Organisation</h1>
          <p className="mt-1 text-sm text-muted-foreground">Set up your private voting environment in minutes</p>
        </div>

        {/* Steps indicator */}
        <div className="mt-8 flex items-center justify-center gap-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold ${
                s === step ? "bg-primary text-primary-foreground" : s < step ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {s}
              </div>
              {s < 3 && <div className={`h-0.5 w-8 ${s < step ? "bg-accent" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-center gap-10 text-xs text-muted-foreground">
          <span>Organisation</span>
          <span>Admin Account</span>
          <span>Plan</span>
        </div>

        <div className="glass-card mt-6 p-6 sm:p-8">
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="orgName">Organisation Name</Label>
                <Input id="orgName" autoComplete="organization" required placeholder="e.g. National Alumni Association" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgType">Organisation Type</Label>
                <Select value={orgType} onValueChange={setOrgType}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alumni">Alumni Association</SelectItem>
                    <SelectItem value="club">Club</SelectItem>
                    <SelectItem value="union">Union</SelectItem>
                    <SelectItem value="religious">Religious Group</SelectItem>
                    <SelectItem value="professional">Professional Body</SelectItem>
                    <SelectItem value="community">Community Group</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgSize">Estimated Members</Label>
                <Select value={orgSize} onValueChange={setOrgSize}>
                  <SelectTrigger><SelectValue placeholder="Select size" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">1–50</SelectItem>
                    <SelectItem value="medium">51–200</SelectItem>
                    <SelectItem value="large">201–1000</SelectItem>
                    <SelectItem value="xlarge">1000+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" size="lg" onClick={() => setStep(2)} disabled={!orgName}>
                Continue <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" autoComplete="given-name" required placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" autoComplete="family-name" required placeholder="Doe" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" autoComplete="email" required placeholder="john@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" autoComplete="new-password" required placeholder="Min 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                <Button className="flex-1" onClick={() => setStep(3)} disabled={!email || !password || !firstName}>
                  Continue <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-4">
                <div
                  className={`rounded-xl border-2 p-4 cursor-pointer transition-colors ${selectedPlan === "monthly" ? "border-primary" : "border-border"}`}
                  onClick={() => setSelectedPlan("monthly")}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Monthly Plan</p>
                      <p className="text-sm text-muted-foreground">Best value for regular elections</p>
                    </div>
                    <span className="text-2xl font-bold">$29<span className="text-sm font-normal text-muted-foreground">/mo</span></span>
                  </div>
                </div>
                <div
                  className={`rounded-xl border-2 p-4 cursor-pointer transition-colors ${selectedPlan === "daily" ? "border-primary" : "border-border"}`}
                  onClick={() => setSelectedPlan("daily")}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Daily Plan</p>
                      <p className="text-sm text-muted-foreground">For short-term needs</p>
                    </div>
                    <span className="text-2xl font-bold">$2<span className="text-sm font-normal text-muted-foreground">/day</span></span>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                One-time registration fee: <strong className="text-foreground">$49</strong>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                <Button className="flex-1" size="lg" onClick={handleRegister} disabled={loading}>
                  {loading ? "Creating account…" : "Proceed to Payment"} {!loading && <ArrowRight className="ml-1 h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;
