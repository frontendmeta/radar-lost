import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toMarketplace } from '@/lib/mappers';
import { asBody, assertDomainsFree, validateMarketplace } from '@/lib/settings-validate';
import { stamp } from '@/lib/settings';

// POST /api/settings/marketplaces { name, domains } -> Marketplace
export const POST = route(async (req) => {
  const user = await requireUser();
  const cols = validateMarketplace(asBody(await readJson(req)));
  await assertDomainsFree(db(), cols.domains);
  const row = must(await db().from('marketplaces').insert(cols).select('*').single(), 'marketplaces');
  await stamp(user.email);
  return json(toMarketplace(row), 201);
});
