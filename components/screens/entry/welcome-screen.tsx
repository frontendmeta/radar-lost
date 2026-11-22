'use client';

import { ArrowRight, Check, KeyRound, Radar, Rocket, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import type { AssistantInfo, Setup } from '@/lib/api-types';
import { api } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { ASSISTANT_LABEL, BrandLogo, Button, ICON_STROKE, Skeleton, brandLogoSrc, cn } from '@/components/ui';
import { InlineError } from '../states/inline';
import { EntryBackdrop } from './backdrop';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function listJoin(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function initial(name: string) {
  return (name.trim()[0] ?? '·').toUpperCase();
}

const SWATCHES = [
  { label: '100', cls: 'bg-brand-100' },
  { label: '300', cls: 'bg-brand-300' },
  { label: '500', cls: 'bg-brand-500' },
  { label: '700', cls: 'bg-brand-700' },
  { label: 'marigold', cls: 'bg-marigold-500' },
];
const FROM = ['bg-peacock-100', 'bg-peacock-300', 'bg-peacock-500', 'bg-peacock-700', 'bg-marigold-500'];
const TO = ['bg-brand-100', 'bg-brand-300', 'bg-brand-500', 'bg-brand-700', 'bg-marigold-500'];

/** Frame 61 swatch reveal: the brand ramp, then "From Peacock → brand" dots. */
function SwatchReveal() {
  return (
    <div className="flex flex-col items-center gap-2.5">
      <ul className="flex flex-wrap justify-center gap-3" aria-label="Your brand colours">
        {SWATCHES.map((s) => (
          <li key={s.label} className="flex w-[72px] flex-col items-center gap-1.5">
            <span
              aria-hidden
              className={cn('block size-[72px] animate-pop-in rounded-[22px]', s.cls)}
            />
            <span className="type-label text-ink-500">{s.label}</span>
          </li>
        ))}
      </ul>
      <div aria-hidden className="flex items-center gap-2 pt-1">
        <span className="type-label text-ink-500">From</span>
        {FROM.map((c, i) => (
          <span key={`f${i}`} className={cn('block size-3 rounded-full', c)} />
        ))}
        <ArrowRight size={14} strokeWidth={ICON_STROKE} className="text-ink-400" />
        {TO.map((c, i) => (
          <span key={`t${i}`} className={cn('block size-3 rounded-full', c)} />
        ))}
      </div>
    </div>
  );
}

function CheckRow({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className="flex min-w-0 items-center gap-2.5">
      <span
        aria-hidden
        className={cn('flex size-[22px] shrink-0 items-center justify-center rounded-pill', ok ? 'bg-picked-500 text-white' : 'bg-marigold-100 text-marigold-700')}
      >
        {ok ? <Check size={14} strokeWidth={2.5} /> : <TriangleAlert size={13} strokeWidth={2.25} />}
      </span>
      <span className="type-body-strong min-w-0 text-ink-900">{children}</span>
    </li>
  );
}

function assistantsLine(assistants: AssistantInfo[]): { ok: boolean; text: string } {
  const on = assistants.filter((a) => a.enabled);
  const label = (a: AssistantInfo) => a.label || ASSISTANT_LABEL[a.id] || a.id;
  const ready = on.filter((a) => a.keyPresent).map(label);
  const missing = on.filter((a) => !a.keyPresent).map(label);
  if (!on.length) return { ok: false, text: 'No AI shoppers turned on' };
  if (!missing.length) return { ok: true, text: `${listJoin(ready)} ready` };
  if (!ready.length) return { ok: false, text: `Add API keys for ${listJoin(missing)}` };
  return { ok: false, text: `${listJoin(ready)} ready · ${listJoin(missing)} needs a key` };
}

function WelcomeBody({ setup, hasRuns }: { setup: Setup; hasRuns: boolean | undefined }) {
  const { brand, products, competitors, queries, assistants } = setup;
  const ai = assistantsLine(assistants);
  const anyReady = assistants.some((a) => a.enabled && a.keyPresent);

  // Primary action: keys first, then the first run, then the radar.
  const primary = !anyReady
    ? { href: '/settings', icon: KeyRound, label: 'Add API keys' }
    : hasRuns === false
      ? { href: '/runs', icon: Rocket, label: 'Plan the first run' }
      : { href: '/', icon: Radar, label: 'Open the radar' };
  const secondary = !anyReady
    ? { href: '/', icon: Radar, label: 'Open the radar' }
    : !ai.ok
      ? { href: '/settings', icon: KeyRound, label: 'Add the missing key' }
      : { href: '/settings', icon: SlidersHorizontal, label: 'Review settings' };

  return (
    <>
      {brandLogoSrc(brand.name, brand.domains, 'brand', 72) ? (
        <BrandLogo name={brand.name} domain={brand.domains} kind="brand" size={72} className="rounded-full! ring-4 ring-brand-100" />
      ) : (
        <span className="flex size-[72px] items-center justify-center rounded-pill bg-brand-500 ring-4 ring-brand-100">
          <span className="font-display text-[34px] leading-none font-bold text-on-brand">{initial(brand.name)}</span>
        </span>
      )}
      <div className="flex flex-col items-center gap-2.5">
        <h1 className="font-display text-[34px] leading-[1.09] font-bold tracking-[-0.7px] text-ink-900 sm:text-[44px] sm:tracking-[-0.9px]">
          Welcome to the {brand.name} radar
        </h1>
        <p className="text-[17px] leading-6 text-ink-700">We dressed the app in your colours.</p>
      </div>
      <SwatchReveal />
      <ul className="grid w-full grid-cols-1 gap-3 rounded-[22px] bg-surface-sunken px-6 py-5 text-left sm:grid-cols-2" aria-label="What's set up">
        <CheckRow ok={products.length > 0}>{plural(products.length, 'product')}</CheckRow>
        <CheckRow ok={competitors.length > 0}>{plural(competitors.length, 'competitor')}</CheckRow>
        <CheckRow ok={queries.length > 0}>{plural(queries.length, 'shopper question')}</CheckRow>
        <CheckRow ok={ai.ok}>{ai.text}</CheckRow>
      </ul>
      <div className="flex w-full flex-col items-center gap-2">
        <Button href={primary.href} icon={primary.icon} size="lg" className="w-full max-w-[320px]">
          {primary.label}
        </Button>
        <Button href={secondary.href} icon={secondary.icon} variant="ghost">
          {secondary.label}
        </Button>
      </div>
    </>
  );
}

function WelcomeSkeleton() {
  return (
    <div aria-busy className="flex w-full flex-col items-center gap-7" aria-label="Loading your setup">
      <Skeleton width={72} height={72} className="rounded-pill!" />
      <div className="flex w-full flex-col items-center gap-3">
        <Skeleton width="70%" height={44} />
        <Skeleton width="45%" height={18} />
      </div>
      <Skeleton width={408} height={93} className="max-w-full" />
      <Skeleton width="100%" height={96} />
      <Skeleton width={320} height={52} className="max-w-full rounded-pill!" />
    </div>
  );
}

/** Pencil frame 61 "Brand welcome": first-run screen for the brand under watch. */
export function WelcomeScreen() {
  const setup = useApi('setup', api.setup);
  const runs = useApi('runs', () => api.runs());

  return (
    <main className="relative isolate flex min-h-screen w-full flex-1 items-center justify-center bg-page px-4 py-12 sm:px-6">
      <EntryBackdrop variant="welcome" />
      <section className="flex w-full max-w-[720px] animate-pop-in flex-col items-center gap-7 rounded-card border border-[rgb(232_225_226/0.7)] bg-surface px-6 pt-12 pb-10 text-center shadow-[0_24px_64px_rgb(31_26_28/0.12)] sm:px-14">
        {setup.data ? (
          <WelcomeBody setup={setup.data} hasRuns={runs.data ? runs.data.length > 0 : undefined} />
        ) : setup.error ? (
          <div className="flex w-full flex-col gap-5">
            <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.4px] text-ink-900">Welcome to Lost Sale Radar</h1>
            <InlineError message="Couldn't load your brand setup. Try again." onRetry={setup.reload} />
            <Button href="/settings" variant="ghost" icon={SlidersHorizontal} className="self-center">
              Open settings
            </Button>
          </div>
        ) : (
          <WelcomeSkeleton />
        )}
      </section>
    </main>
  );
}
