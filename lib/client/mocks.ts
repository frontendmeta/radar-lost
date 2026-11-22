// Realistic fixtures for every API response, so screens render before the
// backend lands (and as a stage fallback). Numbers agree with each other:
// a full run of 90 tasks, 87 done, Libas found 54/84, named 36/87, picked 12/87.

import type {
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
  Rate,
  RunListItem,
  RunStatus,
  SettingsBundle,
  Setup,
  SourcesBreakdown,
  Summary,
  Trace,
  Win,
} from '@/lib/api-types';

export class MockError {
  constructor(public status: number, public code: string, public message: string, public field?: string) {}
}

const rate = (n: number, of: number): Rate => ({ n, of, rate: of > 0 ? n / of : null });
const ALL: Assistant[] = ['openai', 'anthropic', 'gemini'];

// ---------- setup ----------

export const mockBrand: Brand = { id: 'brand-libas', name: 'Libas', aliases: ['Libas'], domains: ['libas.in'], isPrimary: true };

export const mockCompetitors: Brand[] = [
  { id: 'brand-jaipur-kurti', name: 'Jaipur Kurti', aliases: ['Jaipur Kurti', 'JaipurKurti'], domains: ['jaipurkurti.com'], isPrimary: false },
  { id: 'brand-janasya', name: 'Janasya', aliases: ['Janasya'], domains: ['janasya.com'], isPrimary: false },
  { id: 'brand-biba', name: 'Biba', aliases: ['Biba', 'BIBA'], domains: ['biba.in'], isPrimary: false },
  { id: 'brand-aurelia', name: 'Aurelia', aliases: ['Aurelia'], domains: ['shopforaurelia.com'], isPrimary: false },
  { id: 'brand-kalini', name: 'Kalini', aliases: ['Kalini'], domains: [], isPrimary: false },
];

export const mockMarketplaces: Marketplace[] = [
  { id: 'mkt-myntra', name: 'Myntra', domains: ['myntra.com'] },
  { id: 'mkt-ajio', name: 'Ajio', domains: ['ajio.com'] },
  { id: 'mkt-amazon', name: 'Amazon', domains: ['amazon.in'] },
  { id: 'mkt-flipkart', name: 'Flipkart', domains: ['flipkart.com'] },
  { id: 'mkt-nykaa', name: 'Nykaa Fashion', domains: ['nykaafashion.com'] },
];

export const mockProducts: Product[] = [
  {
    id: 'prod-p1', code: 'P1', name: 'White Woven Design Cotton Straight Kurta', url: 'https://www.libas.in/products/white-woven-design-cotton-kurta',
    priceInr: 503, mrpInr: 2099, sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'], fabric: 'Pure cotton', style: 'Straight kurta', deliveryDays: 1, deliveryIsSample: true,
  },
  {
    id: 'prod-p2', code: 'P2', name: 'Pink Printed Cotton Kurta Set with Dupatta', url: 'https://www.libas.in/products/pink-printed-cotton-kurta-set-with-dupatta',
    priceInr: 999, mrpInr: 2999, sizes: ['S', 'M', 'L', 'XL', 'XXL'], fabric: 'Pure cotton', style: 'Kurta set with dupatta', deliveryDays: 1, deliveryIsSample: true,
  },
  {
    id: 'prod-p3', code: 'P3', name: 'Blue Floral Print A-Line Cotton Kurti', url: 'https://www.libas.in/products/blue-floral-print-a-line-cotton-kurti',
    priceInr: 649, mrpInr: 1799, sizes: ['XS', 'S', 'M', 'L', 'XL'], fabric: 'Cotton', style: 'A-line kurti', deliveryDays: 1, deliveryIsSample: true,
  },
];

const Q = (n: number, text: string, productId: string, budgetInr: number): Query => ({
  id: `qry-q${String(n).padStart(2, '0')}`, code: `q${String(n).padStart(2, '0')}`, text, productId, budgetInr, city: 'Mumbai', deadlineDays: 1,
});

export const mockQueries: Query[] = [
  Q(1, 'Find me a pure cotton kurta for office under ₹1,500 that can be delivered in Mumbai by tomorrow. Which one should I buy, and where?', 'prod-p1', 1500),
  Q(2, "I need a white cotton straight kurta under ₹1,000, delivered to Andheri, Mumbai within a day. What's the best option?", 'prod-p1', 1000),
  Q(3, 'Cotton kurta set with dupatta under ₹1,500, delivered in Mumbai in 1 day. Pick one for me.', 'prod-p2', 1500),
  Q(4, 'Best A-line cotton kurti under ₹800 for daily wear, delivered to Mumbai tomorrow.', 'prod-p3', 800),
  Q(5, "I'm in Bandra, Mumbai. I need a festive-looking cotton kurta under ₹1,500 by tomorrow evening. What should I order?", 'prod-p2', 1500),
  Q(6, 'XL size cotton kurta under ₹1,200 with next-day delivery in Mumbai. Which brand and which product?', 'prod-p1', 1200),
  Q(7, 'Pure cotton kurta pant set for summer, under ₹1,500, must reach Mumbai by tomorrow. Recommend one.', 'prod-p2', 1500),
  Q(8, 'Mumbai mein kal tak delivery chahiye, cotton kurti under 1000, best kaunsi hai?', 'prod-p3', 1000),
  Q(9, "Gift for my mom: a cotton kurta under ₹1,500, delivered in Mumbai within 24 hours. What's the best pick?", 'prod-p2', 1500),
  Q(10, 'Compare the options and choose the best printed cotton kurta under ₹1,500 with 1-day delivery to Powai, Mumbai.', 'prod-p1', 1500),
];

export const mockAssistants: AssistantInfo[] = [
  { id: 'openai', label: 'ChatGPT', enabled: true, model: null, effectiveModel: 'gpt-5.1', keyPresent: true },
  { id: 'anthropic', label: 'Claude', enabled: true, model: null, effectiveModel: 'claude-sonnet-4-5', keyPresent: true },
  { id: 'gemini', label: 'Gemini', enabled: true, model: null, effectiveModel: 'gemini-2.5-flash', keyPresent: true },
];

let setupState: Setup = {
  brand: mockBrand, products: mockProducts, competitors: mockCompetitors, marketplaces: mockMarketplaces, queries: mockQueries, assistants: mockAssistants,
};
let settingsMeta: Pick<SettingsBundle, 'runDefaults' | 'updatedAt' | 'updatedByEmail'> = {
  runDefaults: {
    attempts: 3, city: 'Mumbai', region: 'Maharashtra', country: 'IN', timezone: 'Asia/Kolkata', lat: 19.076, lng: 72.8777, extractorModel: null, fixesModel: null,
  },
  updatedAt: '2026-11-22T07:40:00.000Z',
  updatedByEmail: 'demo@lostsaleradar.app',
};

export const mockMe: Me = { email: 'demo@lostsaleradar.app', name: 'Prathm V', avatarUrl: null };

// ---------- runs ----------

const FULL = 'run-2211-full';
const PREV = 'run-2111-full';

const baseRuns: RunListItem[] = [
  { id: 'run-2211-live-1', label: 'Live test', trigger: 'live', status: 'done', createdAt: '2026-11-22T10:32:00.000Z', createdByEmail: mockMe.email, assistants: ['openai'], city: 'Mumbai', total: 1, done: 1, failed: 0, costUsd: 0.06 },
  { id: FULL, label: 'Full run', trigger: 'manual', status: 'done', createdAt: '2026-11-22T09:45:00.000Z', createdByEmail: mockMe.email, assistants: ALL, city: 'Mumbai', total: 90, done: 87, failed: 3, costUsd: 4.82 },
  { id: PREV, label: 'Full run', trigger: 'manual', status: 'done', createdAt: '2026-11-21T13:10:00.000Z', createdByEmail: mockMe.email, assistants: ALL, city: 'Mumbai', total: 90, done: 88, failed: 2, costUsd: 4.61 },
  { id: 'run-2111-claude', label: 'Claude only', trigger: 'manual', status: 'cancelled', createdAt: '2026-11-21T11:02:00.000Z', createdByEmail: mockMe.email, assistants: ['anthropic'], city: 'Mumbai', total: 30, done: 9, failed: 0, costUsd: 0.51 },
  { id: 'run-2011-pilot', label: 'Pilot', trigger: 'manual', status: 'partial', createdAt: '2026-11-20T16:25:00.000Z', createdByEmail: mockMe.email, assistants: ALL, city: 'Mumbai', total: 90, done: 71, failed: 19, costUsd: 3.9 },
];

// Runs created through the mock POST /api/runs progress with wall-clock time.
const createdRuns = new Map<string, { item: RunListItem; startedAt: number }>();

function liveProgress(id: string): RunStatus | undefined {
  const c = createdRuns.get(id);
  if (!c) return undefined;
  const elapsed = (Date.now() - c.startedAt) / 1000;
  const { total } = c.item;
  const duration = Math.max(10, total * 1.2);
  const doneN = elapsed < 2 ? 0 : Math.min(total, Math.floor(((elapsed - 2) / duration) * total));
  const status: RunStatus['status'] = elapsed < 2 ? 'queued' : doneN >= total ? 'done' : 'processing';
  const per = c.item.assistants.map((a) => ({
    assistant: a,
    total: total / c.item.assistants.length,
    done: Math.floor(doneN / c.item.assistants.length),
    failed: 0,
  }));
  return {
    ...c.item, status, done: doneN, failed: 0,
    fixesStatus: status === 'done' ? (c.item.trigger === 'live' ? 'pending' : 'done') : 'pending',
    inFlight: status === 'processing' ? Math.min(2 * c.item.assistants.length, total - doneN) : 0,
    byAssistant: per,
  };
}

function runStatusOf(id: string): RunStatus | undefined {
  const live = liveProgress(id);
  if (live) return live;
  const r = baseRuns.find((x) => x.id === id);
  if (!r) return undefined;
  const per = r.assistants.length;
  const split = (n: number, i: number) => Math.floor(n / per) + (i < n % per ? 1 : 0);
  return {
    ...r,
    fixesStatus: r.trigger === 'live' ? 'pending' : r.status === 'done' ? 'done' : 'failed',
    inFlight: 0,
    byAssistant: r.assistants.map((a, i) => ({ assistant: a, total: split(r.total, i), done: split(r.done, i), failed: split(r.failed, i) })),
  };
}

function allRuns(): RunListItem[] {
  const created = [...createdRuns.keys()].map((id) => {
    const s = liveProgress(id)!;
    const { fixesStatus: _f, inFlight: _i, byAssistant: _b, ...item } = s;
    void _f; void _i; void _b;
    return item;
  });
  return [...created.reverse(), ...baseRuns];
}

// ---------- analysis (full run, Libas in focus) ----------

// per query: [attempts, found, mentioned, picked, topWinner] for openai, anthropic, gemini
type Cell = [number, number, number, number, string];
const grid: Record<string, [Cell, Cell, Cell]> = {
  q01: [[3, 3, 2, 1, 'Biba'], [3, 2, 2, 1, 'Libas'], [3, 3, 2, 1, 'Libas']],
  q02: [[3, 2, 1, 0, 'Jaipur Kurti'], [3, 1, 1, 0, 'Jaipur Kurti'], [3, 2, 2, 1, 'Jaipur Kurti']],
  q03: [[3, 2, 2, 0, 'Biba'], [3, 2, 1, 0, 'Biba'], [3, 2, 0, 0, 'Janasya']],
  q04: [[3, 2, 2, 1, 'Libas'], [3, 2, 2, 1, 'Jaipur Kurti'], [3, 3, 2, 1, 'Libas']],
  q05: [[3, 1, 0, 0, 'Aurelia'], [3, 1, 1, 0, 'Biba'], [2, 1, 1, 0, 'Aurelia']],
  q06: [[3, 2, 1, 0, 'Jaipur Kurti'], [3, 2, 2, 1, 'Janasya'], [3, 2, 1, 0, 'Jaipur Kurti']],
  q07: [[3, 1, 0, 0, 'Biba'], [2, 1, 0, 0, 'Biba'], [3, 1, 1, 0, 'Kalini']],
  q08: [[3, 2, 2, 1, 'Jaipur Kurti'], [3, 1, 1, 0, 'Jaipur Kurti'], [3, 2, 2, 1, 'Libas']],
  q09: [[3, 1, 0, 0, 'Aurelia'], [3, 2, 1, 0, 'Biba'], [2, 1, 1, 0, 'Janasya']],
  q10: [[3, 2, 1, 0, 'Janasya'], [3, 2, 1, 1, 'Jaipur Kurti'], [3, 2, 1, 1, 'Jaipur Kurti']],
};

function mockQueryRows(assistants: Assistant[]): QueryRow[] {
  return mockQueries.map((q) => {
    const cells = grid[q.code];
    const perAssistant = ALL.map((a, i) => {
      const [attempts, found, mentioned, picked, topWinner] = cells[i];
      return { assistant: a, attempts, found, mentioned, picked, topWinner };
    }).filter((p) => assistants.includes(p.assistant));
    const n = perAssistant.reduce((s, p) => s + p.picked, 0);
    const of = perAssistant.reduce((s, p) => s + p.attempts, 0);
    return { queryId: q.id, code: q.code, text: q.text, productId: q.productId, perAssistant, picked: rate(n, of) };
  });
}

const byAssistantRows: ByAssistant[] = [
  { assistant: 'openai', done: 30, found: rate(18, 29), mentioned: rate(11, 30), picked: rate(3, 30) },
  { assistant: 'anthropic', done: 29, found: rate(17, 27), mentioned: rate(12, 29), picked: rate(4, 29) },
  { assistant: 'gemini', done: 28, found: rate(19, 28), mentioned: rate(13, 28), picked: rate(5, 28) },
];

// Per focus brand: found n, mentioned n, picked n (of 84 searched / 87 done).
const focusNumbers: Record<string, [number, number, number]> = {
  'brand-libas': [54, 36, 12],
  'brand-jaipur-kurti': [61, 41, 19],
  'brand-biba': [58, 37, 16],
  'brand-janasya': [44, 26, 10],
  'brand-aurelia': [35, 19, 8],
  'brand-kalini': [29, 14, 5],
};

function brandById(id: string | null | undefined): Brand {
  return [mockBrand, ...mockCompetitors].find((b) => b.id === id) ?? mockBrand;
}

function mockSummary(lp: URLSearchParams): Summary {
  const focus = brandById(lp.get('focus'));
  const assistants = parseAssistants(lp);
  const runId = lp.get('run') ?? FULL;
  const [f, m, p] = focusNumbers[focus.id] ?? focusNumbers['brand-libas'];
  // Assistant filter: scale counts by that assistant's share of done answers.
  const rows = byAssistantRows.filter((r) => assistants.includes(r.assistant));
  const done = rows.reduce((s, r) => s + r.done, 0);
  const share = done / 87;
  const searched = Math.round(84 * share);
  const sc = (n: number) => Math.round(n * share);
  const found = rate(sc(f), searched);
  const mentioned = rate(sc(m), done);
  const picked = rate(sc(p), done);
  const compare = lp.get('compare') === 'none'
    ? null
    : { runId: PREV, label: 'Full run', sharedPairs: 30, foundDelta: 0.04, mentionedDelta: -0.02, pickedDelta: 0.03 };
  return {
    lens: { runId, focusBrandId: focus.id, assistants, productIds: list(lp, 'products'), queryIds: list(lp, 'queries') },
    focus: { id: focus.id, name: focus.name, isPrimary: focus.isPrimary },
    done, failed: runId === FULL ? 3 : 2,
    found, mentioned, picked,
    gap: mentioned.rate !== null && picked.rate !== null ? mentioned.rate - picked.rate : null,
    budgetMisses: rate(9, 81),
    compare,
  };
}

const winsAll: [string | null, string, number][] = [
  ['brand-jaipur-kurti', 'Jaipur Kurti', 19], ['brand-biba', 'Biba', 16], ['brand-libas', 'Libas', 12],
  ['brand-janasya', 'Janasya', 10], ['brand-aurelia', 'Aurelia', 8], ['brand-kalini', 'Kalini', 5], [null, 'Other', 17],
];
const winsPer: Record<Assistant, number[]> = {
  openai: [7, 7, 3, 3, 3, 1, 6],
  anthropic: [6, 5, 4, 4, 2, 2, 6],
  gemini: [6, 4, 5, 3, 3, 2, 5],
};

function mockWins(lp: URLSearchParams): Win[] {
  const focusId = brandById(lp.get('focus')).id;
  const assistants = parseAssistants(lp);
  const picks = winsAll.map((_, i) => assistants.reduce((s, a) => s + winsPer[a][i], 0));
  const total = picks.reduce((s, n) => s + n, 0);
  return winsAll
    .map(([brandId, brandName], i) => ({
      brandId, brandName, isPrimary: brandId === mockBrand.id, isFocus: brandId === focusId, picks: picks[i], share: total ? picks[i] / total : 0,
    }))
    .sort((a, b) => (a.brandId === null ? 1 : b.brandId === null ? -1 : b.picks - a.picks));
}

const lossReasonRows: LossReasonRow[] = (
  [['delivery_unclear_or_slow', 24], ['over_budget', 14], ['missing_details', 11], ['not_found', 10], ['found_not_mentioned', 9], ['weaker_reviews', 7]] as const
).map(([reason, n]) => ({ reason, n, share: n / 75 }));

const sourcesBreakdown: SourcesBreakdown = {
  byType: [{ type: 'marketplace', n: 251 }, { type: 'listicle', n: 158 }, { type: 'brand_site', n: 97 }, { type: 'review', n: 43 }, { type: 'other', n: 63 }],
  topDomains: [
    { domain: 'myntra.com', type: 'marketplace', n: 96, focusPresent: true },
    { domain: 'ajio.com', type: 'marketplace', n: 61, focusPresent: true },
    { domain: 'amazon.in', type: 'marketplace', n: 38, focusPresent: false },
    { domain: 'libas.in', type: 'brand_site', n: 34, focusPresent: true },
    { domain: 'biba.in', type: 'brand_site', n: 27, focusPresent: false },
    { domain: 'nykaafashion.com', type: 'marketplace', n: 22, focusPresent: true },
    { domain: 'barkhaboutique.com', type: 'listicle', n: 19, focusPresent: true },
    { domain: 'jaipurkurti.com', type: 'brand_site', n: 18, focusPresent: false },
    { domain: 'flipkart.com', type: 'marketplace', n: 17, focusPresent: false },
    { domain: 'mouthshut.com', type: 'review', n: 12, focusPresent: false },
  ],
  focusPickChannels: [{ channel: 'Myntra', n: 6 }, { channel: 'libas.in', n: 4 }, { channel: 'Ajio', n: 2 }],
};

const lostSalesRows: LostSale[] = [
  {
    taskId: 'task-q03-openai-2', queryCode: 'q03', queryText: mockQueries[2].text, assistant: 'openai', outcome: 'mentioned_lost',
    winner: 'Biba', winnerPriceInr: 1299, reason: 'delivery_unclear_or_slow',
    ourProduct: { name: 'Libas cotton kurta set', priceInr: 999, deliveryDays: 1, deliveryIsSample: true },
  },
  {
    taskId: 'task-q01-anthropic-3', queryCode: 'q01', queryText: mockQueries[0].text, assistant: 'anthropic', outcome: 'mentioned_lost',
    winner: 'Jaipur Kurti', winnerPriceInr: 899, reason: 'missing_details',
    ourProduct: { name: mockProducts[0].name, priceInr: 503, deliveryDays: 1, deliveryIsSample: true },
  },
  {
    taskId: 'task-q09-openai-1', queryCode: 'q09', queryText: mockQueries[8].text, assistant: 'openai', outcome: 'mentioned_lost',
    winner: 'Aurelia', winnerPriceInr: 1199, reason: 'weaker_reviews',
    ourProduct: { name: mockProducts[1].name, priceInr: 999, deliveryDays: 1, deliveryIsSample: true },
  },
  {
    taskId: 'task-q06-gemini-2', queryCode: 'q06', queryText: mockQueries[5].text, assistant: 'gemini', outcome: 'mentioned_lost',
    winner: 'Jaipur Kurti', winnerPriceInr: 749, reason: 'size_or_stock',
    ourProduct: { name: mockProducts[0].name, priceInr: 503, deliveryDays: 1, deliveryIsSample: true },
  },
  {
    taskId: 'task-q07-anthropic-1', queryCode: 'q07', queryText: mockQueries[6].text, assistant: 'anthropic', outcome: 'found_not_mentioned',
    winner: 'Biba', winnerPriceInr: 1449, reason: null,
    ourProduct: { name: mockProducts[1].name, priceInr: 999, deliveryDays: 1, deliveryIsSample: true },
  },
  {
    taskId: 'task-q05-gemini-1', queryCode: 'q05', queryText: mockQueries[4].text, assistant: 'gemini', outcome: 'not_found',
    winner: 'Aurelia', winnerPriceInr: 1350, reason: 'not_found',
    ourProduct: { name: mockProducts[1].name, priceInr: 999, deliveryDays: 1, deliveryIsSample: true },
  },
];

const mockFixes: Fix[] = [
  {
    ord: 1, fixType: 'listing', title: 'Show Mumbai delivery dates on product pages',
    why: "24 of 75 losses were 'delivery unclear'.",
    action: "Put 'Delivered by tomorrow' for Mumbai pincodes in the page itself, not only after a pincode check.",
    evidenceTaskIds: ['task-q03-openai-2', 'task-q01-anthropic-3'],
  },
  {
    ord: 2, fixType: 'marketplace', title: 'Fix your Myntra listings first',
    why: 'Myntra was read 96 times, more than any other site, and brought 6 of your 12 wins.',
    action: 'Add fabric, a text size chart and the delivery promise to your top 3 Myntra listings.',
    evidenceTaskIds: ['task-q06-gemini-2'],
  },
  {
    ord: 3, fixType: 'content', title: "Get into the 'best under ₹1,500' guides",
    why: 'Buying guides were 158 of 612 pages read.',
    action: 'Pitch your cotton kurta sets to the 5 most-read guides.',
    evidenceTaskIds: ['task-q07-anthropic-1', 'task-q05-gemini-1'],
  },
];

function mockTrace(taskId: string): Trace {
  const q = mockQueries[2];
  return {
    taskId, runId: taskId.startsWith('task-live') ? taskId.replace('task-live-', '') : FULL,
    assistant: 'openai', model: 'gpt-5.1', attempt: taskId.startsWith('task-live') ? 1 : 2, webSearched: true,
    query: q, ourProduct: mockProducts[1],
    promptText: `${q.text}\n\nYou are shopping for me. Search the web, compare real options, and recommend exactly one product with a link, price and delivery estimate to Mumbai.`,
    searches: [
      'cotton kurta set with dupatta under 1500',
      'kurta set with dupatta next day delivery Mumbai',
      'best cotton kurta sets under ₹1500 2026',
      'Biba cotton kurta set dupatta Myntra',
    ],
    sources: [
      { url: 'https://www.myntra.com/kurta-sets/biba/biba-women-printed-pure-cotton-kurta-with-trousers-dupatta', title: 'Biba Women Printed Pure Cotton Kurta Set with Dupatta', domain: 'myntra.com', type: 'marketplace', brand: 'Biba', cited: true },
      { url: 'https://www.barkhaboutique.com/blog/best-kurta-sets-under-1500', title: '12 Best Cotton Kurta Sets Under ₹1,500 (2026)', domain: 'barkhaboutique.com', type: 'listicle', brand: null, cited: true },
      { url: 'https://www.libas.in/collections/kurta-sets', title: 'Kurta Sets for Women — Libas', domain: 'libas.in', type: 'brand_site', brand: 'Libas', cited: false },
      { url: 'https://www.ajio.com/libas-printed-cotton-kurta-set/p/469', title: 'Libas Printed Cotton Kurta Set with Dupatta | AJIO', domain: 'ajio.com', type: 'marketplace', brand: 'Libas', cited: false },
      { url: 'https://www.janasya.com/collections/kurta-sets', title: 'Janasya Cotton Kurta Sets', domain: 'janasya.com', type: 'brand_site', brand: 'Janasya', cited: false },
      { url: 'https://www.mouthshut.com/product-reviews/biba-reviews', title: 'Biba Reviews — MouthShut', domain: 'mouthshut.com', type: 'review', brand: 'Biba', cited: false },
    ],
    answerText:
      "I'd go with the **Biba Printed Pure Cotton Kurta Set with Dupatta** on Myntra for ₹1,299. It's under your ₹1,500 budget, it's 100% cotton, and Myntra shows delivery to Mumbai by tomorrow for most pincodes.\n\nAlso worth a look: Libas has a similar printed cotton set for ₹999, but I couldn't confirm a delivery date for Mumbai on its page, so I can't promise it arrives in a day. Janasya's sets start around ₹1,100 but most were out of stock in M and L.",
    mentioned: ['Biba', 'Libas', 'Janasya'],
    shortlist: ['Biba', 'Libas'],
    pick: { brand: 'Biba', product: 'Printed Pure Cotton Kurta Set with Dupatta', priceInr: 1299, channel: 'Myntra', url: 'https://www.myntra.com/kurta-sets/biba/biba-women-printed-pure-cotton-kurta-with-trousers-dupatta', deliveryDays: 1 },
    fitsBudget: 'yes', fitsDeadline: 'yes',
    outcomes: [
      { brandId: 'brand-biba', brandName: 'Biba', outcome: 'picked', reason: null, note: 'Clear 1-day Mumbai delivery on Myntra' },
      { brandId: 'brand-libas', brandName: 'Libas', outcome: 'mentioned_lost', reason: 'delivery_unclear_or_slow', note: "Couldn't confirm a Mumbai delivery date on the page" },
      { brandId: 'brand-janasya', brandName: 'Janasya', outcome: 'mentioned_lost', reason: 'size_or_stock', note: 'Out of stock in M and L' },
      { brandId: 'brand-jaipur-kurti', brandName: 'Jaipur Kurti', outcome: 'found_not_mentioned', reason: null, note: null },
      { brandId: 'brand-aurelia', brandName: 'Aurelia', outcome: 'not_found', reason: 'not_found', note: null },
      { brandId: 'brand-kalini', brandName: 'Kalini', outcome: 'not_found', reason: 'not_found', note: null },
    ],
    reasoningExcerpt:
      'Both Biba and Libas fit the budget. Biba on Myntra states delivery by tomorrow for Mumbai; Libas shows no delivery estimate without a pincode check, so the deadline is uncertain. Choosing Biba.',
  };
}

const mockHealth = (): Health => ({
  processorReachable: true,
  lastKickAt: new Date(Date.now() - 40_000).toISOString(),
  lastKickStatus: 'ok',
  leaseUntil: null,
  queuedTasks: 0,
  oldestQueuedAgeSec: null,
  openBreakers: [],
  keysPresent: { openai: true, anthropic: true, gemini: true },
});

// ---------- provider keys ----------

const KEY_LABEL: Record<Assistant, string> = { openai: 'ChatGPT', anthropic: 'Claude', gemini: 'Gemini' };
let keyState: ProviderKeyInfo[] = [
  { assistant: 'openai', label: 'ChatGPT', source: 'ui', last4: '4f2a', keyPresent: true, updatedAt: '2026-11-22T07:52:00.000Z', updatedByEmail: 'demo@lostsaleradar.app' },
  { assistant: 'anthropic', label: 'Claude', source: 'env', last4: null, keyPresent: true, updatedAt: null, updatedByEmail: null },
  { assistant: 'gemini', label: 'Gemini', source: null, last4: null, keyPresent: false, updatedAt: null, updatedByEmail: null },
];

function saveMockKey(assistant: Assistant, body: Body): unknown {
  const key = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
  if (!key) return new MockError(400, 'bad_request', 'apiKey is required', 'apiKey');
  if (key.length < 20 || key.length > 400 || /\s/.test(key)) return new MockError(400, 'bad_key', 'The key looks malformed (20–400 characters, no spaces)', 'apiKey');
  if (/invalid/i.test(key)) return new MockError(400, 'key_invalid', `${KEY_LABEL[assistant]} rejected this key`, 'apiKey');
  const info: ProviderKeyInfo = {
    assistant, label: KEY_LABEL[assistant], source: 'ui', last4: key.slice(-4), keyPresent: true, updatedAt: new Date().toISOString(), updatedByEmail: mockMe.email,
  };
  keyState = keyState.map((k) => (k.assistant === assistant ? info : k));
  return { ...info, verified: body.verify !== false };
}

// ---------- helpers ----------

function list(p: URLSearchParams, key: string): string[] {
  const v = p.get(key);
  return v ? v.split(',').filter(Boolean) : [];
}
function parseAssistants(p: URLSearchParams): Assistant[] {
  const a = list(p, 'assistants').filter((x): x is Assistant => (ALL as string[]).includes(x));
  return a.length ? a : ALL;
}
let seq = 0;
const newId = (prefix: string) => `${prefix}-mock-${Date.now().toString(36)}-${seq++}`;

function lensOptions(): LensOptions {
  return {
    runs: allRuns().filter((r) => r.trigger === 'manual' && (r.status === 'done' || r.status === 'partial')),
    brands: [setupState.brand, ...setupState.competitors],
    assistants: setupState.assistants,
    products: setupState.products,
    queries: setupState.queries,
  };
}

function settingsBundle(): SettingsBundle {
  return { ...setupState, ...settingsMeta };
}
function touch() {
  settingsMeta = { ...settingsMeta, updatedAt: new Date().toISOString(), updatedByEmail: mockMe.email };
}

type Body = Record<string, unknown>;

/** Collection CRUD on the in-memory setup. */
function crud<K extends 'competitors' | 'marketplaces' | 'products' | 'queries'>(
  key: K, method: string, id: string | undefined, body: Body, make: (b: Body) => Setup[K][number],
): unknown {
  const items = setupState[key] as Setup[K][number][];
  if (method === 'POST') {
    const item = make(body);
    setupState = { ...setupState, [key]: [...items, item] };
    touch();
    return item;
  }
  const idx = items.findIndex((x) => x.id === id);
  if (idx < 0) return new MockError(404, 'not_found', `No ${key.slice(0, -1)} ${id}`);
  if (method === 'DELETE') {
    setupState = { ...setupState, [key]: items.filter((x) => x.id !== id) };
    touch();
    return { ok: true };
  }
  const merged = { ...items[idx], ...body } as Setup[K][number];
  if (key === 'queries') (merged as Query).id = newId('qry');
  setupState = { ...setupState, [key]: items.map((x, i) => (i === idx ? merged : x)) };
  touch();
  return merged;
}

// ---------- router ----------

export function mockResponse(method: string, url: string, body: unknown): unknown {
  const u = new URL(url, 'http://mock.local');
  const path = u.pathname.replace(/\/+$/, '');
  const lp = u.searchParams;
  const b = (body ?? {}) as Body;
  const seg = path.split('/').filter(Boolean); // ['api', ...]

  if (method === 'GET') {
    switch (path) {
      case '/api/me': return mockMe;
      case '/api/setup': return { ...setupState, assistants: setupState.assistants.filter((a) => a.enabled) };
      case '/api/health': return mockHealth();
      case '/api/runs': {
        const status = lp.get('status');
        const trigger = lp.get('trigger');
        return allRuns().filter((r) => (!status || r.status === status) && (!trigger || r.trigger === trigger));
      }
      case '/api/runs/latest': return runStatusOf(FULL);
      case '/api/analysis/summary': return mockSummary(lp);
      case '/api/analysis/by-assistant': return byAssistantRows.filter((r) => parseAssistants(lp).includes(r.assistant));
      case '/api/analysis/wins': return mockWins(lp);
      case '/api/analysis/loss-reasons': return lossReasonRows;
      case '/api/analysis/sources': return sourcesBreakdown;
      case '/api/analysis/queries': return mockQueryRows(parseAssistants(lp));
      case '/api/analysis/lost-sales': {
        const run = lp.get('run');
        const limit = Number(lp.get('limit') ?? 10);
        if (run && createdRuns.has(run)) {
          return [{ ...lostSalesRows[0], taskId: `task-live-${run}`, assistant: createdRuns.get(run)!.item.assistants[0] }];
        }
        const as = parseAssistants(lp);
        return lostSalesRows.filter((l) => as.includes(l.assistant)).slice(0, limit);
      }
      case '/api/lens/options': return lensOptions();
      case '/api/settings': return settingsBundle();
      case '/api/settings/keys': return keyState;
    }
    if (seg[1] === 'runs' && seg.length === 3) return runStatusOf(seg[2]) ?? new MockError(404, 'not_found', 'Run not found');
    if (seg[1] === 'runs' && seg[3] === 'fixes') return seg[2] === FULL || seg[2] === PREV ? mockFixes : [];
    if (seg[1] === 'tasks' && seg[3] === 'trace') return mockTrace(seg[2]);
    return undefined;
  }

  if (path === '/api/runs' && method === 'POST') {
    const assistants = (Array.isArray(b.assistants) && b.assistants.length ? b.assistants : ALL) as Assistant[];
    const attempts = typeof b.attempts === 'number' ? b.attempts : 3;
    const queryIds = Array.isArray(b.queryIds) && b.queryIds.length ? b.queryIds : mockQueries.map((q) => q.id);
    const trigger = b.trigger === 'live' ? 'live' : 'manual';
    const id = newId(trigger === 'live' ? 'run-live' : 'run');
    createdRuns.set(id, {
      startedAt: Date.now(),
      item: {
        id, label: typeof b.label === 'string' ? b.label : trigger === 'live' ? 'Live test' : 'Full run', trigger, status: 'queued',
        createdAt: new Date().toISOString(), createdByEmail: mockMe.email, assistants, city: 'Mumbai',
        total: assistants.length * attempts * queryIds.length, done: 0, failed: 0, costUsd: null,
      },
    });
    return { runId: id };
  }
  if (seg[1] === 'runs' && method === 'POST') {
    const run = seg[2];
    if (seg[3] === 'stop') {
      const c = createdRuns.get(run);
      if (c) createdRuns.set(run, { ...c, item: { ...c.item, status: 'cancelled' }, startedAt: -Infinity });
    }
    return { ok: true };
  }

  if (seg[1] === 'settings') {
    const id = seg[3];
    switch (seg[2]) {
      case 'keys': {
        const a = id as Assistant;
        if (!ALL.includes(a)) return new MockError(404, 'not_found', `Assistant ${id} not found`);
        if (method === 'PUT') return saveMockKey(a, b);
        if (method === 'DELETE') {
          keyState = keyState.map((k) => (k.assistant === a ? { ...k, source: null, last4: null, keyPresent: false, updatedAt: new Date().toISOString(), updatedByEmail: mockMe.email } : k));
          return { ok: true };
        }
        return undefined;
      }
      case 'run-defaults':
        settingsMeta = { ...settingsMeta, runDefaults: { ...settingsMeta.runDefaults, ...(b as object) } };
        touch();
        return settingsMeta.runDefaults;
      case 'brand':
        setupState = { ...setupState, brand: { ...setupState.brand, ...(b as object) } };
        touch();
        return setupState.brand;
      case 'competitors':
        return crud('competitors', method, id, b, (x) => ({ id: newId('brand'), name: String(x.name ?? ''), aliases: (x.aliases as string[]) ?? [], domains: (x.domains as string[]) ?? [], isPrimary: false }));
      case 'marketplaces':
        return crud('marketplaces', method, id, b, (x) => ({ id: newId('mkt'), name: String(x.name ?? ''), domains: (x.domains as string[]) ?? [] }));
      case 'products':
        return crud('products', method, id, b, (x) => ({ mrpInr: null, deliveryDays: null, ...(x as object), id: newId('prod') }) as Product);
      case 'queries':
        return crud('queries', method, id, b, (x) => ({ ...(x as object), id: newId('qry'), code: `q${String(setupState.queries.length + 1).padStart(2, '0')}` }) as Query);
      case 'assistants': {
        const a = setupState.assistants.find((x) => x.id === id);
        if (!a) return new MockError(404, 'not_found', 'Unknown assistant');
        const next = { ...a, ...(b as object) } as AssistantInfo;
        setupState = { ...setupState, assistants: setupState.assistants.map((x) => (x.id === id ? next : x)) };
        touch();
        return next;
      }
    }
  }
  return undefined;
}
