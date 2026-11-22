// Service-role Supabase client and small DB helpers for process-run.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected into edge functions automatically.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import type { Assistant, BrandRow, MarketplaceRow, QueryRow, ShopperLocation, TypedSource } from './types.ts';

export type { SupabaseClient };

let client: SupabaseClient | null = null;

export function serviceClient(): SupabaseClient {
  if (client) return client;
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Call a SQL function; throws on error. */
export async function rpc<T = unknown>(sb: SupabaseClient, fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw new Error(`rpc ${fn}: ${error.message}${error.details ? ` (${error.details})` : ''}`);
  return data as T;
}

/** A tasks row as claim_tasks() returns it. */
export interface TaskRow {
  id: string; run_id: string; query_id: string; assistant: Assistant; model: string; attempt: number;
  prompt_text: string; status: string; tries: number; locked_until: string | null; call_started_at: string | null;
}

export interface SettingsRow extends ShopperLocation {
  extractor_provider: string | null; extractor_model: string | null; fixes_model: string | null;
}

export async function loadSettings(sb: SupabaseClient): Promise<SettingsRow> {
  const { data, error } = await sb.from('settings')
    .select('city, region, country, timezone, lat, lng, extractor_provider, extractor_model, fixes_model')
    .eq('id', 1).maybeSingle();
  if (error) throw new Error(`settings: ${error.message}`);
  return (data as SettingsRow | null) ?? {
    city: 'Mumbai', region: 'Maharashtra', country: 'IN', timezone: 'Asia/Kolkata', lat: 19.076, lng: 72.8777,
    extractor_provider: null, extractor_model: null, fixes_model: null,
  };
}

export async function loadBrands(sb: SupabaseClient): Promise<BrandRow[]> {
  const { data, error } = await sb.from('brands').select('id, name, aliases, domains, is_primary').is('archived_at', null);
  if (error) throw new Error(`brands: ${error.message}`);
  return (data ?? []) as BrandRow[];
}

export async function loadMarketplaces(sb: SupabaseClient): Promise<MarketplaceRow[]> {
  const { data, error } = await sb.from('marketplaces').select('id, name, domains').is('archived_at', null);
  if (error) throw new Error(`marketplaces: ${error.message}`);
  return (data ?? []) as MarketplaceRow[];
}

export async function loadQuery(sb: SupabaseClient, id: string): Promise<QueryRow> {
  const { data, error } = await sb.from('queries')
    .select('id, code, text, product_id, budget_inr, city, deadline_days').eq('id', id).single();
  if (error) throw new Error(`query ${id}: ${error.message}`);
  return data as QueryRow;
}

export async function loadAnswerText(sb: SupabaseClient, taskId: string): Promise<string> {
  const { data, error } = await sb.from('answers').select('answer_text').eq('task_id', taskId).maybeSingle();
  if (error) throw new Error(`answer ${taskId}: ${error.message}`);
  if (!data) throw new Error(`answer ${taskId}: no saved answer`);
  return (data as { answer_text: string }).answer_text ?? '';
}

export async function loadTypedSources(sb: SupabaseClient, taskId: string): Promise<TypedSource[]> {
  const { data, error } = await sb.from('sources')
    .select('ord, url, title, domain, root_domain, source_type, brand_id, marketplace_id, cited')
    .eq('task_id', taskId).order('ord');
  if (error) throw new Error(`sources ${taskId}: ${error.message}`);
  return ((data ?? []) as TypedSource[]).map((s) => ({ ...s, title: s.title ?? '', domain: s.domain ?? '', root_domain: s.root_domain ?? '' }));
}

export async function markCallStarted(sb: SupabaseClient, taskId: string): Promise<void> {
  const { error } = await sb.from('tasks').update({ call_started_at: new Date().toISOString() }).eq('id', taskId);
  if (error) throw new Error(`call_started_at ${taskId}: ${error.message}`);
}

/** True when some task of an open run could be claimed now or soon (pending / answered, or an expired in-flight lease). */
export async function claimableWorkRemains(sb: SupabaseClient): Promise<boolean> {
  // Only tasks of open runs: claim_tasks skips the rest, and counting them would re-kick forever.
  const { count, error } = await sb.from('tasks').select('id, runs!inner(status)', { count: 'exact', head: true })
    .in('status', ['pending', 'answered']).in('runs.status', ['queued', 'processing']);
  if (error) throw new Error(`claimable: ${error.message}`);
  if ((count ?? 0) > 0) return true;
  const { count: stuck, error: e2 } = await sb.from('tasks').select('id, runs!inner(status)', { count: 'exact', head: true })
    .in('status', ['answering', 'extracting']).lt('locked_until', new Date().toISOString())
    .in('runs.status', ['queued', 'processing']);
  if (e2) throw new Error(`claimable: ${e2.message}`);
  return (stuck ?? 0) > 0;
}
