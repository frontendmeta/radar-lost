'use client';

import { IndianRupee } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { Assistant, BrandOutcome, LossReason, RunTask, Trace } from '@/lib/api-types';
import { api, isApiError } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { ASSISTANT_LABEL, AssistantBadge, Chip, OutcomePill, cn, formatInr } from '../ui';

const SHORT_REASON: Record<LossReason, string> = {
  over_budget: 'over budget',
  delivery_unclear_or_slow: 'delivery unclear',
  size_or_stock: 'size or stock',
  missing_details: 'missing details',
  weaker_reviews: 'weaker reviews',
  better_fit_elsewhere: 'better fit elsewhere',
  not_found: 'never found',
};

/** "myntra" → "Myntra", "brand_site" → "their own site". */
export function channelLabel(channel: string | null | undefined): string | null {
  const c = (channel ?? '').trim();
  if (!c) return null;
  if (c === 'brand_site' || c === 'brand site') return 'their own site';
  const s = c.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * GET /api/runs/:id/tasks, refetched every 2 s while `polling` (one last fetch when it turns off,
 * so the final statuses land). Keeps the previous list on a transient error.
 */
export function useRunTasks(runId: string | null, polling: boolean, intervalMs = 2000) {
  const [state, setState] = useState<{ id: string | null; tasks?: RunTask[]; error?: Error }>({ id: null });
  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const tasks = await api.runTasks(runId);
        if (!cancelled) setState({ id: runId, tasks });
      } catch (e) {
        if (!cancelled) setState((s) => ({ id: runId, tasks: s.id === runId ? s.tasks : undefined, error: e instanceof Error ? e : new Error(String(e)) }));
      }
      if (polling && !cancelled) timer = setTimeout(tick, intervalMs);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [runId, polling, intervalMs]);
  const fresh = state.id === runId;
  return { tasks: fresh ? state.tasks : undefined, error: fresh ? state.error : undefined };
}

/** Trace of one finished task (null id = skip). */
export function useTaskTrace(taskId: string | null) {
  return useApi(taskId ? `trace:${taskId}` : null, () => api.trace(taskId!));
}

/** Short failure text for a task: its error, else the failure class. */
export function failureText(t: Pick<RunTask, 'error' | 'failureClass'>): string {
  const e = (t.error ?? '').trim();
  if (e) return e.length > 120 ? `${e.slice(0, 117)}…` : e;
  if (t.failureClass === 'retryable') return 'Rate limited or timed out';
  if (t.failureClass === 'config') return 'Setup problem (key or model)';
  if (t.failureClass === 'model') return 'The model refused or errored';
  return 'Failed';
}

const TINT: Record<BrandOutcome | 'unknown', { box: string; detail: string }> = {
  picked: { box: 'bg-picked-50', detail: 'text-picked-700' },
  mentioned_lost: { box: 'bg-lost-50', detail: 'text-lost-700' },
  found_not_mentioned: { box: 'bg-seen-50', detail: 'text-seen-700' },
  not_found: { box: 'bg-surface-sunken', detail: 'text-ink-700' },
  unknown: { box: 'bg-surface-sunken', detail: 'text-ink-700' },
};

/** Pencil "44 Live test – result" (u5gehC) result card: who it picked, where we stood, the pick's price and channel. */
export function LiveResultCard({ trace, brandId, brandName, className }: { trace: Trace; brandId?: string; brandName: string; className?: string }) {
  const ours = trace.outcomes.find((o) => (brandId ? o.brandId === brandId : o.brandName === brandName));
  const outcome = ours?.outcome ?? 'unknown';
  const name = ASSISTANT_LABEL[trace.assistant];
  const pick = trace.pick;
  const headline = pick ? `${name} picked ${pick.brand}` : `${name} didn't pick one`;
  const detail =
    outcome === 'picked'
      ? `${brandName} won this one`
      : outcome === 'mentioned_lost'
        ? `${brandName} was named but lost${ours?.reason ? ` (${SHORT_REASON[ours.reason]})` : ''}`
        : outcome === 'found_not_mentioned'
          ? `${brandName} was in its sources but never named`
          : outcome === 'not_found'
            ? `${brandName} never came up in its search`
            : `Couldn't tell where ${brandName} stood`;
  const channel = channelLabel(pick?.channel);
  const pickChip = pick
    ? [pick.brand, pick.priceInr != null ? formatInr(pick.priceInr) : null, channel ? `on ${channel}` : null].filter(Boolean).join(' ')
    : null;
  const t = TINT[outcome];

  return (
    <div className={cn('flex flex-col gap-3.5 rounded-[22px] p-5', t.box, className)}>
      <div className="flex items-center gap-3">
        <AssistantBadge assistant={trace.assistant} className="size-10 text-[17px]" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="font-display text-[24px] leading-8 font-bold text-ink-900">{headline}</p>
          <p className={cn('text-[15px] leading-6 font-semibold', t.detail)}>{detail}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {ours && <OutcomePill outcome={ours.outcome} onTint />}
        {pickChip && <Chip label={pickChip} icon={IndianRupee} className="bg-surface" />}
      </div>
    </div>
  );
}

/** Inline API error. A missing provider key reads as "not connected", with no link. */
export function RunErrorNote({ error, className }: { error: unknown; className?: string }) {
  const keyMissing = isApiError(error) && error.code === 'key_missing';
  const raw = error instanceof Error && error.message ? error.message : 'Something went wrong';
  const named = raw.replace(/\b(openai|anthropic|gemini)\b/g, (a) => ASSISTANT_LABEL[a as Assistant]);
  const message = keyMissing ? "This assistant isn't connected right now." : named;
  return (
    <div role="alert" className={cn('flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-inner bg-lost-50 px-4 py-3 type-small text-lost-700', className)}>
      <span>{message}</span>
    </div>
  );
}
