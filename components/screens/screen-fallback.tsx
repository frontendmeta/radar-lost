// Server-safe fallback shown while a client screen boots (Suspense boundary).
export function ScreenFallback() {
  return (
    <div className="flex min-h-screen w-full flex-col items-center bg-page">
      <div className="flex w-full max-w-[1200px] flex-col gap-10 px-6 pt-[72px] xl:px-0">
        <div className="h-[60px] w-56 animate-pulse rounded-inner bg-ink-100" />
        <div className="h-[104px] w-full max-w-[640px] animate-pulse rounded-inner bg-ink-100" />
        <div className="h-[440px] w-full animate-pulse rounded-card bg-surface" />
      </div>
    </div>
  );
}
