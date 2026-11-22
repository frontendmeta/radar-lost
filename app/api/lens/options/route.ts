import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { toAssistant, toBrand, toProduct, toQuery } from '@/lib/mappers';
import { ASSISTANTS } from '@/lib/models';
import { listRuns } from '@/lib/runs';
import type { Assistant, LensOptions } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Values for the lens dropdowns: every run (newest first; filter on trigger for manual-only), active brands
// (primary first), every assistant, active products and queries.
export const GET = route(async () => {
  await requireUser();
  const s = db();
  const [runs, brands, assistants, products, queries] = await Promise.all([
    listRuns(),
    s.from('brands').select('*').is('archived_at', null).order('is_primary', { ascending: false }).order('name'),
    s.from('assistants').select('*'),
    s.from('products').select('*').is('archived_at', null).order('code'),
    s.from('queries').select('*').is('archived_at', null).order('code'),
  ]);
  const body: LensOptions = {
    runs,
    brands: ((must(brands, 'brands') ?? []) as any[]).map(toBrand),
    assistants: ((must(assistants, 'assistants') ?? []) as any[])
      .map(toAssistant)
      .sort((a, b) => ASSISTANTS.indexOf(a.id as Assistant) - ASSISTANTS.indexOf(b.id as Assistant)),
    products: ((must(products, 'products') ?? []) as any[]).map(toProduct),
    queries: ((must(queries, 'queries') ?? []) as any[]).map(toQuery),
  };
  return json(body);
});
