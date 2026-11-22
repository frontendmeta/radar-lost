import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens } from '@/lib/lens';
import type { SourcesBreakdown, SourceType } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// byType: source rows per type; topDomains: top 10 root domains by source rows (type = its most common type,
// focusPresent = a source there carries the focus brand); focusPickChannels: focus picks per channel.
export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_sources', lensArgs(l));
  const body: SourcesBreakdown = { byType: [], topDomains: [], focusPickChannels: [] };
  for (const r of rows as any[]) {
    const n = Number(r.n);
    if (r.kind === 'type') body.byType.push({ type: r.key as SourceType, n });
    else if (r.kind === 'domain') body.topDomains.push({ domain: r.key, type: (r.source_type ?? 'other') as SourceType, n, focusPresent: !!r.focus_present });
    else if (r.kind === 'channel') body.focusPickChannels.push({ channel: r.key, n });
  }
  return json(body);
});
