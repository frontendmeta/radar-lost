// Deterministic fake shopper (FAKE_PROVIDERS=true): no network, plausible kurta-shopping answers
// that name 2–4 seeded brands and pick one, with 3–6 sources and a couple of searches.
// Output varies by a hash of prompt + model + attempt, so runs produce varied but repeatable data.
// Optional env: FAKE_LATENCY_MS (max simulated latency, default 2500), FAKE_FAIL_RATE (0–1, share
// of calls that throw a retryable 429, default 0).
import { ProviderError } from '../errors.ts';
import type { Assistant, ShopperAdapter, ShopperResult } from '../types.ts';
import { sleep } from './util.ts';

interface FakeBrand { name: string; slug: string; site: string | null }
const BRANDS: FakeBrand[] = [
  { name: 'Libas', slug: 'libas', site: 'libas.in' },
  { name: 'Biba', slug: 'biba', site: 'biba.in' },
  { name: 'Janasya', slug: 'janasya', site: null },
  { name: 'Jaipur Kurti', slug: 'jaipur-kurti', site: null },
  { name: 'Aurelia', slug: 'aurelia', site: null },
  { name: 'Kalini', slug: 'kalini', site: null },
];
const PRODUCTS = [
  'Pure Cotton Straight Kurta', 'Printed Cotton A-Line Kurti', 'Cotton Kurta Set with Dupatta',
  'Block Print Cotton Kurta', 'Solid Cotton Straight Kurta', 'Cotton Kurta Pant Set',
];
const DELIVERY = ['next-day delivery to Mumbai', 'delivery in 1–2 days', 'delivery in 2–4 days', 'no clear delivery date for Mumbai'];
const WHY = [
  'it fits the budget and Myntra shows next-day delivery for Mumbai pincodes',
  'it has strong reviews (4.3★ from thousands of ratings) and a clear size chart',
  'the fabric is 100% cotton and it is in stock in all sizes including XL',
  'it is the best value here and arrives by tomorrow',
];

function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function rng(seed: number): () => number {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickN<T>(r: () => number, arr: T[], n: number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a.slice(0, n);
}

export function makeFakeShopper(assistant: Assistant, attempt: number): ShopperAdapter {
  return async ({ prompt, model, location }): Promise<ShopperResult> => {
    const t0 = Date.now();
    const seed = hash32(`${prompt}|${model}|${attempt}`);
    const r = rng(seed);
    const maxLatency = Number(Deno.env.get('FAKE_LATENCY_MS') ?? '2500');
    await sleep(Math.round(300 + r() * Math.max(0, maxLatency - 300)));
    const failRate = Number(Deno.env.get('FAKE_FAIL_RATE') ?? '0');
    if (failRate > 0 && r() < failRate) throw new ProviderError('retryable', `fake ${assistant} HTTP 429: rate limited`, 5, 429);

    const budget = Number(/(?:₹|rs\.?\s*|under\s+)(\d[\d,]*)/i.exec(prompt)?.[1]?.replace(/,/g, '') ?? '1500') || 1500;
    const city = location.city || 'Mumbai';
    // Libas appears in most answers so the focus brand has real funnel data.
    const others = BRANDS.filter((b) => b.name !== 'Libas');
    const n = 2 + Math.floor(r() * 3); // 2–4 brands
    const named = r() < 0.8 ? [BRANDS[0], ...pickN(r, others, n - 1)] : pickN(r, others, n);
    const pickIdx = Math.floor(r() * named.length);
    const pick = named[pickIdx];

    const lines = named.map((b, i) => {
      const product = PRODUCTS[Math.floor(r() * PRODUCTS.length)];
      const over = r() < 0.2;
      const price = over ? budget + 100 + Math.floor(r() * 600) : Math.max(399, Math.floor(budget * (0.45 + r() * 0.5) / 10) * 10 - 1);
      const deliv = i === pickIdx ? DELIVERY[Math.floor(r() * 2)] : DELIVERY[Math.floor(r() * DELIVERY.length)];
      const where = b.site && r() < 0.5 ? b.site : 'Myntra';
      return { b, product, price, deliv, where, text: `${i + 1}. **${b.name} ${product}** – ₹${price} on ${where}, ${deliv}.` };
    });
    const p = lines[pickIdx];
    const answerText = [
      `I searched for cotton kurtas under ₹${budget} that can reach ${city} quickly. Here are the best options I found:`,
      '',
      ...lines.map((l) => l.text),
      '',
      `**My pick: ${pick.name} ${p.product}** (₹${p.price} on ${p.where}) – ${WHY[Math.floor(r() * WHY.length)]}.`,
      r() < 0.3 ? 'Tip: Jaipuri kurti styles in block print are also popular for office wear.' : '',
    ].filter((x, i, a) => x !== '' || a[i - 1] !== '').join('\n').trim();

    // Sources: 3–6 from Myntra, brand sites and a listicle.
    const pool: { url: string; title: string }[] = [];
    for (const l of lines) {
      const id = 10_000_000 + (hash32(`${l.b.slug}${l.product}`) % 89_999_999);
      const slug = l.product.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      pool.push({ url: `https://www.myntra.com/kurtas/${l.b.slug}/${l.b.slug}-women-${slug}/${id}/buy`, title: `${l.b.name} Women ${l.product} | Myntra` });
      if (l.b.site) pool.push({ url: `https://www.${l.b.site}/products/${slug}-${id % 10000}`, title: `${l.product} – ${l.b.name}` });
    }
    const listicle = { url: `https://stylebook.example/best-cotton-kurtas-under-${budget}`, title: `10 Best Cotton Kurtas Under ₹${budget} in India (2026)` };
    const count = Math.min(pool.length + 1, 3 + Math.floor(r() * 4));
    const chosen = [listicle, ...pickN(r, pool, count - 1)];
    // Make sure the pick's own listing is present so pick_url can be matched.
    const pickUrl = pool.find((s) => s.title.startsWith(pick.name) || s.title.includes(`– ${pick.name}`));
    if (pickUrl && !chosen.includes(pickUrl)) chosen[chosen.length - 1] = pickUrl;
    const sources = chosen.map((s, i) => ({ url: s.url, title: s.title, cited: i === 0 || s === pickUrl || r() < 0.4 }));

    const searches = [
      `cotton kurta under ${budget} ${city} next day delivery`,
      r() < 0.5 ? `best cotton kurta brands under ${budget} india` : `${named[0].name} vs ${named[1].name} cotton kurta`,
    ];

    const latencyMs = Date.now() - t0;
    return {
      answerText,
      webSearched: true,
      searches,
      sources,
      raw: { fake: true, assistant, model, attempt, seed },
      usage: { fake: true, input_tokens: 0, output_tokens: 0 },
      latencyMs,
    };
  };
}
