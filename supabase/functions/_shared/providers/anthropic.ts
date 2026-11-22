// Claude shopper: Messages API with the basic web search server tool (direct calls, so every
// search shows up as server_tool_use + web_search_tool_result blocks).
// Searches from server_tool_use input.query; sources from web_search_tool_result blocks;
// text-block citations (web_search_result_location) mark cited. pause_turn is continued up to 3 times.
import { ProviderError } from '../errors.ts';
import { budget, postJson, requireKey } from '../fetch.ts';
import type { ShopperAdapter, ShopperResult } from '../types.ts';
import { addSource, type AdapterExtra, newSourceSet, sourceList } from './util.ts';

const URL_MESSAGES = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
const MAX_CONTINUATIONS = 3;

// deno-lint-ignore no-explicit-any
type Any = any;

export const anthropicShopper: ShopperAdapter = async (args: Parameters<ShopperAdapter>[0] & AdapterExtra): Promise<ShopperResult> => {
  const { prompt, model, location } = args;
  const apiKey = requireKey(args.apiKey, 'ANTHROPIC_API_KEY');
  const t0 = Date.now();
  const deadline = args.deadline ?? t0 + 90_000;
  const toolType = Deno.env.get('ANTHROPIC_SEARCH_TOOL') || 'web_search_20250305';
  const effort = Deno.env.get('ANTHROPIC_EFFORT') ?? '';

  const tools = [{
    type: toolType,
    name: 'web_search',
    max_uses: 5,
    user_location: {
      type: 'approximate', city: location.city, region: location.region,
      country: location.country, timezone: location.timezone,
    },
  }];
  const headers = { 'x-api-key': apiKey, 'anthropic-version': API_VERSION };

  const responses: Any[] = [];
  let assistantContent: Any[] = [];
  for (let turn = 0; turn <= MAX_CONTINUATIONS; turn++) {
    const messages: Any[] = [{ role: 'user', content: prompt }];
    if (assistantContent.length) messages.push({ role: 'assistant', content: assistantContent });
    const body: Record<string, unknown> = { model, max_tokens: 16000, messages, tools };
    if (effort) body.output_config = { effort };
    const res = await postJson<Any>('anthropic', URL_MESSAGES, headers, body, {
      ...budget(deadline, 90_000), keyEnv: 'ANTHROPIC_API_KEY', modelEnv: 'ANTHROPIC_MODEL',
    });
    responses.push(res);
    assistantContent = [...assistantContent, ...((res?.content ?? []) as Any[])];
    if (res?.stop_reason !== 'pause_turn') break;
  }
  const latencyMs = Date.now() - t0;
  const last = responses[responses.length - 1];

  const searches: string[] = [];
  const sources = newSourceSet();
  const searchErrors: string[] = [];
  let answerText = '';
  let webSearched = false;

  for (const b of assistantContent) {
    if (b?.type === 'server_tool_use' && b.name === 'web_search') {
      const q = b.input?.query;
      if (typeof q === 'string' && q.trim()) searches.push(q.trim());
    } else if (b?.type === 'web_search_tool_result') {
      if (Array.isArray(b.content)) {
        webSearched = true;
        for (const r of b.content) if (r?.type === 'web_search_result') addSource(sources, r.url, r.title, false);
      } else if (b.content?.type === 'web_search_tool_result_error') {
        searchErrors.push(String(b.content.error_code ?? 'unknown'));
      }
    } else if (b?.type === 'text') {
      answerText += b.text ?? '';
      for (const c of (b.citations ?? []) as Any[]) {
        if (c?.type === 'web_search_result_location') addSource(sources, c.url, c.title, true);
      }
    }
  }

  if (last?.stop_reason === 'refusal') {
    const cat = last?.stop_details?.category ? ` (${last.stop_details.category})` : '';
    throw new ProviderError('model', `anthropic refusal${cat}`);
  }
  if (!answerText.trim()) {
    if (searchErrors.includes('too_many_requests')) {
      throw new ProviderError('retryable', 'anthropic web search too_many_requests and no answer text', 30);
    }
    throw new ProviderError('unknown', `anthropic: no answer text (stop_reason ${last?.stop_reason ?? '?'}${searchErrors.length ? `, search errors: ${searchErrors.join(',')}` : ''})`);
  }

  // Usage summed over continuations.
  const usage = { input_tokens: 0, output_tokens: 0, server_tool_use: { web_search_requests: 0 }, calls: responses.length };
  for (const r of responses) {
    usage.input_tokens += r?.usage?.input_tokens ?? 0;
    usage.output_tokens += r?.usage?.output_tokens ?? 0;
    usage.server_tool_use.web_search_requests += r?.usage?.server_tool_use?.web_search_requests ?? 0;
  }

  return {
    answerText,
    webSearched,
    searches: [...new Set(searches)],
    sources: sourceList(sources),
    raw: { responses, search_errors: searchErrors, final_stop_reason: last?.stop_reason ?? null },
    usage,
    latencyMs,
  };
};
