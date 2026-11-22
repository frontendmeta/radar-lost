import 'server-only';
import type { SettingsBundle, Setup } from './api-types';
import { HttpError, notFound } from './http';
import { db, dbError, must } from './supabase';
import { toAssistant, toBrand, toMarketplace, toProduct, toQuery, toRunDefaults } from './mappers';
import { ASSISTANTS } from './models';
import { isUuid } from './settings-validate';

/* eslint-disable @typescript-eslint/no-explicit-any */
// Settings reads and write helpers shared by app/api/settings/**.

export type SetupTable = 'brands' | 'marketplaces' | 'products' | 'queries';

export const nowIso = () => new Date().toISOString();

/** Every settings write stamps settings.updated_at / updated_by_email. */
export async function stamp(email: string) {
  must(await db().from('settings').upsert({ id: 1, updated_at: nowIso(), updated_by_email: email }, { onConflict: 'id' }), 'settings stamp');
}

/** An active (non-archived) row by id, or 404 not_found. */
export async function activeRow(table: SetupTable, id: string, what: string): Promise<any> {
  if (!isUuid(id)) throw notFound('not_found', `${what} ${id} not found`);
  const row = must(await db().from(table).select('*').eq('id', id).is('archived_at', null).maybeSingle(), table);
  if (!row) throw notFound('not_found', `${what} ${id} not found or archived`);
  return row;
}

export async function primaryBrandRow(): Promise<any> {
  const row = must(await db().from('brands').select('*').eq('is_primary', true).is('archived_at', null).maybeSingle(), 'brands');
  if (!row) throw new HttpError(500, 'setup_missing', 'No active primary brand; run supabase/seed.sql');
  return row;
}

/** RPC errors: '<code>: <message>' -> 400 <code>; not_found -> 404. */
export function rpcError(err: { message: string; code?: string }, what: string): HttpError {
  const e = dbError(err, what);
  if (e.code === 'not_found') e.status = 404;
  return e;
}

const SETTINGS_DEFAULTS = {
  default_attempts: 3, city: 'Mumbai', region: 'Maharashtra', country: 'IN', timezone: 'Asia/Kolkata',
  lat: 19.076, lng: 72.8777, extractor_model: null, fixes_model: null, updated_at: null, updated_by_email: null,
};

export async function settingsRow(): Promise<any> {
  return must(await db().from('settings').select('*').eq('id', 1).maybeSingle(), 'settings') ?? SETTINGS_DEFAULTS;
}

/**
 * Active setup: primary brand, its active products, competitors (active non-primary brands),
 * active marketplaces and queries, and assistants (all, or enabled only for /api/setup).
 */
export async function loadSetup(opts: { enabledAssistantsOnly?: boolean } = {}): Promise<Setup> {
  const sb = db();
  const [brands, products, marketplaces, queries, assistants] = await Promise.all([
    sb.from('brands').select('*').is('archived_at', null).order('name'),
    sb.from('products').select('*').is('archived_at', null).order('code'),
    sb.from('marketplaces').select('*').is('archived_at', null).order('name'),
    sb.from('queries').select('*').is('archived_at', null).order('code'),
    sb.from('assistants').select('*'),
  ]);
  const brandRows = must(brands, 'brands') as any[];
  const primary = brandRows.find((b) => b.is_primary);
  if (!primary) throw new HttpError(500, 'setup_missing', 'No active primary brand; run supabase/seed.sql');
  const order = (id: string) => { const i = ASSISTANTS.indexOf(id as never); return i < 0 ? 99 : i; };
  const assistantRows = (must(assistants, 'assistants') as any[])
    .filter((a) => !opts.enabledAssistantsOnly || a.enabled)
    .sort((a, b) => order(a.id) - order(b.id));
  return {
    brand: toBrand(primary),
    products: (must(products, 'products') as any[]).filter((p) => p.brand_id === primary.id).map(toProduct),
    competitors: brandRows.filter((b) => !b.is_primary).map(toBrand),
    marketplaces: (must(marketplaces, 'marketplaces') as any[]).map(toMarketplace),
    queries: (must(queries, 'queries') as any[]).map(toQuery),
    assistants: assistantRows.map(toAssistant),
  };
}

export async function loadSettingsBundle(): Promise<SettingsBundle> {
  const [setup, s] = await Promise.all([loadSetup(), settingsRow()]);
  return { ...setup, runDefaults: toRunDefaults(s), updatedAt: s.updated_at ?? null, updatedByEmail: s.updated_by_email ?? null };
}

/** Next free query code: q01, q02, … counting archived rows too, so a code is never reused. */
export async function nextQueryCode(): Promise<string> {
  const rows = must(await db().from('queries').select('code'), 'queries') as any[];
  let max = 0;
  for (const r of rows) {
    const m = /^q(\d+)$/i.exec(r.code ?? '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `q${String(max + 1).padStart(2, '0')}`;
}
