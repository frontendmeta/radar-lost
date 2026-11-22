import type { Assistant } from "@/lib/api-types";
import { AssistantLogo } from "./assistant-logo";
import { cn } from "./cn";
import { ASSISTANT_LABEL } from "./meta";

export interface AssistantBadgeProps {
  assistant: Assistant;
  /** Dimmed (opacity .4), e.g. assistant turned off. */
  disabled?: boolean;
  /** Show the assistant name next to the badge. */
  showLabel?: boolean;
  className?: string;
}

/** Pencil: Badge / ChatGPT · Claude · Gemini (T1yM0n, T37Vf, HyfsN). 28 px circle with the assistant logo (scales with a size-* className). */
export function AssistantBadge({
  assistant,
  disabled = false,
  showLabel = false,
  className,
}: AssistantBadgeProps) {
  const label = ASSISTANT_LABEL[assistant] ?? assistant;
  const badge = (
    <span
      role={showLabel ? undefined : "img"}
      aria-label={showLabel ? undefined : label}
      aria-hidden={showLabel || undefined}
      title={showLabel ? undefined : label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface",
        disabled && "opacity-40",
        !showLabel && className,
      )}
    >
      <AssistantLogo assistant={assistant} decorative className="size-[57%]" />
    </span>
  );
  if (!showLabel) return badge;
  return (
    <span className={cn("inline-flex items-center gap-2.5", disabled && "opacity-40", className)}>
      {badge}
      <span className="type-body-strong text-ink-900">{label}</span>
    </span>
  );
}
