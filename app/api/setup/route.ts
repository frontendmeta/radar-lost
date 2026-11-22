import { HttpError, json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toAssistant, toBrand, toMarketplace, toProduct, toQuery } from '@/lib/mappers';
import { ASSISTANTS } from '@/lib/models';
import type { Assistant, Setup } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

export const GET = route(async () => {
  await requireUser();
  const s = db();
  const [brands, products, marketplaces, queries, assistants] = await Promise.all([
    s.from('brands').select('*').is('archived_at', null).order('created_at'),
    s.from('products').select('*').is('archived_at', null).order('code'),
    s.from('marketplaces').select('*').is('archived_at', null).order('name'),
    s.from('queries').select('*').is('archived_at', null).order('code'),
    s.from('assistants').select('*').eq('enabled', true),
  ]);
  const brandRows = (must(brands, 'brands') ?? []) as any[];
  const primary = brandRows.find((b) => b.is_primary);
  if (!primary) throw new HttpError(500, 'no_primary_brand', 'No active primary brand is set up');

  const setup: Setup = {
    brand: toBrand(primary),
    products: ((must(products, 'products') ?? []) as any[]).map(toProduct),
    competitors: brandRows.filter((b) => !b.is_primary).map(toBrand),
    marketplaces: ((must(marketplaces, 'marketplaces') ?? []) as any[]).map(toMarketplace),
    queries: ((must(queries, 'queries') ?? []) as any[]).map(toQuery),
    assistants: ((must(assistants, 'assistants') ?? []) as any[])
      .map(toAssistant)
      .sort((a, b) => ASSISTANTS.indexOf(a.id as Assistant) - ASSISTANTS.indexOf(b.id as Assistant)),
  };
  return json(setup);
});
