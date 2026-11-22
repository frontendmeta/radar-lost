import 'server-only';
import type { Assistant, LensEcho, Rate, RunState } from './api-types';
import { db, must } from './supabase';
import { badRequest, notFound } from './http';
import { ASSISTANTS } from './models';
import { isUuid } from './runs';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Lens: the same filters on every analysis route.
//   run        run id | 'latest' (default: newest manual run with status done or partial; live runs never count)
//   focus      brand id (default: the primary brand)
//   assistants comma list of openai, anthropic, gemini (default: every assistant in that run)
//   products   comma list of product ids (default: all)
//   queries    comma list of query ids (default: all; AND-ed with products)
//   compare    'previous' (default) | run id | 'none'
// Bad values -> 400 bad_lens naming the field and the allowed values.

export interface LensRun {
  id: string; label: string | null; trigger: 'manual' | 'live'; status: RunState; assistants: Assistant[]; createdAt: string;
}
export interface Lens {
  run: LensRun;
  runId: string;
  focus: { id: string; name: string; isPrimary: boolean };
  focusBrandId: string;
  assistants: Assistant[];
  productIds: string[] | null; // null = all
  queryIds: string[] | null;   // null = all
  compare: { id: string; label: string | null } | null;
}

/** Counts -> Rate. of = 0 gives rate null (shown as "—"), never 0. */
export const rate = (n: number, of: number): Rate => ({ n: Number(n) || 0, of: Number(of) || 0, rate: Number(of) ? Number(n) / Number(of) : null });

/** a - b for two rates (0–1 difference, i.e. percentage points / 100); null when either is unknown. */
export const delta = (a: number | null, b: number | null): number | null => (a == null || b == null ? null : a - b);

/** Arguments every analysis_* SQL function takes. */
export function lensArgs(l: Lens) {
  return {
    p_run_id: l.runId, p_focus: l.focusBrandId, p_assistants: l.assistants,
    p_product_ids: l.productIds, p_query_ids: l.queryIds,
  };
}

/** Echo of the resolved lens. Empty productIds / queryIds mean "all". */
export function lensEcho(l: Lens): LensEcho {
  return { runId: l.runId, focusBrandId: l.focusBrandId, assistants: l.assistants, productIds: l.productIds ?? [], queryIds: l.queryIds ?? [] };
}

/** Call an analysis_* function and return its rows. */
export async function analysisRpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T[]> {
  return ((must(await db().rpc(fn, args), fn) as T[] | null) ?? []);
}

const RUN_COLS = 'id,label,trigger,status,assistants,created_at';
const FINISHED: RunState[] = ['done', 'partial'];

const toLensRun = (r: any): LensRun => ({
  id: r.id, label: r.label ?? null, trigger: r.trigger, status: r.status, assistants: (r.assistants ?? []) as Assistant[], createdAt: r.created_at,
});

/** Newest manual run with status done or partial (live runs never become latest). */
export async function latestRunId(): Promise<string | null> {
  const rows = must(
    await db().from('runs').select('id').eq('trigger', 'manual').in('status', FINISHED)
      .order('created_at', { ascending: false }).limit(1),
    'runs',
  ) as any[] | null;
  return rows?.[0]?.id ?? null;
}

/** The manual done/partial run created just before `run`. */
async function previousRun(run: LensRun): Promise<{ id: string; label: string | null } | null> {
  const rows = must(
    await db().from('runs').select('id,label').eq('trigger', 'manual').in('status', FINISHED)
      .lt('created_at', run.createdAt).neq('id', run.id)
      .order('created_at', { ascending: false }).limit(1),
    'runs',
  ) as any[] | null;
  const r = rows?.[0];
  return r ? { id: r.id, label: r.label ?? null } : null;
}

async function getRun(id: string): Promise<LensRun | null> {
  const r = must(await db().from('runs').select(RUN_COLS).eq('id', id).maybeSingle(), 'runs');
  return r ? toLensRun(r) : null;
}

/** Split a comma list; empty / missing -> null. */
function list(v: string | null): string[] | null {
  if (v == null) return null;
  const parts = [...new Set(v.split(',').map((s) => s.trim()).filter(Boolean))];
  return parts.length ? parts : null;
}

async function allowedBrands(): Promise<string> {
  const rows = (must(await db().from('brands').select('id,name').is('archived_at', null).order('is_primary', { ascending: false }).order('name'), 'brands') ?? []) as any[];
  return rows.map((b) => `${b.name}=${b.id}`).join(', ');
}

/** Validate a list of ids against a table (archived rows included: old runs reference them). */
async function checkIds(table: 'products' | 'queries', field: string, ids: string[]): Promise<string[]> {
  const bad = ids.filter((id) => !isUuid(id));
  let found = new Set<string>();
  if (bad.length < ids.length) {
    const rows = (must(await db().from(table).select('id').in('id', ids.filter(isUuid)), table) ?? []) as any[];
    found = new Set(rows.map((r) => r.id));
  }
  const missing = ids.filter((id) => !found.has(id));
  if (missing.length) {
    const active = (must(await db().from(table).select('id,code').is('archived_at', null).order('code'), table) ?? []) as any[];
    const noun = table === 'products' ? 'product' : 'query';
    throw badRequest('bad_lens', `Unknown ${field}: ${missing.join(', ')}. Allowed: comma list of ${noun} ids (${active.map((r) => `${r.code}=${r.id}`).join(', ')})`, field);
  }
  return ids;
}

export async function parseLens(req: Request): Promise<Lens> {
  const sp = new URL(req.url).searchParams;

  // run
  const runParam = (sp.get('run') ?? '').trim() || 'latest';
  let runId: string;
  if (runParam === 'latest') {
    const id = await latestRunId();
    if (!id) throw notFound('no_runs', 'No finished manual run yet');
    runId = id;
  } else if (isUuid(runParam)) {
    runId = runParam;
  } else {
    throw badRequest('bad_lens', "run must be a run id or 'latest'", 'run');
  }

  // Independent lookups in parallel.
  const focusParam = (sp.get('focus') ?? '').trim();
  if (focusParam && !isUuid(focusParam)) {
    throw badRequest('bad_lens', `focus must be a brand id. Allowed: ${await allowedBrands()}`, 'focus');
  }
  const productIds = list(sp.get('products'));
  const queryIds = list(sp.get('queries'));

  const [run, focusRow] = await Promise.all([
    getRun(runId),
    focusParam
      ? db().from('brands').select('id,name,is_primary').eq('id', focusParam).maybeSingle().then((r) => must(r, 'brands'))
      : db().from('brands').select('id,name,is_primary').eq('is_primary', true).is('archived_at', null).limit(1).maybeSingle().then((r) => must(r, 'brands')),
    productIds ? checkIds('products', 'products', productIds) : null,
    queryIds ? checkIds('queries', 'queries', queryIds) : null,
  ]);
  if (!run) throw badRequest('bad_lens', `Unknown run ${runId}. Allowed: a run id from /api/runs or 'latest'`, 'run');
  if (!focusRow) {
    if (focusParam) throw badRequest('bad_lens', `Unknown focus brand ${focusParam}. Allowed: ${await allowedBrands()}`, 'focus');
    throw notFound('no_primary_brand', 'No active primary brand is set up');
  }
  const focus = { id: (focusRow as any).id as string, name: (focusRow as any).name as string, isPrimary: !!(focusRow as any).is_primary };

  // assistants
  const aList = list(sp.get('assistants'));
  let assistants: Assistant[];
  if (aList) {
    const lower = aList.map((a) => a.toLowerCase());
    const bad = lower.filter((a) => !(ASSISTANTS as string[]).includes(a));
    if (bad.length) throw badRequest('bad_lens', `Unknown assistants: ${bad.join(', ')}. Allowed: ${ASSISTANTS.join(', ')}`, 'assistants');
    assistants = ASSISTANTS.filter((a) => lower.includes(a));
  } else {
    assistants = ASSISTANTS.filter((a) => run.assistants.includes(a));
  }

  // compare
  const cmp = (sp.get('compare') ?? '').trim() || 'previous';
  let compare: Lens['compare'] = null;
  if (cmp === 'none') compare = null;
  else if (cmp === 'previous') compare = await previousRun(run);
  else if (isUuid(cmp)) {
    const c = await getRun(cmp);
    if (!c) throw badRequest('bad_lens', `Unknown compare run ${cmp}. Allowed: 'previous', 'none' or a run id`, 'compare');
    compare = { id: c.id, label: c.label };
  } else {
    throw badRequest('bad_lens', "compare must be 'previous', 'none' or a run id", 'compare');
  }

  return { run, runId: run.id, focus, focusBrandId: focus.id, assistants, productIds, queryIds, compare };
}
