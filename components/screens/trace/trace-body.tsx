'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import {
  ArrowLeftRight, Check, ChevronDown, CircleDashed, ExternalLink, Eye, FileQuestionMark, IndianRupee, MapPin, MessageSquareText, Quote, Ruler,
  Shirt, Star, Truck, type LucideIcon,
} from 'lucide-react';
import type { Fix, Trace } from '@/lib/api-types';
import {
  ASSISTANT_LABEL, FixCard, ICON_STROKE, LOSS_REASON_LABEL, OUTCOME_LABEL, OutcomePill, QueryBubble, SearchPill, SourceRow, YouTag, cn,
  competitorColor, formatInr, type ReasonKey,
} from '../ui';
import { plural } from '../format';

// ---------------------------------------------------------------- helpers

type Outcome = Trace['outcomes'][number];

const same = (a: string | null | undefined, b: string | null | undefined) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

const CHANNEL: Record<string, string> = {
  myntra: 'Myntra', ajio: 'Ajio', amazon: 'Amazon', flipkart: 'Flipkart', nykaa: 'Nykaa Fashion', nykaafashion: 'Nykaa Fashion',
  tatacliq: 'Tata CLiQ', meesho: 'Meesho', brand_site: 'Brand site', 'brand site': 'Brand site',
};

/** "myntra" → "Myntra", "www.libas.in" → "libas.in". */
export function channelLabel(ch: string | null | undefined): string {
  if (!ch) return '—';
  const k = ch.trim().toLowerCase();
  if (CHANNEL[k]) return CHANNEL[k];
  if (k.includes('.')) return k.replace(/^www\./, '');
  return ch.charAt(0).toUpperCase() + ch.slice(1);
}

export function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Delivery promise in days → "Today" / "Tomorrow" / "3 days". */
export function deliveryLabel(days: number | null | undefined): string {
  if (days == null) return 'Unknown';
  if (days <= 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  return `${days} days`;
}

const dayCount = (d: number) => (d <= 0 ? 'Same day' : plural(d, 'day'));

/** The extractor sometimes tags names "(heuristic)"; show the product, prefixed with its brand. */
function pickTitle(brand: string, product: string | null): string {
  const p = (product ?? '').replace(/\s*\(heuristic\)\s*$/i, '').trim();
  if (!p || same(p, brand)) return brand;
  return p.toLowerCase().startsWith(brand.toLowerCase()) ? p : `${brand} ${p}`;
}

/** "Libas Off White Kurta" → "Off White Kurta" when it starts with the brand. */
function withoutBrand(name: string, brand: string): string {
  return name.toLowerCase().startsWith(`${brand.toLowerCase()} `) ? name.slice(brand.length + 1) : name;
}

const tint = (color: string): CSSProperties => ({ background: `color-mix(in srgb, ${color} 12%, var(--color-surface))` });

const REASON_ICON: Record<ReasonKey, LucideIcon> = {
  over_budget: IndianRupee,
  delivery_unclear_or_slow: Truck,
  size_or_stock: Ruler,
  missing_details: FileQuestionMark,
  weaker_reviews: Star,
  better_fit_elsewhere: ArrowLeftRight,
  not_found: CircleDashed,
  found_not_mentioned: Eye,
};

function reasonKey(o: Outcome): ReasonKey | null {
  if (o.reason) return o.reason;
  if (o.outcome === 'found_not_mentioned') return 'found_not_mentioned';
  if (o.outcome === 'not_found') return 'not_found';
  return null;
}

/** A plain-English line when the extractor left no note. */
function fallbackNote(o: Outcome, t: Trace, focusName: string): string {
  const ai = ASSISTANT_LABEL[t.assistant] ?? 'The AI';
  const winner = t.pick?.brand;
  switch (reasonKey(o)) {
    case 'over_budget': return `${ai} thought ${focusName} cost more than the ${formatInr(t.query.budgetInr)} budget.`;
    case 'delivery_unclear_or_slow': return `${ai} couldn't confirm ${focusName} would reach ${t.query.city} in ${dayCount(t.query.deadlineDays).toLowerCase()}.`;
    case 'size_or_stock': return `${ai} wasn't sure ${focusName} had the size in stock.`;
    case 'missing_details': return `${focusName}'s pages didn't give ${ai} the details it needed to choose it.`;
    case 'weaker_reviews': return `${ai} trusted ${winner ?? 'another brand'}'s reviews over ${focusName}'s.`;
    case 'better_fit_elsewhere': return `${ai} named ${focusName}, then picked ${winner ?? 'another brand'} as the better fit.`;
    case 'found_not_mentioned': return `${ai} read a page with ${focusName} on it, but never named it in the answer.`;
    case 'not_found': return `${focusName} never showed up in anything ${ai} searched or read.`;
    default: return o.outcome === 'picked' ? `${ai} chose ${focusName} for this shopper.` : `${ai} didn't pick ${focusName}.`;
  }
}

/** Untrusted model text: plain text only, with **bold** turned into <strong> (React escapes everything). */
function AnswerText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*\n]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**') && p.length > 4 ? (
          <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong>
        ) : (
          <span key={i}>{p.replace(/^#{1,6}\s+/gm, '')}</span>
        ),
      )}
    </>
  );
}

// ---------------------------------------------------------------- pieces

function Step({ n, title, last, children }: { n: number; title: ReactNode; last?: boolean; children: ReactNode }) {
  return (
    <li className="flex gap-3.5">
      <div className="flex w-8 shrink-0 flex-col items-center gap-1.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill bg-brand-100 text-[14px] leading-none font-bold text-brand-700">{n}</span>
        {!last && (
          <span aria-hidden className="w-0.5 flex-1 rounded-[1px] bg-[repeating-linear-gradient(to_bottom,var(--color-ink-200)_0_6px,transparent_6px_10px)]" />
        )}
      </div>
      <div className={cn('flex min-w-0 flex-1 flex-col gap-3 pt-1', !last && 'pb-7')}>
        <h3 className="type-h3 text-ink-900">{title}</h3>
        {children}
      </div>
    </li>
  );
}

function Inner({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-col rounded-inner border border-ink-200', className)}>{children}</div>;
}

function Muted({ children }: { children: ReactNode }) {
  return <p className="type-small text-ink-500">{children}</p>;
}

function ReasonPill({ reason, tone }: { reason: ReasonKey; tone: 'lost' | 'seen' | 'ink' }) {
  const Icon = REASON_ICON[reason] ?? CircleDashed;
  return (
    <span className="inline-flex h-[26px] w-fit shrink-0 items-center gap-1.5 rounded-pill bg-surface pr-2.5 pl-2 whitespace-nowrap">
      <Icon aria-hidden size={16} strokeWidth={ICON_STROKE} className={tone === 'lost' ? 'text-lost-500' : tone === 'seen' ? 'text-seen-500' : 'text-ink-400'} />
      <span className={cn('text-[13px] leading-5 font-semibold', tone === 'lost' ? 'text-lost-700' : tone === 'seen' ? 'text-seen-700' : 'text-ink-500')}>
        {LOSS_REASON_LABEL[reason] ?? reason}
      </span>
    </span>
  );
}

function BrandDot({ color }: { color: string }) {
  return <span aria-hidden className="inline-block size-2.5 shrink-0 rounded-full" style={{ background: color }} />;
}

function CompareCell({ value, note, good }: { value: ReactNode; note?: ReactNode; good?: boolean }) {
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-0.5 rounded-xl px-2.5 py-2', good ? 'bg-picked-50' : 'bg-surface-sunken')}>
      <span className={cn('flex items-center gap-1 text-[13px] leading-4 font-semibold break-words', good ? 'text-picked-700' : 'text-ink-900')}>
        {good && <Check aria-hidden size={14} strokeWidth={2} className="shrink-0" />}
        <span className="min-w-0">{value}</span>
      </span>
      {note && <span className={cn('text-[12px] leading-[15px] font-medium', good ? 'text-picked-700' : 'text-ink-500')}>{note}</span>}
    </div>
  );
}

function CompareRow({ label, ours, theirs }: { label: string; ours: ReactNode; theirs?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="type-label text-ink-500">{label}</span>
      <div className="flex items-start gap-1.5">
        {ours}
        {theirs}
      </div>
    </div>
  );
}

function ProductTile({ name, sub, color, you }: { name: string; sub: string; color: string; you?: boolean }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
      <span className="flex h-[72px] w-14 items-center justify-center rounded-[14px]" style={tint(color)}>
        <Shirt aria-hidden size={24} strokeWidth={ICON_STROKE} style={{ color }} />
      </span>
      <span className="flex items-center gap-1">
        <span className="truncate text-[14px] leading-[18px] font-bold text-ink-900">{name}</span>
        {you && <YouTag className="h-[18px] px-1.5 text-[11px]" />}
      </span>
      <span className="line-clamp-3 text-[12px] leading-[15px] font-medium text-ink-500">{sub}</span>
    </div>
  );
}

// ---------------------------------------------------------------- body

export interface TraceBodyProps {
  trace: Trace;
  /** The lens's focus brand (defaults to matching by name). */
  focusBrandId?: string;
  focusName: string;
  /** Primary (your) brand id; the "You had a match" panel shows only when it is in focus. */
  primaryBrandId?: string;
  /** Domains of the focus brand: sources on them are highlighted too. */
  focusDomains?: string[];
  /** The fix to show under the comparison. */
  fix?: Fix;
  /** Drawer layout (760 px sheet): narrower side panel, compact source rows. */
  compact?: boolean;
}

/** The 7 numbered steps of "How the AI decided" + the "You had a match" side panel (Pencil RqOOe body). */
export function TraceBody({ trace, focusBrandId, focusName, primaryBrandId, focusDomains = [], fix, compact = false }: TraceBodyProps) {
  const [showAnswer, setShowAnswer] = useState(false);
  const q = trace.query;
  const pick = trace.pick;
  const ourProduct = trace.ourProduct;
  const ai = ASSISTANT_LABEL[trace.assistant] ?? 'The AI';

  const ours = (focusBrandId ? trace.outcomes.find((o) => o.brandId === focusBrandId) : undefined) ?? trace.outcomes.find((o) => same(o.brandName, focusName));
  const isUs = (name: string | null | undefined) => same(name, focusName);
  const domains = focusDomains.map((d) => d.replace(/^www\./, '').toLowerCase());
  const isFocusSource = (s: Trace['sources'][number]) => isUs(s.brand) || domains.includes(s.domain.replace(/^www\./, '').toLowerCase());

  // Colours: focus = brand, competitors in the order this answer lists them.
  const others = trace.outcomes.filter((o) => !isUs(o.brandName)).map((o) => o.brandName.toLowerCase());
  const colorOf = (name: string) => {
    if (isUs(name)) return 'var(--color-brand-500)';
    const i = others.indexOf(name.toLowerCase());
    return i < 0 ? 'var(--color-comp-other)' : competitorColor(i);
  };

  // "You had a match": only for your own brand's product.
  const ourIsFocus = ourProduct != null && (!primaryBrandId || !ours || ours.brandId === primaryBrandId);
  const weWon = ours?.outcome === 'picked';
  const ourFits = ourProduct != null && ourProduct.priceInr <= q.budgetInr && ourProduct.deliveryDays != null && ourProduct.deliveryDays <= q.deadlineDays;
  const cheaperBy = ourProduct && pick?.priceInr != null ? pick.priceInr - ourProduct.priceInr : null;
  const ourFaster = ourProduct?.deliveryDays != null && ourProduct.deliveryDays <= q.deadlineDays && (pick?.deliveryDays == null || ourProduct.deliveryDays < pick.deliveryDays);

  const reason = ours ? reasonKey(ours) : null;
  const tone: 'lost' | 'seen' | 'ink' = ours?.outcome === 'mentioned_lost' ? 'lost' : ours?.outcome === 'found_not_mentioned' ? 'seen' : 'ink';
  const answerPreview = trace.answerText.replace(/\*\*/g, '').replace(/\s+/g, ' ').trim();

  const budgetCheck =
    trace.fitsBudget === 'yes' ? <OutcomePill outcome="picked" label={`Within ${formatInr(q.budgetInr)}`} />
    : trace.fitsBudget === 'no' ? <OutcomePill outcome="mentioned_lost" label={`Over ${formatInr(q.budgetInr)}`} />
    : <OutcomePill outcome="not_found" label="Price vs budget unclear" />;
  const deadlineCheck =
    trace.fitsDeadline === 'yes' ? <OutcomePill outcome="picked" label={q.deadlineDays <= 1 ? (q.deadlineDays <= 0 ? 'Same day' : 'By tomorrow') : `Within ${q.deadlineDays} days`} />
    : trace.fitsDeadline === 'no' ? <OutcomePill outcome="mentioned_lost" label={`Misses ${dayCount(q.deadlineDays).toLowerCase()}`} />
    : <OutcomePill outcome="not_found" label="Delivery date unclear" />;

  const showMatch = ourProduct != null && ourIsFocus && !weWon;

  return (
    <div className={cn('flex flex-col gap-8', compact ? 'md:flex-row md:gap-6' : 'lg:flex-row lg:gap-10')}>
      <ol className="flex min-w-0 flex-1 flex-col">
        {/* 1 */}
        <Step n={1} title="The shopper asked">
          <Inner className="gap-3.5 p-4">
            <QueryBubble text={q.text} className="[&>p]:text-[16px] [&>p]:leading-6" />
            <div className="flex flex-wrap gap-2 pl-11">
              <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-ink-100 px-3 text-[13px] font-semibold text-ink-700">
                <IndianRupee aria-hidden size={16} strokeWidth={ICON_STROKE} />{formatInr(q.budgetInr)}
              </span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-ink-100 px-3 text-[13px] font-semibold text-ink-700">
                <Truck aria-hidden size={16} strokeWidth={ICON_STROKE} />{dayCount(q.deadlineDays)}
              </span>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-ink-100 px-3 text-[13px] font-semibold text-ink-700">
                <MapPin aria-hidden size={16} strokeWidth={ICON_STROKE} />{q.city}
              </span>
            </div>
          </Inner>
        </Step>

        {/* 2 */}
        <Step n={2} title={trace.searches.length ? 'It searched' : trace.webSearched ? 'It searched the web' : 'It answered without searching'}>
          {trace.searches.length ? (
            <Inner className="items-start gap-2 p-4">
              {trace.searches.map((s, i) => <SearchPill key={`${i}-${s}`} text={s} />)}
            </Inner>
          ) : (
            <Muted>{trace.webSearched ? 'It searched, but the search terms weren’t recorded.' : `${ai} answered from what it already knew, with no web search.`}</Muted>
          )}
        </Step>

        {/* 3 */}
        <Step n={3} title={trace.sources.length ? `It read ${plural(trace.sources.length, 'page')}` : 'It read no pages'}>
          {trace.sources.length ? (
            <Inner className="gap-0.5 p-1.5">
              {trace.sources.map((s, i) => {
                const focus = isFocusSource(s);
                return (
                  <SourceRow
                    key={`${s.url}-${i}`}
                    domain={s.domain.replace(/^www\./, '')}
                    title={s.title}
                    url={s.url}
                    sourceType={s.type}
                    brand={compact && !focus ? null : s.brand}
                    cited={s.cited}
                    isFocusBrand={focus}
                    className={compact ? 'gap-2.5! px-2.5! [&>span.h-7]:h-6 [&>span.h-7]:px-[9px] [&>span.h-7]:text-[12px]' : undefined}
                  />
                );
              })}
            </Inner>
          ) : (
            <Muted>No pages were recorded for this answer.</Muted>
          )}
        </Step>

        {/* 4 */}
        <Step n={4} title={trace.shortlist.length ? 'It shortlisted' : 'It named'}>
          {(trace.shortlist.length ? trace.shortlist : trace.mentioned).length ? (
            <div className="flex flex-wrap gap-2">
              {(trace.shortlist.length ? trace.shortlist : trace.mentioned).map((b) => (
                <span
                  key={b}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-pill border pr-3.5 pl-3 text-[14px] leading-[18px] font-semibold text-ink-900',
                    isUs(b) ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-surface',
                  )}
                >
                  <BrandDot color={colorOf(b)} />
                  {b}
                  {isUs(b) && <YouTag />}
                  {pick && same(b, pick.brand) && <Check aria-label="picked" size={14} strokeWidth={2.25} className="text-picked-500" />}
                </span>
              ))}
            </div>
          ) : (
            <Muted>It didn’t name any brands.</Muted>
          )}
        </Step>

        {/* 5 */}
        <Step n={5} title="It picked">
          {pick ? (
            <Inner className="flex-row gap-3.5 p-3.5">
              <span className="flex h-24 w-[72px] shrink-0 items-center justify-center rounded-[14px]" style={tint(colorOf(pick.brand))}>
                <Shirt aria-hidden size={28} strokeWidth={ICON_STROKE} style={{ color: colorOf(pick.brand) }} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <p className="text-[15px] leading-[21px] font-semibold text-ink-900">
                  {pickTitle(pick.brand, pick.product)}
                  {isUs(pick.brand) && <YouTag className="ml-1.5 align-middle" />}
                </p>
                <p className="text-[17px] leading-[21px] font-bold text-ink-900 tabular-nums">{formatInr(pick.priceInr)}</p>
                <p className="type-small text-ink-500">
                  {channelLabel(pick.channel)} · Delivery: {deliveryLabel(pick.deliveryDays).toLowerCase()}
                  {pick.url && (
                    <>
                      {' · '}
                      <a href={pick.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:underline">
                        View page <ExternalLink aria-hidden size={12} strokeWidth={ICON_STROKE} />
                      </a>
                    </>
                  )}
                </p>
                <div className="flex flex-wrap gap-2">
                  {budgetCheck}
                  {deadlineCheck}
                </div>
              </div>
            </Inner>
          ) : (
            <div className="flex flex-col gap-2">
              <Muted>It didn’t settle on a single product.</Muted>
              <div className="flex flex-wrap gap-2">{budgetCheck}{deadlineCheck}</div>
            </div>
          )}
        </Step>

        {/* 6 */}
        <Step n={6} title={weWon ? `Why ${focusName} won` : `Why not ${focusName}`}>
          {ours ? (
            <div className={cn('flex flex-col gap-2.5 rounded-inner p-4', weWon ? 'bg-picked-50' : tone === 'lost' ? 'bg-lost-50' : tone === 'seen' ? 'bg-seen-50' : 'bg-surface-sunken')}>
              {weWon ? <OutcomePill outcome="picked" onTint label="Picked" className="w-fit" /> : reason ? <ReasonPill reason={reason} tone={tone} /> : <OutcomePill outcome={ours.outcome} onTint className="w-fit" />}
              <p className="type-body text-ink-900">{ours.note || fallbackNote(ours, trace, focusName)}</p>
            </div>
          ) : (
            <Muted>No outcome was recorded for {focusName} in this answer.</Muted>
          )}

          {trace.reasoningExcerpt && (
            <figure className="flex gap-2.5 rounded-inner border border-ink-200 px-4 py-3">
              <Quote aria-hidden size={16} strokeWidth={ICON_STROKE} className="mt-1 shrink-0 text-ink-400" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <figcaption className="type-label text-ink-500">In {ai}’s words</figcaption>
                <blockquote className="type-small whitespace-pre-wrap text-ink-700 italic">
                  <AnswerText text={/^[a-z0-9]/.test(trace.reasoningExcerpt.trim()) ? `…${trace.reasoningExcerpt.trim()}` : trace.reasoningExcerpt.trim()} />
                </blockquote>
              </div>
            </figure>
          )}

          {trace.outcomes.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="type-label text-ink-500">Every brand in this answer</span>
              <Inner className="divide-y divide-ink-100">
                {trace.outcomes.map((o) => {
                  const why = o.outcome !== 'picked' && o.reason && o.reason !== 'not_found' ? LOSS_REASON_LABEL[o.reason] : null;
                  return (
                    <div key={o.brandId} className={cn('flex items-start gap-3 px-3.5 py-2.5', isUs(o.brandName) && 'bg-brand-50/60')}>
                      <span className="flex pt-[7px]"><BrandDot color={colorOf(o.brandName)} /></span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="flex items-center gap-1.5 text-[14px] leading-6 font-semibold text-ink-900">
                          {o.brandName}
                          {isUs(o.brandName) && <YouTag className="h-[18px] px-1.5 text-[11px]" />}
                        </span>
                        {(why || o.note) && (
                          <span className="type-small text-ink-500">
                            {[why, o.note].filter(Boolean).join(' · ')}
                          </span>
                        )}
                      </div>
                      <OutcomePill outcome={o.outcome} label={o.outcome === 'picked' ? 'Picked' : OUTCOME_LABEL[o.outcome]} />
                    </div>
                  );
                })}
              </Inner>
            </div>
          )}
        </Step>

        {/* 7 */}
        <Step n={7} title="Read the full answer" last>
          <div className="flex flex-col rounded-inner bg-surface-sunken">
            <button
              type="button"
              onClick={() => setShowAnswer((v) => !v)}
              aria-expanded={showAnswer}
              className="flex min-h-[52px] w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left"
            >
              <MessageSquareText aria-hidden size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
              <span className={cn('min-w-0 flex-1 text-[14px] leading-[18px] text-ink-700', !showAnswer && 'line-clamp-2')}>
                {showAnswer ? `${ai} · ${trace.model}` : `“${answerPreview}”`}
              </span>
              <ChevronDown aria-hidden size={18} strokeWidth={ICON_STROKE} className={cn('shrink-0 text-ink-500 transition-transform', showAnswer && 'rotate-180')} />
            </button>
            {showAnswer && (
              <div className="border-t border-ink-200 px-4 pt-3 pb-4 text-[14px] leading-[22px] break-words whitespace-pre-wrap text-ink-700">
                <AnswerText text={trace.answerText || 'The answer text is empty.'} />
              </div>
            )}
          </div>
        </Step>
      </ol>

      {(showMatch || fix) && (
        <aside className={cn('flex w-full shrink-0 flex-col gap-4', compact ? 'md:w-[248px]' : 'lg:w-[300px]')}>
          {showMatch && ourProduct && (
            <>
              <div className="flex flex-col gap-0.5">
                <h3 className="type-h2 text-ink-900">{ourFits ? 'You had a match' : pick ? 'Your closest product' : 'Your matching product'}</h3>
                <p className="type-small text-ink-500">
                  {ourFits && cheaperBy != null && cheaperBy > 0
                    ? `${focusName} fit the ask and cost less`
                    : ourFits
                      ? `${focusName} fit the ask too`
                      : cheaperBy != null && cheaperBy > 0
                        ? `${focusName} cost less`
                        : `How ${focusName} compared`}
                </p>
              </div>
              <div className="flex flex-col gap-2.5 rounded-inner border border-ink-200 bg-surface p-3.5">
                <div className="flex items-start gap-1">
                  <ProductTile name={focusName} sub={withoutBrand(ourProduct.name, focusName)} color="var(--color-brand-500)" you />
                  {pick && (
                    <>
                      <span className="mt-4 flex size-10 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface-sunken font-display text-[14px] font-bold text-ink-500">vs</span>
                      <ProductTile
                        name={pick.brand}
                        sub={same(pickTitle(pick.brand, pick.product), pick.brand) ? 'Product not named' : withoutBrand(pickTitle(pick.brand, pick.product), pick.brand)}
                        color={colorOf(pick.brand)}
                      />
                    </>
                  )}
                </div>
                <CompareRow
                  label="Price"
                  ours={
                    <CompareCell
                      value={formatInr(ourProduct.priceInr)}
                      good={cheaperBy != null && cheaperBy > 0}
                      note={cheaperBy != null && cheaperBy > 0 ? `${formatInr(cheaperBy)} cheaper` : ourProduct.priceInr <= q.budgetInr ? `Within ${formatInr(q.budgetInr)}` : `Over ${formatInr(q.budgetInr)}`}
                    />
                  }
                  theirs={pick && <CompareCell value={formatInr(pick.priceInr)} />}
                />
                <CompareRow
                  label="Delivery"
                  ours={
                    <CompareCell
                      value={ourProduct.deliveryDays == null ? '—' : dayCount(ourProduct.deliveryDays)}
                      good={ourFaster}
                      note={ourProduct.deliveryIsSample ? 'sample promise' : undefined}
                    />
                  }
                  theirs={pick && <CompareCell value={deliveryLabel(pick.deliveryDays)} />}
                />
                <CompareRow
                  label="Where to buy"
                  ours={<CompareCell value={hostOf(ourProduct.url) ?? '—'} />}
                  theirs={pick && <CompareCell value={channelLabel(pick.channel)} />}
                />
                {ourProduct.fabric && <CompareRow label="Fabric" ours={<CompareCell value={ourProduct.fabric} />} theirs={pick && <CompareCell value="—" />} />}
                {ourProduct.url && (
                  <a href={ourProduct.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 pt-1 type-small font-semibold text-brand-600 hover:underline">
                    Open your product page <ExternalLink aria-hidden size={12} strokeWidth={ICON_STROKE} />
                  </a>
                )}
              </div>
            </>
          )}
          {fix && (
            <FixCard
              ord={fix.ord}
              title={fix.title}
              why={fix.why}
              action={fix.action}
              fixType={fix.fixType}
              className="gap-2.5! border-brand-200! bg-brand-50! p-4! [&_.bg-surface-sunken]:bg-surface!"
              footer={
                fix.evidenceTaskIds.length ? (
                  <p className="type-small text-ink-500">
                    {fix.evidenceTaskIds.includes(trace.taskId)
                      ? fix.evidenceTaskIds.length > 1 ? `Could win back this sale and ${plural(fix.evidenceTaskIds.length - 1, 'other')}` : 'Could win back this sale'
                      : `Could win back ${plural(fix.evidenceTaskIds.length, 'lost sale')}`}
                  </p>
                ) : undefined
              }
            />
          )}
        </aside>
      )}
    </div>
  );
}
