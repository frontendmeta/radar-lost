import { json, readJson, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toMarketplace } from '@/lib/mappers';
import { MARKETPLACE_KEYS, asBody, assertDomainsFree, overlay, validateMarketplace } from '@/lib/settings-validate';
import { activeRow, nowIso, stamp } from '@/lib/settings';

type Ctx = { params: Promise<{ id: string }> };

// PATCH /api/settings/marketplaces/:id { name?, domains? } -> Marketplace
export const PATCH = route<Ctx>(async (req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('marketplaces', id, 'Marketplace');
  const cols = validateMarketplace(overlay(toMarketplace(current), asBody(await readJson(req)), MARKETPLACE_KEYS));
  await assertDomainsFree(db(), cols.domains, { marketplaceId: current.id });
  const row = must(await db().from('marketplaces').update(cols).eq('id', current.id).select('*').single(), 'marketplaces');
  await stamp(user.email);
  return json(toMarketplace(row));
});

// DELETE /api/settings/marketplaces/:id -> { ok: true } (archives)
export const DELETE = route<Ctx>(async (_req, ctx) => {
  const user = await requireUser();
  const { id } = await ctx.params;
  const current = await activeRow('marketplaces', id, 'Marketplace');
  must(await db().from('marketplaces').update({ archived_at: nowIso() }).eq('id', current.id), 'marketplaces');
  await stamp(user.email);
  return json({ ok: true });
});
