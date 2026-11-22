import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "./cn";
import { RadarMark } from "./radar-mark";

export type WorkerStatus = "online" | "offline" | "unknown";

const WORKER: Record<WorkerStatus, { dot: string; text: string }> = {
  online: { dot: "bg-picked-500", text: "Worker online" },
  offline: { dot: "bg-lost-500", text: "Worker offline" },
  unknown: { dot: "bg-ink-300", text: "Worker status unknown" },
};

export interface TopBarProps {
  workerStatus?: WorkerStatus;
  /** Override the worker status text. */
  workerLabel?: string;
  /** Avatar initials, e.g. "PV". */
  userInitials?: string | null;
  userAvatarUrl?: string | null;
  /** Slot between worker status and avatar, e.g. a "Live test" secondary button. */
  actions?: ReactNode;
  /** Wordmark link target. */
  homeHref?: string;
  className?: string;
}

/** Pencil: Top bar (JeCO7). 72 px: mark + wordmark · worker status, actions, avatar. Single brand, so no brand switcher. */
export function TopBar({
  workerStatus = "unknown",
  workerLabel,
  userInitials,
  userAvatarUrl,
  actions,
  homeHref = "/",
  className,
}: TopBarProps) {
  const w = WORKER[workerStatus];

  return (
    <header className={cn("flex h-[72px] w-full items-center justify-between gap-4", className)}>
      <div className="flex min-w-0 items-center gap-4">
        <Link href={homeHref} className="flex items-center gap-2.5 rounded-pill">
          <RadarMark />
          <span className="font-display text-[17px] leading-6 font-semibold tracking-[-0.2px] text-ink-900 whitespace-nowrap">
            Lost Sale Radar
          </span>
        </Link>
      </div>
      <div className="flex items-center gap-4">
        <span className="hidden items-center gap-2 sm:flex" role="status">
          <span aria-hidden className={cn("size-2 rounded-full", w.dot)} />
          <span className="type-small text-ink-500">{workerLabel ?? w.text}</span>
        </span>
        {actions}
        <span
          className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-100 text-[13px] leading-none font-bold text-brand-700"
          aria-label="Your account"
          role="img"
        >
          {userAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatarUrl} alt="" className="size-full object-cover" />
          ) : (
            (userInitials ?? "").slice(0, 2).toUpperCase() || "·"
          )}
        </span>
      </div>
    </header>
  );
}
