import { json, notFound, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toAssistant } from '@/lib/mappers';
import { ASSISTANTS } from '@/lib/models';
import { asBody, validateAssistantPatch } from '@/lib/settings-validate';
import { stamp } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/settings/assistants/:id { enabled?, model? } -> AssistantInfo
// model null or '' = env default. Tasks already created keep their snapshotted model.
export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  if (!ASSISTANTS.includes(id as never)) throw notFound('not_found', `Assistant ${id} not found; use one of ${ASSISTANTS.join(', ')}`);
  const current = must(await db().from('assistants').select('*').eq('id', id).maybeSingle(), 'assistants');
  if (!current) throw notFound('not_found', `Assistant ${id} is not set up; run supabase/seed.sql`);
  const patch = validateAssistantPatch(asBody(await readJson(req)), current);
  if (!Object.keys(patch).length) return json(toAssistant(current));
  const row = must(await db().from('assistants').update(patch).eq('id', id).select('*').single(), 'assistants');
  await stamp(user.email);
  return json(toAssistant(row));
});
