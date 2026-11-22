import { cn } from "./cn";
import { barWidth, formatCountShare } from "./format";
import { YouTag } from "./you-tag";

export interface BarRowProps {
  name: string;
  /** Count shown before the share, e.g. picks. null → "—". */
  n: number | null;
  /** 0–1 share; drives bar width. null → "—" and an empty bar. */
  share: number | null;
  /** Show the "You" tag after the name. */
  isYou?: boolean;
  /** Focus row: brand-50 background. Defaults to isYou. */
  highlighted?: boolean;
  /** Bar colour (CSS colour). Defaults to brand-500; use competitorColor(i) for competitors. */
  color?: string;
  /** Override the right-hand value text. */
  valueLabel?: string;
  className?: string;
}

/** Pencil: Bar row (k80Xk). 44 px row: name (150) · track · value (80, right). */
export function BarRow({
  name,
  n,
  share,
  isYou = false,
  highlighted,
  color = "var(--color-brand-500)",
  valueLabel,
  className,
}: BarRowProps) {
  const hl = highlighted ?? isYou;
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center gap-4 rounded-input px-3",
        hl && "bg-brand-50",
        className,
      )}
    >
      <div className="flex w-[150px] shrink-0 items-center gap-2 min-w-0">
        <span className="type-body-strong truncate text-ink-900" title={name}>
          {name}
        </span>
        {isYou && <YouTag />}
      </div>
      <div
        className="h-3 min-w-0 flex-1 overflow-hidden rounded-bar bg-ink-100"
        role="presentation"
      >
        <div
          className="h-full rounded-bar transition-[width] duration-500 ease-out"
          style={{ width: barWidth(share), backgroundColor: color }}
        />
      </div>
      <span className="type-num w-20 shrink-0 text-right text-ink-900">
        {valueLabel ?? formatCountShare(n, share)}
      </span>
    </div>
  );
}
