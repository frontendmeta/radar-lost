'use client';

import { useEffect, useMemo, useState } from 'react';
import { Rocket, Sparkles } from 'lucide-react';
import type { RunListItem, RunState } from '@/lib/api-types';
import { api, isTerminal } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { AppShell, ErrorNote, Skeleton } from '../app-shell';
import { runDateLabel } from '../format';
import { Button, EmptyState, RunRow, Segmented } from '../ui';
import { LiveTestDialog } from '../live-test';

type StatusFilter = 'all' | 'running' | 'done' | 'partial' | 'failed';
type TriggerFilter = 'any' | 'manual' | 'live';

const STATUS_MATCH: Record<StatusFilter, (s: RunState) => boolean> = {
  all: () => true,
  running: (s) => s === 'queued' || s === 'processing',
  done: (s) => s === 'done',
  partial: (s) => s === 'partial',
  failed: (s) => s === 'failed' || s === 'cancelled',
};

function dayKey(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
}

function meta(r: RunListItem): string {
  const who = r.createdByEmail?.split('@')[0];
  const by = who ? `Started by ${who.charAt(0).toUpperCase()}${who.slice(1)}` : 'Started';
  const failed = r.failed && isTerminal(r.status) ? ` · ${r.failed} failed, will not retry` : '';
  const stopped = r.status === 'cancelled' ? ' · stopped' : '';
  return `${by}${failed}${stopped}`;
}

/** Pencil "40 Runs" (P1BO3m). */
export function RunsScreen() {
  const [status, setStatus] = useState<StatusFilter>('all');
  const [trigger, setTrigger] = useState<TriggerFilter>('any');
  const [liveOpen, setLiveOpen] = useState(false);
  const runs = useApi('runs', () => api.runs());
  const { reload } = runs;

  // Keep the list fresh while anything is running.
  const anyRunning = runs.data?.some((r) => !isTerminal(r.status)) ?? false;
  useEffect(() => {
    if (!anyRunning) return;
    const t = setInterval(reload, 4000);
    return () => clearInterval(t);
  }, [anyRunning, reload]);

  const groups = useMemo(() => {
    const list = (runs.data ?? []).filter((r) => STATUS_MATCH[status](r.status) && (trigger === 'any' || r.trigger === trigger));
    const out: { day: string; runs: RunListItem[] }[] = [];
    for (const r of list) {
      const d = dayKey(r.createdAt);
      const g = out.find((x) => x.day === d);
      if (g) g.runs.push(r);
      else out.push({ day: d, runs: [r] });
    }
    return out;
  }, [runs.data, status, trigger]);

  return (
    <AppShell active="runs">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2">
          <h1 className="type-display text-ink-900">Runs</h1>
          <p className="type-body text-ink-500">Every time we send AI shoppers out</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" icon={Sparkles} onClick={() => setLiveOpen(true)}>Live test</Button>
          <Button icon={Rocket} href="/runs/new">Run AI shoppers</Button>
        </div>
      </div>

      <div className="-mt-2 flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-3">
          <span className="type-label text-ink-500">Status</span>
          <Segmented<StatusFilter>
            label="Status"
            value={status}
            onValueChange={setStatus}
            options={[
              { value: 'all', label: 'All' },
              { value: 'running', label: 'Running' },
              { value: 'done', label: 'Done' },
              { value: 'partial', label: 'Partial' },
              { value: 'failed', label: 'Failed' },
            ]}
          />
        </div>
        <div className="flex items-center gap-3">
          <span className="type-label text-ink-500">Trigger</span>
          <Segmented<TriggerFilter>
            label="Trigger"
            value={trigger}
            onValueChange={setTrigger}
            options={[
              { value: 'any', label: 'Any' },
              { value: 'manual', label: 'Full' },
              { value: 'live', label: 'Live' },
            ]}
          />
        </div>
      </div>

      {runs.error && !runs.data ? (
        <ErrorNote error={runs.error} onRetry={runs.reload} />
      ) : !runs.data ? (
        <div className="flex flex-col gap-2 rounded-card bg-surface p-4 elevation-card">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : runs.data.length === 0 ? (
        <EmptyState
          title="No runs yet"
          body="Send the AI shoppers out to see how often ChatGPT, Claude and Gemini pick your brand."
          action={<Button icon={Rocket} href="/runs/new">Run AI shoppers</Button>}
        />
      ) : groups.length === 0 ? (
        <p className="rounded-card bg-surface px-6 py-8 text-center type-small text-ink-500 elevation-card">No runs match these filters.</p>
      ) : (
        <div className="flex flex-col gap-1 rounded-card bg-surface p-4 elevation-card">
          {groups.map((g) => (
            <div key={g.day} className="flex flex-col">
              <div className="flex items-center gap-3 px-4 py-2">
                <p className="type-label text-ink-500">{g.day}</p>
                <span aria-hidden className="h-px flex-1 bg-ink-200" />
              </div>
              {g.runs.map((r) => (
                <RunRow
                  key={r.id}
                  title={`${r.label ?? (r.trigger === 'live' ? 'Live test' : 'Full run')} · ${runDateLabel(r.createdAt, true)}`}
                  meta={meta(r)}
                  trigger={r.trigger}
                  status={r.status}
                  total={r.total}
                  done={r.done}
                  failed={r.failed}
                  assistants={r.assistants}
                  city={r.city}
                  costUsd={r.costUsd}
                  href={`/runs/${encodeURIComponent(r.id)}`}
                  className={!isTerminal(r.status) ? 'bg-brand-50' : undefined}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {liveOpen && (
        <LiveTestDialog
          onClose={() => {
            setLiveOpen(false);
            reload();
          }}
        />
      )}
    </AppShell>
  );
}
