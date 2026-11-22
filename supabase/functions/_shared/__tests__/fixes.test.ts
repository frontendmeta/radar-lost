import { describe, expect, test } from 'bun:test';
import { ProviderError } from '../errors.ts';
import { buildFixesPrompt, FIX_TYPES, heuristicFixes, inputFacts, modelFixes, validateFixes, writeFixes } from '../fixes.ts';
import type { ModelCfg } from '../types.ts';
import sample from './fixes_input.sample.json';

const CFG: ModelCfg = { provider: 'anthropic', model: 'claude-haiku-5-5', apiKey: 'k' };
const T1 = '66666666-0000-0000-0000-000000000001';
const T2 = '66666666-0000-0000-0000-000000000002';
const EMPTY = { run: null, summary: { done_tasks: 0, found: 0, picked: 0, mentioned: 0, web_searched_tasks: 0 }, products: [], top_domains: [], top_winners: [], by_assistant: [], loss_reasons: [], primary_brand: null, top_lost_sales: [] };

const goodFixes = {
  fixes: [
    { title: 'Fix the Myntra listing', why: 'Libas lost 2 of 2 Myntra-led tasks; Biba won at ₹1,199 vs our ₹503 (gap 696).', action: 'Put the Mumbai delivery promise in the listing text at https://www.libas.in/p1', fix_type: 'marketplace', evidence: { task_ids: [T1, T2], numbers: { lost_tasks: 2, tasks: 2, winner_price_inr: 1199 } } },
    { title: 'Pitch the buying guide', why: 'blog.example.com was cited in 1 lost task (50% of the 2 lost).', action: 'Pitch Libas to https://blog.example.com/best-kurtas', fix_type: 'pr', evidence: { task_ids: [T2], numbers: { tasks: 1, pct: 50 } } },
    { title: 'Put delivery in libas.in HTML', why: 'Libas was found in 1 of 2 searched tasks.', action: 'Render price, stock and delivery in the page HTML.', fix_type: 'site', evidence: { task_ids: [], numbers: { found: 1 } } },
  ],
};

function fakeSb(input: unknown, opts: { rpcError?: string } = {}) {
  const log: { op: string; args: unknown[] }[] = [];
  const sb = {
    rpc: async (...args: unknown[]) => { log.push({ op: 'rpc', args }); return opts.rpcError ? { data: null, error: { message: opts.rpcError } } : { data: input, error: null }; },
    from: (table: string) => ({
      update: (vals: unknown) => ({ eq: async (...args: unknown[]) => { log.push({ op: `update:${table}`, args: [vals, ...args] }); return { error: null }; } }),
      upsert: async (rows: unknown, o: unknown) => { log.push({ op: `upsert:${table}`, args: [rows, o] }); return { error: null }; },
    }),
  };
  return { sb, log };
}

describe('inputFacts / validateFixes', () => {
  const facts = inputFacts(sample);
  test('collects task ids and URLs from the input', () => {
    expect(facts.taskIds.has(T1)).toBe(true);
    expect(facts.taskIds.has('66666666-0000-0000-0000-000000000003')).toBe(true);
    expect(facts.urls.has('https://www.libas.in/p1')).toBe(true);
    expect(facts.numbers.has(1199)).toBe(true);
    expect(facts.numbers.has(1500)).toBe(true);
  });
  test('accepts grounded fixes (derived % and gaps allowed)', () => {
    const r = validateFixes(goodFixes, facts);
    expect(r.error).toBeNull();
    expect(r.fixes!.length).toBe(3);
    expect(r.fixes![0].fix_type).toBe('marketplace');
  });
  test('rejects bad enum, unknown task ids, invented numbers and links, wrong count', () => {
    const bad = structuredClone(goodFixes);
    bad.fixes[0].fix_type = 'seo';
    bad.fixes[1].evidence.task_ids = ['deadbeef-0000-0000-0000-000000000000'];
    bad.fixes[2].why = 'Libas lost 4,321 sales last quarter.';
    bad.fixes[2].action = 'See https://invented.example/page';
    const r = validateFixes(bad, facts);
    expect(r.fixes).toBeNull();
    expect(r.error).toContain('fix_type');
    expect(r.error).toContain('deadbeef');
    expect(r.error).toContain('4321');
    expect(r.error).toContain('invented.example');
    expect(validateFixes({ fixes: goodFixes.fixes.slice(0, 2) }, facts).error).toContain('exactly 3');
    expect(validateFixes({}, facts).error).toContain('exactly 3');
  });
  test('prompt fences the run data and lists every fix type', () => {
    const { system, user } = buildFixesPrompt(sample);
    expect(user).toContain('<untrusted_run_data>');
    for (const t of FIX_TYPES) expect(system).toContain(t);
    expect(system).toContain('Libas');
    expect(user.length).toBeLessThan(20_000);
  });
});

describe('modelFixes', () => {
  test('repairs once, then succeeds', async () => {
    const replies = ['{"fixes": []}', JSON.stringify(goodFixes)];
    const users: string[] = [];
    const r = await modelFixes(sample, CFG, { call: async (_c, _s, u) => { users.push(u); return { text: replies[users.length - 1], usage: null }; } });
    expect(users.length).toBe(2);
    expect(users[1]).toContain('exactly 3');
    expect(r.fixes.length).toBe(3);
  });
  test('fails after one repair with ProviderError unknown', async () => {
    let n = 0;
    const p = modelFixes(sample, CFG, { call: async () => { n++; return { text: 'nope', usage: null }; } });
    await expect(p).rejects.toBeInstanceOf(ProviderError);
    await p.catch((e: ProviderError) => expect(e.failureClass).toBe('unknown'));
    expect(n).toBe(2);
  });
});

describe('heuristicFixes', () => {
  for (const [name, input] of [['sample', sample], ['empty run', EMPTY]] as const) {
    test(`3 valid, grounded fixes for ${name}`, () => {
      const fixes = heuristicFixes(input);
      expect(fixes.length).toBe(3);
      expect(new Set(fixes.map((f) => f.title)).size).toBe(3);
      const r = validateFixes({ fixes }, inputFacts(input));
      expect(r.error).toBeNull();
    });
  }
});

describe('writeFixes', () => {
  test('fake mode: rpc, upsert 3 rows on (run_id, ord), status running -> done', async () => {
    const { sb, log } = fakeSb(sample);
    await writeFixes(sb, 'run-1', CFG, { fake: true });
    expect(log.map((l) => l.op)).toEqual(['update:runs', 'rpc', 'upsert:run_fixes', 'update:runs']);
    expect(log[1].args).toEqual(['fixes_input', { p_run_id: 'run-1' }]);
    const [rows, o] = log[2].args as [{ run_id: string; ord: number }[], unknown];
    expect(rows.map((r) => [r.run_id, r.ord])).toEqual([['run-1', 1], ['run-1', 2], ['run-1', 3]]);
    expect(o).toEqual({ onConflict: 'run_id,ord' });
    expect((log[3].args[0] as { fixes_status: string }).fixes_status).toBe('done');
  });
  test('model mode with injected call', async () => {
    const { sb, log } = fakeSb(sample);
    await writeFixes(sb, 'run-1', CFG, { call: async () => ({ text: JSON.stringify(goodFixes), usage: null }) });
    expect((log.at(-1)!.args[0] as { fixes_status: string }).fixes_status).toBe('done');
  });
  test('failure sets fixes_status failed and throws ProviderError', async () => {
    const { sb, log } = fakeSb(sample);
    const p = writeFixes(sb, 'run-1', CFG, { call: async () => ({ text: '{}', usage: null }) });
    await expect(p).rejects.toBeInstanceOf(ProviderError);
    expect((log.at(-1)!.args[0] as { fixes_status: string }).fixes_status).toBe('failed');
    expect(log.some((l) => l.op.startsWith('upsert'))).toBe(false);
  });
  test('rpc error -> failed', async () => {
    const { sb, log } = fakeSb(null, { rpcError: 'boom' });
    await expect(writeFixes(sb, 'run-1', CFG, { fake: true })).rejects.toBeInstanceOf(ProviderError);
    expect((log.at(-1)!.args[0] as { fixes_status: string }).fixes_status).toBe('failed');
  });
});
