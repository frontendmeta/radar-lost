import { Check, CircleDashed, Eye, TriangleAlert, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { OUTCOME_LABEL, type Outcome } from "./meta";

export interface OutcomeDotProps {
  outcome: Outcome;
  className?: string;
}

/** Pencil: Dot / Picked · Named, lost · Seen, never named · Never found · Failed. 14 px. */
export function OutcomeDot({ outcome, className }: OutcomeDotProps) {
  const label = OUTCOME_LABEL[outcome] ?? outcome;
  const base = "inline-flex size-3.5 shrink-0 items-center justify-center rounded-pill";
  let body: ReactNode;
  let tone: string;
  switch (outcome) {
    case "picked":
      tone = "bg-picked-500 text-white";
      body = <Check size={10} strokeWidth={3} />;
      break;
    case "mentioned_lost":
      tone = "bg-surface border border-lost-500 text-lost-500";
      body = <X size={9} strokeWidth={3} />;
      break;
    case "found_not_mentioned":
      tone = "bg-seen-500 text-white";
      body = <Eye size={9} strokeWidth={2.5} />;
      break;
    case "failed":
      tone = "bg-ink-100 text-ink-500";
      body = <TriangleAlert size={10} strokeWidth={2.25} />;
      break;
    default:
      tone = "text-ink-300";
      body = <CircleDashed size={14} strokeWidth={2} />;
  }
  return (
    <span role="img" aria-label={label} title={label} className={cn(base, tone, className)}>
      {body}
    </span>
  );
}
