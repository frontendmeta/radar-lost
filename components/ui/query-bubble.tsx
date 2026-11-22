import { ShoppingBag } from "lucide-react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface QueryBubbleProps {
  /** The shopper's question, verbatim. */
  text: string;
  className?: string;
}

/** Pencil: Query bubble (Sb7RR). Shopper avatar + brand-50 speech bubble, 17/26 text. */
export function QueryBubble({ text, className }: QueryBubbleProps) {
  return (
    <div className={cn("flex w-full items-end gap-3", className)}>
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface"
      >
        <ShoppingBag size={16} strokeWidth={ICON_STROKE} className="text-brand-600" />
      </span>
      <p className="min-w-0 flex-1 rounded-[22px_22px_22px_6px] bg-brand-50 px-[18px] py-3.5 text-[17px] leading-[26px] text-ink-900">
        {text}
      </p>
    </div>
  );
}
