// Source typing and literal brand matching. Pure functions, no model calls, no Deno APIs.
import type { BrandRow, MarketplaceRow, SourceType, TypedSource } from './types.ts';

// --- Domains -------------------------------------------------------------------

/** Lowercase hostname without port or trailing dot ('' when nothing usable). */
export function hostOf(urlOrHost: string): string {
  const s = String(urlOrHost ?? '').trim().toLowerCase();
  if (!s) return '';
  let host = '';
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//.test(s) ? s : `http://${s}`).hostname;
  } catch {
    host = s.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split(/[/?#]/)[0].split('@').pop() ?? '';
    host = host.replace(/:\d*$/, '');
  }
  host = host.replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  return /^[a-z0-9.\-_:]+$/.test(host) ? host : '';
}

/** Host with leading `www.` / `m.` stripped (repeatedly), e.g. https://m.www.Myntra.com:443/x -> myntra.com */
export function rootDomain(urlOrHost: string): string {
  let host = hostOf(urlOrHost);
  while (/^(www\d*|m)\./.test(host) && host.split('.').length > 2) host = host.replace(/^(www\d*|m)\./, '');
  return host;
}

/** True when `root` is `domain` or a subdomain of it (domain list entries are normalized first). */
export function domainMatches(root: string, domain: string): boolean {
  const d = rootDomain(domain);
  if (!root || !d) return false;
  return root === d || root.endsWith(`.${d}`);
}

function inDomains(root: string, domains: string[] | null | undefined): boolean {
  return (domains ?? []).some((d) => domainMatches(root, d));
}

// --- Text ----------------------------------------------------------------------

/** NFKD, strip diacritics, lowercase, punctuation -> space, collapse whitespace. */
export function normalizeText(s: string): string {
  return String(s ?? '')
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Pre-normalized haystack so many aliases can be checked against one long answer. */
export interface TextIndex { spaced: string; tokens: Set<string> }
export function indexText(text: string): TextIndex {
  const norm = normalizeText(text);
  return { spaced: ` ${norm} `, tokens: new Set(norm ? norm.split(' ') : []) };
}

/** Word-bounded literal match ignoring case, spacing and accents. A multi-word alias also
 *  matches its spaceless form ("Nykaa Fashion" ~ "NykaaFashion"). */
export function aliasInIndex(idx: TextIndex, alias: string): boolean {
  const a = normalizeText(alias);
  if (!a) return false;
  if (idx.spaced.includes(` ${a} `)) return true;
  if (a.includes(' ')) return idx.tokens.has(a.replace(/ /g, ''));
  return false;
}

export function aliasInText(text: string, alias: string): boolean {
  return aliasInIndex(indexText(text), alias);
}

/** Every alias of a brand, its name included, de-duplicated by normalized form. */
export function brandAliases(b: Pick<BrandRow, 'name' | 'aliases'>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [b.name, ...(b.aliases ?? [])]) {
    const n = normalizeText(a ?? '');
    if (n && !seen.has(n)) { seen.add(n); out.push(a); }
  }
  return out;
}

/** Aliases of `b` that literally appear in the indexed text. */
export function matchedAliases(idx: TextIndex, b: Pick<BrandRow, 'name' | 'aliases'>): string[] {
  return brandAliases(b).filter((a) => aliasInIndex(idx, a));
}

/** Resolve a free-text brand name (from a model) to a tracked brand by exact normalized alias. */
export function resolveBrand(name: unknown, brands: BrandRow[]): BrandRow | null {
  if (typeof name !== 'string') return null;
  const n = normalizeText(name);
  if (!n) return null;
  const compact = n.replace(/ /g, '');
  for (const b of brands) {
    for (const a of brandAliases(b)) {
      const na = normalizeText(a);
      if (na === n || na.replace(/ /g, '') === compact) return b;
    }
  }
  return null;
}

// --- Source typing ---------------------------------------------------------------

const REVIEW_SITES = ['trustpilot.com', 'mouthshut.com', 'sitejabber.com', 'consumeraffairs.com', 'reviews.io', 'yelp.com', 'productreview.com.au'];
const LISTICLE_RE = /(^| )(best|top \d+|under (rs |inr )?\d+|list|lists|listicle|vs|versus)( |$)/;
const GEMINI_REDIRECT_RE = /(^|\.)vertexaisearch\.cloud\.google\.com$/;
const HOSTLIKE_RE = /^[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function safeDecode(s: string): string {
  try { return decodeURIComponent(s); } catch { return s; }
}

function urlParts(url: string): { host: string; pathAndQuery: string; path: string } {
  try {
    const u = new URL(url);
    return { host: u.hostname.toLowerCase(), pathAndQuery: safeDecode(u.pathname + u.search), path: safeDecode(u.pathname) };
  } catch {
    const rest = String(url ?? '').replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
    const i = rest.search(/[/?#]/);
    const tail = i >= 0 ? rest.slice(i).split('#')[0] : '';
    return { host: hostOf(url), pathAndQuery: safeDecode(tail), path: safeDecode(tail.split('?')[0]) };
  }
}

/** First brand whose alias appears in any of the given texts (texts checked in order). */
function brandIn(texts: string[], brands: BrandRow[]): string | null {
  for (const t of texts) {
    if (!t) continue;
    const idx = indexText(t);
    for (const b of brands) if (matchedAliases(idx, b).length) return b.id;
  }
  return null;
}

/** Type one source by the spec's ordered rules. */
export function classifySource(
  src: { url: string; title: string },
  brands: BrandRow[],
  marketplaces: MarketplaceRow[],
): { domain: string; root_domain: string; source_type: SourceType; brand_id: string | null; marketplace_id: string | null } {
  const { host, pathAndQuery, path } = urlParts(src.url);
  let domain = host;
  // Unresolved Gemini redirect: the adapter keeps the redirect URL and the chunk title is the publisher domain.
  if (GEMINI_REDIRECT_RE.test(host) && HOSTLIKE_RE.test((src.title ?? '').trim())) domain = src.title.trim().toLowerCase();
  const root = rootDomain(domain);
  const base = { domain, root_domain: root };

  // 1. brand's own domain
  const own = brands.find((b) => inDomains(root, b.domains));
  if (own) return { ...base, source_type: 'brand_site', brand_id: own.id, marketplace_id: null };

  // 2. marketplace; brand_id when an alias appears in the URL path or the title
  const mp = marketplaces.find((m) => inDomains(root, m.domains));
  if (mp) return { ...base, source_type: 'marketplace', brand_id: brandIn([pathAndQuery, src.title ?? ''], brands), marketplace_id: mp.id };

  // 3. listicle: best / top N / under ₹N / list / vs in title or URL
  const titleN = normalizeText(src.title ?? '');
  const urlN = normalizeText(`${host} ${path}`);
  if (LISTICLE_RE.test(titleN) || LISTICLE_RE.test(urlN)) return { ...base, source_type: 'listicle', brand_id: null, marketplace_id: null };

  // 4. review path or known review site
  if (/review/i.test(path) || REVIEW_SITES.some((d) => domainMatches(root, d))) {
    return { ...base, source_type: 'review', brand_id: null, marketplace_id: null };
  }

  // 5. anything else
  return { ...base, source_type: 'other', brand_id: null, marketplace_id: null };
}

/** Dedupe identical URLs (cited if any copy was cited), then type each source. ord = index after dedupe. */
export function matchSources(
  sources: { url: string; title: string; cited: boolean }[],
  brands: BrandRow[],
  marketplaces: MarketplaceRow[],
): TypedSource[] {
  const byUrl = new Map<string, { url: string; title: string; cited: boolean }>();
  for (const s of sources ?? []) {
    const url = String(s?.url ?? '').trim();
    if (!url) continue;
    const prev = byUrl.get(url);
    if (prev) {
      prev.cited = prev.cited || !!s.cited;
      if (!prev.title && s.title) prev.title = String(s.title);
    } else {
      byUrl.set(url, { url, title: String(s.title ?? ''), cited: !!s.cited });
    }
  }
  return [...byUrl.values()].map((s, ord) => ({ ord, url: s.url, title: s.title, cited: s.cited, ...classifySource(s, brands, marketplaces) }));
}

/** 'brand_site' | marketplace name lowercased | 'unknown'. */
export function pickChannel(url: string | null, brands: BrandRow[], marketplaces: MarketplaceRow[]): string {
  if (!url) return 'unknown';
  const root = rootDomain(urlParts(url).host);
  if (!root) return 'unknown';
  if (brands.some((b) => inDomains(root, b.domains))) return 'brand_site';
  const mp = marketplaces.find((m) => inDomains(root, m.domains));
  return mp ? mp.name.trim().toLowerCase() : 'unknown';
}
