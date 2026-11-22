import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toProduct } from '@/lib/mappers';
import { PRODUCT_KEYS, asBody, assertProductCodeFree, assertProductUnused, overlay, validateProduct } from '@/lib/settings-validate';
import { activeRow, nowIso, stamp } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/settings/products/:id (any subset of the POST body) -> Product
export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('products', id, 'Product');
  const cols = validateProduct(overlay(toProduct(current), asBody(await readJson(req)), PRODUCT_KEYS));
  if (cols.code !== current.code) await assertProductCodeFree(db(), cols.code, current.id);
  const row = must(await db().from('products').update(cols).eq('id', current.id).select('*').single(), 'products');
  await stamp(user.email);
  return json(toProduct(row));
});

// DELETE /api/settings/products/:id -> { ok: true } (archives; refused while active queries use it)
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('products', id, 'Product');
  await assertProductUnused(db(), current.id);
  must(await db().from('products').update({ archived_at: nowIso() }).eq('id', current.id), 'products');
  await stamp(user.email);
  return json({ ok: true });
});
