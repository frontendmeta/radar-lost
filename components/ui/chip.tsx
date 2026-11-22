import type { LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export type ChipTone = "neutral" | "brand" | "code" | "outline";

const TONE: Record<ChipTone, string> = {
  neutral: "bg-ink-100 text-ink-700",
  brand: "bg-brand-100 text-brand-700",
  code: "bg-surface-sunken text-ink-700 border border-ink-200",
  outline: "bg-surface text-ink-700 border border-ink-200",
};

export interface ChipProps {
  label: string;
  /** Lucide icon component, 16 px. */
  icon?: LucideIcon;
  /** neutral (ink-100) · brand (brand-100) · code (product code, sunken + border) · outline (e.g. "Cited"). */
  tone?: ChipTone;
  className?: string;
}

/** Pencil: Chip (ObqUG). 28 px pill, optional 16 px icon, 13/600 label. */
export function Chip({ label, icon: Icon, tone = "neutral", className }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-7 shrink-0 items-center gap-1.5 rounded-pill px-3 text-[13px] leading-5 font-semibold whitespace-nowrap",
        TONE[tone],
        className,
      )}
    >
      {Icon && <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0" />}
      {label}
    </span>
  );
}
