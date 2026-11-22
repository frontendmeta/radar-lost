'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { lensFromParams, lensKey } from '@/lib/client/lens';
import { AppShell } from '../app-shell';
import { Button, ICON_STROKE, cn } from '../ui';
import { lensQuery, traceHref } from './trace-drawer';
import { TraceContent, TraceHeading, useTrace } from './trace-view';

function safeDecode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

const pagerBtn = 'flex size-10 items-center justify-center rounded-pill border border-ink-200 bg-surface text-ink-900 transition-colors';

/** /trace/[taskId]: the shareable full page of Pencil "20 Trace" (RqOOe). */
export function TraceScreen({ taskId: taskIdProp }: { taskId?: string }) {
  const params = useParams<{ taskId: string }>();
  const taskId = taskIdProp ?? safeDecode(params.taskId ?? '');
  const sp = useSearchParams();
  const query = lensQuery(sp);
  const lens = lensFromParams(new URLSearchParams(query));
  const backHref = `/${query}`;

  const data = useTrace(taskId, { focusBrandId: lens.focus });
  const lost = useApi(`lost:${lensKey(lens)}`, () => api.lostSales(lens, 100));
  const pager = lost.data?.map((l) => l.taskId) ?? [];
  const idx = pager.indexOf(taskId);
  const prev = idx > 0 ? pager[idx - 1] : null;
  const next = idx >= 0 && idx < pager.length - 1 ? pager[idx + 1] : null;

  return (
    <AppShell active="radar">
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={backHref}
            className="inline-flex h-10 items-center gap-2 rounded-pill pr-4 pl-3 type-small font-semibold text-ink-700 transition-colors hover:bg-surface hover:text-ink-900"
          >
            <ArrowLeft aria-hidden size={18} strokeWidth={ICON_STROKE} />
            Back to Radar
          </Link>
          {idx >= 0 && (
            <nav aria-label="Lost sales" className="flex items-center gap-2">
              <span className="mr-1 text-[13px] leading-4 font-semibold text-ink-500">Lost sale {idx + 1} of {pager.length}</span>
              {prev ? (
                <Link href={traceHref(prev, query)} aria-label="Previous lost sale" className={cn(pagerBtn, 'hover:bg-ink-100')}>
                  <ChevronLeft aria-hidden size={18} strokeWidth={ICON_STROKE} />
                </Link>
              ) : (
                <span aria-hidden className={cn(pagerBtn, 'opacity-40')}><ChevronLeft size={18} strokeWidth={ICON_STROKE} /></span>
              )}
              {next ? (
                <Link href={traceHref(next, query)} aria-label="Next lost sale" className={cn(pagerBtn, 'hover:bg-ink-100')}>
                  <ChevronRight aria-hidden size={18} strokeWidth={ICON_STROKE} />
                </Link>
              ) : (
                <span aria-hidden className={cn(pagerBtn, 'opacity-40')}><ChevronRight size={18} strokeWidth={ICON_STROKE} /></span>
              )}
            </nav>
          )}
        </div>
        <TraceHeading data={data} size="page" />
      </div>

      {data.notFound ? (
        <TraceContent data={data} notFoundAction={<Button href={backHref} icon={ArrowLeft}>Back to Radar</Button>} />
      ) : (
        <section className="flex flex-col rounded-card bg-surface p-6 elevation-card sm:p-8">
          <TraceContent data={data} />
        </section>
      )}
    </AppShell>
  );
}
