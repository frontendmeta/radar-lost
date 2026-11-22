// One JSON-only model call (extractor / fixes) over plain fetch. No SDKs, no Deno APIs.
import { classifyStatus, ProviderError } from './errors.ts';
import type { Assistant, ModelCfg } from './types.ts';

export const KEY_ENV: Record<Assistant, string> = { openai: 'OPENAI_API_KEY', anthropic: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };
const MAX_OUTPUT_TOKENS = 16000;
const ANTHROPIC_VERSION = '2026-10-21';

/** Seconds from Retry-After (seconds or HTTP date) or retry-after-ms; null when absent. */
export function retryAfterSeconds(h: Headers): number | null {
  const ms = h.get('retry-after-ms');
  if (ms && Number.isFinite(Number(ms))) return Math.max(0, Math.ceil(Number(ms) / 1000));
  const v = h.get('retry-after');
  if (!v) return null;
  if (/^\s*\d+(\.\d+)?\s*$/.test(v)) return Math.max(0, Math.ceil(Number(v)));
  const t = Date.parse(v);
  return Number.isFinite(t) ? Math.max(0, Math.ceil((t - Date.now()) / 1000)) : null;
}

function errorMessage(body: string): string {
  try {
    const j = JSON.parse(body);
    const e = Array.isArray(j) ? j[0]?.error : j?.error;
    if (typeof e === 'string') return e;
    if (e?.message) return String(e.message);
  } catch { /* not JSON */ }
  return body.slice(0, 500);
}

interface Req { url: string; headers: Record<string, string>; body: unknown }

/** POST JSON with a hard timeout covering headers and body; no redirects followed. */
async function postJson(provider: Assistant, req: Req, timeoutMs: number): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let res: Response;
    try {
      res = await fetch(req.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...req.headers },
        body: JSON.stringify(req.body),
        redirect: 'manual',
        signal: ctrl.signal,
      });
    } catch (e) {
      if (ctrl.signal.aborted) throw new ProviderError('retryable', `${provider} timeout after ${timeoutMs}ms`);
      throw new ProviderError('retryable', `${provider} network error: ${(e as Error)?.message ?? e}`);
    }
    let text: string;
    try {
      text = await res.text();
    } catch (e) {
      if (ctrl.signal.aborted) throw new ProviderError('retryable', `${provider} timeout after ${timeoutMs}ms`);
      throw new ProviderError('retryable', `${provider} network error reading body: ${(e as Error)?.message ?? e}`);
    }
    if (res.status === 0 || (res.status >= 300 && res.status < 400)) {
      throw new ProviderError('unknown', `${provider} unexpected redirect (${res.status})`, null, res.status || null);
    }
    if (!res.ok) {
      throw new ProviderError(classifyStatus(res.status), `${provider} ${res.status}: ${errorMessage(text)}`, retryAfterSeconds(res.headers), res.status);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ProviderError('unknown', `${provider} returned non-JSON body: ${text.slice(0, 200)}`, null, res.status);
    }
  } finally {
    clearTimeout(timer);
  }
}

// --- Providers ---------------------------------------------------------------------

function anthropicReq(cfg: ModelCfg, system: string, user: string): Req {
  const body: Record<string, unknown> = {
    model: cfg.model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
  };
  // Claude 5.x models take effort; keep the extractor cheap and fast.
  if (/^claude-(haiku|sonnet|opus|fable|mythos)-5/.test(cfg.model)) body.output_config = { effort: 'low' };
  return {
    url: 'https://api.anthropic.com/v1/messages',
    headers: { 'x-api-key': cfg.apiKey, 'anthropic-version': ANTHROPIC_VERSION },
    body,
  };
}

// deno-lint-ignore no-explicit-any
function anthropicText(j: any): string {
  if (j?.stop_reason === 'refusal') {
    throw new ProviderError('model', `anthropic refusal${j?.stop_details?.category ? ` (${j.stop_details.category})` : ''}`);
  }
  return (Array.isArray(j?.content) ? j.content : [])
    .filter((b: { type?: string }) => b?.type === 'text')
    .map((b: { text?: string }) => b.text ?? '')
    .join('');
}

function openaiReq(cfg: ModelCfg, system: string, user: string): Req {
  return {
    url: 'https://api.openai.com/v1/responses',
    headers: { authorization: `Bearer ${cfg.apiKey}` },
    body: {
      model: cfg.model,
      instructions: system,
      input: user,
      text: { format: { type: 'json_object' } },
      max_output_tokens: MAX_OUTPUT_TOKENS,
      store: false,
    },
  };
}

// deno-lint-ignore no-explicit-any
function openaiText(j: any): string {
  if (j?.status === 'failed') throw new ProviderError('unknown', `openai failed: ${j?.error?.message ?? 'unknown error'}`);
  if (j?.status === 'incomplete' && j?.incomplete_details?.reason === 'content_filter') {
    throw new ProviderError('model', 'openai content_filter');
  }
  let text = '';
  for (const item of Array.isArray(j?.output) ? j.output : []) {
    if (item?.type !== 'message') continue;
    for (const c of Array.isArray(item.content) ? item.content : []) {
      if (c?.type === 'refusal') throw new ProviderError('model', `openai refusal: ${String(c.refusal ?? '').slice(0, 200)}`);
      if (c?.type === 'output_text') text += c.text ?? '';
    }
  }
  if (!text && typeof j?.output_text === 'string') text = j.output_text;
  return text;
}

function geminiReq(cfg: ModelCfg, system: string, user: string): Req {
  const model = cfg.model.replace(/^models\//, '');
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    headers: { 'x-goog-api-key': cfg.apiKey },
    body: {
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: MAX_OUTPUT_TOKENS },
    },
  };
}

const GEMINI_BLOCKED = new Set(['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION', 'IMAGE_SAFETY']);

// deno-lint-ignore no-explicit-any
function geminiText(j: any): string {
  const block = j?.promptFeedback?.blockReason;
  if (block && block !== 'BLOCK_REASON_UNSPECIFIED') throw new ProviderError('model', `gemini prompt blocked: ${block}`);
  const cand = Array.isArray(j?.candidates) ? j.candidates[0] : null;
  if (cand?.finishReason && GEMINI_BLOCKED.has(cand.finishReason)) throw new ProviderError('model', `gemini blocked: ${cand.finishReason}`);
  return (Array.isArray(cand?.content?.parts) ? cand.content.parts : [])
    .filter((p: { thought?: boolean; text?: string }) => !p?.thought && typeof p?.text === 'string')
    .map((p: { text: string }) => p.text)
    .join('');
}

/** One JSON-only call. Throws ProviderError (retryable | model | config | unknown). */
export async function jsonCall(cfg: ModelCfg, system: string, user: string, timeoutMs: number): Promise<{ text: string; usage: unknown }> {
  if (!cfg?.provider || !KEY_ENV[cfg.provider]) throw new ProviderError('config', `unknown provider ${cfg?.provider}`);
  if (!cfg.apiKey) throw new ProviderError('config', `missing API key: set ${KEY_ENV[cfg.provider]}`);
  if (!cfg.model) throw new ProviderError('config', `missing model for ${cfg.provider}`);
  // deno-lint-ignore no-explicit-any
  let j: any;
  let text: string;
  switch (cfg.provider) {
    case 'anthropic':
      j = await postJson('anthropic', anthropicReq(cfg, system, user), timeoutMs);
      text = anthropicText(j);
      return { text, usage: j?.usage ?? null };
    case 'openai':
      j = await postJson('openai', openaiReq(cfg, system, user), timeoutMs);
      text = openaiText(j);
      return { text, usage: j?.usage ?? null };
    case 'gemini':
      j = await postJson('gemini', geminiReq(cfg, system, user), timeoutMs);
      text = geminiText(j);
      return { text, usage: j?.usageMetadata ?? null };
  }
}

/** Parse model text as one JSON object: tolerates ```json fences and prose around the object. */
export function parseJsonObject(text: string): Record<string, unknown> {
  let s = String(text ?? '').trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  let v: unknown;
  try {
    v = JSON.parse(s);
  } catch (e1) {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a < 0 || b <= a) throw new Error(`not JSON: ${(e1 as Error).message}`);
    try {
      v = JSON.parse(s.slice(a, b + 1));
    } catch (e2) {
      throw new Error(`not JSON: ${(e2 as Error).message}`);
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('expected a JSON object at the top level');
  return v as Record<string, unknown>;
}

/** Fence untrusted text: strips anything that could close or open the fence tag. */
export function fence(tag: string, s: string): string {
  const clean = String(s ?? '').replace(new RegExp(`</?\\s*${tag}\\s*>`, 'gi'), '');
  return `<${tag}>\n${clean}\n</${tag}>`;
}
