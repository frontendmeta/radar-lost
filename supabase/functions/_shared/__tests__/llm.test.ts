import { afterEach, describe, expect, test } from 'bun:test';
import { ProviderError } from '../errors.ts';
import { jsonCall, parseJsonObject } from '../llm.ts';

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

type Seen = { url: string; init: RequestInit };
function mockFetch(respond: (s: Seen) => Response | Promise<Response>): Seen[] {
  const seen: Seen[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => { const s = { url: String(url), init }; seen.push(s); return respond(s); }) as unknown as typeof fetch;
  return seen;
}
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

describe('jsonCall request shapes', () => {
  test('anthropic: Messages API, key in header, text blocks joined, thinking skipped', async () => {
    const seen = mockFetch(() => json({ content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: '{"a":' }, { type: 'text', text: '1}' }], stop_reason: 'end_turn', usage: { input_tokens: 3 } }));
    const r = await jsonCall({ provider: 'anthropic', model: 'claude-haiku-5-5', apiKey: 'sk-ant-secret' }, 'SYS', 'USER', 5000);
    expect(r).toEqual({ text: '{"a":1}', usage: { input_tokens: 3 } });
    expect(seen[0].url).toBe('https://api.anthropic.com/v1/messages');
    const h = seen[0].init.headers as Record<string, string>;
    expect(h['x-api-key']).toBe('sk-ant-secret');
    expect(h['anthropic-version']).toBeTruthy();
    expect(seen[0].init.redirect).toBe('manual');
    expect(seen[0].init.signal).toBeInstanceOf(AbortSignal);
    const body = JSON.parse(String(seen[0].init.body));
    expect(body).toMatchObject({ model: 'claude-haiku-5-5', system: 'SYS', messages: [{ role: 'user', content: 'USER' }] });
    expect(seen[0].url).not.toContain('secret');
  });
  test('openai: Responses API with json_object format', async () => {
    const seen = mockFetch(() => json({ status: 'completed', output: [{ type: 'reasoning' }, { type: 'message', content: [{ type: 'output_text', text: '{"ok":true}' }] }], usage: { total_tokens: 9 } }));
    const r = await jsonCall({ provider: 'openai', model: 'gpt-5-mini', apiKey: 'sk-test' }, 'SYS JSON', 'USER', 5000);
    expect(r.text).toBe('{"ok":true}');
    expect(seen[0].url).toBe('https://api.openai.com/v1/responses');
    expect((seen[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test');
    expect(JSON.parse(String(seen[0].init.body))).toMatchObject({ model: 'gpt-5-mini', instructions: 'SYS JSON', input: 'USER', text: { format: { type: 'json_object' } } });
  });
  test('gemini: generateContent with responseMimeType, key in x-goog-api-key, thought parts skipped', async () => {
    const seen = mockFetch(() => json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'hmm', thought: true }, { text: '{"g":1}' }] } }], usageMetadata: { totalTokenCount: 4 } }));
    const r = await jsonCall({ provider: 'gemini', model: 'gemini-3-flash', apiKey: 'AIzaKEY' }, 'SYS', 'USER', 5000);
    expect(r).toEqual({ text: '{"g":1}', usage: { totalTokenCount: 4 } });
    expect(seen[0].url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash:generateContent');
    expect((seen[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaKEY');
    const body = JSON.parse(String(seen[0].init.body));
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.systemInstruction.parts[0].text).toBe('SYS');
  });
});

describe('jsonCall errors', () => {
  const cfg = { provider: 'anthropic' as const, model: 'claude-haiku-5-5', apiKey: 'k' };
  const fail = async (p: Promise<unknown>): Promise<ProviderError> => {
    try { await p; } catch (e) { return e as ProviderError; }
    throw new Error('expected rejection');
  };
  test('429 -> retryable with Retry-After seconds', async () => {
    mockFetch(() => json({ error: { message: 'rate limited' } }, 429, { 'retry-after': '7' }));
    const e = await fail(jsonCall(cfg, 's', 'u', 5000));
    expect(e).toBeInstanceOf(ProviderError);
    expect(e.failureClass).toBe('retryable');
    expect(e.retryAfterSeconds).toBe(7);
    expect(e.status).toBe(429);
  });
  test('401 -> config; 529 -> retryable', async () => {
    mockFetch(() => json({ error: { message: 'invalid x-api-key' } }, 401));
    expect((await fail(jsonCall(cfg, 's', 'u', 5000))).failureClass).toBe('config');
    mockFetch(() => json({ error: { message: 'overloaded' } }, 529));
    expect((await fail(jsonCall(cfg, 's', 'u', 5000))).failureClass).toBe('retryable');
  });
  test('redirect is not followed', async () => {
    mockFetch(() => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }));
    expect((await fail(jsonCall(cfg, 's', 'u', 5000))).message).toContain('redirect');
  });
  test('timeout -> retryable', async () => {
    mockFetch(({ init }) => new Promise((_, reject) => init.signal!.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
    const e = await fail(jsonCall(cfg, 's', 'u', 30));
    expect(e.failureClass).toBe('retryable');
    expect(e.message).toContain('timeout');
  });
  test('refusals and safety blocks -> model', async () => {
    mockFetch(() => json({ content: [], stop_reason: 'refusal' }));
    expect((await fail(jsonCall(cfg, 's', 'u', 5000))).failureClass).toBe('model');
    mockFetch(() => json({ candidates: [{ finishReason: 'SAFETY' }] }));
    expect((await fail(jsonCall({ provider: 'gemini', model: 'g', apiKey: 'k' }, 's', 'u', 5000))).failureClass).toBe('model');
    mockFetch(() => json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] }));
    expect((await fail(jsonCall({ provider: 'openai', model: 'o', apiKey: 'k' }, 's', 'u', 5000))).failureClass).toBe('model');
  });
  test('missing key -> config naming the env var', async () => {
    const e = await fail(jsonCall({ provider: 'gemini', model: 'g', apiKey: '' }, 's', 'u', 5000));
    expect(e.failureClass).toBe('config');
    expect(e.message).toContain('GEMINI_API_KEY');
  });
});

describe('parseJsonObject', () => {
  test('fences, prose, arrays', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Sure! {"a":{"b":2}} hope that helps')).toEqual({ a: { b: 2 } });
    expect(() => parseJsonObject('[1,2]')).toThrow();
    expect(() => parseJsonObject('nope')).toThrow();
  });
});
