'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { ChevronRight, ExternalLink, ShoppingBag, X } from 'lucide-react';
import type { Assistant, LostSale, Product, Query, QueryRow, RunTask } from '@/lib/api-types';
import { api, type Lens } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { ErrorNote, Skeleton } from '../app-shell';
import {
  ASSISTANT_LABEL, AssistantBadge, ICON_STROKE, LOSS_REASON_LABEL, OUTCOME_LABEL, OutcomePill, cn, formatCount, formatInr, type Outcome,
} from '../ui';
import { MiniChip, QueryChips, WinnerChip, type WinnerStyle } from './shared';

interface AnswerRow {
  key: string;
  assistant: Assistant;
  sub: string;
  outcome: Outcome;
  winner: string | null;
  taskId: string | null;
  /** Pill label override (e.g. "In progress"). */
  pill?: string;
  title?: string;
}

const ORDER: Assistant[] = ['openai', 'anthropic', 'gemini'];

/** Every task for the query, in assistant then attempt order; done ones open their trace. */
function rowsFromTasks(tasks: RunTask[]): AnswerRow[] {
  return [...tasks]
    .sort((a, b) => ORDER.indexOf(a.assistant) - ORDER.indexOf(b.assistant) || a.attempt - b.attempt)
    .map((t) => {
      const failed = t.status === 'failed' || t.status === 'cancelled';
      const done = t.status === 'done';
      const outcome: Outcome = failed ? 'failed' : done ? t.focusOutcome ?? 'not_found' : 'not_found';
      return {
        key: t.id,
        assistant: t.assistant,
        sub: `Attempt ${t.attempt}`,
        outcome,
        pill: failed ? (t.status === 'cancelled' ? 'Stopped' : 'Failed') : done ? undefined : 'In progress',
        title: failed ? t.error ?? undefined : t.focusReason && t.focusReason !== 'not_found' ? LOSS_REASON_LABEL[t.focusReason] : undefined,
        winner: done ? t.pickBrand : null,
        taskId: done ? t.id : null,
      };
    });
}

/** Picked answers first (no lost-sale trace for them), then that assistant's lost sales in ranked order. */
function buildRows(row: QueryRow, lost: LostSale[], focusName: string): AnswerRow[] {
  const out: AnswerRow[] = [];
  for (const pa of row.perAssistant) {
    let k = 0;
    for (let i = 0; i < pa.picked; i++) {
      k += 1;
      out.push({ key: `${pa.assistant}-picked-${i}`, assistant: pa.assistant, sub: `Answer ${k}`, outcome: 'picked', winner: focusName, taskId: null });
    }
    for (const l of lost.filter((x) => x.assistant === pa.assistant)) {
      k += 1;
      out.push({
        key: l.taskId,
        assistant: l.assistant,
        sub: `Answer ${k}`,
        outcome: l.outcome,
        // The reason stays one hover away instead of a second line.
        title: l.reason && l.reason !== 'not_found' ? LOSS_REASON_LABEL[l.reason] : undefined,
        winner: l.winner,
        taskId: l.taskId,
      });
    }
  }
  return out;
}

function AnswerRowView({ r, winnerStyle }: { r: AnswerRow; winnerStyle: (name: string) => WinnerStyle }) {
  const body = (
    <>
      <AssistantBadge assistant={r.assistant} className="size-7!" />
      <span className="flex w-[112px] shrink-0 flex-col">
        <span className="text-[14px] leading-[18px] font-semibold text-ink-900">{ASSISTANT_LABEL[r.assistant]}</span>
        <span className="truncate text-[12px] leading-[15px] font-medium text-ink-500">{r.sub}</span>
      </span>
      <span className="flex w-[170px] shrink-0" title={r.title}>
        <OutcomePill outcome={r.outcome} label={r.pill} />
      </span>
      <span className="flex min-w-0 flex-1">
        <WinnerChip name={r.winner} style={winnerStyle} />
      </span>
      <span className="flex shrink-0 items-center justify-end gap-1 text-[12px] leading-4 font-semibold text-ink-400 transition-colors group-hover:text-ink-900">
        {r.taskId && (
          <>
            Trace
            <ChevronRight aria-hidden size={16} strokeWidth={ICON_STROKE} className="transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </span>
    </>
  );
  const cls = 'group flex h-14 w-full items-center gap-3.5 rounded-inner px-4 transition-colors';
  if (!r.taskId) return <div className={cls}>{body}</div>;
  return (
    <Link
      href={`/trace/${encodeURIComponent(r.taskId)}`}
      aria-label={`${ASSISTANT_LABEL[r.assistant]}, ${r.sub}: ${r.pill ?? OUTCOME_LABEL[r.outcome]}, picked ${r.winner ?? 'nothing'}. Open the trace.`}
      className={cn(cls, 'cursor-pointer hover:bg-surface-sunken focus-visible:bg-surface-sunken focus-visible:outline-none')}
    >
      {body}
    </Link>
  );
}

function ProductStrip({ product, brandName }: { product: Product | undefined; brandName: string }) {
  if (!product) return null;
  return (
    <div className="flex items-center gap-3 rounded-inner bg-surface-sunken px-4 py-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface text-brand-500">
        <ShoppingBag aria-hidden size={18} strokeWidth={ICON_STROKE} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] leading-4 font-semibold text-ink-500">
          {brandName}&apos;s product · {product.code}
        </span>
        <span className="truncate text-[14px] leading-5 font-semibold text-ink-900" title={product.name}>{product.name}</span>
      </div>
      <span className="shrink-0 text-[15px] leading-5 font-semibold text-ink-900 tabular-nums">{formatInr(product.priceInr)}</span>
      {product.url && (
        <a
          href={product.url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${product.name} on your site`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink-500 transition-colors hover:bg-surface hover:text-ink-900"
        >
          <ExternalLink aria-hidden size={16} strokeWidth={ICON_STROKE} />
        </a>
      )}
    </div>
  );
}

/** Pencil: "31 Queries – row drawer" (eSOZP). Every answer for one query, lost ones open their trace. */
export function QueryDrawer({
  row, query, product, brandName, lens, runId, focusName, winnerStyle, tasks, onClose,
}: {
  row: QueryRow;
  query: Query | undefined;
  product: Product | undefined;
  brandName: string;
  lens: Lens;
  runId: string | undefined;
  focusName: string;
  winnerStyle: (name: string) => WinnerStyle;
  /** This query's run tasks (primary-brand outcomes). undefined = loading or not usable (competitor focus) → lost-sales fallback. */
  tasks: RunTask[] | undefined;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const attempts = row.perAssistant.reduce((s, pa) => s + pa.attempts, 0);
  const limit = Math.min(50, Math.max(10, attempts));
  const lostLens: Lens = { ...lens, run: runId ?? lens.run, queries: [row.queryId], products: undefined };
  const lost = useApi(`q-lost:${row.queryId}:${runId ?? lens.run ?? ''}:${lens.focus ?? ''}:${(lens.assistants ?? []).join(',')}:${limit}`, () => api.lostSales(lostLens, limit));

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const picked = row.picked;
  const pickedLabel = `${focusName} picked ${formatCount(picked.n)} of ${formatCount(picked.of)}`;
  // Real tasks list every answer (won, lost, failed) in attempt order; otherwise fall back to the lost sales.
  const rows = tasks?.length ? rowsFromTasks(tasks) : lost.data ? buildRows(row, lost.data, focusName) : undefined;
  const missing = rows && !tasks?.length ? Math.max(0, attempts - rows.length) : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" tabIndex={-1} onClick={onClose} className="absolute inset-0 cursor-default bg-ink-900/30 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="query-drawer-title"
        className="relative flex h-full w-full max-w-[680px] animate-[drawer-in_280ms_var(--ease-spring)_both] flex-col overflow-hidden rounded-l-card bg-surface shadow-overlay"
      >
        <style>{'@keyframes drawer-in{from{transform:translateX(32px);opacity:0}to{transform:none;opacity:1}}'}</style>
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-ink-200 pt-5 pr-6 pb-5 pl-7">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <MiniChip size="md" code label={row.code} />
              <QueryChips query={query} size="md" />
            </div>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full bg-surface-sunken text-ink-900 transition-colors hover:bg-ink-100"
            >
              <X aria-hidden size={20} strokeWidth={ICON_STROKE} />
            </button>
          </div>
          <h2 id="query-drawer-title" className="font-display text-[24px] leading-[1.3] font-semibold tracking-[-0.3px] text-ink-900">
            {row.text}
          </h2>
          <ProductStrip product={product} brandName={brandName} />
          <div>
            <OutcomePill outcome={picked.n > 0 ? 'picked' : 'mentioned_lost'} label={pickedLabel} />
          </div>
        </div>

        {/* Answers */}
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <div className="flex flex-col gap-0.5 p-3 pb-8">
            {lost.error && !lost.data && !tasks?.length ? (
              <div className="p-2"><ErrorNote error={lost.error} onRetry={lost.reload} /></div>
            ) : !rows ? (
              Array.from({ length: Math.min(Math.max(attempts, 3), 9) }, (_, i) => <Skeleton key={i} className="h-14" />)
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center type-body text-ink-500">No answers for this question in this run yet.</p>
            ) : (
              rows.map((r) => <AnswerRowView key={r.key} r={r} winnerStyle={winnerStyle} />)
            )}
            {missing > 0 && (
              <p className="px-4 pt-2 type-small text-ink-400">
                {missing} more {missing === 1 ? 'answer' : 'answers'} not listed.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
