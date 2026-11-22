import { badRequest, json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens } from '@/lib/lens';
import type { Assistant, LostSale } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Ranked: mentioned_lost, then found_not_mentioned, then not_found; then our product cheaper than the
// winner; then the biggest price gap; then newest. ?limit=10 (1–50; larger values are capped at 50).
export const GET = route(async (req) => {
  await requireUser();
  const raw = new URL(req.url).searchParams.get('limit');
  let limit = 10;
  if (raw != null && raw.trim() !== '') {
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1) throw badRequest('bad_limit', 'limit must be an integer from 1 to 50', 'limit');
    limit = Math.min(n, 50);
  }
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_lost_sales', { ...lensArgs(l), p_limit: limit });
  const body: LostSale[] = rows.map((r: any) => ({
    taskId: r.task_id,
    queryCode: r.query_code,
    queryText: r.query_text,
    assistant: r.assistant as Assistant,
    outcome: r.outcome,
    winner: r.winner ?? null,
    winnerPriceInr: r.winner_price_inr ?? null,
    reason: r.reason ?? null,
    ourProduct: r.product_name != null
      ? { name: r.product_name, priceInr: r.product_price_inr, deliveryDays: r.product_delivery_days ?? null, deliveryIsSample: !!r.product_delivery_is_sample }
      : null,
  }));
  return json(body);
});
