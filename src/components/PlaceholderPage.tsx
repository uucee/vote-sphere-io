const PlaceholderPage = ({ title }: { title: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-center">
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
      <span className="text-2xl">🚧</span>
    </div>
    <h2 className="mt-4 text-xl font-semibold">{title}</h2>
    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
      This section is coming soon.
    </p>
  </div>
);

export default PlaceholderPage;
