import { Ban, Check, ChevronRight, MapPin, Rocket, Sparkles, X } from "lucide-react";
import Link from "next/link";
import type { Assistant, RunState } from "@/lib/api-types";
import { AssistantBadge } from "./assistant-badge";
import { Chip } from "./chip";
import { cn } from "./cn";
import { formatUsd } from "./format";
import { ICON_STROKE } from "./meta";

export interface StatusRingProps {
  status: RunState;
  done: number | null;
  total: number | null;
  className?: string;
}

/** 44 px status ring from Run row: progress arc while running, solid disc when finished. */
export function StatusRing({ status, done, total, className }: StatusRingProps) {
  const pct =
    done != null && total != null && total > 0 ? Math.max(0, Math.min(1, done / total)) : null;
  const finished = status === "done" || status === "partial" || status === "failed" || status === "cancelled";
  const r = 20.24;
  const c = 2 * Math.PI * r;

  if (finished) {
    const disc =
      status === "done"
        ? "bg-picked-500"
        : status === "partial"
          ? "bg-seen-500"
          : status === "failed"
            ? "bg-lost-500"
            : "bg-ink-300";
    const label =
      status === "done" ? "Done" : status === "partial" ? "Partly done" : status === "failed" ? "Failed" : "Cancelled";
    return (
      <span
        role="img"
        aria-label={label}
        className={cn("flex size-11 shrink-0 items-center justify-center rounded-pill text-white", disc, className)}
      >
        {status === "done" && <Check size={20} strokeWidth={2.25} />}
        {status === "partial" && <span className="text-[20px] leading-none font-bold">!</span>}
        {status === "failed" && <X size={20} strokeWidth={2.25} />}
        {status === "cancelled" && <Ban size={18} strokeWidth={2} />}
      </span>
    );
  }

  return (
    <span
      role="progressbar"
      aria-label={status === "queued" ? "Queued" : "Running"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct == null ? undefined : Math.round(pct * 100)}
      className={cn("relative flex size-11 shrink-0 items-center justify-center", className)}
    >
      <svg aria-hidden viewBox="0 0 44 44" className="absolute inset-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="var(--color-ink-100)" strokeWidth={3.52} />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3.52}
          strokeDasharray={`${(pct ?? 0) * c} ${c}`}
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="relative text-[11px] leading-none font-bold text-brand-600 tabular-nums">
        {pct == null ? "—" : `${Math.round(pct * 100)}%`}
      </span>
    </span>
  );
}

export interface RunRowProps {
  /** e.g. "Full run · 22 Nov, 3:15 PM". */
  title: string;
  /** e.g. "Started by Prathm". */
  meta?: string | null;
  trigger: "manual" | "live";
  status: RunState;
  total: number | null;
  done: number | null;
  failed: number | null;
  assistants: Assistant[];
  city: string | null;
  costUsd: number | null;
  href?: string;
  className?: string;
}

function answersText(status: RunState, done: number | null, total: number | null, failed: number | null) {
  if (status === "queued" || status === "processing") {
    return `${done ?? "—"} of ${total ?? "—"} answers`;
  }
  const n = done ?? null;
  return `${n ?? "—"} ${n === 1 ? "answer" : "answers"} · ${failed ?? "—"} failed`;
}

/** Pencil: Run row (gMFp6). Ring · title/meta · trigger chip · assistants · city · answers · cost · chevron. */
export function RunRow({
  title,
  meta,
  trigger,
  status,
  total,
  done,
  failed,
  assistants,
  city,
  costUsd,
  href,
  className,
}: RunRowProps) {
  const body = (
    <>
      <StatusRing status={status} done={done} total={total} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="type-h3 truncate text-ink-900">{title}</span>
        {meta && <span className="type-small truncate text-ink-500">{meta}</span>}
      </div>
      {trigger === "live" ? (
        <Chip label="Live" icon={Sparkles} />
      ) : (
        <Chip label="Full" icon={Rocket} tone="brand" />
      )}
      <span className="hidden w-[72px] shrink-0 items-center md:flex" aria-label="Assistants">
        {assistants.map((a, i) => (
          <AssistantBadge key={a} assistant={a} className={cn(i > 0 && "-ml-1.5")} />
        ))}
      </span>
      <span className="hidden w-24 shrink-0 items-center gap-1.5 md:flex">
        <MapPin aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
        <span className="truncate text-[14px] leading-5 font-medium text-ink-700">{city ?? "—"}</span>
      </span>
      <span className="hidden w-[150px] shrink-0 text-[14px] leading-5 font-semibold text-ink-700 tabular-nums lg:block">
        {answersText(status, done, total, failed)}
      </span>
      <span className="flex w-[84px] shrink-0 flex-col items-end">
        <span className="type-num text-ink-900">{formatUsd(costUsd)}</span>
        {costUsd != null && <span className="text-[12px] leading-4 font-medium text-ink-500">estimated</span>}
      </span>
      <ChevronRight aria-hidden size={20} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-400" />
    </>
  );
  const classes = cn(
    "flex h-20 w-full items-center gap-4 rounded-inner px-4 transition-colors",
    href && "hover:bg-surface-sunken",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
