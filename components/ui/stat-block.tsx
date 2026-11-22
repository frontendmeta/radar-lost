import { cn } from "./cn";
import { DeltaBadge } from "./delta-badge";
import { DASH, formatCount, formatPercent } from "./format";

export type StatTone = "brand" | "picked" | "lost" | "seen" | "marigold" | "ink";

const DOT: Record<StatTone, string> = {
  brand: "bg-brand-500",
  picked: "bg-picked-500",
  lost: "bg-lost-500",
  seen: "bg-seen-500",
  marigold: "bg-marigold-500",
  ink: "bg-ink-300",
};

export interface StatBlockProps {
  label: string;
  /** number: formatted by `format` (percent expects 0–1). string: shown as is. null → "—". */
  value: number | string | null;
  format?: "percent" | "count";
  /** Change in 0–1 points. Omit (undefined) to hide the badge; null shows "—". */
  delta?: number | null;
  /** Small line under the number, e.g. "54 of 84 searched answers". */
  caption?: string | null;
  tone?: StatTone;
  className?: string;
}

/** Pencil: Stat block (P6XleR). Dot + label, 48 px number + delta, small caption. */
export function StatBlock({
  label,
  value,
  format = "percent",
  delta,
  caption,
  tone = "brand",
  className,
}: StatBlockProps) {
  const text =
    value === null
      ? DASH
      : typeof value === "string"
        ? value
        : format === "percent"
          ? formatPercent(value)
          : formatCount(value);
  const unknown = text === DASH;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn("size-2 shrink-0 rounded-full", DOT[tone])} />
        <span className="type-label text-ink-500">{label}</span>
      </div>
      <div className="flex items-center gap-2.5">
        <span className={cn("type-stat", unknown ? "text-ink-400" : "text-ink-900")}>
          {text}
        </span>
        {!unknown && delta !== undefined && <DeltaBadge value={delta} />}
      </div>
      {caption != null && <p className="type-small text-ink-500">{caption}</p>}
    </div>
  );
}
