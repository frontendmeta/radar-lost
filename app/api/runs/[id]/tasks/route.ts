import type { Assistant, BrandOutcome, LossReason, RunTask, TaskState } from '@/lib/api-types';
import { json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { isUuid, runExists } from '@/lib/runs';

/* eslint-disable @typescript-eslint/no-explicit-any */

// GET /api/runs/:id/tasks -> RunTask[] ordered by query code, assistant, attempt (a run has ≤ 300 tasks).
export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id) || !(await runExists(id))) throw notFound('run_not_found', `No run ${id}`);
  const sb = db();
  const [tasks, primary] = await Promise.all([
    sb.from('tasks')
      .select('id, query_id, assistant, model, attempt, status, failure_class, error, call_started_at, done_at, queries(code, text), decisions(pick_brand_name)')
      .eq('run_id', id)
      .range(0, 999),
    sb.from('brands').select('id').eq('is_primary', true).is('archived_at', null).maybeSingle(),
  ]);
  const rows = must(tasks, 'tasks') as any[];
  const primaryId = (must(primary, 'brands') as any)?.id ?? null;
  const outcomes = primaryId
    ? (must(await sb.from('v_task_brand').select('task_id, outcome, reason').eq('run_id', id).eq('brand_id', primaryId).range(0, 999), 'v_task_brand') as any[])
    : [];
  const byTask = new Map(outcomes.map((o) => [o.task_id, o]));
  const one = (v: any) => (Array.isArray(v) ? v[0] : v) ?? null;

  const out: RunTask[] = rows.map((t) => {
    const q = one(t.queries);
    const d = one(t.decisions);
    const o = byTask.get(t.id);
    return {
      id: t.id, queryId: t.query_id, queryCode: q?.code ?? '', queryText: q?.text ?? '',
      assistant: t.assistant as Assistant, model: t.model, attempt: t.attempt,
      status: t.status as TaskState, failureClass: t.failure_class ?? null, error: t.error ?? null,
      callStartedAt: t.call_started_at ?? null, doneAt: t.done_at ?? null,
      pickBrand: d?.pick_brand_name ?? null,
      focusOutcome: (o?.outcome as BrandOutcome) ?? null, focusReason: (o?.reason as LossReason) ?? null,
    };
  });
  out.sort((a, b) => a.queryCode.localeCompare(b.queryCode) || a.assistant.localeCompare(b.assistant) || a.attempt - b.attempt);
  return json(out);
});
