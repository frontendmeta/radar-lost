import type { Assistant } from "@/lib/api-types";
import { AssistantBadge } from "./assistant-badge";
import { cn } from "./cn";
import { ASSISTANT_COLOR, ASSISTANT_LABEL } from "./meta";

export interface ProgressBarProps {
  /** Shows the badge, uses the assistant name and colour. */
  assistant?: Assistant;
  /** Label (defaults to the assistant name). */
  label?: string;
  value: number | null;
  max: number | null;
  /** Bar colour override (CSS colour). */
  color?: string;
  className?: string;
}

/** Pencil: Progress bar (I9b0Sw). Badge + name + "18 of 30", 10 px track. */
export function ProgressBar({ assistant, label, value, max, color, className }: ProgressBarProps) {
  const pct = value != null && max != null && max > 0 ? Math.max(0, Math.min(1, value / max)) : null;
  const name = label ?? (assistant ? ASSISTANT_LABEL[assistant] : "");
  const fill = color ?? (assistant ? ASSISTANT_COLOR[assistant] : "var(--color-brand-500)");
  return (
    <div className={cn("flex w-full flex-col gap-2.5", className)}>
      <div className="flex w-full items-center gap-2.5">
        {assistant && <AssistantBadge assistant={assistant} />}
        <span className="type-body-strong min-w-0 flex-1 truncate text-ink-900">{name}</span>
        <span className="text-[13px] leading-5 font-semibold text-ink-500 tabular-nums">
          {value ?? "—"} of {max ?? "—"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={name || "Progress"}
        aria-valuemin={0}
        aria-valuemax={max ?? undefined}
        aria-valuenow={value ?? undefined}
        className="h-2.5 w-full overflow-hidden rounded-bar bg-ink-100"
      >
        <div
          className="h-full rounded-bar transition-[width] duration-500 ease-out"
          style={{ width: `${(pct ?? 0) * 100}%`, backgroundColor: fill }}
        />
      </div>
    </div>
  );
}
