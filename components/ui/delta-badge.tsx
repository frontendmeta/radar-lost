import { cn } from "./cn";
import { formatPoints } from "./format";

export interface DeltaBadgeProps {
  /** Change in 0–1 points (0.04 → "▲ 4 pts"). null → "—". */
  value: number | null;
  className?: string;
}

/** Pencil: Delta badge (Zr2EJ). 24 px pill, ▲ picked / ▼ lost / no change neutral. */
export function DeltaBadge({ value, className }: DeltaBadgeProps) {
  const known = typeof value === "number" && Number.isFinite(value);
  const pts = known ? Math.round(value * 100) : 0;
  const dir = !known ? "unknown" : pts > 0 ? "up" : pts < 0 ? "down" : "flat";

  const text =
    dir === "unknown"
      ? "—"
      : dir === "flat"
        ? "No change"
        : `${dir === "up" ? "▲" : "▼"} ${formatPoints(value)}`;
  const aria =
    dir === "unknown"
      ? "Change unknown"
      : dir === "flat"
        ? "No change"
        : `${dir === "up" ? "Up" : "Down"} ${formatPoints(value)}`;

  return (
    <span
      aria-label={aria}
      className={cn(
        "inline-flex h-6 shrink-0 items-center rounded-pill px-[9px] text-[12px] leading-4 font-semibold whitespace-nowrap tabular-nums",
        dir === "up" && "bg-picked-50 text-picked-700",
        dir === "down" && "bg-lost-50 text-lost-700",
        (dir === "flat" || dir === "unknown") && "bg-ink-100 text-ink-500",
        className,
      )}
    >
      {text}
    </span>
  );
}
