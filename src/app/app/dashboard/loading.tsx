export default function DashboardLoading() {
  return (
    <div className="space-y-5" aria-label="Loading dashboard">
      <div className="h-20 animate-pulse rounded-[14px] bg-secondary" />
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="h-32 animate-pulse rounded-[14px] bg-secondary"
          />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-[14px] bg-secondary" />
    </div>
  );
}
