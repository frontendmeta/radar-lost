import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens } from '@/lib/lens';
import type { LossReasonRow } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Per reason over done tasks where the focus wasn't picked; share = n / those tasks. Largest first.
export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_loss_reasons', lensArgs(l));
  const body: LossReasonRow[] = rows.map((r: any) => ({
    reason: r.reason,
    n: Number(r.n),
    share: Number(r.total) ? Number(r.n) / Number(r.total) : 0,
  }));
  return json(body);
});
