import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

function RadarIllustration() {
  // Three 140° arcs (20°→160°) around a bag tile, from Pencil (160×160).
  const arc = (r: number) => {
    const a0 = (20 * Math.PI) / 180;
    const a1 = (160 * Math.PI) / 180;
    const p = (a: number) => `${(80 + r * Math.cos(a)).toFixed(2)} ${(80 - r * Math.sin(a)).toFixed(2)}`;
    return `M ${p(a0)} A ${r} ${r} 0 0 0 ${p(a1)}`;
  };
  return (
    <div aria-hidden className="relative size-40 shrink-0">
      <svg viewBox="0 0 160 160" className="absolute inset-0 text-brand-300" fill="none" stroke="currentColor" strokeWidth={2.5}>
        <path d={arc(78.75)} opacity={0.25} />
        <path d={arc(58.75)} opacity={0.45} />
        <path d={arc(38.75)} opacity={0.7} />
      </svg>
      <span className="absolute top-16 left-[52px] flex size-14 items-center justify-center rounded-inner border border-brand-300 bg-surface">
        <ShoppingBag size={28} strokeWidth={ICON_STROKE} className="text-brand-500" />
      </span>
    </div>
  );
}

export interface EmptyStateProps {
  title: string;
  body?: string | null;
  /** e.g. a primary Button. */
  action?: ReactNode;
  /** Show the radar + bag illustration (default true). */
  illustration?: boolean;
  className?: string;
}

/** Pencil: Empty state (j4KaEz). Card with illustration, 22 px title, body, action. */
export function EmptyState({ title, body, action, illustration = true, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-card border border-ink-200 bg-surface px-10 py-12 text-center",
        className,
      )}
    >
      {illustration && <RadarIllustration />}
      <h3 className="type-h2 text-ink-900">{title}</h3>
      {body && <p className="type-body max-w-md text-ink-500">{body}</p>}
      {action && <div className="pt-2">{action}</div>}
    </div>
  );
}
