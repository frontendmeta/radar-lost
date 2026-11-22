import { CircleCheck, CircleDashed, CircleX, Eye, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { ICON_STROKE, OUTCOME_LABEL, type Outcome } from "./meta";

const STYLE: Record<Outcome, { icon: LucideIcon; bg: string; iconColor: string; text: string }> = {
  picked: { icon: CircleCheck, bg: "bg-picked-50", iconColor: "text-picked-500", text: "text-picked-700" },
  mentioned_lost: { icon: CircleX, bg: "bg-lost-50", iconColor: "text-lost-500", text: "text-lost-700" },
  found_not_mentioned: { icon: Eye, bg: "bg-seen-50", iconColor: "text-seen-500", text: "text-seen-700" },
  not_found: { icon: CircleDashed, bg: "bg-ink-100", iconColor: "text-ink-400", text: "text-ink-500" },
  failed: { icon: TriangleAlert, bg: "bg-ink-100", iconColor: "text-ink-500", text: "text-ink-500" },
};

export interface OutcomePillProps {
  outcome: Outcome;
  /** Override the label (defaults: Picked, Named, lost, Seen, never named, Never found, Failed). */
  label?: string;
  /** White pill instead of the tinted one (as on the tokens sheet). */
  onTint?: boolean;
  className?: string;
}

/** Pencil: Outcome pill (uaUr0). 26 px, icon + word, never colour alone. */
export function OutcomePill({ outcome, label, onTint = false, className }: OutcomePillProps) {
  const s = STYLE[outcome] ?? STYLE.not_found;
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-pill pr-2.5 pl-2 whitespace-nowrap",
        onTint ? "bg-surface" : s.bg,
        className,
      )}
    >
      <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className={s.iconColor} />
      <span className={cn("text-[13px] leading-5 font-semibold", s.text)}>
        {label ?? OUTCOME_LABEL[outcome] ?? outcome}
      </span>
    </span>
  );
}
