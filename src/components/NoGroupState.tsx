import { Building2 } from "lucide-react";

const NoGroupState = ({ title }: { title: string }) => (
  <div className="space-y-6">
    <h1 className="text-xl font-bold sm:text-2xl">{title}</h1>
    <div className="glass-card flex flex-col items-center justify-center px-4 py-16 text-center">
      <Building2 className="h-12 w-12 text-muted-foreground" aria-hidden="true" />
      <p className="mt-4 max-w-md text-muted-foreground">
        You're not part of an organisation yet. Ask your organisation's administrator for an invitation.
      </p>
    </div>
  </div>
);

export default NoGroupState;
