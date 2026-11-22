import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toBrand } from '@/lib/mappers';
import { BRAND_KEYS, asBody, assertAliasesFree, assertDomainsFree, overlay, validateBrand } from '@/lib/settings-validate';
import { nowIso, primaryBrandRow, stamp } from '@/lib/settings';

// PUT /api/settings/brand { name, aliases, domains } -> Brand (the primary brand; omitted keys keep their value)
export const PUT = route(async (req) => {
  const user = await requireUser();
  const current = await primaryBrandRow();
  const cols = validateBrand(overlay(toBrand(current), asBody(await readJson(req)), BRAND_KEYS));
  await assertAliasesFree(db(), cols.aliases, current.id);
  await assertDomainsFree(db(), cols.domains, { brandId: current.id });
  const row = must(await db().from('brands').update({ ...cols, updated_at: nowIso() }).eq('id', current.id).select('*').single(), 'brands');
  await stamp(user.email);
  return json(toBrand(row));
});
