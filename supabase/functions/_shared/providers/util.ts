// Small helpers shared by the shopper adapters.
import type { ShopperResult } from '../types.ts';

/** Extra, optional adapter args beyond ShopperAdapter's: an absolute deadline (epoch ms). */
export interface AdapterExtra { deadline?: number; attempt?: number }

type Src = ShopperResult['sources'][number];
export interface SourceSet { order: string[]; byKey: Map<string, Src> }

export function newSourceSet(): SourceSet {
  return { order: [], byKey: new Map() };
}

/** Drop provider tracking params (OpenAI adds utm_source=openai) and the fragment. */
export function cleanUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    u.hash = '';
    if (u.searchParams.get('utm_source') === 'openai') u.searchParams.delete('utm_source');
    return u.toString();
  } catch {
    return null;
  }
}

function keyOf(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '').toLowerCase();
}

/** Add or merge a source: keeps the first non-empty title; cited is sticky. */
export function addSource(set: SourceSet, rawUrl: unknown, title: unknown, cited: boolean): void {
  if (typeof rawUrl !== 'string' || !rawUrl) return;
  const url = cleanUrl(rawUrl);
  if (!url) return;
  const k = keyOf(url);
  const t = typeof title === 'string' ? title.trim() : '';
  const cur = set.byKey.get(k);
  if (cur) {
    if (!cur.title && t) cur.title = t;
    if (cited) cur.cited = true;
    return;
  }
  set.byKey.set(k, { url, title: t, cited });
  set.order.push(k);
}

export function sourceList(set: SourceSet): Src[] {
  return set.order.map((k) => set.byKey.get(k)!);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
