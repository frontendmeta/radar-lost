'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, KeyRound, Rocket } from 'lucide-react';
import type { Assistant } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { ASSISTANT_LABEL, AssistantBadge, Banner, Button, ICON_STROKE, Input, Stepper, Toggle, cn } from '../ui';
import { ErrorNote, Skeleton } from '../app-shell';
import { plural } from '../format';
import { RunErrorNote } from './live-result';

/** ≈ trips × 15 s each, 6 in flight; at least 1 min. */
function estimate(trips: number): string {
  const mins = Math.max(1, Math.ceil((trips * 15) / 6 / 60));
  return `about ${mins} min`;
}

/** Pencil "42 Plan a run" (q582I): choose queries, assistants, attempts, then start. Rendered as page content on /runs/new. */
export function PlanRunForm() {
  const router = useRouter();
  const setup = useApi('setup', api.setup);
  const settings = useApi('settings', api.settings);

  // null = untouched (defaults: everything enabled)
  const [queryIds, setQueryIds] = useState<string[] | null>(null);
  const [assistants, setAssistants] = useState<Assistant[] | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [label, setLabel] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const s = setup.data;
  const allQ = useMemo(() => s?.queries.map((q) => q.id) ?? [], [s]);
  const enabledA = useMemo(() => s?.assistants.filter((a) => a.enabled && a.keyPresent).map((a) => a.id) ?? [], [s]);
  const selQ = queryIds ?? allQ;
  const selA = assistants ?? enabledA;
  const nAttempts = attempts ?? settings.data?.runDefaults.attempts ?? 3;
  const trips = selQ.length * selA.length * nAttempts;
  const noKeys = !!s && s.assistants.every((a) => !a.keyPresent);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  function cancel() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/runs');
  }

  async function start() {
    setStarting(true);
    setError(null);
    try {
      const { runId } = await api.createRun({
        trigger: 'manual',
        attempts: nAttempts,
        assistants: selA,
        queryIds: selQ.length === allQ.length ? undefined : selQ,
        label: label.trim() || undefined,
      });
      router.push(`/runs/${encodeURIComponent(runId)}`);
    } catch (e) {
      setError(e);
      setStarting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {noKeys && (
        <Banner
          tone="error"
          icon={KeyRound}
          spin={false}
          action={<Button size="sm" href="/settings/keys" icon={ArrowRight}>Add keys</Button>}
        >
          Add your API keys in Settings to send shoppers
        </Banner>
      )}

      <div className="flex flex-col gap-8 rounded-card bg-surface p-8 elevation-card">
        {setup.error && !s ? (
          <ErrorNote error={setup.error} onRetry={setup.reload} />
        ) : !s ? (
          <div className="flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
        ) : (
          <>
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h2 className="type-h3 text-ink-900">Queries</h2>
                <button
                  type="button"
                  onClick={() => setQueryIds(selQ.length === allQ.length ? [] : allQ)}
                  className="cursor-pointer type-small font-semibold text-brand-600 hover:underline"
                >
                  {selQ.length === allQ.length ? 'Clear all' : 'Select all'} · {selQ.length} of {allQ.length}
                </button>
              </div>
              {s.products.map((p) => {
                const qs = s.queries.filter((q) => q.productId === p.id);
                if (!qs.length) return null;
                const allOn = qs.every((q) => selQ.includes(q.id));
                return (
                  <div key={p.id} className="flex items-center gap-3 rounded-inner bg-surface-sunken px-4 py-3">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={allOn}
                      aria-label={`All ${p.code} queries`}
                      onClick={() => setQueryIds(allOn ? selQ.filter((id) => !qs.some((q) => q.id === id)) : [...new Set([...selQ, ...qs.map((q) => q.id)])])}
                      className={cn('flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border', allOn ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-ink-300 bg-surface text-transparent')}
                    >
                      <Check size={14} strokeWidth={2.5} />
                    </button>
                    <span className="type-body-strong text-ink-900">{p.code}</span>
                    <span className="type-small whitespace-nowrap text-ink-500">{qs.length} {qs.length === 1 ? 'query' : 'queries'}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] leading-5 font-semibold text-ink-700" title={p.name}>{p.name}</span>
                    <span className="flex flex-wrap justify-end gap-1">
                      {qs.map((q) => (
                        <button
                          key={q.id}
                          type="button"
                          title={q.text}
                          aria-pressed={selQ.includes(q.id)}
                          onClick={() => setQueryIds(toggle(selQ, q.id))}
                          className={cn(
                            'h-7 cursor-pointer rounded-pill border px-2.5 text-[12px] font-semibold transition-colors',
                            selQ.includes(q.id) ? 'border-ink-200 bg-surface text-ink-900' : 'border-dashed border-ink-300 bg-transparent text-ink-400',
                          )}
                        >
                          {q.code}
                        </button>
                      ))}
                    </span>
                  </div>
                );
              })}
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="type-h3 text-ink-900">Assistants</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {s.assistants.map((a) => {
                  const on = selA.includes(a.id);
                  const usable = a.enabled && a.keyPresent;
                  return (
                    <div key={a.id} className={cn('flex min-w-0 flex-col gap-3 rounded-inner border p-4', on ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-surface')}>
                      <div className="flex items-center justify-between gap-2">
                        <AssistantBadge assistant={a.id} className={cn('size-8', !usable && 'opacity-50')} />
                        <Toggle label={`Ask ${a.label}`} checked={on} disabled={!usable} onCheckedChange={() => setAssistants(toggle(selA, a.id))} />
                      </div>
                      <div className={cn('min-w-0', !usable && 'opacity-60')}>
                        <p className="type-body-strong truncate text-ink-900">{a.label || ASSISTANT_LABEL[a.id]}</p>
                        <p className="type-small truncate text-ink-500">{a.model ?? 'Default model'}</p>
                      </div>
                      {a.keyPresent ? (
                        <span className={cn('inline-flex h-6 w-fit max-w-full items-center gap-1 rounded-pill px-2 text-[12px] font-semibold whitespace-nowrap', a.enabled ? 'bg-picked-50 text-picked-700' : 'bg-ink-100 text-ink-500')}>
                          <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} className="shrink-0" />
                          <span className="truncate">{a.enabled ? 'Key connected' : 'Turned off in Settings'}</span>
                        </span>
                      ) : (
                        <Link
                          href="/settings/keys"
                          className="inline-flex h-6 w-fit shrink-0 items-center gap-1 rounded-pill bg-lost-50 px-2 text-[12px] font-semibold whitespace-nowrap text-lost-700 hover:underline"
                        >
                          <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} className="shrink-0" />
                          Add key
                          <ArrowRight aria-hidden size={12} strokeWidth={ICON_STROKE} className="shrink-0" />
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="flex flex-col gap-3">
              <h2 className="type-h3 text-ink-900">Attempts</h2>
              <div className="flex items-center gap-4">
                <Stepper label="Attempts per query" value={nAttempts} min={1} max={5} onValueChange={setAttempts} />
                <p className="type-small font-medium text-ink-500">Each question is asked this many times per assistant, because AI answers vary.</p>
              </div>
            </section>

            <Input
              label="Label (optional)"
              placeholder="e.g. After the Myntra listing fix"
              maxLength={200}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              helper="Shows on the Runs list and in Radar's run picker."
            />
            {error != null && <RunErrorNote error={error} />}
          </>
        )}
      </div>

      {/* Sticky footer: sits above the floating dock (bottom-6 + 64 px). */}
      <div className="sticky bottom-[104px] z-30 flex flex-wrap items-center justify-between gap-4 rounded-card border border-ink-200 bg-surface px-8 py-[18px] shadow-raised">
        <div>
          <p className="font-display text-[20px] leading-7 font-bold text-ink-900">{trips} AI shopping {trips === 1 ? 'trip' : 'trips'}</p>
          <p className="type-small text-ink-500">
            {plural(selQ.length, 'question')} × {plural(selA.length, 'assistant')} × {plural(nAttempts, 'attempt')}
            {trips > 0 && ` · ${estimate(trips)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={cancel}>Cancel</Button>
          <Button icon={Rocket} loading={starting} disabled={!trips} onClick={start}>Start run</Button>
        </div>
      </div>
    </div>
  );
}
