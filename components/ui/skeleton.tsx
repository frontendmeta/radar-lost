import type { CSSProperties } from "react";
import { cn } from "./cn";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  className?: string;
}

/** Shimmering ink-100 block (radius 8) for loading states. */
export function Skeleton({ width, height = 12, className }: SkeletonProps) {
  const style: CSSProperties = {
    width,
    height,
    backgroundImage:
      "linear-gradient(90deg, var(--color-ink-100) 0%, var(--color-surface-sunken) 50%, var(--color-ink-100) 100%)",
    backgroundSize: "200% 100%",
  };
  return <span aria-hidden className={cn("block animate-shimmer rounded-bar bg-ink-100", className)} style={style} />;
}

/** Pencil: Skeleton card from the Feedback section. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("flex w-full flex-col gap-3 rounded-inner border border-ink-200 p-5", className)}
    >
      <Skeleton width={120} height={12} />
      <Skeleton width={180} height={40} />
      <Skeleton width={260} height={12} className="max-w-full" />
    </div>
  );
}
