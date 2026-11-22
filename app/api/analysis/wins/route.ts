import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens } from '@/lib/lens';
import type { Win } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Most picks first. Unknown winners (no brand id) keep their name; the UI groups them as "Other".
// The focus brand is always present (0 picks if it never won). share = picks / done tasks in the lens.
export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_wins', lensArgs(l));
  const body: Win[] = rows.map((r: any) => ({
    brandId: r.brand_id ?? null,
    brandName: r.brand_name,
    isPrimary: !!r.is_primary,
    isFocus: r.brand_id != null && r.brand_id === l.focusBrandId,
    picks: Number(r.picks),
    share: Number(r.done) ? Number(r.picks) / Number(r.done) : 0,
  }));
  return json(body);
});
