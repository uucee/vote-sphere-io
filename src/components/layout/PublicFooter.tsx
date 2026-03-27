import { Link } from "react-router-dom";
import { Vote } from "lucide-react";

const PublicFooter = () => (
  <footer className="border-t border-border bg-card">
    <div className="container-wide mx-auto px-4 py-12 sm:px-6 lg:px-8">
      <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Vote className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold text-foreground">BallotBox</span>
          </Link>
          <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
            Secure, transparent online voting for organisations of all sizes.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Product</h4>
          <ul className="mt-3 space-y-2">
            <li><Link to="/features" className="text-sm text-muted-foreground hover:text-primary">Features</Link></li>
            <li><Link to="/pricing" className="text-sm text-muted-foreground hover:text-primary">Pricing</Link></li>
            <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-primary">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Legal</h4>
          <ul className="mt-3 space-y-2">
            <li><span className="text-sm text-muted-foreground">Privacy Policy</span></li>
            <li><span className="text-sm text-muted-foreground">Terms of Service</span></li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Support</h4>
          <ul className="mt-3 space-y-2">
            <li><Link to="/contact" className="text-sm text-muted-foreground hover:text-primary">Help Centre</Link></li>
            <li><span className="text-sm text-muted-foreground">Documentation</span></li>
          </ul>
        </div>
      </div>
      <div className="mt-10 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} BallotBox. All rights reserved.
      </div>
    </div>
  </footer>
);

export default PublicFooter;
