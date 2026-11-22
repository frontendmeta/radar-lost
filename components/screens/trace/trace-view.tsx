'use client';

import type { ReactNode } from 'react';
import type { Fix, Trace } from '@/lib/api-types';
import { api, isApiError } from '@/lib/client/api';
import { useApi, type Resource } from '@/lib/client/hooks';
import { ErrorNote, Skeleton } from '../app-shell';
import { runDateLabel } from '../format';
import { ASSISTANT_LABEL, AssistantBadge, EmptyState, OutcomePill, cn } from '../ui';
import { TraceBody } from './trace-body';

export interface TraceOptions {
  /** Lens focus brand id; defaults to your (primary) brand. */
  focusBrandId?: string;
  /** Focus brand name if the caller already knows it. */
  focusName?: string;
  /** The run's fixes if the caller already loaded them (else fetched by trace.runId). */
  fixes?: Fix[];
  /** e.g. "Full run · 22 Nov" (else fetched by trace.runId). */
  runLabel?: string;
}

export interface TraceData {
  resource: Resource<Trace>;
  /** The trace for this taskId (never a stale one from the previous id). */
  trace: Trace | undefined;
  notFound: boolean;
  focusBrandId: string | undefined;
  focusName: string;
  primaryBrandId: string | undefined;
  focusDomains: string[];
  ours: Trace['outcomes'][number] | undefined;
  fix: Fix | undefined;
  meta: string;
}

/** Loads a trace plus what it needs around it: focus brand, run label, the matching fix. */
export function useTrace(taskId: string, opts: TraceOptions = {}): TraceData {
  const resource = useApi(`trace:${taskId}`, () => api.trace(taskId));
  const setup = useApi('setup', api.setup);
  const trace = resource.data?.taskId === taskId ? resource.data : undefined;
  const runId = trace?.runId;
  const run = useApi(!opts.runLabel && runId ? `run:${runId}` : null, () => api.run(runId!));
  const fixes = useApi(!opts.fixes && runId ? `fixes:${runId}` : null, () => api.fixes(runId!));

  const s = setup.data;
  const primaryBrandId = s?.brand.id;
  const focusBrandId = opts.focusBrandId ?? primaryBrandId;
  const brands = s ? [s.brand, ...s.competitors] : [];
  const focusBrand = brands.find((b) => b.id === focusBrandId);
  const focusName =
    opts.focusName ??
    trace?.outcomes.find((o) => o.brandId === focusBrandId)?.brandName ??
    focusBrand?.name ??
    'your brand';
  const ours = trace?.outcomes.find((o) => (focusBrandId ? o.brandId === focusBrandId : o.brandName === focusName)) ?? trace?.outcomes.find((o) => o.brandName === focusName);

  const allFixes = opts.fixes ?? fixes.data;
  const fix = allFixes?.find((f) => f.evidenceTaskIds.includes(taskId)) ?? allFixes?.find((f) => f.ord === 1);

  const runLabel = opts.runLabel ?? (run.data ? `${run.data.label ?? (run.data.trigger === 'live' ? 'Live test' : 'Run')} · ${runDateLabel(run.data.createdAt)}` : undefined);
  const meta = trace ? [runLabel, `attempt ${trace.attempt}`, trace.query.code, trace.model].filter(Boolean).join(' · ') : '';

  const notFound = !trace && !!resource.error && isApiError(resource.error) && resource.error.status === 404;

  return { resource, trace, notFound, focusBrandId, focusName, primaryBrandId, focusDomains: focusBrand?.domains ?? [], ours, fix, meta };
}

/** Pencil RqOOe "Title row": badge, "How ChatGPT decided", meta, outcome pill. */
export function TraceHeading({ data, size = 'drawer', className }: { data: TraceData; size?: 'drawer' | 'page'; className?: string }) {
  const { trace: t, ours, focusName, meta } = data;
  if (!t) return data.resource.error || data.notFound ? null : <Skeleton className={cn('h-[52px] w-full max-w-[520px]', className)} />;
  const label = ours?.outcome === 'picked' ? `${focusName} won` : t.pick ? `${focusName} lost to ${t.pick.brand}` : `${focusName} lost`;
  return (
    <div className={cn('flex flex-wrap items-center gap-3.5', className)}>
      <AssistantBadge assistant={t.assistant} className={size === 'page' ? 'size-12! text-[20px]!' : 'size-10! text-[17px]!'} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <h2 className={cn('font-display font-bold text-ink-900', size === 'page' ? 'text-[40px] leading-[46px] tracking-[-0.01em]' : 'text-[28px] leading-[34px]')}>
          How {ASSISTANT_LABEL[t.assistant] ?? t.assistant} decided
        </h2>
        <p className="text-[13px] leading-4 font-medium text-ink-500">{meta}</p>
      </div>
      {ours && (
        <OutcomePill
          outcome={ours.outcome === 'picked' ? 'picked' : 'mentioned_lost'}
          label={label}
          className="h-8! pr-3.5! pl-2.5! [&>span]:text-[14px]"
        />
      )}
    </div>
  );
}

/** Loading / not found / error / body for one trace. */
export function TraceContent({ data, compact, notFoundAction }: { data: TraceData; compact?: boolean; notFoundAction?: ReactNode }) {
  const { trace: t, resource } = data;
  if (data.notFound) {
    return (
      <EmptyState
        title="We couldn’t find that answer"
        body="This lost sale may belong to a run that was deleted, or the link is incomplete. Pick another one from the Radar."
        action={notFoundAction}
      />
    );
  }
  if (resource.error && !t) return <ErrorNote error={resource.error} onRetry={resource.reload} />;
  if (!t) {
    return (
      <div className={cn('flex flex-col gap-8', compact ? 'md:flex-row md:gap-6' : 'lg:flex-row lg:gap-10')} aria-busy>
        <div className="flex flex-1 flex-col gap-6">
          {[120, 96, 220, 60, 140].map((h, i) => (
            <div key={i} className="flex gap-3.5">
              <Skeleton className="size-8 shrink-0 rounded-pill" />
              <div className="flex flex-1 flex-col gap-3 pt-1">
                <Skeleton className="h-5 w-36" />
                <div style={{ height: h }}><Skeleton className="h-full" /></div>
              </div>
            </div>
          ))}
        </div>
        <div className={cn('flex shrink-0 flex-col gap-4', compact ? 'md:w-[248px]' : 'lg:w-[300px]')}>
          <Skeleton className="h-11" />
          <Skeleton className="h-[360px]" />
        </div>
      </div>
    );
  }
  return (
    <TraceBody
      trace={t}
      focusBrandId={data.focusBrandId}
      focusName={data.focusName}
      primaryBrandId={data.primaryBrandId}
      focusDomains={data.focusDomains}
      fix={data.fix}
      compact={compact}
    />
  );
}

export interface TraceViewProps extends TraceOptions {
  taskId: string;
  /** Show the "How ChatGPT decided" heading (default true). */
  heading?: boolean;
  /** Narrow layout for sheets/panels (side panel 248 px). */
  compact?: boolean;
  /** Action under the 404 empty state, e.g. a link back to the Radar. */
  notFoundAction?: ReactNode;
  className?: string;
}

/** Self-loading trace for one task: drop it into any page, panel or sheet. */
export function TraceView({ taskId, heading = true, compact = false, notFoundAction, className, ...opts }: TraceViewProps) {
  const data = useTrace(taskId, opts);
  return (
    <div className={cn('flex flex-col gap-6', className)}>
      {heading && <TraceHeading data={data} size={compact ? 'drawer' : 'page'} />}
      <TraceContent data={data} compact={compact} notFoundAction={notFoundAction} />
    </div>
  );
}
