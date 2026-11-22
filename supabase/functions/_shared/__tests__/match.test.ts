import { describe, expect, test } from 'bun:test';
import { aliasInText, matchSources, normalizeText, pickChannel, resolveBrand, rootDomain } from '../match.ts';
import { BRANDS, MARKETPLACES } from './fixtures.ts';

describe('rootDomain', () => {
  test('strips scheme, www., m., port, path, case', () => {
    expect(rootDomain('https://www.Libas.in/products/x?y=1')).toBe('libas.in');
    expect(rootDomain('https://m.myntra.com:443/kurtas')).toBe('myntra.com');
    expect(rootDomain('http://www.m.ajio.com')).toBe('ajio.com');
    expect(rootDomain('WWW.Biba.IN')).toBe('biba.in');
    expect(rootDomain('amazon.in:8080/dp/123')).toBe('amazon.in');
    expect(rootDomain('https://user:pw@www.flipkart.com/x')).toBe('flipkart.com');
    expect(rootDomain('https://shop.libas.in./')).toBe('shop.libas.in');
  });
  test('bad input never throws', () => {
    expect(rootDomain('')).toBe('');
    expect(rootDomain('not a url at all')).toBe('');
    expect(rootDomain(null as unknown as string)).toBe('');
    expect(rootDomain('http://')).toBe('');
  });
  test('does not strip the registrable label itself', () => {
    expect(rootDomain('m.com')).toBe('m.com');
    expect(rootDomain('www.com')).toBe('www.com');
  });
});

describe('aliasInText', () => {
  test('ignores case, spacing and accents', () => {
    expect(normalizeText('  Jaipur   KURTI! ')).toBe('jaipur kurti');
    expect(aliasInText('Try jaipur  kurti today', 'Jaipur Kurti')).toBe(true);
    expect(aliasInText('Try JAIPUR\nKurti today', 'Jaipur Kurti')).toBe(true);
    expect(aliasInText('Shop Líbás now', 'Libas')).toBe(true);
    expect(aliasInText('Libas’s kurta', 'Libas')).toBe(true);
  });
  test('JaipurKurti matches via its own alias (and the spaceless form)', () => {
    expect(aliasInText('Order from JaipurKurti.com', 'JaipurKurti')).toBe(true);
    expect(aliasInText('Order from JaipurKurti.com', 'Jaipur Kurti')).toBe(true);
  });
  test('word-bounded', () => {
    expect(aliasInText('Fablibasa and Libasx are different', 'Libas')).toBe(false);
    expect(aliasInText('a Jaipuri kurti is a style', 'Jaipur Kurti')).toBe(false);
    expect(aliasInText('libas-cotton-kurta', 'Libas')).toBe(true);
    expect(aliasInText('anything', '')).toBe(false);
  });
  test('resolveBrand maps model names to tracked brands', () => {
    expect(resolveBrand('BIBA', BRANDS)?.id).toBe('b-biba');
    expect(resolveBrand('jaipur kurti', BRANDS)?.id).toBe('b-jk');
    expect(resolveBrand('JaipurKurti', BRANDS)?.id).toBe('b-jk');
    expect(resolveBrand('Anouk', BRANDS)).toBeNull();
    expect(resolveBrand(42, BRANDS)).toBeNull();
  });
});

describe('matchSources', () => {
  const src = (url: string, title = '', cited = false) => ({ url, title, cited });

  test('rule 1: brand domain -> brand_site', () => {
    const [s] = matchSources([src('https://www.libas.in/products/white-kurta', 'White kurta')], BRANDS, MARKETPLACES);
    expect(s).toMatchObject({ ord: 0, source_type: 'brand_site', brand_id: 'b-libas', marketplace_id: null, domain: 'www.libas.in', root_domain: 'libas.in' });
  });
  test('rule 1 wins over listicle words; subdomains match', () => {
    const [s] = matchSources([src('https://blog.biba.in/best-kurtas-under-1500', 'Top 10 kurtas')], BRANDS, MARKETPLACES);
    expect(s.source_type).toBe('brand_site');
    expect(s.brand_id).toBe('b-biba');
  });
  test('rule 2: marketplace, brand from URL path or title', () => {
    const out = matchSources([
      src('https://www.myntra.com/kurtas/libas/libas-women-cotton-kurta/123/buy', 'Buy Kurta'),
      src('https://www.amazon.in/dp/B0XYZ', 'Kalini Women Straight Kurta : Amazon.in'),
      src('https://www.ajio.com/best-kurtas', 'Kurtas'),
      src('https://m.flipkart.com/janasya-kurta/p/itm1?pid=1', ''),
    ], BRANDS, MARKETPLACES);
    expect(out[0]).toMatchObject({ source_type: 'marketplace', marketplace_id: 'm-myntra', brand_id: 'b-libas' });
    expect(out[1]).toMatchObject({ source_type: 'marketplace', marketplace_id: 'm-amazon', brand_id: 'b-kalini' });
    expect(out[2]).toMatchObject({ source_type: 'marketplace', marketplace_id: 'm-ajio', brand_id: null });
    expect(out[3]).toMatchObject({ source_type: 'marketplace', marketplace_id: 'm-flipkart', brand_id: 'b-janasya', root_domain: 'flipkart.com' });
  });
  test('rule 3: listicle (best / top N / under ₹N / list / vs)', () => {
    const out = matchSources([
      src('https://example.com/a', '10 Best Cotton Kurtas in India'),
      src('https://example.com/top-10-kurta-brands', 'Kurta brands'),
      src('https://example.com/b', 'Kurtas under ₹1,500 for office'),
      src('https://example.com/c', 'Libas vs Kalini vs AKS'),
      src('https://example.com/kurta-brand-list', ''),
    ], BRANDS, MARKETPLACES);
    expect(out.map((s) => s.source_type)).toEqual(['listicle', 'listicle', 'listicle', 'listicle', 'listicle']);
    expect(out.every((s) => s.brand_id === null)).toBe(true);
  });
  test('rule 4: review path or known review site', () => {
    const out = matchSources([
      src('https://example.com/libas-kurta-review', 'Honest take'),
      src('https://www.trustpilot.com/review/libas.in', 'Libas'),
      src('https://www.mouthshut.com/product/biba', 'Biba'),
    ], BRANDS, MARKETPLACES);
    expect(out.map((s) => s.source_type)).toEqual(['review', 'review', 'review']);
  });
  test('rule 5: other; "tops" and "bestseller" are not listicle words', () => {
    const out = matchSources([
      src('https://example.com/women/tops', 'Women tops'),
      src('https://example.com/bestseller', 'Bestseller kurta'),
      src('https://www.reddit.com/r/india/comments/x', 'Where to buy kurtas'),
    ], BRANDS, MARKETPLACES);
    expect(out.map((s) => s.source_type)).toEqual(['other', 'other', 'other']);
  });
  test('dedupes identical URLs, keeps cited=true, ord = index', () => {
    const out = matchSources([
      src('https://www.libas.in/x', 'A', false),
      src('https://www.myntra.com/y', 'B', false),
      src('https://www.libas.in/x', 'A again', true),
      src('', 'empty'),
    ], BRANDS, MARKETPLACES);
    expect(out.length).toBe(2);
    expect(out[0]).toMatchObject({ ord: 0, url: 'https://www.libas.in/x', title: 'A', cited: true });
    expect(out[1]).toMatchObject({ ord: 1, cited: false });
  });
  test('unresolved Gemini redirect uses the chunk title as the domain', () => {
    const [s] = matchSources([src('https://vertexaisearch.cloud.google.com/grounding-api-redirect/AbC', 'myntra.com')], BRANDS, MARKETPLACES);
    expect(s).toMatchObject({ domain: 'myntra.com', root_domain: 'myntra.com', source_type: 'marketplace', marketplace_id: 'm-myntra' });
  });
  test('garbage URL does not throw', () => {
    const [s] = matchSources([src('not a url', 'Best kurtas')], BRANDS, MARKETPLACES);
    expect(s.source_type).toBe('listicle');
    expect(s.root_domain).toBe('');
  });
});

describe('pickChannel', () => {
  test('brand_site / marketplace name lowercased / unknown', () => {
    expect(pickChannel('https://www.libas.in/p/1', BRANDS, MARKETPLACES)).toBe('brand_site');
    expect(pickChannel('https://m.myntra.com/kurta/1', BRANDS, MARKETPLACES)).toBe('myntra');
    expect(pickChannel('https://www.nykaafashion.com/x', BRANDS, MARKETPLACES)).toBe('nykaa fashion');
    expect(pickChannel('https://example.com/x', BRANDS, MARKETPLACES)).toBe('unknown');
    expect(pickChannel(null, BRANDS, MARKETPLACES)).toBe('unknown');
    expect(pickChannel('garbage', BRANDS, MARKETPLACES)).toBe('unknown');
  });
});
