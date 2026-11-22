import 'server-only';
import type { Assistant, RunListItem, RunState, RunStatus } from './api-types';
import { db, must } from './supabase';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const RUN_STATES: RunState[] = ['queued', 'processing', 'done', 'partial', 'failed', 'cancelled'];
export const RUN_TRIGGERS = ['manual', 'live'] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s);

// run_counts returns at most 3 rows per run (one per assistant); 300 runs stays under PostgREST's 1,000-row cap.
const LIST_LIMIT = 300;
const RUN_COLS = 'id,label,trigger,status,fixes_status,created_at,created_by_email,assistants,city';

interface CountRow { run_id: string; assistant: Assistant; total: number; done: number; failed: number; in_flight: number }

async function runCounts(ids: string[]): Promise<Map<string, CountRow[]>> {
  const byRun = new Map<string, CountRow[]>();
  if (!ids.length) return byRun;
  const rows = must(await db().rpc('run_counts', { p_run_ids: ids }), 'run_counts') as any[] | null;
  for (const r of rows ?? []) {
    const row: CountRow = {
      run_id: r.run_id, assistant: r.assistant,
      total: Number(r.total ?? 0), done: Number(r.done ?? 0), failed: Number(r.failed ?? 0), in_flight: Number(r.in_flight ?? 0),
    };
    const list = byRun.get(row.run_id);
    if (list) list.push(row); else byRun.set(row.run_id, [row]);
  }
  return byRun;
}

const sum = (rows: CountRow[], k: 'total' | 'done' | 'failed' | 'in_flight') => rows.reduce((n, r) => n + r[k], 0);

function toListItem(r: any, counts: CountRow[]): RunListItem {
  return {
    id: r.id, label: r.label ?? null, trigger: r.trigger, status: r.status, createdAt: r.created_at,
    createdByEmail: r.created_by_email ?? null, assistants: (r.assistants ?? []) as Assistant[], city: r.city,
    total: sum(counts, 'total'), done: sum(counts, 'done'), failed: sum(counts, 'failed'), costUsd: null,
  };
}

/** Runs newest first: one runs query + one run_counts call. Callers validate status/trigger. */
export async function listRuns(opts: { status?: string; trigger?: string } = {}): Promise<RunListItem[]> {
  let q = db().from('runs').select(RUN_COLS).order('created_at', { ascending: false }).limit(LIST_LIMIT);
  if (opts.status) q = q.eq('status', opts.status);
  if (opts.trigger) q = q.eq('trigger', opts.trigger);
  const runs = (must(await q, 'runs') ?? []) as any[];
  const counts = await runCounts(runs.map((r) => r.id));
  return runs.map((r) => toListItem(r, counts.get(r.id) ?? []));
}

/** One run with task counts (run_counts, not a read of every task). null when missing or not a uuid. */
export async function getRunStatus(id: string): Promise<RunStatus | null> {
  if (!isUuid(id)) return null;
  const [runRes, counts] = await Promise.all([
    db().from('runs').select(RUN_COLS).eq('id', id).maybeSingle(),
    runCounts([id]),
  ]);
  const r = must(runRes, 'runs') as any;
  if (!r) return null;
  const rows = counts.get(id) ?? [];
  const order = (r.assistants ?? []) as string[];
  const rank = (a: string) => { const i = order.indexOf(a); return i < 0 ? order.length : i; };
  return {
    ...toListItem(r, rows),
    fixesStatus: r.fixes_status,
    inFlight: sum(rows, 'in_flight'),
    byAssistant: [...rows]
      .sort((a, b) => rank(a.assistant) - rank(b.assistant))
      .map((c) => ({ assistant: c.assistant, total: c.total, done: c.done, failed: c.failed })),
  };
}

/** True when a run row exists (cheap head count). */
export async function runExists(id: string): Promise<boolean> {
  if (!isUuid(id)) return false;
  const res = await db().from('runs').select('id', { head: true, count: 'exact' }).eq('id', id);
  must(res, 'runs');
  return (res.count ?? 0) > 0;
}
