import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens, rate } from '@/lib/lens';
import type { Assistant, QueryRow } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// One row per query in the lens (ordered by code), with each lens assistant's done attempts and how many
// found / mentioned / picked the focus brand, plus that assistant's most frequent winner.
export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_queries', lensArgs(l));
  const out = new Map<string, QueryRow & { _n: number; _of: number }>();
  for (const r of rows as any[]) {
    let q = out.get(r.query_id);
    if (!q) {
      q = { queryId: r.query_id, code: r.query_code, text: r.query_text, productId: r.product_id, perAssistant: [], picked: rate(0, 0), _n: 0, _of: 0 };
      out.set(r.query_id, q);
    }
    q.perAssistant.push({
      assistant: r.assistant as Assistant, attempts: Number(r.attempts), found: Number(r.found_n),
      mentioned: Number(r.mentioned_n), picked: Number(r.picked_n), topWinner: r.top_winner ?? null,
    });
    q._n += Number(r.picked_n);
    q._of += Number(r.focus_of);
  }
  const order = (a: Assistant) => l.assistants.indexOf(a);
  const body: QueryRow[] = [...out.values()].map(({ _n, _of, ...q }) => ({
    ...q,
    perAssistant: q.perAssistant.sort((a, b) => order(a.assistant) - order(b.assistant)),
    picked: rate(_n, _of),
  }));
  return json(body);
});
