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
  /** Shown in the account menu. */
  userEmail?: string | null;
  /** Account menu "Sign out" target. */
  signOutHref?: string;
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
  userEmail,
  signOutHref = "/logout",
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
        <details className="relative">
          <summary
            className="flex size-9 shrink-0 cursor-pointer list-none items-center justify-center overflow-hidden rounded-pill bg-brand-100 text-[13px] leading-none font-bold text-brand-700 outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden"
            aria-label="Account menu"
          >
            {userAvatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userAvatarUrl} alt="" className="size-full object-cover" />
            ) : (
              (userInitials ?? "").slice(0, 2).toUpperCase() || "·"
            )}
          </summary>
          <div className="absolute right-0 z-50 mt-2 w-60 rounded-inner border border-line bg-surface p-2 shadow-overlay">
            {userEmail ? (
              <p className="truncate px-3 py-2 type-small text-ink-500" title={userEmail}>
                {userEmail}
              </p>
            ) : null}
            <a
              href={signOutHref}
              className="block rounded-input px-3 py-2 type-body-strong text-ink-900 hover:bg-surface-sunken"
            >
              Sign out
            </a>
          </div>
        </details>
      </div>
    </header>
  );
}
