import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toBrand } from '@/lib/mappers';
import { asBody, assertAliasesFree, assertDomainsFree, validateBrand } from '@/lib/settings-validate';
import { nowIso, stamp } from '@/lib/settings';

// POST /api/settings/competitors { name, aliases, domains } -> Brand
export const POST = route(async (req) => {
  const user = await requireUser();
  const cols = validateBrand(asBody(await readJson(req)));
  await assertAliasesFree(db(), cols.aliases);
  await assertDomainsFree(db(), cols.domains);
  const row = must(await db().from('brands').insert({ ...cols, is_primary: false, updated_at: nowIso() }).select('*').single(), 'brands');
  await stamp(user.email);
  return json(toBrand(row), 201);
});
