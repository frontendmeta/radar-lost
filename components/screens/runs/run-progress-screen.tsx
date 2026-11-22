'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, CircleStop, LoaderCircle, Radar as RadarIcon, Route, Timer, TriangleAlert } from 'lucide-react';
import type { RunStatus, RunTask } from '@/lib/api-types';
import { api, isApiError, isTerminal } from '@/lib/client/api';
import { useApi, useRunPolling } from '@/lib/client/hooks';
import { AppShell, ErrorNote, Skeleton } from '../app-shell';
import { RUN_STATE_LABEL, plural, runDateLabel } from '../format';
import { ASSISTANT_LABEL, AssistantBadge, Button, ICON_STROKE, ProgressBar, cn, formatUsd } from '../ui';
import { LiveResultCard, RunErrorNote, failureText, useRunTasks, useTaskTrace } from './live-result';

function Ring({ done, total, tone }: { done: number; total: number; tone: 'brand' | 'picked' | 'lost' | 'ink' }) {
  const R = 74.4;
  const C = 2 * Math.PI * R;
  const frac = total > 0 ? Math.min(1, done / total) : 0;
  const color = { brand: 'var(--color-brand-500)', picked: 'var(--color-picked-500)', lost: 'var(--color-lost-500)', ink: 'var(--color-ink-400)' }[tone];
  return (
    <div className="relative size-40" role="img" aria-label={`${done} of ${total} answers`}>
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--color-ink-100)" strokeWidth="11.2" />
        <circle cx="80" cy="80" r={R} fill="none" stroke={color} strokeWidth="11.2" strokeLinecap="round" strokeDasharray={`${frac * C} ${C}`} className="transition-[stroke-dasharray] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-[48px] leading-[50px] font-bold tracking-[-1px] text-ink-900 tabular-nums">{done}</span>
        <span className="text-[13px] font-semibold text-ink-500">of {total} answers</span>
      </div>
    </div>
  );
}

/** Remaining time from the observed pace: (total − finished) × elapsed ÷ finished. */
function eta(run: RunStatus, now: number): string | null {
  const elapsed = (now - new Date(run.createdAt).getTime()) / 1000;
  const finished = run.done + run.failed;
  if (finished < 2 || elapsed < 20) return null;
  const left = ((run.total - finished) * elapsed) / finished;
  if (left < 60) return 'Under a minute left';
  return `About ${Math.round(left / 60)} min left`;
}

function starter(email: string | null) {
  const who = email?.split('@')[0];
  return who ? `started by ${who.charAt(0).toUpperCase()}${who.slice(1)}` : null;
}

const IN_FLIGHT: RunTask['status'][] = ['answering', 'answered', 'extracting'];

/** "Asking now": the questions out with an assistant right now (task status answering / answered / extracting). */
function AskingNow({ run, tasks }: { run: RunStatus; tasks: RunTask[] | undefined }) {
  const flying = (tasks ?? []).filter((t) => IN_FLIGHT.includes(t.status));
  const note =
    run.status === 'queued'
      ? 'Waiting for the worker to pick the run up'
      : flying.length
        ? null
        : tasks
          ? 'Between questions, the next ones go out in a moment'
          : null;
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="flex items-center gap-2.5">
        <span aria-hidden className="relative flex size-2.5">
          <span className="absolute inset-0 animate-ping rounded-full bg-brand-500/60" />
          <span className="relative size-2.5 rounded-full border border-brand-200 bg-brand-500" />
        </span>
        <h2 className="type-h2 text-ink-900">Asking now</h2>
        {flying.length > 0 && <span className="type-small font-medium text-ink-500">{flying.length} in flight</span>}
      </div>
      {note ? (
        <p className="rounded-[22px] bg-surface px-5 py-4 type-small text-ink-500 elevation-card">{note}</p>
      ) : !tasks ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[148px] rounded-[22px]" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {flying.map((t) => (
            <div key={t.id} className="flex animate-pop-in flex-col gap-3.5 rounded-[22px] bg-surface p-5 elevation-card">
              <div className="flex items-center gap-2">
                <AssistantBadge assistant={t.assistant} />
                <span className="min-w-0 flex-1 truncate text-[14px] leading-5 font-semibold text-ink-900">{ASSISTANT_LABEL[t.assistant]}</span>
                <span className="inline-flex h-[26px] shrink-0 items-center gap-1.5 rounded-pill bg-brand-50 px-2.5 text-[12px] leading-4 font-semibold text-brand-700">
                  <LoaderCircle aria-hidden size={14} strokeWidth={ICON_STROKE} className="animate-spin text-brand-600" />
                  {t.status === 'answering' ? 'Asking…' : 'Reading its answer…'}
                </span>
              </div>
              <div className="flex items-start gap-2 rounded-[18px] rounded-bl-[6px] bg-surface-sunken px-3.5 py-3">
                <span className="text-[13px] leading-5 font-semibold text-ink-400">{t.queryCode}</span>
                <span className="line-clamp-2 text-[14px] leading-5 text-ink-900" title={t.queryText}>{t.queryText}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/** Collapsible "N failed" card listing each failed task with its error. */
function FailedCard({ run, tasks }: { run: RunStatus; tasks: RunTask[] | undefined }) {
  const [open, setOpen] = useState(true);
  const failed = (tasks ?? []).filter((t) => t.status === 'failed');
  const live = !isTerminal(run.status);
  return (
    <section className="flex flex-col gap-1 rounded-card bg-surface px-5 py-4 elevation-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-10 cursor-pointer items-center gap-2.5 text-left">
        <TriangleAlert aria-hidden size={22} strokeWidth={ICON_STROKE} className="shrink-0 text-seen-500" />
        <span className="type-h3 text-ink-900">{run.failed} failed</span>
        <span className="min-w-0 flex-1 truncate type-small font-medium text-ink-500">
          Numbers use only finished answers{live ? '' : ', failed ones will not retry'}
        </span>
        <ChevronDown aria-hidden size={20} strokeWidth={ICON_STROKE} className={cn('shrink-0 text-ink-500 transition-transform', open && 'rotate-180')} />
      </button>
      {open &&
        (tasks
          ? failed.map((t) => (
              <div key={t.id} className="flex min-h-12 items-center gap-3 px-1 py-1.5">
                <AssistantBadge assistant={t.assistant} />
                <span className="shrink-0 type-body-strong text-ink-900">
                  {ASSISTANT_LABEL[t.assistant]} · {t.queryCode} · attempt {t.attempt}
                </span>
                <span className="min-w-0 flex-1 truncate type-body text-ink-700" title={t.error ?? undefined}>
                  {failureText(t)}
                </span>
              </div>
            ))
          : run.byAssistant
              .filter((a) => a.failed > 0)
              .map((a) => (
                <div key={a.assistant} className="flex h-12 items-center gap-3 px-1">
                  <AssistantBadge assistant={a.assistant} />
                  <span className="type-body-strong text-ink-900">
                    {ASSISTANT_LABEL[a.assistant]} · {plural(a.failed, 'answer')} failed
                  </span>
                </div>
              )))}
    </section>
  );
}

/** Live run finished: what the one answer said, and a way into its trace. */
function LiveRunResult({ task, brandId, brandName }: { task: RunTask; brandId?: string; brandName: string }) {
  const trace = useTaskTrace(task.id);
  return (
    <section className="flex flex-col gap-5 rounded-card bg-surface p-8 elevation-card">
      <div className="flex flex-col gap-1">
        <h2 className="type-h2 text-ink-900">Live test result</h2>
        <p className="type-small text-ink-500">
          {task.queryCode} · {task.queryText}
        </p>
      </div>
      {trace.error && !trace.data ? (
        <ErrorNote error={trace.error} onRetry={trace.reload} />
      ) : !trace.data ? (
        <Skeleton className="h-[130px] rounded-[22px]" />
      ) : (
        <>
          <LiveResultCard trace={trace.data} brandId={brandId} brandName={brandName} />
          <div>
            <Button icon={Route} href={`/?trace=${encodeURIComponent(task.id)}`}>See how it decided</Button>
          </div>
        </>
      )}
    </section>
  );
}

/** Pencil "41 Run in progress" (y8U5O). Polls GET /api/runs/:id every 2 s until the run ends. */
export function RunProgressScreen() {
  const params = useParams<{ id: string }>();
  const id = params.id ? decodeURIComponent(params.id) : null;
  const { run, error, done } = useRunPolling(id);
  const { tasks } = useRunTasks(run ? id : null, !done);
  const setup = useApi('setup', api.setup);
  const [stopping, setStopping] = useState(false);
  const [stopError, setStopError] = useState<unknown>(null);
  const [now, setNow] = useState(() => Date.now());
  const kicked = useRef(false);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(t);
  }, [done]);

  // Queued for 15 s with nothing moving: nudge the processor once (the demo never waits on cron).
  const queuedFor = run?.status === 'queued' ? (now - new Date(run.createdAt).getTime()) / 1000 : 0;
  useEffect(() => {
    if (!id || kicked.current || queuedFor < 15) return;
    kicked.current = true;
    api.kickRun(id).catch(() => {});
  }, [id, queuedFor]);

  async function stop() {
    if (!id) return;
    setStopping(true);
    setStopError(null);
    try {
      await api.stopRun(id);
    } catch (e) {
      setStopError(e);
    } finally {
      setStopping(false);
    }
  }

  const finishedOk = !!run && (run.status === 'done' || run.status === 'partial');
  const liveTask = run?.trigger === 'live' && done ? tasks?.find((t) => t.status === 'done') : undefined;
  const title = !run ? 'Run' : !isTerminal(run.status) ? (run.trigger === 'live' ? 'Live test in progress' : 'Run in progress') : run.status === 'done' ? 'Run finished' : `Run ${RUN_STATE_LABEL[run.status].toLowerCase()}`;
  const tone = !run ? 'brand' : run.status === 'done' ? 'picked' : run.status === 'failed' ? 'lost' : run.status === 'cancelled' ? 'ink' : 'brand';
  const queriesN = run && run.byAssistant.length && run.byAssistant[0].total ? run.byAssistant[0].total : null;
  const notFound = !run && error && isApiError(error) && (error.status === 404 || error.code === 'bad_run');

  return (
    <AppShell active="runs">
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Link href="/runs" className="flex w-fit items-center gap-1.5 text-[13px] leading-4 font-semibold text-brand-600 hover:underline">
            <ArrowLeft aria-hidden size={16} strokeWidth={ICON_STROKE} /> Runs
          </Link>
          <h1 className="type-display text-ink-900">{title}</h1>
          <div className="type-body text-ink-500">
            {run ? (
              [
                `${run.label ?? (run.trigger === 'live' ? 'Live test' : 'Full run')} · ${runDateLabel(run.createdAt, true)}`,
                starter(run.createdByEmail),
                run.city,
                run.costUsd != null ? `${formatUsd(run.costUsd)} estimated` : null,
              ]
                .filter(Boolean)
                .join(' · ')
            ) : notFound ? (
              'This run does not exist.'
            ) : (
              <Skeleton className="h-5 w-80" />
            )}
          </div>
        </div>
        {run && !isTerminal(run.status) && (
          <Button variant="secondary" icon={CircleStop} loading={stopping} onClick={stop} className="text-lost-700!">
            Stop run
          </Button>
        )}
        {run && finishedOk && run.trigger === 'manual' && (
          <Button icon={RadarIcon} href={`/?run=${encodeURIComponent(run.id)}`}>Open in Radar</Button>
        )}
      </div>

      {stopError != null && <RunErrorNote error={stopError} />}
      {error && !run && !notFound && <ErrorNote error={error} />}
      {notFound && (
        <div>
          <Button variant="secondary" icon={ArrowLeft} href="/runs">Back to runs</Button>
        </div>
      )}

      {!run ? (
        notFound ? null : <Skeleton className="h-[342px] rounded-card" />
      ) : (
        <section className="flex flex-col items-center gap-10 rounded-card bg-surface p-10 elevation-card md:flex-row md:gap-14">
          <div className="flex w-60 shrink-0 flex-col items-center gap-4">
            <Ring done={run.done} total={run.total} tone={tone} />
            <span className="flex items-center gap-1.5 text-[15px] font-semibold text-ink-700">
              <Timer aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-ink-500" />
              {!isTerminal(run.status) ? (run.status === 'queued' ? 'Waiting for the worker…' : eta(run, now) ?? 'Estimating time left…') : RUN_STATE_LABEL[run.status]}
            </span>
          </div>
          <div className="flex w-full flex-1 flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="type-h2 text-ink-900">
                {!isTerminal(run.status)
                  ? 'AI shoppers are out shopping'
                  : run.status === 'done'
                    ? 'Every AI shopper is back'
                    : run.status === 'partial'
                      ? 'Most AI shoppers are back'
                      : run.status === 'cancelled'
                        ? 'This run was stopped'
                        : 'This run failed'}
              </h2>
              <p className="type-small font-medium text-ink-500">
                {queriesN != null
                  ? `${plural(run.byAssistant.length, 'assistant')} × ${plural(queriesN, 'answer')} each`
                  : plural(run.total, 'answer')}
                {!isTerminal(run.status) ? (run.trigger === 'live' ? '. Live tests skip the queue.' : '. Radar updates as answers arrive.') : '.'}
              </p>
            </div>
            {run.byAssistant.map((a) => (
              <ProgressBar key={a.assistant} assistant={a.assistant} value={a.done} max={a.total} />
            ))}
            {run.trigger === 'manual' && finishedOk && (
              <p className="type-small text-ink-500">
                Fixes:{' '}
                {run.fixesStatus === 'done' ? 'ready on the Radar' : run.fixesStatus === 'failed' ? 'failed. Regenerate them from the Radar.' : 'being written…'}
              </p>
            )}
          </div>
        </section>
      )}

      {run && !isTerminal(run.status) && <AskingNow run={run} tasks={tasks} />}
      {run && run.failed > 0 && <FailedCard run={run} tasks={tasks} />}
      {run && run.trigger === 'live' && liveTask && (
        <LiveRunResult task={liveTask} brandId={setup.data?.brand.id} brandName={setup.data?.brand.name ?? 'your brand'} />
      )}
    </AppShell>
  );
}
