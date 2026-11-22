'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, KeyRound, Rocket, X } from 'lucide-react';
import type { Assistant } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { ASSISTANT_LABEL, AssistantBadge, Button, ICON_STROKE, Input, Stepper, Toggle, cn } from '../ui';
import { ErrorNote, Skeleton } from '../app-shell';
import { plural } from '../format';
import { RunErrorNote } from './live-result';

/** Pencil "42 Plan a run" (q582I): choose queries, assistants, attempts, then start. */
export function PlanRunDialog({ onClose }: { onClose: () => void }) {
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

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

  const minutes = trips <= 3 ? 'about 1 min' : trips <= 30 ? 'about 5–10 min' : 'about 15–25 min';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="plan-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[640px] animate-pop-in flex-col overflow-hidden rounded-card bg-surface shadow-overlay"
      >
        <div className="flex items-start justify-between gap-4 px-8 pt-7 pb-2">
          <div>
            <h2 id="plan-title" className="font-display text-[28px] leading-9 font-bold text-ink-900">Send AI shoppers</h2>
            <p className="type-small font-medium text-ink-500">Choose what to ask and who to ask</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-surface-sunken text-ink-900 transition-colors hover:bg-ink-100"
          >
            <X aria-hidden size={20} strokeWidth={ICON_STROKE} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-6">
          {setup.error && !s ? (
            <ErrorNote error={setup.error} onRetry={setup.reload} />
          ) : !s ? (
            <div className="flex flex-col gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : (
            <>
              <section className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="type-h3 text-ink-900">Queries</h3>
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
                      <span className="type-small text-ink-500">{qs.length} {qs.length === 1 ? 'query' : 'queries'}</span>
                      <span className="min-w-0 flex-1 truncate text-center text-[13px] leading-5 font-semibold text-ink-700" title={p.name}>{p.name}</span>
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
                <h3 className="type-h3 text-ink-900">Assistants</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {s.assistants.map((a) => {
                    const on = selA.includes(a.id);
                    const usable = a.enabled && a.keyPresent;
                    return (
                      <div key={a.id} className={cn('flex flex-col gap-3 rounded-inner border p-4', on ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-surface')}>
                        <div className="flex items-center justify-between">
                          <AssistantBadge assistant={a.id} className={cn('size-8', !usable && 'opacity-50')} />
                          <Toggle label={`Ask ${a.label}`} checked={on} disabled={!usable} onCheckedChange={() => setAssistants(toggle(selA, a.id))} />
                        </div>
                        <div className={cn(!usable && 'opacity-60')}>
                          <p className="type-body-strong text-ink-900">{a.label || ASSISTANT_LABEL[a.id]}</p>
                          <p className="type-small text-ink-500">{a.model ?? 'Default model'}</p>
                        </div>
                        {a.keyPresent ? (
                          <span className={cn('inline-flex h-6 w-fit items-center gap-1 rounded-pill px-2 text-[12px] font-semibold', a.enabled ? 'bg-picked-50 text-picked-700' : 'bg-ink-100 text-ink-500')}>
                            <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} /> {a.enabled ? 'Key connected' : 'Turned off in Settings'}
                          </span>
                        ) : (
                          <Link href="/settings" className="inline-flex h-6 w-fit items-center gap-1 rounded-pill bg-lost-50 px-2 text-[12px] font-semibold text-lost-700 hover:underline">
                            <KeyRound aria-hidden size={14} strokeWidth={ICON_STROKE} /> Add a key in Settings
                          </Link>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="flex flex-col gap-3">
                <h3 className="type-h3 text-ink-900">Attempts</h3>
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

        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-ink-200 bg-surface-sunken px-8 py-[18px]">
          <div>
            <p className="font-display text-[20px] leading-7 font-bold text-ink-900">{trips} AI shopping {trips === 1 ? 'trip' : 'trips'}</p>
            <p className="type-small text-ink-500">
              {plural(selQ.length, 'question')} × {plural(selA.length, 'assistant')} × {plural(nAttempts, 'attempt')} · {minutes}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button icon={Rocket} loading={starting} disabled={!trips} onClick={start}>Start run</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
