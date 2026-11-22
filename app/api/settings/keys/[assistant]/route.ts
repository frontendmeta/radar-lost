import type { Assistant, SaveKeyResult } from '@/lib/api-types';
import { badRequest, json, notFound, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, dbError } from '@/lib/supabase';
import { ASSISTANTS } from '@/lib/models';
import { stamp } from '@/lib/settings';
import { listProviderKeys, verifyProviderKey } from '@/lib/provider-keys';

type Ctx = { params: Promise<{ assistant: string }> };

async function assistantParam(ctx: Ctx): Promise<Assistant> {
  const { assistant } = await ctx.params;
  if (!ASSISTANTS.includes(assistant as Assistant)) throw notFound('not_found', `Assistant ${assistant} not found; use one of ${ASSISTANTS.join(', ')}`);
  return assistant as Assistant;
}

// PUT /api/settings/keys/:assistant { apiKey, verify?: boolean = true } -> SaveKeyResult
// The key is checked with the provider, then encrypted into Supabase Vault. It is never echoed or logged.
export const PUT = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const assistant = await assistantParam(ctx);
  const body = await readJson<{ apiKey?: unknown; verify?: unknown }>(req);
  if (typeof body.apiKey !== 'string' || !body.apiKey.trim()) throw badRequest('bad_request', 'apiKey is required', 'apiKey');
  const key = body.apiKey.trim();
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) throw badRequest('bad_key', 'The key looks malformed (20–400 characters, no spaces)', 'apiKey');
  const verified = body.verify === false ? false : await verifyProviderKey(assistant, key);

  const { error } = await db().rpc('set_provider_key', { p_assistant: assistant, p_key: key, p_email: user.email });
  if (error) throw dbError({ message: error.message.replace(key, '***') }, 'set_provider_key');
  await stamp(user.email);

  const info = (await listProviderKeys()).find((k) => k.assistant === assistant)!;
  const result: SaveKeyResult = { ...info, verified };
  return json(result);
});

// DELETE /api/settings/keys/:assistant -> { ok: true }. Falls back to the env key, if any, on the processor's next tick.
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const assistant = await assistantParam(ctx);
  const { error } = await db().rpc('delete_provider_key', { p_assistant: assistant });
  if (error) throw dbError(error, 'delete_provider_key');
  await stamp(user.email);
  return json({ ok: true });
});
