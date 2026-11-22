import { badRequest, json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { ASSISTANTS, envModel } from '@/lib/models';
import { kickProcessor } from '@/lib/kick';
import { isUuid, listRuns, RUN_STATES, RUN_TRIGGERS } from '@/lib/runs';
import type { Assistant } from '@/lib/api-types';

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await readJson<unknown>(req);
  if (!isObject(body)) throw badRequest('bad_json', 'Body must be a JSON object');

  let assistants: Assistant[] | null = null;
  if (body.assistants != null) {
    const a = body.assistants;
    if (!Array.isArray(a) || !a.length || !a.every((x) => typeof x === 'string' && (ASSISTANTS as string[]).includes(x)))
      throw badRequest('bad_assistant', `assistants must be a non-empty array of ${ASSISTANTS.join(', ')}`, 'assistants');
    assistants = [...new Set(a as Assistant[])];
  }

  let attempts: number | null = null;
  if (body.attempts != null) {
    const n = body.attempts;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 5)
      throw badRequest('bad_attempts', 'attempts must be an integer from 1 to 5', 'attempts');
    attempts = n;
  }

  let queryIds: string[] | null = null;
  if (body.queryIds != null) {
    const q = body.queryIds;
    if (!Array.isArray(q) || !q.length || !q.every(isUuid))
      throw badRequest('bad_query', 'queryIds must be a non-empty array of query ids', 'queryIds');
    queryIds = [...new Set(q as string[])];
  }

  let label: string | null = null;
  if (body.label != null) {
    if (typeof body.label !== 'string' || body.label.trim().length > 200)
      throw badRequest('bad_label', 'label must be a string of at most 200 characters', 'label');
    label = body.label.trim() || null;
  }

  let trigger: 'manual' | 'live' = 'manual';
  if (body.trigger != null) {
    if (typeof body.trigger !== 'string' || !(RUN_TRIGGERS as readonly string[]).includes(body.trigger))
      throw badRequest('bad_trigger', "trigger must be 'manual' or 'live'", 'trigger');
    trigger = body.trigger as 'manual' | 'live';
  }

  const defaultModels = Object.fromEntries(ASSISTANTS.map((a) => [a, envModel(a)]));
  const runId = must(
    await db().rpc('create_run', {
      p_assistants: assistants,
      p_attempts: attempts,
      p_query_ids: queryIds,
      p_label: label,
      p_trigger: trigger,
      p_user_id: user.id,
      p_user_email: user.email,
      p_default_models: defaultModels,
    }),
    'create_run',
  ) as string;

  // The run is stored; a failed kick only delays it until the next cron tick.
  const kick = await kickProcessor();
  if (!kick.ok) console.warn('[api/runs] kick failed; cron will pick the run up', kick.status ?? kick.error);

  return json({ runId }, 201);
});

export const GET = route(async (req) => {
  await requireUser();
  const sp = new URL(req.url).searchParams;
  const status = sp.get('status') || undefined;
  const trigger = sp.get('trigger') || undefined;
  if (status && !(RUN_STATES as string[]).includes(status))
    throw badRequest('bad_status', `status must be one of ${RUN_STATES.join(', ')}`, 'status');
  if (trigger && !(RUN_TRIGGERS as readonly string[]).includes(trigger))
    throw badRequest('bad_trigger', "trigger must be 'manual' or 'live'", 'trigger');
  return json(await listRuns({ status, trigger }));
});
