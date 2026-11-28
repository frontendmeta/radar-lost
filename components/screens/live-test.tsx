'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronDown, Circle, CircleCheck, LoaderCircle, RotateCcw, Route, Sparkles, X } from 'lucide-react';
import type { Assistant } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { useApi, useRunPolling } from '@/lib/client/hooks';
import { ASSISTANT_LABEL, AssistantBadge, Button, ICON_STROKE, cn } from './ui';
import { Skeleton } from './app-shell';
import { LiveResultCard, RunErrorNote, failureText, useRunTasks, useTaskTrace } from './runs/live-result';

type Step = 0 | 1 | 2;

/** Asking → Reading its answer → Checking for <brand>. Pencil "43 Live test – working" (pXJkZ). */
function Steps({ step, brand }: { step: Step; brand: string }) {
  const labels = ['Asking', 'Reading its answer', `Checking for ${brand}`];
  return (
    <ol className="flex flex-wrap items-center justify-center gap-2 pb-4">
      {labels.map((label, i) => {
        const state = i < step ? 'done' : i === step ? 'active' : 'todo';
        const Icon = state === 'active' ? LoaderCircle : state === 'done' ? CircleCheck : Circle;
        return (
          <li key={label} className="flex items-center gap-2">
            {i > 0 && <span aria-hidden className="h-0.5 w-5 rounded-full bg-ink-300" />}
            <span
              aria-current={state === 'active' ? 'step' : undefined}
              className={cn(
                'inline-flex h-7 items-center gap-1.5 rounded-pill px-2.5 text-[12px] leading-4 font-semibold',
                state === 'active' ? 'bg-brand-100 text-brand-700' : state === 'done' ? 'bg-surface text-ink-700' : 'bg-surface text-ink-500',
              )}
            >
              <Icon
                aria-hidden
                size={14}
                strokeWidth={ICON_STROKE}
                className={cn(state === 'active' && 'animate-spin', state === 'done' && 'text-picked-500', state === 'todo' && 'text-ink-400')}
              />
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Concentric brand rings around the assistant badge, the outer one breathing. */
function Pulse({ assistant }: { assistant: Assistant }) {
  return (
    <div aria-hidden className="relative flex h-40 w-[200px] items-center justify-center">
      <span className="absolute size-[152px] animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite] rounded-full bg-brand-300/10" />
      <span className="absolute size-[152px] rounded-full bg-brand-300/[0.08]" />
      <span className="absolute size-28 rounded-full bg-brand-300/[0.14]" />
      <span className="absolute size-[76px] rounded-full bg-brand-300/25" />
      <AssistantBadge assistant={assistant} className="relative size-14 text-[26px] shadow-card" />
    </div>
  );
}

/**
 * Live mini-run: 1 query × 1 assistant × 1 attempt (trigger 'live'), polled every 2 s,
 * then the answer's outcome and a link to its trace.
 * Pencil "43 Live test – working" (pXJkZ) and "44 Live test – result" (u5gehC).
 */
export function LiveTestDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const setup = useApi('setup', api.setup);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [picked, setPicked] = useState<Assistant | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState(0);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const kicked = useRef<string | null>(null);

  const { run, error: pollError, done } = useRunPolling(runId);
  const { tasks } = useRunTasks(runId, !done);
  const task = tasks?.[0];
  const doneTask = done ? tasks?.find((t) => t.status === 'done') ?? null : null;
  const result = useTaskTrace(doneTask?.id ?? null);
  const failed =
    done && (run?.status === 'failed' || run?.status === 'cancelled' || (!!tasks?.length && tasks.every((t) => t.status === 'failed' || t.status === 'cancelled')));

  const s = setup.data;
  const brandName = s?.brand.name ?? 'your brand';
  const queries = s?.queries ?? [];
  const query = queries.find((q) => q.id === queryId) ?? queries[0];
  const tiles = s?.assistants ?? [];
  const usable = (id: Assistant) => tiles.some((a) => a.id === id && a.enabled && a.keyPresent);
  const assistant: Assistant = picked ?? tiles.find((a) => a.enabled && a.keyPresent)?.id ?? tiles[0]?.id ?? 'openai';
  const missingKeys = tiles.filter((a) => !a.keyPresent);

  const stage: 'idle' | 'working' | 'result' | 'failed' = !runId
    ? 'idle'
    : failed
      ? 'failed'
      : doneTask && (result.data || result.error)
        ? 'result'
        : 'working';
  const elapsed = startedAt ? (now - startedAt) / 1000 : 0;
  // Task status drives the steps: answering → asking, answered/extracting → reading, done → checking for us.
  const step: Step = done || task?.status === 'done' ? 2 : task?.status === 'answered' || task?.status === 'extracting' ? 1 : 0;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Clock for the step hints while the shopper is out.
  useEffect(() => {
    if (stage !== 'working') return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Still queued after 8 s: nudge the processor once (the demo never waits on cron).
  useEffect(() => {
    if (!runId || run?.status !== 'queued' || elapsed < 8 || kicked.current === runId) return;
    kicked.current = runId;
    api.kickRun(runId).catch(() => {});
  }, [runId, run?.status, elapsed]);

  async function start() {
    if (!query) return;
    setStarting(true);
    setStartError(null);
    try {
      const { runId: id } = await api.createRun({ assistants: [assistant], attempts: 1, queryIds: [query.id], trigger: 'live', label: 'Live test' });
      const t = Date.now();
      setStartedAt(t);
      setNow(t);
      setRunId(id);
    } catch (e) {
      setStartError(e);
    } finally {
      setStarting(false);
    }
  }

  function cancel() {
    if (runId && stage === 'working' && !done) api.stopRun(runId).catch(() => {});
    onClose();
  }

  function reset() {
    setRunId(null);
    setStartError(null);
  }

  const locked = stage !== 'idle';
  const name = ASSISTANT_LABEL[assistant];
  const statusText = step === 0 ? `Asking ${name}…` : step === 1 ? `Reading ${name}'s answer…` : `Checking for ${brandName}…`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-[2px]" onClick={cancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="live-test-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[calc(100vh-32px)] w-full max-w-[560px] animate-pop-in flex-col gap-6 overflow-y-auto rounded-card bg-surface p-6 shadow-overlay sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id="live-test-title" className="font-display text-[28px] leading-9 font-bold text-ink-900">Ask one AI right now</h2>
            <p className="type-small font-medium text-ink-500">One shopper question, one answer, about 30 seconds</p>
          </div>
          <button
            type="button"
            onClick={cancel}
            aria-label="Close"
            className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-surface-sunken text-ink-900 transition-colors hover:bg-ink-100"
          >
            <X aria-hidden size={20} strokeWidth={ICON_STROKE} />
          </button>
        </div>

        {!s ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-[76px]" />
            <Skeleton className="h-[132px]" />
          </div>
        ) : (
          <>
            <label className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-semibold text-ink-900">Shopper question</span>
              <span
                className={cn(
                  'relative flex h-[52px] items-center gap-2.5 rounded-input bg-surface-sunken px-4 focus-within:ring-2 focus-within:ring-brand-300',
                  locked && 'opacity-70',
                )}
              >
                <span className="text-[13px] leading-5 font-bold text-brand-600">{query?.code ?? '—'}</span>
                <span className="min-w-0 flex-1 truncate text-[15px] leading-6 text-ink-900">{query?.text ?? 'No queries yet — add one in Settings'}</span>
                <ChevronDown aria-hidden size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
                <select
                  value={query?.id ?? ''}
                  disabled={locked || !queries.length}
                  onChange={(e) => setQueryId(e.target.value)}
                  className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                >
                  {queries.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.code} · {q.text}
                    </option>
                  ))}
                </select>
              </span>
            </label>

            <div className="flex flex-col gap-2">
              <span className="text-[13px] leading-5 font-semibold text-ink-900">Assistant</span>
              <div role="radiogroup" aria-label="Assistant" className="grid grid-cols-3 gap-3">
                {tiles.map((a) => {
                  const on = a.id === assistant;
                  const can = a.enabled && a.keyPresent;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      disabled={locked || !can}
                      onClick={() => setPicked(a.id)}
                      title={!a.keyPresent ? 'Not connected right now' : !a.enabled ? 'Turned off in Settings' : undefined}
                      className={cn(
                        'flex flex-col gap-2.5 rounded-inner border p-4 text-left transition-colors',
                        on && can ? 'border-brand-500 bg-brand-50' : 'border-ink-200 bg-surface',
                        can && !locked && 'cursor-pointer hover:border-brand-300',
                        !can && 'cursor-not-allowed opacity-60',
                        locked && can && !on && 'opacity-60',
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <AssistantBadge assistant={a.id} className="size-8" />
                        <span
                          aria-hidden
                          className={cn(
                            'flex size-5 items-center justify-center rounded-full border',
                            on && can ? 'border-brand-500 bg-brand-500' : 'border-ink-300 bg-surface',
                          )}
                        >
                          {on && can && <span className="size-2 rounded-full bg-white" />}
                        </span>
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="type-body-strong text-ink-900">{a.label || ASSISTANT_LABEL[a.id]}</span>
                        <span className={cn('truncate text-[12px] leading-4 font-medium', can ? 'text-ink-500' : 'text-lost-700')}>
                          {!a.keyPresent ? 'Not connected' : !a.enabled ? 'Turned off' : a.model ?? 'Default model'}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
              {stage === 'idle' && missingKeys.length > 0 && (
                <p className="type-small text-ink-500">
                  {missingKeys.map((a) => a.label || ASSISTANT_LABEL[a.id]).join(', ').replace(/, ([^,]*)$/, ' and $1')}{' '}
                  {missingKeys.length === 1 ? "isn't" : "aren't"} connected right now.
                </p>
              )}
            </div>

            {stage === 'working' && (
              <div role="status" aria-live="polite" className="flex flex-col items-center gap-4 rounded-[22px] bg-surface-sunken px-4 pt-4 pb-2">
                <Pulse assistant={assistant} />
                <p className="type-h2 text-ink-900">{statusText}</p>
                {run?.status === 'queued' && elapsed > 6 && <p className="-mt-2 type-small text-ink-500">Waiting for the worker to pick it up…</p>}
                {pollError && !run && <p className="-mt-2 type-small text-lost-700">Can&rsquo;t reach the server, retrying…</p>}
                <Steps step={step} brand={brandName} />
              </div>
            )}

            {stage === 'result' &&
              (result.data ? (
                <LiveResultCard trace={result.data} brandId={s.brand.id} brandName={brandName} />
              ) : (
                <div className="flex flex-col gap-1 rounded-[22px] bg-surface-sunken p-5">
                  <p className="type-h3 text-ink-900">The answer is in, but we couldn&rsquo;t open it</p>
                  <p className="type-small text-ink-500">
                    {result.error?.message ?? 'Try again in a moment.'}{' '}
                    <Link href={`/runs/${encodeURIComponent(runId!)}`} className="font-semibold text-brand-600 hover:underline" onClick={onClose}>
                      Open the run
                    </Link>
                  </p>
                </div>
              ))}

            {stage === 'failed' && (
              <div role="alert" className="flex flex-col gap-1 rounded-[22px] bg-lost-50 p-5">
                <p className="type-h3 text-ink-900">{run?.status === 'cancelled' ? 'The live test was stopped' : `${name} didn't answer`}</p>
                <p className="type-small text-lost-700">
                  {run?.status === 'cancelled'
                    ? 'Nothing was counted.'
                    : `${task?.status === 'failed' ? failureText(task) : 'The request failed or timed out'}. Try again, or pick another assistant.`.replace('.. ', '. ')}
                </p>
              </div>
            )}

            {startError != null && <RunErrorNote error={startError} />}
          </>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {stage === 'idle' && (
            <>
              <Button variant="secondary" onClick={onClose}>Cancel</Button>
              <Button icon={Sparkles} loading={starting} disabled={!query || !usable(assistant)} onClick={start}>
                Ask {name}
              </Button>
            </>
          )}
          {stage === 'working' && (
            <>
              <Button variant="secondary" onClick={cancel}>Cancel</Button>
              <Button loading>Asking…</Button>
            </>
          )}
          {(stage === 'result' || stage === 'failed') && (
            <>
              <Button variant="secondary" icon={RotateCcw} onClick={reset}>Try another</Button>
              {result.data ? (
                <Button
                  icon={Route}
                  onClick={() => {
                    onClose();
                    router.push(`/?trace=${encodeURIComponent(result.data!.taskId)}`);
                  }}
                >
                  See how it decided
                </Button>
              ) : stage === 'failed' ? (
                <Button icon={Sparkles} onClick={start} loading={starting} disabled={!usable(assistant)}>
                  Try again
                </Button>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
