// process-run: the one background processor. Every shopper, extractor and fixes call happens here.
// Woken by pg_cron (every minute), the create-run kick, the manual kick route and its own re-kick.
// One invocation: secret check -> 202 at once -> take_lease(150) -> key_present + env models ->
// sweep_stuck() -> claim/run tasks (<= 6 in flight) for ~110 s -> release lease -> re-kick if work remains.
import { ProviderError, scrub } from '../_shared/errors.ts';
import { TimeoutError } from '../_shared/fetch.ts';
import {
  claimableWorkRemains, loadAnswerText, loadBrands, loadMarketplaces, loadQuery, loadSettings, loadTypedSources,
  markCallStarted, rpc, serviceClient, type SettingsRow, type SupabaseClient, type TaskRow,
} from '../_shared/db.ts';
import { matchSources } from '../_shared/match.ts';
import { extractDecision, heuristicExtract } from '../_shared/extract.ts';
import { writeFixes } from '../_shared/fixes.ts';
import { openaiShopper } from '../_shared/providers/openai.ts';
import { anthropicShopper } from '../_shared/providers/anthropic.ts';
import { geminiShopper } from '../_shared/providers/gemini.ts';
import { makeFakeShopper } from '../_shared/providers/fake.ts';
import { sleep } from '../_shared/providers/util.ts';
import type { Assistant, DecisionRow, ModelCfg, RejectionRow, ShopperAdapter, ShopperResult, TypedSource } from '../_shared/types.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

// Timing. Hosted Free plan wall clock is 150 s; the lease is 150 s; all work ends by WALL_MS.
const LEASE_S = 150;
const CLAIM_LEASE_S = 180;
const MAX_IN_FLIGHT = 6;
const WALL_MS = 140_000;          // hard end of this invocation's work (inside the 150 s lease)
const LOOP_MS = 110_000;          // stop claiming new work after this
const MIN_CLAIM_BUDGET_MS = 60_000; // ...or when less than this is left before WALL_MS
const ANSWER_TIMEOUT_MS = 90_000;
const EXTRACT_TIMEOUT_MS = 45_000;
const FIXES_MIN_BUDGET_MS = 50_000;
const SELF_KICK_TIMEOUT_MS = 2_000;

const ASSISTANTS: Assistant[] = ['openai', 'anthropic', 'gemini'];
const KEY_ENV: Record<Assistant, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };
const MODEL_ENV: Record<Assistant, string> = { openai: 'OPENAI_MODEL', anthropic: 'ANTHROPIC_MODEL', gemini: 'GEMINI_MODEL' };
const DEFAULT_MODEL: Record<Assistant, string> = { openai: 'gpt-6.2-sol', anthropic: 'claude-sonnet-5-5', gemini: 'gemini-4-hydrogen' };
const CHEAP_MODEL: Record<Assistant, string> = { openai: 'gpt-6-luna', anthropic: 'claude-haiku-5-5', gemini: 'gemini-3.5-flash-lite' };
const ADAPTERS: Record<Assistant, ShopperAdapter> = { openai: openaiShopper, anthropic: anthropicShopper, gemini: geminiShopper };

const env = (k: string) => (Deno.env.get(k) ?? '').trim();
const isFake = () => env('FAKE_PROVIDERS').toLowerCase() === 'true';
const envModel = (a: Assistant) => env(MODEL_ENV[a]) || DEFAULT_MODEL[a];
// Provider keys for this invocation: the key saved in the UI (Vault, via get_provider_keys()) wins,
// else the env key. Loaded once per invocation by the lease holder; values are never logged.
let keys: Record<Assistant, string> = { openai: '', anthropic: '', gemini: '' };
const keyFor = (a: Assistant) => keys[a] ?? '';
const missingKey = (a: Assistant) => `no ${a} API key: save one in Settings or set ${KEY_ENV[a]}`;

async function loadKeys(sb: SupabaseClient): Promise<Record<Assistant, string>> {
  const merged: Record<Assistant, string> = { openai: env(KEY_ENV.openai), anthropic: env(KEY_ENV.anthropic), gemini: env(KEY_ENV.gemini) };
  try {
    const { data, error } = await sb.rpc('get_provider_keys');
    if (error) throw new Error(error.message);
    for (const row of (Array.isArray(data) ? data : []) as { assistant?: string; api_key?: string }[]) {
      const a = String(row?.assistant ?? '');
      const k = typeof row?.api_key === 'string' ? row.api_key.trim() : '';
      if (isAssistant(a) && k) merged[a] = k;
    }
  } catch (e) {
    log('get_provider_keys unavailable; using env keys only:', scrub(String((e as Error)?.message ?? e)).slice(0, 200));
  }
  return merged;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function log(...parts: unknown[]) {
  console.log('[process-run]', ...parts.map((p) => (typeof p === 'string' ? scrub(p) : p)));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// ---------------------------------------------------------------------------------------------
// Model configs for the extractor and the fixes call.

function inferProvider(model: string): Assistant {
  if (/^claude/i.test(model)) return 'anthropic';
  if (/^gemini/i.test(model)) return 'gemini';
  return 'openai';
}

function isAssistant(x: string): x is Assistant {
  return (ASSISTANTS as string[]).includes(x);
}

function extractorCfg(s: SettingsRow): ModelCfg {
  const p0 = (s.extractor_provider || env('EXTRACTOR_PROVIDER')).toLowerCase();
  let provider: Assistant | null = isAssistant(p0) ? p0 : null;
  let model = s.extractor_model || '';
  if (!provider && model) provider = inferProvider(model);
  if (!provider) provider = 'anthropic';
  if (!model) {
    const em = env('EXTRACTOR_MODEL');
    model = em && inferProvider(em) === provider ? em : CHEAP_MODEL[provider];
  }
  return { provider, model, apiKey: keyFor(provider) };
}

function fixesCfg(s: SettingsRow): ModelCfg {
  const m = s.fixes_model || env('FIXES_MODEL');
  if (!m) return extractorCfg(s);
  const provider = inferProvider(m);
  return { provider, model: m, apiKey: keyFor(provider) };
}

// ---------------------------------------------------------------------------------------------
// Startup bookkeeping: key_present per assistant and the env default models.

async function writeEnvState(sb: SupabaseClient) {
  const fake = isFake();
  await Promise.all(ASSISTANTS.map(async (a) => {
    const { error } = await sb.from('assistants').update({ key_present: fake || !!keyFor(a) }).eq('id', a);
    if (error) log('key_present update failed', a, error.message);
  }));
  const rows = ASSISTANTS.map((a) => ({ key: `env_model_${a}`, value: envModel(a) }));
  const { error } = await sb.from('app_config').upsert(rows, { onConflict: 'key' });
  if (error) log('env_model upsert failed', error.message);
}

// ---------------------------------------------------------------------------------------------
// Task phases.

class Stage {
  constructor(public name: 'prepare' | 'call' | 'save') {}
}

function fallbackTyping(sources: ShopperResult['sources']): TypedSource[] {
  return sources.map((s, i) => {
    let domain = '';
    try { domain = new URL(s.url).hostname.toLowerCase(); } catch { /* keep empty */ }
    const root = domain.replace(/^(www\.|m\.)/, '');
    return { ord: i, url: s.url, title: s.title, domain, root_domain: root, source_type: 'other', brand_id: null, marketplace_id: null, cited: s.cited };
  });
}

async function answerTask(sb: SupabaseClient, t: TaskRow, settings: SettingsRow, hardDeadline: number, stage: Stage) {
  const fake = isFake();
  const adapter = fake ? makeFakeShopper(t.assistant, t.attempt) : ADAPTERS[t.assistant];
  if (!adapter) throw new ProviderError('config', `unknown assistant ${t.assistant}`);
  const apiKey = fake ? 'fake' : keyFor(t.assistant);
  if (!apiKey) throw new ProviderError('config', missingKey(t.assistant));
  const model = t.model || envModel(t.assistant);
  const location = { city: settings.city, region: settings.region, country: settings.country, timezone: settings.timezone, lat: settings.lat, lng: settings.lng };

  await markCallStarted(sb, t.id);
  stage.name = 'call';
  const deadline = Math.min(Date.now() + ANSWER_TIMEOUT_MS, hardDeadline);
  const result = await (adapter as (a: unknown) => Promise<ShopperResult>)({ prompt: t.prompt_text, model, location, apiKey, deadline });

  stage.name = 'save';
  let typed: TypedSource[];
  try {
    const [brands, marketplaces] = await Promise.all([loadBrands(sb), loadMarketplaces(sb)]);
    typed = matchSources(result.sources, brands, marketplaces);
  } catch (e) {
    log('matchSources failed, saving untyped sources', t.id, String((e as Error)?.message ?? e));
    typed = fallbackTyping(result.sources);
  }
  const args = {
    p_task_id: t.id,
    p_answer: { answer_text: result.answerText, web_searched: result.webSearched, raw: result.raw ?? null, usage: result.usage ?? null, latency_ms: result.latencyMs },
    p_searches: result.searches,
    p_sources: typed,
  };
  try {
    await rpc(sb, 'save_answer', args);
  } catch (e) {
    log('save_answer failed once, retrying', t.id, String((e as Error)?.message ?? e));
    await sleep(500);
    await rpc(sb, 'save_answer', args);
  }
  log(`answered ${t.id} ${t.assistant}/${model} ${result.latencyMs}ms searched=${result.webSearched} searches=${result.searches.length} sources=${typed.length}`);
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const to = new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new TimeoutError(label, ms)), ms); });
  return Promise.race([p, to]).finally(() => clearTimeout(timer));
}

async function extractTask(sb: SupabaseClient, t: TaskRow, settings: SettingsRow, hardDeadline: number, stage: Stage) {
  const [answerText, sources, query, brands, marketplaces] = await Promise.all([
    loadAnswerText(sb, t.id), loadTypedSources(sb, t.id), loadQuery(sb, t.query_id), loadBrands(sb), loadMarketplaces(sb),
  ]);
  const cfg = extractorCfg(settings);
  stage.name = 'call';
  let out: { decision: DecisionRow; rejections: RejectionRow[] };
  if (!cfg.apiKey && isFake()) {
    // FAKE_PROVIDERS with no extractor key: deterministic extraction, no model call.
    out = heuristicExtract({ query, answerText, sources, brands, marketplaces });
  } else {
    if (!cfg.apiKey) throw new ProviderError('config', `${missingKey(cfg.provider)} (extractor provider ${cfg.provider}; see EXTRACTOR_PROVIDER / EXTRACTOR_MODEL)`);
    // One budget for the whole extraction, including a possible repair call.
    const ms = Math.max(1000, Math.min(EXTRACT_TIMEOUT_MS, hardDeadline - Date.now()));
    out = await withTimeout(extractDecision({ query, answerText, sources, brands, marketplaces, cfg }, { timeoutMs: ms }), ms, `extract ${cfg.provider}`);
  }
  stage.name = 'save';
  await rpc(sb, 'save_decision', { p_task_id: t.id, p_decision: out.decision, p_rejections: out.rejections });
  log(`done ${t.id} pick=${out.decision.pick_brand_name ?? '-'} rejections=${out.rejections.length} by ${out.decision.extractor_model}`);
}

// ---------------------------------------------------------------------------------------------
// Failures.

async function handleFailure(sb: SupabaseClient, t: TaskRow, phase: 'answering' | 'extracting', stage: Stage, e: unknown, capped: boolean) {
  let pe: ProviderError;
  if (e instanceof ProviderError) pe = e;
  else if (stage.name === 'prepare') pe = new ProviderError('retryable', `before provider call: ${(e as Error)?.message ?? String(e)}`);
  else pe = new ProviderError('unknown', `${stage.name}: ${(e as Error)?.message ?? String(e)}`);
  const msg = scrub(`${phase}: ${pe.message}`);
  log(`error ${t.id} ${t.assistant} ${phase} [${pe.failureClass}] ${msg}`);

  if (pe.failureClass === 'retryable') {
    // A timeout caused by this invocation's wall clock is not the provider's fault: don't count it toward the breaker.
    const wallCut = pe instanceof TimeoutError && capped;
    const countBreaker = phase === 'answering' && stage.name !== 'prepare' && !wallCut;
    const retryAfter = pe.retryAfterSeconds ?? Math.min(60, 10 * Math.max(1, t.tries));
    const status = await rpc<string>(sb, 'retry_task', {
      p_task_id: t.id, p_error: msg, p_retry_after_seconds: retryAfter, p_count_breaker: countBreaker,
    });
    if (status === 'failed') await rpc(sb, 'finish_run_if_done', { p_run_id: t.run_id });
  } else {
    await rpc(sb, 'fail_task', { p_task_id: t.id, p_class: pe.failureClass, p_error: msg });
    await rpc(sb, 'finish_run_if_done', { p_run_id: t.run_id });
  }
}

async function runTask(sb: SupabaseClient, t: TaskRow, settings: SettingsRow, hardDeadline: number): Promise<void> {
  const phase = t.status === 'answering' ? 'answering' : t.status === 'extracting' ? 'extracting' : null;
  if (!phase) { log('claimed task in unexpected status', t.id, t.status); return; }
  const stage = new Stage('prepare');
  const capped = hardDeadline - Date.now() < (phase === 'answering' ? ANSWER_TIMEOUT_MS : EXTRACT_TIMEOUT_MS);
  try {
    if (phase === 'answering') {
      await answerTask(sb, t, settings, hardDeadline, stage);
    } else {
      await extractTask(sb, t, settings, hardDeadline, stage);
      const closed = await rpc<boolean>(sb, 'finish_run_if_done', { p_run_id: t.run_id });
      if (closed) log(`run ${t.run_id} closed`);
    }
  } catch (e) {
    try {
      await handleFailure(sb, t, phase, stage, e, capped);
    } catch (e2) {
      log('failure handling failed', t.id, String((e2 as Error)?.message ?? e2));
    }
  }
}

async function runFixes(sb: SupabaseClient, runId: string, settings: SettingsRow, hardDeadline: number) {
  const cfg = fixesCfg(settings);
  const fake = !cfg.apiKey && isFake(); // FAKE_PROVIDERS with no key: heuristic fixes, no model call
  const ms = Math.max(5000, hardDeadline - Date.now() - 2000);
  try {
    await withTimeout(writeFixes(sb, runId, cfg, { fake, timeoutMs: Math.min(ms, 60_000) }), ms, 'fixes');
    log(`fixes written for run ${runId} by ${fake ? 'heuristic' : `${cfg.provider}/${cfg.model}`}`);
  } catch (e) {
    log('fixes failed', runId, String((e as Error)?.message ?? e));
  }
}

// ---------------------------------------------------------------------------------------------
// The loop.

function idsOf(rows: unknown): string[] {
  if (!Array.isArray(rows)) return [];
  return rows.map((r) => (typeof r === 'string' ? r : String(Object.values(r as Record<string, unknown>)[0] ?? ''))).filter(Boolean);
}

async function processLoop(sb: SupabaseClient, t0: number): Promise<void> {
  const settings = await loadSettings(sb);
  const hardDeadline = t0 + WALL_MS;
  const inflight = new Map<string, Promise<void>>();
  let fixes: Promise<void> | null = null;
  let maxSeen = 0;

  while (true) {
    const elapsed = Date.now() - t0;
    const canClaim = elapsed < LOOP_MS && hardDeadline - Date.now() >= MIN_CLAIM_BUDGET_MS;
    if (!canClaim && inflight.size === 0 && !fixes) break;

    try {
    if (canClaim) {
      const free = MAX_IN_FLIGHT - inflight.size;
      if (free > 0) {
        const rows = (await rpc<TaskRow[] | null>(sb, 'claim_tasks', { p_limit: free, p_lease_seconds: CLAIM_LEASE_S })) ?? [];
        for (const t of rows) {
          const p = runTask(sb, t, settings, hardDeadline).finally(() => inflight.delete(t.id));
          inflight.set(t.id, p);
        }
        maxSeen = Math.max(maxSeen, inflight.size);
      }
      if (!fixes && hardDeadline - Date.now() >= FIXES_MIN_BUDGET_MS) {
        try {
          const ids = idsOf(await rpc(sb, 'claim_fixes', { p_limit: 1 }));
          if (ids[0]) fixes = runFixes(sb, ids[0], settings, hardDeadline).finally(() => { fixes = null; });
        } catch (e) {
          log('claim_fixes failed', String((e as Error)?.message ?? e));
        }
      }
    }

    if (inflight.size === 0 && !fixes) {
      if (!canClaim) break;
      if (!(await claimableWorkRemains(sb))) break; // nothing to do at all
      // Work exists but is not claimable yet (breaker, Retry-After, or leases of a dead worker): sweep, then wait.
      const swept = await rpc<number>(sb, 'sweep_stuck', {}).catch(() => 0);
      if (swept) { log(`swept ${swept} stuck task(s)`); continue; }
      await sleep(3000);
      continue;
    }
    } catch (e) {
      // A DB hiccup must not abandon in-flight tasks or drop the lease early: log and keep looping.
      log('loop iteration failed', String((e as Error)?.message ?? e));
      if (inflight.size === 0 && !fixes) { await sleep(2000); continue; }
    }
    // Wake when a slot frees up, or poll again shortly for newly claimable work.
    await Promise.race([...inflight.values(), ...(fixes ? [fixes] : []), sleep(inflight.size < MAX_IN_FLIGHT ? 2000 : 5000)]);
  }
  log(`loop ended after ${Math.round((Date.now() - t0) / 1000)}s, max in flight ${maxSeen}`);
}

async function selfKick() {
  const url = env('PROCESSOR_URL') || `${env('SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/process-run`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-processor-secret': env('PROCESSOR_SECRET') },
      body: '{}',
      signal: AbortSignal.timeout(SELF_KICK_TIMEOUT_MS),
    });
    try { await res.body?.cancel(); } catch { /* ignore */ }
    log(`re-kicked: ${res.status}`);
  } catch (e) {
    log('re-kick did not confirm (it may still have landed)', String((e as Error)?.message ?? e));
  }
}

async function runProcessor(): Promise<void> {
  const t0 = Date.now();
  const sb = serviceClient();
  const got = await rpc<boolean>(sb, 'take_lease', { p_seconds: LEASE_S });
  if (!got) { log('lease held by another invocation; exiting'); return; }
  let released = false;
  const release = async () => {
    if (released) return;
    released = true;
    await rpc(sb, 'release_lease', {});
  };
  try {
    keys = await loadKeys(sb);
    await writeEnvState(sb);
    const swept = await rpc<number>(sb, 'sweep_stuck', {});
    if (swept) log(`swept ${swept} stuck task(s)`);
    await processLoop(sb, t0);
    const more = await claimableWorkRemains(sb).catch(() => false);
    await release(); // before the re-kick, so the next invocation can take the lease
    if (more) await selfKick();
  } finally {
    // Never release after a re-kick: release_lease() is not owner-scoped and could free the next invocation's lease.
    await release().catch((e) => log('release_lease failed', String((e as Error)?.message ?? e)));
  }
}

// ---------------------------------------------------------------------------------------------

Deno.serve((req) => {
  const secret = env('PROCESSOR_SECRET');
  const given = req.headers.get('x-processor-secret') ?? '';
  if (!secret || !timingSafeEqual(given, secret)) {
    return json(401, { error: { code: 'unauthorized', message: 'bad or missing x-processor-secret' } });
  }
  const work = runProcessor().catch((e) => log('processor crashed', String((e as Error)?.stack ?? e)));
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(work);
  return json(202, { ok: true, accepted: true });
});
