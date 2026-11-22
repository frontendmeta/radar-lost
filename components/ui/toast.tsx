import { CircleAlert, CircleCheck, Info, type LucideIcon } from "lucide-react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export type ToastTone = "success" | "error" | "info";

const TONE: Record<ToastTone, { wrap: string; icon: LucideIcon; color: string }> = {
  success: { wrap: "bg-picked-50", icon: CircleCheck, color: "text-picked-500" },
  error: { wrap: "bg-lost-50", icon: CircleAlert, color: "text-lost-500" },
  info: { wrap: "bg-brand-50", icon: Info, color: "text-brand-500" },
};

export interface ToastProps {
  title: string;
  body?: string | null;
  tone?: ToastTone;
  className?: string;
}

/** Pencil: Toast (KwCip). 360 px raised card: icon chip + title/body. Position it yourself. */
export function Toast({ title, body, tone = "success", className }: ToastProps) {
  const t = TONE[tone];
  const Icon = t.icon;
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex w-[360px] max-w-full animate-pop-in gap-3 rounded-inner bg-surface p-4 shadow-raised",
        className,
      )}
    >
      <span aria-hidden className={cn("flex size-8 shrink-0 items-center justify-center rounded-pill", t.wrap)}>
        <Icon size={18} strokeWidth={ICON_STROKE} className={t.color} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-body-strong text-ink-900">{title}</span>
        {body && <span className="text-[13px] leading-5 text-ink-500">{body}</span>}
      </div>
    </div>
  );
}
