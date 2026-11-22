import { badRequest, json, notFound, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toBrand } from '@/lib/mappers';
import { BRAND_KEYS, asBody, assertAliasesFree, assertDomainsFree, overlay, validateBrand } from '@/lib/settings-validate';
import { activeRow, nowIso, stamp } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/settings/competitors/:id { name?, aliases?, domains? } -> Brand
export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('brands', id, 'Competitor');
  if (current.is_primary) throw notFound('not_found', 'That is the primary brand: edit it with PUT /api/settings/brand');
  const cols = validateBrand(overlay(toBrand(current), asBody(await readJson(req)), BRAND_KEYS));
  await assertAliasesFree(db(), cols.aliases, current.id);
  await assertDomainsFree(db(), cols.domains, { brandId: current.id });
  const row = must(await db().from('brands').update({ ...cols, updated_at: nowIso() }).eq('id', current.id).select('*').single(), 'brands');
  await stamp(user.email);
  return json(toBrand(row));
});

// DELETE /api/settings/competitors/:id -> { ok: true } (archives; past runs keep its name and numbers)
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('brands', id, 'Competitor');
  if (current.is_primary) throw badRequest('primary_locked', "The primary brand can't be archived", 'id');
  const now = nowIso();
  must(await db().from('brands').update({ archived_at: now, updated_at: now }).eq('id', current.id), 'brands');
  await stamp(user.email);
  return json({ ok: true });
});
