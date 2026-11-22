import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { analysisRpc, lensArgs, parseLens, rate } from '@/lib/lens';
import type { ByAssistant } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = route(async (req) => {
  await requireUser();
  const l = await parseLens(req);
  const rows = await analysisRpc('analysis_by_assistant', lensArgs(l));
  const by = new Map(rows.map((r: any) => [r.assistant, r]));
  // One row per lens assistant, in lens order; an assistant with no tasks gets zeros and null rates.
  const body: ByAssistant[] = l.assistants.map((a) => {
    const r: any = by.get(a) ?? {};
    return {
      assistant: a,
      done: Number(r.done ?? 0),
      found: rate(r.found_n ?? 0, r.found_of ?? 0),
      mentioned: rate(r.mentioned_n ?? 0, r.focus_of ?? 0),
      picked: rate(r.picked_n ?? 0, r.focus_of ?? 0),
    };
  });
  return json(body);
});
