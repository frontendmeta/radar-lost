'use client';

import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { Assistant } from '@/lib/api-types';
import type { Lens } from './api';

const ASSISTANTS: Assistant[] = ['openai', 'anthropic', 'gemini'];
const csv = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

/** Read the lens from the URL (?run=&focus=&assistants=&products=&queries=&compare=). */
export function lensFromParams(sp: URLSearchParams | { get(k: string): string | null }): Lens {
  const assistants = csv(sp.get('assistants')).filter((a): a is Assistant => (ASSISTANTS as string[]).includes(a));
  return {
    run: sp.get('run') ?? undefined,
    focus: sp.get('focus') ?? undefined,
    assistants: assistants.length ? assistants : undefined,
    products: csv(sp.get('products')).length ? csv(sp.get('products')) : undefined,
    queries: csv(sp.get('queries')).length ? csv(sp.get('queries')) : undefined,
    compare: sp.get('compare') ?? undefined,
  };
}

/** Stable string key for a lens (cache keys / effect deps). */
export function lensKey(l: Lens): string {
  return [l.run ?? '', l.focus ?? '', (l.assistants ?? []).join(','), (l.products ?? []).join(','), (l.queries ?? []).join(','), l.compare ?? ''].join('|');
}

/**
 * The lens lives in the URL so every view is shareable and the back button works.
 * Must render under a <Suspense> boundary (useSearchParams).
 */
export function useLens() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const spString = sp.toString();
  const lens = useMemo(() => lensFromParams(new URLSearchParams(spString)), [spString]);

  const setParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(spString);
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, v);
      }
      const s = next.toString();
      router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
    },
    [router, pathname, spString],
  );

  const setLens = useCallback(
    (patch: Partial<Lens>) => {
      const out: Record<string, string | null> = {};
      if ('run' in patch) out.run = patch.run && patch.run !== 'latest' ? patch.run : null;
      if ('focus' in patch) out.focus = patch.focus ?? null;
      if ('assistants' in patch) out.assistants = patch.assistants?.length && patch.assistants.length < 3 ? patch.assistants.join(',') : null;
      if ('products' in patch) out.products = patch.products?.length ? patch.products.join(',') : null;
      if ('queries' in patch) out.queries = patch.queries?.length ? patch.queries.join(',') : null;
      if ('compare' in patch) out.compare = patch.compare ?? null;
      setParams(out);
    },
    [setParams],
  );

  return { lens, key: lensKey(lens), setLens, setParams, params: sp };
}
