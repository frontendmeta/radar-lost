import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toProduct } from '@/lib/mappers';
import { asBody, assertProductCodeFree, validateProduct } from '@/lib/settings-validate';
import { primaryBrandRow, stamp } from '@/lib/settings';

// POST /api/settings/products { code, name, url, priceInr, mrpInr?, sizes, fabric, style, deliveryDays?, deliveryIsSample } -> Product
// Products belong to the primary brand.
export const POST = route(async (req) => {
  const user = await requireUser();
  const cols = validateProduct(asBody(await readJson(req)));
  await assertProductCodeFree(db(), cols.code);
  const brand = await primaryBrandRow();
  const row = must(await db().from('products').insert({ ...cols, brand_id: brand.id }).select('*').single(), 'products');
  await stamp(user.email);
  return json(toProduct(row), 201);
});
