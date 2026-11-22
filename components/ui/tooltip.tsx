import type { ReactNode } from "react";
import { cn } from "./cn";

export interface TooltipBubbleProps {
  children: ReactNode;
  className?: string;
}

/** Pencil: Tooltip (qAuKh). The dark bubble on its own (ink-900, radius 10, 13 px white). */
export function TooltipBubble({ children, className }: TooltipBubbleProps) {
  return (
    <span
      className={cn(
        "inline-block rounded-[10px] bg-ink-900 px-3 py-2 text-[13px] leading-5 font-normal text-white shadow-raised",
        className,
      )}
    >
      {children}
    </span>
  );
}

export interface TooltipProps {
  /** Tooltip text. */
  content: ReactNode;
  /** The trigger. Make it focusable (button/link) so keyboard users get the tooltip too. */
  children: ReactNode;
  side?: "top" | "bottom";
  className?: string;
}

/** CSS-only tooltip: shows on hover and keyboard focus within the trigger. Server-safe. */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <span className={cn("group/tip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 w-max max-w-[260px] -translate-x-1/2 opacity-0 transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100",
          side === "top" ? "bottom-full mb-2" : "top-full mt-2",
        )}
      >
        <TooltipBubble>{content}</TooltipBubble>
      </span>
    </span>
  );
}
