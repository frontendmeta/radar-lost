// HTTP helpers for every provider call: hard timeout, no redirects followed,
// Retry-After parsing, HTTP status -> ProviderError. Keys go in headers only and
// are never logged; every error message passes through scrub() (ProviderError does it).
import { classifyStatus, ProviderError } from './errors.ts';

/** A retryable timeout. `capped` = the budget was cut short by the invocation's wall clock. */
export class TimeoutError extends ProviderError {
  constructor(label: string, public timeoutMs: number, public capped = false) {
    super('retryable', `${label}: timeout after ${Math.round(timeoutMs / 1000)}s`);
  }
}

export interface ProviderFetchOpts {
  /** Hard timeout for this request. */
  timeoutMs: number;
  /** Set when timeoutMs was shortened to fit the invocation's wall clock. */
  capped?: boolean;
  /** Env var holding the key (named in config errors), e.g. OPENAI_API_KEY. */
  keyEnv?: string;
  /** Env var holding the model (named in config errors), e.g. OPENAI_MODEL. */
  modelEnv?: string;
}

/** Seconds to wait from Retry-After / retry-after-ms headers, or null. */
export function parseRetryAfter(h: Headers): number | null {
  const ms = h.get('retry-after-ms');
  if (ms && /^\d+(\.\d+)?$/.test(ms.trim())) return Math.max(1, Math.ceil(Number(ms) / 1000));
  const v = h.get('retry-after');
  if (!v) return null;
  if (/^\d+(\.\d+)?$/.test(v.trim())) return Math.max(1, Math.ceil(Number(v)));
  const at = Date.parse(v);
  if (!Number.isNaN(at)) return Math.max(1, Math.ceil((at - Date.now()) / 1000));
  return null;
}

function errorText(body: string): string {
  try {
    const j = JSON.parse(body);
    const e = j?.error ?? j;
    const msg = typeof e === 'string' ? e : (e?.message ?? e?.error?.message ?? '');
    const code = typeof e === 'object' ? (e?.type ?? e?.code ?? e?.status ?? '') : '';
    const s = [code, msg].filter(Boolean).join(': ');
    if (s) return s;
  } catch { /* not JSON */ }
  return body.slice(0, 500);
}

function configHint(status: number, opts: ProviderFetchOpts): string {
  const { keyEnv, modelEnv } = opts;
  if (!keyEnv && !modelEnv) return '';
  if ((status === 401 || status === 403) && keyEnv) return ` (check the key saved in Settings or ${keyEnv})`;
  if (status === 404 && modelEnv) return ` (check ${modelEnv} or the model set in Settings)`;
  return ` (check ${[keyEnv, modelEnv].filter(Boolean).join(' / ')})`;
}

/**
 * fetch() with a hard timeout and redirect: 'manual'. Returns the Response only when it is 2xx;
 * otherwise throws ProviderError classified by status (retryable / config / unknown).
 * Network errors and timeouts are retryable.
 */
export async function providerFetch(label: string, url: string, init: RequestInit, opts: ProviderFetchOpts): Promise<Response> {
  const timeoutMs = Math.max(1000, opts.timeoutMs);
  let res: Response;
  try {
    res = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const name = (e as Error)?.name;
    if (name === 'TimeoutError' || name === 'AbortError') throw new TimeoutError(label, timeoutMs, !!opts.capped);
    throw new ProviderError('retryable', `${label}: network error: ${(e as Error)?.message ?? String(e)}`);
  }
  if (res.ok) return res;
  let body = '';
  try { body = await res.text(); } catch { /* ignore */ }
  const cls = classifyStatus(res.status);
  const retryAfter = cls === 'retryable' ? parseRetryAfter(res.headers) : null;
  const hint = cls === 'config' ? configHint(res.status, opts) : '';
  throw new ProviderError(cls, `${label} HTTP ${res.status}: ${errorText(body)}${hint}`, retryAfter, res.status);
}

/** POST JSON and parse the JSON reply, with providerFetch's rules. */
export async function postJson<T = unknown>(
  label: string, url: string, headers: Record<string, string>, body: unknown, opts: ProviderFetchOpts,
): Promise<T> {
  const res = await providerFetch(label, url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }, opts);
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError('unknown', `${label}: response is not JSON: ${text.slice(0, 300)}`);
  }
}

/**
 * Read one redirect's Location header without following it (Gemini's vertexaisearch links).
 * Returns the absolute target URL, or null on any failure.
 */
export async function resolveRedirect(url: string, timeoutMs = 4000): Promise<string | null> {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
    try { await res.body?.cancel(); } catch { /* ignore */ }
    if (res.status < 300 || res.status >= 400) return null;
    const loc = res.headers.get('location');
    if (!loc) return null;
    const abs = new URL(loc, url).toString();
    return /^https?:\/\//i.test(abs) ? abs : null;
  } catch {
    return null;
  }
}

/** Throw the standard config error for a missing key. */
export function requireKey(apiKey: string | undefined | null, keyEnv: string): string {
  if (!apiKey) throw new ProviderError('config', `${keyEnv} is not set`);
  return apiKey;
}

/** Budget left until `deadline` (epoch ms), capped at `max`. */
export function budget(deadline: number, max: number): { timeoutMs: number; capped: boolean } {
  const left = deadline - Date.now();
  return left < max ? { timeoutMs: Math.max(1000, left), capped: true } : { timeoutMs: max, capped: false };
}
