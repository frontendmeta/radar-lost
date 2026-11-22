import { badRequest, json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { kickProcessor } from '@/lib/kick';
import { isUuid } from '@/lib/runs';
import type { Fix } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ctx = { params: Promise<{ id: string }> };

async function runRow(id: string): Promise<any> {
  if (!isUuid(id)) throw notFound('run_not_found', `No run ${id}`);
  const r = must(await db().from('runs').select('id,status,trigger,fixes_status').eq('id', id).maybeSingle(), 'runs');
  if (!r) throw notFound('run_not_found', `No run ${id}`);
  return r;
}

function taskIds(evidence: any): string[] {
  const ids = evidence?.task_ids ?? evidence?.taskIds;
  return Array.isArray(ids) ? ids.filter((x: unknown): x is string => typeof x === 'string') : [];
}

// GET: the run's fixes ordered by ord ([] while none are written yet).
export const GET = route(async (_req, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  await runRow(id);
  const rows = (must(
    await db().from('run_fixes').select('ord,title,why,action,fix_type,evidence').eq('run_id', id).order('ord'),
    'run_fixes',
  ) ?? []) as any[];
  const body: Fix[] = rows.map((r) => ({
    ord: r.ord, title: r.title, why: r.why, action: r.action, fixType: r.fix_type, evidenceTaskIds: taskIds(r.evidence),
  }));
  return json(body);
});

// POST: regenerate. Marks fixes pending (finished runs only) and kicks the processor, which writes them.
export const POST = route(async (_req, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  const run = await runRow(id);
  if (run.status !== 'done' && run.status !== 'partial') {
    throw badRequest('run_not_finished', `Run is ${run.status}; fixes need a done or partial run`);
  }
  // The processor (claim_fixes) only writes fixes for manual runs; a live mini-run would stay pending forever.
  if (run.trigger !== 'manual') throw badRequest('live_run_no_fixes', 'Fixes are written for manual runs only');
  must(await db().from('runs').update({ fixes_status: 'pending' }).eq('id', id), 'runs');
  await kickProcessor();
  return json({ ok: true });
});
