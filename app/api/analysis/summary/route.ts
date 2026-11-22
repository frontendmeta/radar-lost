import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, delta, lensArgs, lensEcho, parseLens, rate } from '@/lib/lens';
import type { Summary } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const args = lensArgs(l);
  const [rows, cmpRows] = await Promise.all([
    analysisRpc('analysis_summary', args),
    l.compare
      ? analysisRpc('analysis_compare', {
          p_run_id: l.runId, p_compare_run_id: l.compare.id, p_focus: l.focusBrandId,
          p_assistants: l.assistants, p_product_ids: l.productIds, p_query_ids: l.queryIds,
        })
      : Promise.resolve([] as any[]),
  ]);
  const s: any = rows[0] ?? {};
  const mentioned = rate(s.mentioned_n, s.focus_of);
  const picked = rate(s.picked_n, s.focus_of);

  let compare: Summary['compare'] = null;
  if (l.compare) {
    const c: any = cmpRows[0] ?? {};
    // Like-for-like: both sides measured over the shared (query, assistant) pairs only.
    compare = {
      runId: l.compare.id, label: l.compare.label, sharedPairs: Number(c.shared_pairs ?? 0),
      foundDelta: delta(rate(c.cur_found_n, c.cur_found_of).rate, rate(c.prev_found_n, c.prev_found_of).rate),
      mentionedDelta: delta(rate(c.cur_mentioned_n, c.cur_of).rate, rate(c.prev_mentioned_n, c.prev_of).rate),
      pickedDelta: delta(rate(c.cur_picked_n, c.cur_of).rate, rate(c.prev_picked_n, c.prev_of).rate),
    };
  }

  const body: Summary = {
    lens: lensEcho(l),
    focus: l.focus,
    done: Number(s.done ?? 0),
    failed: Number(s.failed ?? 0),
    found: rate(s.found_n, s.found_of),
    mentioned,
    picked,
    gap: delta(mentioned.rate, picked.rate),
    budgetMisses: rate(s.budget_miss_n, s.budget_known_of),
    compare,
  };
  return json(body);
});
