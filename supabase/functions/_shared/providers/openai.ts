// ChatGPT shopper: OpenAI Responses API with the web_search tool.
// Searches from web_search_call items (action.query / action.queries); sources from
// action.sources (requested via include) plus url_citation annotations, which mark cited.
import { ProviderError } from '../errors.ts';
import { budget, postJson, requireKey } from '../fetch.ts';
import type { ShopperAdapter, ShopperResult } from '../types.ts';
import { addSource, type AdapterExtra, newSourceSet, sourceList } from './util.ts';

const URL_RESPONSES = 'https://api.openai.com/v1/responses';

// deno-lint-ignore no-explicit-any
type Any = any;

export const openaiShopper: ShopperAdapter = async (args: Parameters<ShopperAdapter>[0] & AdapterExtra): Promise<ShopperResult> => {
  const { prompt, model, location } = args;
  const apiKey = requireKey(args.apiKey, 'OPENAI_API_KEY');
  const t0 = Date.now();
  const deadline = args.deadline ?? t0 + 90_000;
  const effort = Deno.env.get('OPENAI_REASONING_EFFORT') ?? 'low';

  const body: Record<string, unknown> = {
    model,
    input: prompt,
    tools: [{
      type: 'web_search',
      user_location: {
        type: 'approximate', country: location.country, city: location.city,
        region: location.region, timezone: location.timezone,
      },
    }],
    include: ['web_search_call.action.sources'],
    store: false,
  };
  if (effort) body.reasoning = { effort };

  const res = await postJson<Any>('openai', URL_RESPONSES, { authorization: `Bearer ${apiKey}` }, body, {
    ...budget(deadline, 90_000), keyEnv: 'OPENAI_API_KEY', modelEnv: 'OPENAI_MODEL',
  });
  const latencyMs = Date.now() - t0;

  if (res?.error) {
    const code = String(res.error.code ?? '');
    const cls = /rate_limit|server_error|overloaded|timeout/i.test(code) ? 'retryable' : 'unknown';
    throw new ProviderError(cls, `openai ${code}: ${res.error.message ?? 'response failed'}`);
  }

  const searches: string[] = [];
  const sources = newSourceSet();
  let answerText = '';
  let refusal: string | null = null;
  let webSearched = false;

  for (const item of (res?.output ?? []) as Any[]) {
    if (item?.type === 'web_search_call') {
      const a = item.action ?? {};
      if (item.status !== 'failed') webSearched = true;
      if (typeof a.query === 'string' && a.query.trim()) searches.push(a.query.trim());
      for (const q of (Array.isArray(a.queries) ? a.queries : [])) if (typeof q === 'string' && q.trim()) searches.push(q.trim());
      for (const s of (Array.isArray(a.sources) ? a.sources : [])) addSource(sources, s?.url, s?.title, false);
      if (a.type === 'open_page' && typeof a.url === 'string') addSource(sources, a.url, '', false);
    } else if (item?.type === 'message') {
      for (const c of (item.content ?? []) as Any[]) {
        if (c?.type === 'output_text') {
          answerText += (answerText && !answerText.endsWith('\n') ? '\n\n' : '') + (c.text ?? '');
          for (const an of (c.annotations ?? []) as Any[]) {
            if (an?.type === 'url_citation') addSource(sources, an.url, an.title, true);
          }
        } else if (c?.type === 'refusal') {
          refusal = String(c.refusal ?? 'refused');
        }
      }
    }
  }

  const incomplete = res?.status === 'incomplete' ? String(res?.incomplete_details?.reason ?? 'incomplete') : null;
  if (incomplete === 'content_filter') throw new ProviderError('model', 'openai: response stopped by content filter');
  if (refusal && !answerText.trim()) throw new ProviderError('model', `openai refusal: ${refusal.slice(0, 300)}`);
  if (!answerText.trim()) {
    throw new ProviderError('unknown', `openai: no answer text (status ${res?.status ?? '?'}${incomplete ? `, ${incomplete}` : ''})`);
  }

  return {
    answerText,
    webSearched,
    searches: [...new Set(searches)],
    sources: sourceList(sources),
    raw: res,
    usage: res?.usage ?? null,
    latencyMs,
  };
};
