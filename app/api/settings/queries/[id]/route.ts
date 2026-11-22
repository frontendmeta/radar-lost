import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toQuery } from '@/lib/mappers';
import { QUERY_KEYS, asBody, assertActiveProduct, overlay, validateQuery } from '@/lib/settings-validate';
import { activeRow, nowIso, rpcError, stamp } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/settings/queries/:id (any subset of the POST body) -> Query, the NEW version.
// Wording is frozen: settings_replace_query archives this row and inserts a new one with the
// same code and replaces_id = this id. Old runs keep their prompt_text. No change -> no new version.
export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('queries', id, 'Query');
  const cols = validateQuery(overlay(toQuery(current), asBody(await readJson(req)), QUERY_KEYS));
  await assertActiveProduct(db(), cols.product_id);
  const unchanged = cols.text === current.text && cols.product_id === current.product_id && cols.budget_inr === current.budget_inr
    && cols.city === current.city && cols.deadline_days === current.deadline_days;
  if (unchanged) return json(toQuery(current));
  const res = await db().rpc('settings_replace_query', {
    p_old_id: current.id, p_text: cols.text, p_product_id: cols.product_id,
    p_budget_inr: cols.budget_inr, p_city: cols.city, p_deadline_days: cols.deadline_days,
  });
  if (res.error) throw rpcError(res.error, 'settings_replace_query');
  await stamp(user.email);
  return json(toQuery(Array.isArray(res.data) ? res.data[0] : res.data));
});

// DELETE /api/settings/queries/:id -> { ok: true } (archives; old runs keep it)
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('queries', id, 'Query');
  must(await db().from('queries').update({ archived_at: nowIso() }).eq('id', current.id), 'queries');
  await stamp(user.email);
  return json({ ok: true });
});
