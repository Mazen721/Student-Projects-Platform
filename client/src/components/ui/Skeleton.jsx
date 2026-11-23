export function Skeleton({ className = 'h-4 w-full' }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-[0_1px_3px_rgba(18,47,74,0.05)]">
      <Skeleton className="mb-3 h-5 w-2/3" />
      <Skeleton className="mb-2 h-4 w-1/2" />
      <Skeleton className="mt-4 h-2.5 w-full rounded-full" />
    </div>
  );
}
