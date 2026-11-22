// Browser-side API client for Lost Sale Radar.
// Typed wrappers for every route in the API contract (lib/api-types.ts).
// Errors throw ApiError; a 401 sends the browser to /login.
// Mocks: served when NEXT_PUBLIC_USE_MOCKS=true, when the URL has ?mock=1
// (sticky for the tab), or — in development only — when a route is missing
// (HTML 404) or 500s, so screens render before the backend lands.

import type {
  RunTask,
  Assistant,
  AssistantInfo,
  Brand,
  ByAssistant,
  Fix,
  Health,
  LensOptions,
  LossReasonRow,
  LostSale,
  Marketplace,
  Me,
  Product,
  ProviderKeyInfo,
  Query,
  QueryRow,
  RunDefaults,
  RunListItem,
  RunState,
  RunStatus,
  SaveKeyResult,
  SettingsBundle,
  Setup,
  SourcesBreakdown,
  Summary,
  Trace,
  Win,
} from '@/lib/api-types';
import { MockError, mockResponse } from './mocks';

// ---------- errors ----------

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly field?: string;
  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

// ---------- the lens ----------

export interface Lens {
  /** a run id, or 'latest' (default) */
  run?: string;
  /** a brand id; default = primary brand */
  focus?: string;
  assistants?: Assistant[];
  products?: string[];
  queries?: string[];
  /** 'previous', a run id, or 'none' */
  compare?: string;
}

export function lensToSearch(lens: Lens | undefined, extra?: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  if (lens) {
    if (lens.run && lens.run !== 'latest') p.set('run', lens.run);
    if (lens.focus) p.set('focus', lens.focus);
    if (lens.assistants?.length) p.set('assistants', lens.assistants.join(','));
    if (lens.products?.length) p.set('products', lens.products.join(','));
    if (lens.queries?.length) p.set('queries', lens.queries.join(','));
    if (lens.compare) p.set('compare', lens.compare);
  }
  if (extra) for (const [k, v] of Object.entries(extra)) if (v !== undefined && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}

// ---------- mock mode ----------

const MOCK_KEY = 'lsr:mock';
const envMocks = process.env.NEXT_PUBLIC_USE_MOCKS === 'true';
const isDev = process.env.NODE_ENV !== 'production';

export function mocksForced(): boolean {
  if (envMocks) return true;
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('mock');
    if (q === '1') window.sessionStorage.setItem(MOCK_KEY, '1');
    if (q === '0') window.sessionStorage.removeItem(MOCK_KEY);
    return window.sessionStorage.getItem(MOCK_KEY) === '1';
  } catch {
    return false;
  }
}

// Tiny store so the UI can show "sample data" when anything came from mocks.
let mockHits = 0;
const mockListeners = new Set<() => void>();
function noteMock(path: string, why: string) {
  mockHits += 1;
  if (isDev) console.info(`[api] mock for ${path} (${why})`);
  mockListeners.forEach((l) => l());
}
export const mockStore = {
  subscribe(l: () => void) {
    mockListeners.add(l);
    return () => mockListeners.delete(l);
  },
  getSnapshot: () => mockHits,
  getServerSnapshot: () => 0,
};

// ---------- core request ----------

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

function redirectToLogin() {
  if (typeof window === 'undefined') return;
  if (window.location.pathname.startsWith('/login')) return;
  const next = encodeURIComponent(window.location.pathname + window.location.search);
  // Full reload on purpose: the login page owns the auth handshake.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(`${window.location.origin}/login?next=${next}`);
}

async function serveMock<T>(method: Method, path: string, body: unknown, why: string): Promise<T> {
  const res = mockResponse(method, path, body);
  if (res === undefined) throw new ApiError(404, 'not_found', `No mock for ${method} ${path}`);
  noteMock(path, why);
  await new Promise((r) => setTimeout(r, 150 + Math.random() * 200));
  if (res instanceof MockError) throw new ApiError(res.status, res.code, res.message, res.field);
  return res as T;
}

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  if (mocksForced()) return serveMock<T>(method, path, body, 'mock mode');

  let res: Response;
  try {
    res = await fetch(path, {
      method,
      headers: body !== undefined ? { 'content-type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: 'no-store',
      credentials: 'same-origin',
    });
  } catch (e) {
    if (isDev) return serveMock<T>(method, path, body, 'network error');
    throw new ApiError(0, 'network', e instanceof Error ? e.message : 'Network error');
  }

  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');

  if (res.ok) {
    if (res.status === 204 || !isJson) return { ok: true } as T;
    return (await res.json()) as T;
  }

  if (res.status === 401) {
    redirectToLogin();
    throw new ApiError(401, 'unauthenticated', 'Please sign in');
  }

  // Route not built yet (Next's HTML 404) or a server error: use mocks in dev.
  if (isDev && ((res.status === 404 && !isJson) || res.status >= 500)) {
    return serveMock<T>(method, path, body, `HTTP ${res.status}`);
  }

  let code = `http_${res.status}`;
  let message = res.statusText || 'Request failed';
  let field: string | undefined;
  if (isJson) {
    try {
      const j = (await res.json()) as { error?: { code?: string; message?: string; field?: string } };
      if (j?.error) {
        code = j.error.code ?? code;
        message = j.error.message ?? message;
        field = j.error.field;
      }
    } catch {
      /* keep defaults */
    }
  }
  throw new ApiError(res.status, code, message, field);
}

const get = <T>(path: string) => request<T>('GET', path);
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {});
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body);
const patch = <T>(path: string, body: unknown) => request<T>('PATCH', path, body);
const del = <T>(path: string) => request<T>('DELETE', path);
const enc = encodeURIComponent;

type Ok = { ok: true };

// ---------- runs & setup ----------

export interface CreateRunBody {
  assistants?: Assistant[];
  attempts?: number;
  queryIds?: string[];
  label?: string;
  trigger?: 'manual' | 'live';
}

export const api = {
  me: () => get<Me>('/api/me'),
  setup: () => get<Setup>('/api/setup'),
  health: () => get<Health>('/api/health'),

  runs: (filter?: { status?: RunState; trigger?: 'manual' | 'live' }) =>
    get<RunListItem[]>(`/api/runs${lensToSearch(undefined, filter)}`),
  latestRun: () => get<RunStatus>('/api/runs/latest'),
  run: (id: string) => get<RunStatus>(`/api/runs/${enc(id)}`),
  runTasks: (id: string) => get<RunTask[]>(`/api/runs/${enc(id)}/tasks`),
  createRun: (body: CreateRunBody) => post<{ runId: string }>('/api/runs', body),
  kickRun: (id: string) => post<Ok>(`/api/runs/${enc(id)}/kick`),
  stopRun: (id: string) => post<Ok>(`/api/runs/${enc(id)}/stop`),
  reExtractRun: (id: string) => post<Ok>(`/api/runs/${enc(id)}/re-extract`),
  fixes: (runId: string) => get<Fix[]>(`/api/runs/${enc(runId)}/fixes`),
  regenerateFixes: (runId: string) => post<Ok>(`/api/runs/${enc(runId)}/fixes`),
  trace: (taskId: string) => get<Trace>(`/api/tasks/${enc(taskId)}/trace`),

  // ---------- analysis (all take the lens) ----------
  summary: (lens?: Lens) => get<Summary>(`/api/analysis/summary${lensToSearch(lens)}`),
  byAssistant: (lens?: Lens) => get<ByAssistant[]>(`/api/analysis/by-assistant${lensToSearch(lens)}`),
  wins: (lens?: Lens) => get<Win[]>(`/api/analysis/wins${lensToSearch(lens)}`),
  lossReasons: (lens?: Lens) => get<LossReasonRow[]>(`/api/analysis/loss-reasons${lensToSearch(lens)}`),
  sources: (lens?: Lens) => get<SourcesBreakdown>(`/api/analysis/sources${lensToSearch(lens)}`),
  queries: (lens?: Lens) => get<QueryRow[]>(`/api/analysis/queries${lensToSearch(lens)}`),
  lostSales: (lens?: Lens, limit = 10) => get<LostSale[]>(`/api/analysis/lost-sales${lensToSearch(lens, { limit })}`),
  lensOptions: () => get<LensOptions>('/api/lens/options'),

  // ---------- settings ----------
  settings: () => get<SettingsBundle>('/api/settings'),
  patchRunDefaults: (body: Partial<RunDefaults>) => patch<RunDefaults>('/api/settings/run-defaults', body),
  putBrand: (body: BrandInput) => put<Brand>('/api/settings/brand', body),

  createCompetitor: (body: BrandInput) => post<Brand>('/api/settings/competitors', body),
  updateCompetitor: (id: string, body: Partial<BrandInput>) => patch<Brand>(`/api/settings/competitors/${enc(id)}`, body),
  deleteCompetitor: (id: string) => del<Ok>(`/api/settings/competitors/${enc(id)}`),

  createMarketplace: (body: MarketplaceInput) => post<Marketplace>('/api/settings/marketplaces', body),
  updateMarketplace: (id: string, body: Partial<MarketplaceInput>) =>
    patch<Marketplace>(`/api/settings/marketplaces/${enc(id)}`, body),
  deleteMarketplace: (id: string) => del<Ok>(`/api/settings/marketplaces/${enc(id)}`),

  createProduct: (body: ProductInput) => post<Product>('/api/settings/products', body),
  updateProduct: (id: string, body: Partial<ProductInput>) => patch<Product>(`/api/settings/products/${enc(id)}`, body),
  deleteProduct: (id: string) => del<Ok>(`/api/settings/products/${enc(id)}`),

  createQuery: (body: QueryInput) => post<Query>('/api/settings/queries', body),
  /** PATCH returns the new version's id */
  updateQuery: (id: string, body: Partial<QueryInput>) => patch<{ id: string } & Partial<Query>>(`/api/settings/queries/${enc(id)}`, body),
  deleteQuery: (id: string) => del<Ok>(`/api/settings/queries/${enc(id)}`),

  patchAssistant: (id: Assistant, body: { enabled?: boolean; model?: string | null }) =>
    patch<AssistantInfo>(`/api/settings/assistants/${enc(id)}`, body),

  // Provider API keys: metadata only, the key itself is never returned.
  keys: () => get<ProviderKeyInfo[]>('/api/settings/keys'),
  /** Checks the key with the provider (unless verify=false), then stores it encrypted. 400 key_invalid / bad_key, field 'apiKey'. */
  saveKey: (assistant: Assistant, apiKey: string, verify = true) =>
    put<SaveKeyResult>(`/api/settings/keys/${enc(assistant)}`, { apiKey, verify }),
  deleteKey: (assistant: Assistant) => del<Ok>(`/api/settings/keys/${enc(assistant)}`),
};

export interface BrandInput { name: string; aliases: string[]; domains: string[] }
export interface MarketplaceInput { name: string; domains: string[] }
export type ProductInput = Omit<Product, 'id' | 'mrpInr' | 'deliveryDays'> & { mrpInr?: number | null; deliveryDays?: number | null };
export type QueryInput = Omit<Query, 'id' | 'code'>;

export const TERMINAL_STATES: RunState[] = ['done', 'partial', 'failed', 'cancelled'];
export const isTerminal = (s: RunState) => TERMINAL_STATES.includes(s);
