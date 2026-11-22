import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface VerticalTabProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  label: string;
  icon?: LucideIcon;
  active?: boolean;
  /** Render as a Next <Link>. */
  href?: string;
}

/** Pencil: Vertical tab (tvNMB) active / idle. 44 px pill, 20 px icon, used in Settings nav. */
export function VerticalTab({ label, icon: Icon, active = false, href, className, type = "button", ...rest }: VerticalTabProps) {
  const classes = cn(
    "flex h-11 w-full max-w-[220px] cursor-pointer items-center gap-2.5 rounded-pill px-4 text-[15px] leading-6 font-semibold whitespace-nowrap transition-colors duration-150",
    active ? "bg-brand-50 text-brand-700" : "text-ink-700 hover:bg-ink-100",
    className,
  );
  const inner = (
    <>
      {Icon && <Icon aria-hidden size={20} strokeWidth={ICON_STROKE} className="shrink-0" />}
      <span className="truncate">{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={classes}>
        {inner}
      </Link>
    );
  }
  return (
    <button type={type} aria-current={active ? "true" : undefined} className={classes} {...rest}>
      {inner}
    </button>
  );
}
