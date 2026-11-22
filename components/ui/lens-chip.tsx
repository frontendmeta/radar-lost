import { ChevronDown } from "lucide-react";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface LensChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  /** Popover open: brand-50 fill, brand-300 border. */
  open?: boolean;
}

/**
 * Pencil: Lens chip (s93eD). Inline 34 px Bricolage chip used inside the lens sentence
 * ("Does AI pick [Libas] for [all queries]?"). Renders a <button>.
 */
export function LensChip({ label, open = false, className, type = "button", ...rest }: LensChipProps) {
  return (
    <button
      type={type}
      aria-haspopup="listbox"
      aria-expanded={open}
      className={cn(
        "inline-flex h-[52px] shrink-0 cursor-pointer items-center gap-1.5 rounded-pill border pr-3.5 pl-5 align-middle transition-[background-color,box-shadow,border-color] duration-150",
        open
          ? "border-brand-300 bg-brand-50 shadow-card"
          : "border-card-line bg-surface shadow-card hover:shadow-raised",
        className,
      )}
      {...rest}
    >
      <span className="font-display text-[34px] leading-[48px] font-semibold tracking-[-0.5px] text-brand-600 whitespace-nowrap">
        {label}
      </span>
      <ChevronDown
        aria-hidden
        size={20}
        strokeWidth={ICON_STROKE}
        className={cn("text-ink-400 transition-transform duration-150", open && "rotate-180")}
      />
    </button>
  );
}
