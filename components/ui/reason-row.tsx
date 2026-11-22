import {
  ArrowLeftRight,
  CircleDashed,
  Eye,
  FileQuestionMark,
  IndianRupee,
  Ruler,
  Star,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "./cn";
import { barWidth, formatCountShare } from "./format";
import { ICON_STROKE, LOSS_REASON_LABEL, type ReasonKey } from "./meta";

const ICON: Record<ReasonKey, LucideIcon> = {
  over_budget: IndianRupee,
  delivery_unclear_or_slow: Truck,
  size_or_stock: Ruler,
  missing_details: FileQuestionMark,
  weaker_reviews: Star,
  better_fit_elsewhere: ArrowLeftRight,
  not_found: CircleDashed,
  found_not_mentioned: Eye,
};

type Tone = "lost" | "seen" | "ink";
const TONE: Record<Tone, { wrap: string; icon: string; bar: string }> = {
  lost: { wrap: "bg-lost-50", icon: "text-lost-700", bar: "bg-lost-500" },
  seen: { wrap: "bg-seen-50", icon: "text-seen-700", bar: "bg-seen-500" },
  ink: { wrap: "bg-ink-100", icon: "text-ink-500", bar: "bg-ink-400" },
};

export interface ReasonRowProps {
  reason: ReasonKey;
  n: number | null;
  /** 0–1 share of losses. */
  share: number | null;
  /** Override the default label for the reason. */
  label?: string;
  className?: string;
}

/** Pencil: Reason row (yyP3s). Icon chip · label (200) · track · value (80). */
export function ReasonRow({ reason, n, share, label, className }: ReasonRowProps) {
  const Icon = ICON[reason] ?? CircleDashed;
  const tone: Tone =
    reason === "found_not_mentioned" ? "seen" : reason === "not_found" ? "ink" : "lost";
  const t = TONE[tone];
  return (
    <div className={cn("flex h-11 w-full items-center gap-3.5 rounded-input px-3", className)}>
      <span
        aria-hidden
        className={cn("flex size-8 shrink-0 items-center justify-center rounded-pill", t.wrap)}
      >
        <Icon size={16} strokeWidth={ICON_STROKE} className={t.icon} />
      </span>
      <span className="type-body-strong w-[200px] shrink-0 truncate text-ink-900">
        {label ?? LOSS_REASON_LABEL[reason] ?? reason}
      </span>
      <div className="h-3 min-w-0 flex-1 overflow-hidden rounded-bar bg-ink-100" role="presentation">
        <div
          className={cn("h-full rounded-bar transition-[width] duration-500 ease-out", t.bar)}
          style={{ width: barWidth(share) }}
        />
      </div>
      <span className="type-num w-20 shrink-0 text-right text-ink-900">
        {formatCountShare(n, share)}
      </span>
    </div>
  );
}
