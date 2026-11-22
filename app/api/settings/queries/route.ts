import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toQuery } from '@/lib/mappers';
import { asBody, assertActiveProduct, validateQuery } from '@/lib/settings-validate';
import { nextQueryCode, stamp } from '@/lib/settings';

// POST /api/settings/queries { text, productId, budgetInr, city, deadlineDays } -> Query
// The code (q11, q12, …) is assigned here.
export const POST = route(async (req) => {
  const user = await requireUser();
  const cols = validateQuery(asBody(await readJson(req)));
  await assertActiveProduct(db(), cols.product_id);
  for (let attempt = 0; ; attempt++) {
    const res = await db().from('queries').insert({ ...cols, code: await nextQueryCode() }).select('*').single();
    // Two creates racing for the same code: take the next one.
    if (res.error?.code === '23505' && attempt < 3) continue;
    const row = must(res, 'queries');
    await stamp(user.email);
    return json(toQuery(row), 201);
  }
});
