'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight, Maximize2, X } from 'lucide-react';
import type { Fix } from '@/lib/api-types';
import { ICON_STROKE, cn } from '../ui';
import { TraceContent, TraceHeading, useTrace } from './trace-view';

export { TraceBody } from './trace-body';

/** Current lens query (everything but ?trace=), e.g. "?run=…&focus=…" or "". */
export function lensQuery(sp: { toString(): string }): string {
  const p = new URLSearchParams(sp.toString());
  p.delete('trace');
  const s = p.toString();
  return s ? `?${s}` : '';
}

export const traceHref = (taskId: string, query = '') => `/trace/${encodeURIComponent(taskId)}${query}`;

const roundBtn =
  'flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-ink-900 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-default disabled:opacity-40';

/**
 * Pencil "20 Trace" (RqOOe): a 760 px sheet over the Radar. The pager walks the ranked lost sales
 * (← → keys), Esc closes, ⤢ opens the shareable full page.
 */
export function TraceDrawer({
  taskId, pager = [], focusBrandId, focusName, fixes, onClose, onNavigate, runLabel,
}: {
  taskId: string;
  /** e.g. "Full run · 22 Nov" */
  runLabel?: string;
  /** Ranked lost-sale task ids for prev/next. */
  pager?: string[];
  focusBrandId?: string;
  focusName?: string;
  fixes?: Fix[];
  onClose: () => void;
  onNavigate?: (taskId: string) => void;
}) {
  const data = useTrace(taskId, { focusBrandId, focusName, fixes, runLabel });
  const sp = useSearchParams();
  const idx = pager.indexOf(taskId);
  const prev = idx > 0 ? pager[idx - 1] : null;
  const next = idx >= 0 && idx < pager.length - 1 ? pager[idx + 1] : null;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && prev && onNavigate) onNavigate(prev);
      if (e.key === 'ArrowRight' && next && onNavigate) onNavigate(next);
    };
    window.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose, onNavigate, prev, next]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 cursor-default bg-ink-900/30 backdrop-blur-[2px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How the AI decided"
        className="relative flex h-full w-full max-w-[760px] flex-col overflow-hidden bg-surface shadow-overlay md:rounded-l-[28px]"
      >
        <header className="flex flex-col gap-3.5 border-b border-ink-200 pt-5 pr-6 pb-[22px] pl-7">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {pager.length > 1 && onNavigate && (
                <>
                  <button type="button" aria-label="Previous lost sale" disabled={!prev} onClick={() => prev && onNavigate(prev)} className={cn(roundBtn, 'border border-ink-200 bg-surface enabled:hover:bg-ink-100')}>
                    <ChevronLeft aria-hidden size={18} strokeWidth={ICON_STROKE} />
                  </button>
                  <button type="button" aria-label="Next lost sale" disabled={!next} onClick={() => next && onNavigate(next)} className={cn(roundBtn, 'border border-ink-200 bg-surface enabled:hover:bg-ink-100')}>
                    <ChevronRight aria-hidden size={18} strokeWidth={ICON_STROKE} />
                  </button>
                </>
              )}
              {idx >= 0 && <span className="ml-1 text-[13px] leading-4 font-semibold text-ink-500">Lost sale {idx + 1} of {pager.length}</span>}
            </div>
            <div className="flex items-center gap-2">
              <Link href={traceHref(taskId, lensQuery(sp))} aria-label="Open as a full page" title="Open as a full page" className={cn(roundBtn, 'text-ink-700 hover:bg-ink-100')}>
                <Maximize2 aria-hidden size={18} strokeWidth={ICON_STROKE} />
              </Link>
              <button type="button" aria-label="Close" onClick={onClose} className={cn(roundBtn, 'bg-surface-sunken hover:bg-ink-100')}>
                <X aria-hidden size={20} strokeWidth={ICON_STROKE} />
              </button>
            </div>
          </div>
          {!data.notFound && <TraceHeading data={data} size="drawer" />}
        </header>
        <div className="flex-1 overflow-y-auto pt-6 pr-5 pb-8 pl-7">
          <TraceContent data={data} compact />
        </div>
      </div>
    </div>
  );
}
