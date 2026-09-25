import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

const UnauthorizedPage = () => (
  <div className="flex min-h-dvh items-center justify-center px-4">
    <div className="text-center">
      <ShieldAlert className="mx-auto h-16 w-16 text-destructive" />
      <h1 className="mt-4 text-2xl font-bold">Access Denied</h1>
      <p className="mt-2 text-muted-foreground">
        You don't have permission to access this page.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Button asChild variant="outline">
          <Link to="/">Go Home</Link>
        </Button>
        <Button asChild>
          <Link to="/login">Sign In</Link>
        </Button>
      </div>
    </div>
  </div>
);

export default UnauthorizedPage;
