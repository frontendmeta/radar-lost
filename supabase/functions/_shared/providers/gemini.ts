// Gemini shopper: generateContent with the google_search tool, key in x-goog-api-key.
// Searches from groundingMetadata.webSearchQueries; sources from groundingChunks[].web;
// groundingSupports mark cited. vertexaisearch redirect links are resolved to the publisher URL
// by reading the Location header (redirect: 'manual', in parallel, short timeout); on failure the
// redirect URL is kept.
import { ProviderError } from '../errors.ts';
import { budget, postJson, requireKey, resolveRedirect } from '../fetch.ts';
import type { ShopperAdapter, ShopperResult } from '../types.ts';
import { addSource, type AdapterExtra, newSourceSet, sourceList } from './util.ts';

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const SAFETY_STOPS = new Set(['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'IMAGE_SAFETY', 'LANGUAGE']);

// deno-lint-ignore no-explicit-any
type Any = any;

function isRedirectLink(u: string): boolean {
  try {
    return new URL(u).hostname.endsWith('vertexaisearch.cloud.google.com');
  } catch {
    return false;
  }
}

export const geminiShopper: ShopperAdapter = async (args: Parameters<ShopperAdapter>[0] & AdapterExtra): Promise<ShopperResult> => {
  const { prompt, model } = args;
  const apiKey = requireKey(args.apiKey, 'GEMINI_API_KEY');
  const t0 = Date.now();
  const deadline = args.deadline ?? t0 + 90_000;

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
  };
  const url = `${BASE}/${encodeURIComponent(model)}:generateContent`;
  const res = await postJson<Any>('gemini', url, { 'x-goog-api-key': apiKey }, body, {
    ...budget(deadline, 90_000), keyEnv: 'GEMINI_API_KEY', modelEnv: 'GEMINI_MODEL',
  });
  const latencyMs = Date.now() - t0;

  const blockReason = res?.promptFeedback?.blockReason;
  const cand = (res?.candidates ?? [])[0];
  if (!cand) {
    if (blockReason) throw new ProviderError('model', `gemini prompt blocked: ${blockReason}`);
    throw new ProviderError('unknown', 'gemini: no candidates in response');
  }
  const finish = String(cand.finishReason ?? '');
  const answerText = ((cand.content?.parts ?? []) as Any[])
    .filter((p) => typeof p?.text === 'string' && !p.thought)
    .map((p) => p.text).join('');
  if (SAFETY_STOPS.has(finish)) throw new ProviderError('model', `gemini stopped: ${finish}`);
  if (!answerText.trim()) throw new ProviderError('unknown', `gemini: no answer text (finishReason ${finish || '?'})`);

  const gm = cand.groundingMetadata ?? {};
  const searches = ((gm.webSearchQueries ?? []) as Any[]).filter((q) => typeof q === 'string' && q.trim()).map((q: string) => q.trim());
  const chunks = ((gm.groundingChunks ?? []) as Any[]).map((c) => ({ uri: String(c?.web?.uri ?? ''), title: String(c?.web?.title ?? '') }));
  const citedIdx = new Set<number>();
  for (const s of (gm.groundingSupports ?? []) as Any[]) {
    for (const i of (s?.groundingChunkIndices ?? [])) if (Number.isInteger(i)) citedIdx.add(i);
  }

  // Resolve redirect links in parallel, bounded by the remaining budget.
  const left = Math.max(1000, Math.min(4000, deadline - Date.now()));
  const resolved = await Promise.all(chunks.map((c) => (c.uri && isRedirectLink(c.uri) ? resolveRedirect(c.uri, left) : Promise.resolve(null))));

  const sources = newSourceSet();
  chunks.forEach((c, i) => {
    if (!c.uri) return;
    addSource(sources, resolved[i] ?? c.uri, c.title, citedIdx.has(i));
  });

  return {
    answerText,
    webSearched: searches.length > 0 || chunks.length > 0,
    searches: [...new Set(searches)],
    sources: sourceList(sources),
    raw: { response: res, resolved_urls: resolved },
    usage: res?.usageMetadata ?? null,
    latencyMs,
  };
};
