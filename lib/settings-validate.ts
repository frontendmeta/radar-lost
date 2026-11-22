// Settings validation (backend.md → "Settings validation").
// Every refusal is a 400 { error: { code, message, field } }; wrong types or missing required
// fields are bad_request. Pure functions first, then the DB conflict checks, which take the
// Supabase client as an argument so this file has no server-only imports and stays testable.
import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError, badRequest } from './http';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Obj = Record<string, unknown>;

export const LIMITS = {
  aliasMin: 4,
  queryTextMin: 10, queryTextMax: 500,
  budgetMin: 100, budgetMax: 100_000,
  deadlineMin: 0, deadlineMax: 14,
  attemptsMin: 1, attemptsMax: 5,
} as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);

// ---------------------------------------------------------------------------------------------
// Body helpers

/** The request body must be a JSON object. */
export function asBody(v: unknown): Obj {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw badRequest('bad_request', 'Body must be a JSON object');
  return v as Obj;
}

/** PATCH = current values overlaid with the body's keys (undefined keeps the current value). */
export function overlay(current: object, body: Obj, keys: readonly string[]): Obj {
  const out: Obj = {};
  for (const k of keys) out[k] = body[k] !== undefined ? body[k] : (current as Obj)[k];
  return out;
}

const tidy = (s: string) => s.trim().replace(/\s+/g, ' ');

function str(o: Obj, k: string, opts: { max?: number; allowEmpty?: boolean; dflt?: string } = {}): string {
  let v = o[k];
  if (v === undefined || v === null) {
    if (opts.dflt !== undefined) return opts.dflt;
    throw badRequest('bad_request', `${k} is required`, k);
  }
  if (typeof v !== 'string') throw badRequest('bad_request', `${k} must be a string`, k);
  v = v.trim();
  if (!v && !opts.allowEmpty) throw badRequest('bad_request', `${k} is required`, k);
  if (opts.max && (v as string).length > opts.max) throw badRequest('bad_request', `${k} must be at most ${opts.max} characters`, k);
  return v as string;
}

/** A number (type checked as bad_request); range/integer checks are the caller's. */
function num(o: Obj, k: string): number {
  const v = o[k];
  if (v === undefined || v === null) throw badRequest('bad_request', `${k} is required`, k);
  if (typeof v !== 'number' || !Number.isFinite(v)) throw badRequest('bad_request', `${k} must be a number`, k);
  return v;
}

function int(o: Obj, k: string, min: number, max: number): number {
  const v = num(o, k);
  if (!Number.isInteger(v) || v < min || v > max) throw badRequest('bad_request', `${k} must be a whole number from ${min} to ${max}`, k);
  return v;
}

function optInt(o: Obj, k: string, min: number, max: number): number | null {
  return o[k] === undefined || o[k] === null ? null : int(o, k, min, max);
}

function bool(o: Obj, k: string, dflt?: boolean): boolean {
  const v = o[k];
  if ((v === undefined || v === null) && dflt !== undefined) return dflt;
  if (typeof v !== 'boolean') throw badRequest('bad_request', `${k} must be true or false`, k);
  return v;
}

function strList(o: Obj, k: string, opts: { maxItems?: number; maxLen?: number } = {}): string[] {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw badRequest('bad_request', `${k} must be an array of strings`, k);
  const out = [...new Set((v as string[]).map(tidy).filter(Boolean))];
  if (opts.maxItems && out.length > opts.maxItems) throw badRequest('bad_request', `${k} can have at most ${opts.maxItems} items`, k);
  if (opts.maxLen && out.some((x) => x.length > opts.maxLen!)) throw badRequest('bad_request', `Each of ${k} must be at most ${opts.maxLen} characters`, k);
  return out;
}

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,99}$/;
/** Model id or null (null / '' = env default). */
function model(o: Obj, k: string): string | null {
  const v = o[k];
  if (v === null) return null;
  if (typeof v !== 'string') throw badRequest('bad_request', `${k} must be a model id string or null`, k);
  const s = v.trim();
  if (!s) return null;
  if (!MODEL_RE.test(s)) throw badRequest('bad_request', `${k} "${s}" is not a valid model id`, k);
  return s;
}

// ---------------------------------------------------------------------------------------------
// Aliases

/** Compare form: case, spacing and accents ignored ("Jaipur Kurti" = "jaipurkurti"). */
export function normalizeAlias(s: string): string {
  return s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, '');
}

/** brand_needs_alias (none) and alias_too_short (< 4 characters, spaces not counted). */
export function validateAliases(v: unknown): string[] {
  if (v !== undefined && v !== null && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) {
    throw badRequest('bad_request', 'aliases must be an array of strings', 'aliases');
  }
  const aliases = [...new Set(((v as string[] | null | undefined) ?? []).map(tidy).filter(Boolean))];
  if (!aliases.length) throw badRequest('brand_needs_alias', 'A brand needs at least one alias', 'aliases');
  if (aliases.length > 20) throw badRequest('bad_request', 'A brand can have at most 20 aliases', 'aliases');
  for (const a of aliases) {
    if ([...normalizeAlias(a)].length < LIMITS.aliasMin) {
      throw badRequest('alias_too_short', `Alias "${a}" is too short: every alias needs at least ${LIMITS.aliasMin} characters`, 'aliases');
    }
    if (a.length > 100) throw badRequest('bad_request', `Alias "${a.slice(0, 20)}…" is longer than 100 characters`, 'aliases');
  }
  return aliases;
}

// ---------------------------------------------------------------------------------------------
// Domains

const HOST_RE = /^(?=.{3,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/;
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\/|^\/\//;

/** What the user probably meant: "https://www.Libas.in/kurtas" -> "libas.in". */
function suggestHost(d: string): string {
  return d.replace(SCHEME_RE, '').split(/[/?#]/)[0].replace(/:\d*$/, '').replace(/^www\./, '');
}

/**
 * bad_domain: a lowercase host name with no scheme, path, port or "www.".
 * Obvious noise (surrounding spaces, upper case) is normalised; anything else is refused,
 * with the corrected form in the message when there is one.
 */
export function normalizeDomain(raw: string): string {
  const d = raw.trim().toLowerCase();
  if (!d) throw badRequest('bad_domain', 'A domain cannot be empty', 'domains');
  const s = suggestHost(d);
  const hint = s !== d && HOST_RE.test(s) ? `; use "${s}"` : '';
  const fail = (why: string) => badRequest('bad_domain', `"${raw.trim()}" ${why}${hint}`, 'domains');
  if (SCHEME_RE.test(d)) throw fail('has a scheme: enter the host name only');
  if (/[/?#]/.test(d)) throw fail('has a path: enter the host name only');
  if (/:\d*$/.test(d)) throw fail('has a port: enter the host name only');
  if (d.startsWith('www.')) throw fail('starts with "www."');
  if (!HOST_RE.test(d)) throw fail('is not a host name like "libas.in"');
  return d;
}

export function validateDomains(v: unknown, opts: { min?: number; what?: string } = {}): string[] {
  if (v !== undefined && v !== null && (!Array.isArray(v) || v.some((x) => typeof x !== 'string'))) {
    throw badRequest('bad_request', 'domains must be an array of strings', 'domains');
  }
  const domains = [...new Set(((v as string[] | null | undefined) ?? []).map(normalizeDomain))];
  if (domains.length < (opts.min ?? 0)) throw badRequest('bad_domain', `A ${opts.what ?? 'record'} needs at least one domain`, 'domains');
  if (domains.length > 20) throw badRequest('bad_request', 'At most 20 domains', 'domains');
  return domains;
}

// ---------------------------------------------------------------------------------------------
// Entities. Each validator returns the snake_case columns to write.

export const BRAND_KEYS = ['name', 'aliases', 'domains'] as const;
export interface BrandCols { name: string; aliases: string[]; domains: string[] }
export function validateBrand(body: Obj): BrandCols {
  return { name: str(body, 'name', { max: 100 }), aliases: validateAliases(body.aliases), domains: validateDomains(body.domains, { what: 'brand' }) };
}

export const MARKETPLACE_KEYS = ['name', 'domains'] as const;
export interface MarketplaceCols { name: string; domains: string[] }
export function validateMarketplace(body: Obj): MarketplaceCols {
  return { name: str(body, 'name', { max: 100 }), domains: validateDomains(body.domains, { min: 1, what: 'marketplace' }) };
}

export const PRODUCT_KEYS = ['code', 'name', 'url', 'priceInr', 'mrpInr', 'sizes', 'fabric', 'style', 'deliveryDays', 'deliveryIsSample'] as const;
export interface ProductCols {
  code: string; name: string; url: string; price_inr: number; mrp_inr: number | null; sizes: string[];
  fabric: string; style: string; delivery_days: number | null; delivery_is_sample: boolean;
}
export function validateProduct(body: Obj): ProductCols {
  const code = str(body, 'code', { max: 20 });
  if (!/^[A-Za-z0-9_-]+$/.test(code)) throw badRequest('bad_request', 'code may use letters, digits, "-" and "_" only', 'code');
  const url = str(body, 'url', { max: 2000 });
  let ok = false;
  try { ok = ['http:', 'https:'].includes(new URL(url).protocol); } catch { /* not a URL */ }
  if (!ok) throw badRequest('bad_request', 'url must be a full http(s) URL', 'url');
  return {
    code,
    name: str(body, 'name', { max: 200 }),
    url,
    price_inr: int(body, 'priceInr', 1, 10_000_000),
    mrp_inr: optInt(body, 'mrpInr', 1, 10_000_000),
    sizes: strList(body, 'sizes', { maxItems: 30, maxLen: 20 }),
    fabric: str(body, 'fabric', { max: 100, allowEmpty: true, dflt: '' }),
    style: str(body, 'style', { max: 100, allowEmpty: true, dflt: '' }),
    delivery_days: optInt(body, 'deliveryDays', 0, 60),
    delivery_is_sample: bool(body, 'deliveryIsSample', true),
  };
}

export const QUERY_KEYS = ['text', 'productId', 'budgetInr', 'city', 'deadlineDays'] as const;
export interface QueryCols { text: string; product_id: string; budget_inr: number; city: string; deadline_days: number }
/** bad_query for out-of-range values; the "active product" half is assertActiveProduct(). */
export function validateQuery(body: Obj): QueryCols {
  const text = str(body, 'text', { allowEmpty: true });
  const n = [...text].length;
  if (n < LIMITS.queryTextMin || n > LIMITS.queryTextMax) {
    throw badRequest('bad_query', `Query text must be ${LIMITS.queryTextMin}–${LIMITS.queryTextMax} characters (got ${n})`, 'text');
  }
  if (body.productId === undefined || body.productId === null) throw badRequest('bad_request', 'productId is required', 'productId');
  if (typeof body.productId !== 'string') throw badRequest('bad_request', 'productId must be a string', 'productId');
  if (!isUuid(body.productId)) throw badRequest('bad_query', 'productId must be an active product', 'productId');
  const budget = num(body, 'budgetInr');
  if (!Number.isInteger(budget) || budget < LIMITS.budgetMin || budget > LIMITS.budgetMax) {
    throw badRequest('bad_query', `Budget must be whole rupees from ₹${LIMITS.budgetMin} to ₹1,00,000`, 'budgetInr');
  }
  const deadline = num(body, 'deadlineDays');
  if (!Number.isInteger(deadline) || deadline < LIMITS.deadlineMin || deadline > LIMITS.deadlineMax) {
    throw badRequest('bad_query', `Deadline must be ${LIMITS.deadlineMin}–${LIMITS.deadlineMax} whole days`, 'deadlineDays');
  }
  return { text, product_id: body.productId.toLowerCase(), budget_inr: budget, city: str(body, 'city', { max: 100 }), deadline_days: deadline };
}

/** PATCH /api/settings/run-defaults: only the keys present are validated and returned. */
export function validateRunDefaults(body: Obj): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (body.attempts !== undefined) {
    const a = num(body, 'attempts');
    if (!Number.isInteger(a) || a < LIMITS.attemptsMin || a > LIMITS.attemptsMax) {
      throw badRequest('bad_attempts', `Attempts must be a whole number from ${LIMITS.attemptsMin} to ${LIMITS.attemptsMax}`, 'attempts');
    }
    p.default_attempts = a;
  }
  if (body.city !== undefined) p.city = str(body, 'city', { max: 100 });
  if (body.region !== undefined) p.region = str(body, 'region', { max: 100 });
  if (body.country !== undefined) {
    const c = str(body, 'country').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) throw badRequest('bad_request', 'country must be a 2-letter ISO code like "IN"', 'country');
    p.country = c;
  }
  if (body.timezone !== undefined) {
    const tz = str(body, 'timezone', { max: 64 });
    try { new Intl.DateTimeFormat('en', { timeZone: tz }); } catch {
      throw badRequest('bad_request', `"${tz}" is not an IANA time zone like "Asia/Kolkata"`, 'timezone');
    }
    p.timezone = tz;
  }
  if (body.lat !== undefined) {
    const v = num(body, 'lat');
    if (v < -90 || v > 90) throw badRequest('bad_request', 'lat must be between -90 and 90', 'lat');
    p.lat = v;
  }
  if (body.lng !== undefined) {
    const v = num(body, 'lng');
    if (v < -180 || v > 180) throw badRequest('bad_request', 'lng must be between -180 and 180', 'lng');
    p.lng = v;
  }
  if (body.extractorModel !== undefined) p.extractor_model = model(body, 'extractorModel');
  if (body.fixesModel !== undefined) p.fixes_model = model(body, 'fixesModel');
  return p;
}

const KEY_ENV: Record<string, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };

/** PATCH /api/settings/assistants/:id. key_missing: turning one on while key_present is false. */
export function validateAssistantPatch(body: Obj, current: { id: string; label: string; enabled: boolean; key_present: boolean }): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (body.enabled !== undefined) {
    const on = bool(body, 'enabled');
    if (on && !current.enabled && !current.key_present) {
      throw badRequest('key_missing', `${current.label} can't be enabled: no API key is set (${KEY_ENV[current.id] ?? 'its key'}). The processor reports keys on its next run.`, 'enabled');
    }
    p.enabled = on;
  }
  if (body.model !== undefined) p.model = model(body, 'model');
  return p;
}

// ---------------------------------------------------------------------------------------------
// DB checks (active rows only; archived rows free their aliases, domains and codes)

function dbFail(what: string, err: { message: string }): HttpError {
  return new HttpError(500, 'db_error', `${what}: ${err.message}`);
}

/** alias_conflict: an alias belongs to one active brand only, ignoring case and spacing. */
export async function assertAliasesFree(sb: SupabaseClient, aliases: string[], excludeBrandId?: string) {
  const { data, error } = await sb.from('brands').select('id, name, aliases').is('archived_at', null);
  if (error) throw dbFail('brands', error);
  const owner = new Map<string, { name: string; alias: string }>();
  for (const b of (data ?? []) as any[]) {
    if (b.id === excludeBrandId) continue;
    for (const a of (b.aliases ?? []) as string[]) owner.set(normalizeAlias(a), { name: b.name, alias: a });
  }
  for (const a of aliases) {
    const hit = owner.get(normalizeAlias(a));
    if (hit) throw badRequest('alias_conflict', `Alias "${a}" is already used by ${hit.name} (as "${hit.alias}")`, 'aliases');
  }
}

/** domain_conflict: a domain belongs to one active brand or marketplace only. */
export async function assertDomainsFree(sb: SupabaseClient, domains: string[], exclude: { brandId?: string; marketplaceId?: string } = {}) {
  if (!domains.length) return;
  const [b, m] = await Promise.all([
    sb.from('brands').select('id, name, domains').is('archived_at', null),
    sb.from('marketplaces').select('id, name, domains').is('archived_at', null),
  ]);
  if (b.error) throw dbFail('brands', b.error);
  if (m.error) throw dbFail('marketplaces', m.error);
  const owner = new Map<string, string>();
  for (const r of (b.data ?? []) as any[]) if (r.id !== exclude.brandId) for (const d of r.domains ?? []) owner.set(String(d).toLowerCase(), `brand ${r.name}`);
  for (const r of (m.data ?? []) as any[]) if (r.id !== exclude.marketplaceId) for (const d of r.domains ?? []) owner.set(String(d).toLowerCase(), `marketplace ${r.name}`);
  for (const d of domains) {
    const hit = owner.get(d);
    if (hit) throw badRequest('domain_conflict', `Domain ${d} already belongs to ${hit}`, 'domains');
  }
}

/** bad_query: the query's product must be an active product. */
export async function assertActiveProduct(sb: SupabaseClient, productId: string) {
  const { data, error } = await sb.from('products').select('id').eq('id', productId).is('archived_at', null).maybeSingle();
  if (error) throw dbFail('products', error);
  if (!data) throw badRequest('bad_query', 'productId must be an active product', 'productId');
}

/** Product codes are unique among active products (products_code_active). */
export async function assertProductCodeFree(sb: SupabaseClient, code: string, excludeId?: string) {
  const { data, error } = await sb.from('products').select('id, name, code').is('archived_at', null);
  if (error) throw dbFail('products', error);
  const hit = ((data ?? []) as any[]).find((r) => r.id !== excludeId && String(r.code).toLowerCase() === code.toLowerCase());
  if (hit) throw badRequest('code_conflict', `Code ${code} is already used by ${hit.name}`, 'code');
}

/** product_in_use: a product with active queries can't be archived. */
export async function assertProductUnused(sb: SupabaseClient, productId: string) {
  const { data, error } = await sb.from('queries').select('code').eq('product_id', productId).is('archived_at', null);
  if (error) throw dbFail('queries', error);
  const codes = ((data ?? []) as any[]).map((r) => r.code);
  if (codes.length) throw badRequest('product_in_use', `Archive or move its active queries first (${codes.join(', ')})`, 'id');
}
