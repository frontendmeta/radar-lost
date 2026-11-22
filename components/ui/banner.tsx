import { CircleAlert, Info, Loader, X, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export type BannerTone = "attention" | "error" | "neutral";

const TONE: Record<BannerTone, { box: string; icon: LucideIcon; iconColor: string }> = {
  attention: { box: "bg-marigold-50 border-marigold-100", icon: Loader, iconColor: "text-marigold-700" },
  error: { box: "bg-lost-50 border-lost-50", icon: CircleAlert, iconColor: "text-lost-700" },
  neutral: { box: "bg-surface-sunken border-ink-200", icon: Info, iconColor: "text-ink-500" },
};

export interface BannerProps {
  /** attention (marigold, e.g. run in progress) · error (lost) · neutral (sunken). */
  tone?: BannerTone;
  children: ReactNode;
  /** Override the tone's icon. */
  icon?: LucideIcon;
  /** Spin the icon (default: true for attention). */
  spin?: boolean;
  /** Right-hand action, e.g. <Button size="sm" variant="secondary">View progress</Button>. */
  action?: ReactNode;
  /** Shows a dismiss (×) button. Requires a client parent to pass the handler. */
  onDismiss?: () => void;
  className?: string;
}

/** Pencil: Banner (Bk1Ft). 56 px, radius 18, icon · text · action · dismiss. */
export function Banner({ tone = "attention", children, icon, spin, action, onDismiss, className }: BannerProps) {
  const t = TONE[tone];
  const Icon = icon ?? t.icon;
  const spinning = spin ?? tone === "attention";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex min-h-14 w-full items-center gap-3 rounded-inner border py-2 pr-2.5 pl-[18px]",
        t.box,
        className,
      )}
    >
      <Icon
        aria-hidden
        size={20}
        strokeWidth={ICON_STROKE}
        className={cn("shrink-0", t.iconColor, spinning && "animate-[spin_2s_linear_infinite]")}
      />
      <div className="min-w-0 flex-1 text-[15px] leading-6 font-medium text-ink-900">{children}</div>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-500 transition-colors hover:bg-ink-100"
        >
          <X aria-hidden size={18} strokeWidth={ICON_STROKE} />
        </button>
      )}
    </div>
  );
}
