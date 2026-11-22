import { json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toProduct, toQuery } from '@/lib/mappers';
import { isUuid } from '@/lib/runs';
import type { Assistant, BrandOutcome, Trace } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ctx = { params: Promise<{ id: string }> };

const OUTCOME_ORDER: BrandOutcome[] = ['picked', 'mentioned_lost', 'found_not_mentioned', 'not_found'];

// The full chain for one task: query, our product, prompt, searches, sources, answer, decision, per-brand outcomes.
// Works for a task that isn't done yet (missing parts are empty / null; outcomes exist only once done).
export const GET = route(async (_req, ctx: Ctx) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw notFound('task_not_found', `No task ${id}`);
  const s = db();

  const task = must(
    await s.from('tasks').select('id,run_id,query_id,assistant,model,attempt,prompt_text,status').eq('id', id).maybeSingle(),
    'tasks',
  ) as any;
  if (!task) throw notFound('task_not_found', `No task ${id}`);

  // A task has at most a few dozen searches/sources, well under the 1,000-row cap.
  const [queryRes, answerRes, searchRes, sourceRes, decisionRes, outcomeRes, brandRes] = await Promise.all([
    s.from('queries').select('*, product:products(*)').eq('id', task.query_id).maybeSingle(),
    s.from('answers').select('answer_text,web_searched').eq('task_id', id).maybeSingle(),
    s.from('searches').select('ord,query').eq('task_id', id).order('ord'),
    s.from('sources').select('ord,url,title,domain,root_domain,source_type,brand_id,cited').eq('task_id', id).order('ord'),
    s.from('decisions').select('*').eq('task_id', id).maybeSingle(),
    s.from('v_task_brand').select('brand_id,outcome,reason,note').eq('task_id', id),
    s.from('brands').select('id,name,is_primary'),
  ]);
  const q = must(queryRes, 'queries') as any;
  const answer = must(answerRes, 'answers') as any;
  const searches = (must(searchRes, 'searches') ?? []) as any[];
  const sources = (must(sourceRes, 'sources') ?? []) as any[];
  const d = must(decisionRes, 'decisions') as any;
  const outcomes = (must(outcomeRes, 'v_task_brand') ?? []) as any[];
  const brands = (must(brandRes, 'brands') ?? []) as any[];
  if (!q) throw notFound('task_not_found', `Task ${id} has no query`);

  const brandById = new Map(brands.map((b) => [b.id, b]));
  const name = (bid: string | null | undefined) => (bid ? brandById.get(bid)?.name ?? null : null);
  const names = (ids: string[] | null | undefined) => (ids ?? []).map(name).filter((n): n is string => !!n);

  const pickBrand = d ? name(d.pick_brand_id) ?? (d.pick_brand_name?.trim() || null) : null;

  const body: Trace = {
    taskId: task.id,
    runId: task.run_id,
    assistant: task.assistant as Assistant,
    model: task.model,
    attempt: task.attempt,
    webSearched: !!answer?.web_searched,
    query: toQuery(q),
    ourProduct: q.product ? toProduct(q.product) : null,
    promptText: task.prompt_text,
    searches: searches.map((r) => r.query),
    sources: sources.map((r) => ({
      url: r.url, title: r.title ?? '', domain: r.domain ?? r.root_domain ?? '', type: r.source_type,
      brand: name(r.brand_id), cited: !!r.cited,
    })),
    answerText: answer?.answer_text ?? '',
    mentioned: names(d?.mentioned_brand_ids),
    shortlist: names(d?.shortlist_brand_ids),
    pick: d && pickBrand
      ? {
          brand: pickBrand, product: d.pick_product ?? null, priceInr: d.pick_price_inr ?? null,
          channel: d.pick_channel ?? 'unknown', url: d.pick_url ?? null, deliveryDays: d.pick_delivery_days ?? null,
        }
      : null,
    fitsBudget: d?.fits_budget ?? 'unknown',
    fitsDeadline: d?.fits_deadline ?? 'unknown',
    // Primary brand first, then picked / mentioned_lost / found_not_mentioned / not_found, then by name.
    outcomes: outcomes
      .map((o) => ({
        brandId: o.brand_id as string, brandName: name(o.brand_id) ?? 'Unknown', outcome: o.outcome as BrandOutcome,
        reason: o.reason ?? null, note: o.note ?? null,
      }))
      .sort((a, b) => Number(!!brandById.get(b.brandId)?.is_primary) - Number(!!brandById.get(a.brandId)?.is_primary)
        || OUTCOME_ORDER.indexOf(a.outcome) - OUTCOME_ORDER.indexOf(b.outcome)
        || a.brandName.localeCompare(b.brandName)),
    reasoningExcerpt: d?.reasoning_excerpt ?? null,
  };
  return json(body);
});
