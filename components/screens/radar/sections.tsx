'use client';

import { ArrowUpRight, CircleCheck, CircleDashed, RefreshCw, Route, ShoppingBag, Target, Lightbulb } from 'lucide-react';
import type { Assistant, ByAssistant, Fix, LossReasonRow, LostSale, Marketplace, SourcesBreakdown, SourceType, Summary, Trace, Win } from '@/lib/api-types';
import {
  ASSISTANT_LABEL, AssistantBadge, BarRow, BrandLogo, Button, FixCard, ICON_STROKE, LOSS_REASON_LABEL, OutcomePill, ReasonRow, SOURCE_TYPE_LABEL,
  Segmented, StatBlock, brandLogoSrc, cn, competitorColor, formatCount, formatInr, formatPercent,
} from '../ui';
import { Card, CardHeader, ErrorNote, Skeleton } from '../app-shell';
import { plural } from '../format';

const pts = (gap: number | null | undefined) => (typeof gap === 'number' && Number.isFinite(gap) ? Math.round(gap * 100) : null);

// ---------------------------------------------------------------- loading skeletons

/** Varied name-bar widths so skeleton rows don't look stamped. */
const NAME_W = ['w-[74%]', 'w-[58%]', 'w-[80%]', 'w-[52%]', 'w-[66%]', 'w-[62%]', 'w-[76%]', 'w-[56%]'];
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Shimmer stand-in for BarRow / ReasonRow lists: mark · name · track · value, 44 px rows. */
function BarRowsSkeleton({ rows, variant = 'bar' }: { rows: number; variant?: 'bar' | 'reason' }) {
  const reason = variant === 'reason';
  return (
    <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-1">
      {range(rows).map((i) => (
        <div key={i} className={cn('flex h-11 items-center px-3', reason ? 'gap-3.5' : 'gap-4')}>
          <div className={cn('flex shrink-0 items-center', reason ? 'w-[calc(32px+14px+200px)] gap-3.5' : 'w-[150px] gap-2')}>
            <Skeleton className={cn('shrink-0 rounded-pill!', reason ? 'size-8' : 'size-5')} />
            <Skeleton className={cn('h-3.5', NAME_W[i % NAME_W.length])} />
          </div>
          <Skeleton className="h-3 min-w-0 flex-1 rounded-bar!" />
          <div className="flex w-20 shrink-0 justify-end"><Skeleton className="h-3.5 w-14" /></div>
        </div>
      ))}
    </div>
  );
}

/** Label bar + big number bar + caption bar, the shape of a StatBlock. */
function StatSkeleton() {
  return (
    <div className="flex min-w-0 flex-col gap-2.5">
      <Skeleton className="h-3.5 w-16" />
      <Skeleton className="h-10 w-24 max-w-full" />
      <Skeleton className="h-3.5 w-[80%]" />
    </div>
  );
}

// ---------------------------------------------------------------- funnel

/** Three bars sized by rate, joined by soft ribbons (Pencil: Funnel chart). */
function FunnelChart({ found, named, picked }: { found: number | null; named: number | null; picked: number | null }) {
  const W = 728;
  const H = 144;
  const mid = H / 2;
  const bars = [
    { x: 0, w: 170.67, r: found, fill: 'var(--color-brand-300)' },
    { x: 250.67, w: 170.67, r: named, fill: 'var(--color-brand-400)' },
    { x: 501.33, w: 226.67, r: picked, fill: 'var(--color-brand-500)' },
  ].map((b) => ({ ...b, h: Math.max(b.r == null ? 0 : b.r * H, b.r == null ? 0 : 4) }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Funnel: found, named, picked">
      {bars.slice(0, 2).map((a, i) => {
        const b = bars[i + 1];
        const x1 = a.x + a.w - 8;
        const x2 = b.x + 8;
        const cx = (x1 + x2) / 2;
        return (
          <path
            key={i}
            d={`M${x1} ${mid - a.h / 2} C${cx} ${mid - a.h / 2} ${cx} ${mid - b.h / 2} ${x2} ${mid - b.h / 2} L${x2} ${mid + b.h / 2} C${cx} ${mid + b.h / 2} ${cx} ${mid + a.h / 2} ${x1} ${mid + a.h / 2} Z`}
            fill="var(--color-brand-100)"
          />
        );
      })}
      {bars.map((b, i) =>
        b.r == null ? (
          <rect key={i} x={b.x} y={mid - 12} width={b.w} height={24} rx={12} fill="none" stroke="var(--color-ink-300)" strokeDasharray="4 4" />
        ) : (
          <rect key={i} x={b.x} y={mid - b.h / 2} width={b.w} height={b.h} rx={Math.min(16, b.h / 2)} fill={b.fill} className="transition-all duration-500" />
        ),
      )}
    </svg>
  );
}

export function FunnelCard({ summary, loading, error, onRetry }: { summary?: Summary; loading: boolean; error?: Error; onRetry: () => void }) {
  const name = summary?.focus.name ?? 'your brand';
  const gap = pts(summary?.gap);
  const cmp = summary?.compare;
  return (
    <Card pad="lg" className="min-w-0 flex-[792] gap-7">
      <CardHeader title={`The AI shopping funnel for ${name}`} sub={`How often AI found, named and picked ${name} when it shopped`} />
      {error && !summary ? (
        <ErrorNote error={error} onRetry={onRetry} />
      ) : !summary || loading ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-7">
          <div className="grid grid-cols-3 gap-6">{range(3).map((i) => <StatSkeleton key={i} />)}</div>
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="aspect-[728/144] w-full" />
            <Skeleton className="h-9 w-72 max-w-full rounded-pill!" />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-7">
          <div className="grid grid-cols-3 gap-6">
            <StatBlock label="Found" tone="ink" value={summary.found.rate} delta={cmp ? cmp.foundDelta : undefined} caption={`${formatCount(summary.found.n)} of ${formatCount(summary.found.of)} searched answers`} className="[&>div:first-child>span:first-child]:bg-brand-300" />
            <StatBlock label="Named" tone="brand" value={summary.mentioned.rate} delta={cmp ? cmp.mentionedDelta : undefined} caption={`${formatCount(summary.mentioned.n)} of ${formatCount(summary.mentioned.of)} answers`} className="[&>div:first-child>span:first-child]:bg-brand-400" />
            <StatBlock label="Picked" tone="brand" value={summary.picked.rate} delta={cmp ? cmp.pickedDelta : undefined} caption={`${formatCount(summary.picked.n)} of ${formatCount(summary.picked.of)} answers`} />
          </div>
          <div className="flex flex-col items-center gap-0">
            <FunnelChart found={summary.found.rate} named={summary.mentioned.rate} picked={summary.picked.rate} />
            {gap !== null && (
              <span className="-mt-1 inline-flex h-9 items-center gap-2 rounded-pill bg-marigold-100 pr-4 pl-3 text-[15px] font-semibold text-marigold-700">
                <Lightbulb aria-hidden size={18} strokeWidth={ICON_STROKE} />
                {gap > 0 ? `${gap}-point gap: AI names ${name}, buys elsewhere` : gap === 0 ? `Every time AI names ${name}, it picks it` : `${-gap}-point lead: picked more than named`}
              </span>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- biggest lost sale

export function LostSaleCard({
  mode = 'loss', sale, trace, focusName, primaryName, loading, onOpen,
}: {
  /** loss: the focus brand's top lost sale. win: a competitor in focus — its biggest win over the primary brand. */
  mode?: 'loss' | 'win';
  sale?: LostSale | null;
  trace?: Trace;
  focusName: string;
  primaryName: string;
  loading: boolean;
  onOpen: (taskId: string) => void;
}) {
  const label = mode === 'win' ? `Biggest ${focusName} win` : 'Biggest lost sale';
  if (loading && sale === undefined) {
    return (
      <Card tone="brand" className="min-w-0 flex-[384] gap-4 ">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-24" />
        <Skeleton className="h-12" />
        <Skeleton className="mt-auto h-11" />
      </Card>
    );
  }
  if (!sale) {
    return (
      <Card tone="brand" className="min-w-0 flex-[384] items-start gap-3 ">
        <p className="flex items-center gap-2 type-label text-brand-700"><Target aria-hidden size={16} strokeWidth={ICON_STROKE} /> {label}</p>
        <p className="type-h3 text-ink-900">{mode === 'win' ? `${focusName} didn't beat ${primaryName} in this view.` : 'No lost sales in this view.'}</p>
        <p className="type-small text-ink-500">
          {mode === 'win' ? 'Try another run or widen the lens.' : `Every answer here picked ${focusName}, or there are no finished answers yet.`}
        </p>
      </Card>
    );
  }
  const t = trace?.taskId === sale.taskId ? trace : undefined;
  const pick = t?.pick ?? null;
  const our = sale.ourProduct;
  const reason = sale.reason ? LOSS_REASON_LABEL[sale.reason] : null;
  const outcomeLabel = sale.outcome === 'mentioned_lost' ? 'Named, lost' : sale.outcome === 'found_not_mentioned' ? 'Seen, never named' : 'Never found';
  const pickedLine = (
    <>
      {ASSISTANT_LABEL[sale.assistant]} picked{' '}
      {sale.winner && <BrandLogo name={sale.winner} size={20} decorative className="mr-1 -mt-0.5 align-middle" />}
      {sale.winner ?? 'another brand'}
      {sale.winnerPriceInr != null && ` · ${formatInr(sale.winnerPriceInr)}`}
      {pick?.channel && ` on ${channelName(pick.channel)}`}
    </>
  );
  const delivery = pick?.deliveryDays == null ? null : pick.deliveryDays <= 1 ? (pick.deliveryDays === 0 ? 'Delivery today' : 'Delivery tomorrow') : `Delivery in ${pick.deliveryDays} days`;
  return (
    <Card tone="brand" className="min-w-0 flex-[384] gap-[18px] ">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-2 type-label text-brand-700"><Target aria-hidden size={16} strokeWidth={ICON_STROKE} /> {label}</p>
        <p className="type-label text-ink-500">{sale.queryCode}{t ? ` · attempt ${t.attempt}` : ''}</p>
      </div>
      <div className="flex items-end gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface text-ink-700">
          <ShoppingBag aria-hidden size={16} strokeWidth={ICON_STROKE} />
        </span>
        <p className="flex-1 rounded-[22px_22px_22px_6px] bg-surface px-[18px] py-3.5 text-[16px] leading-6 text-ink-900">{sale.queryText}</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-2.5">
          <AssistantBadge assistant={sale.assistant} />
          <p className="flex-1 text-[15px] font-semibold text-ink-900">{pickedLine}</p>
        </div>
        {our && (
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 shrink-0 items-center justify-center">
              <BrandLogo name={primaryName} kind="brand" size={24} color="var(--color-brand-500)" decorative />
            </span>
            <p className="flex-1 text-[15px] leading-[22px] text-ink-700">
              {mode === 'win' ? (
                <>
                  {primaryName} was {sale.outcome === 'mentioned_lost' ? 'named but lost' : sale.outcome === 'found_not_mentioned' ? 'seen, never named' : 'never found'} · {formatInr(our.priceInr)}
                  {reason && sale.outcome === 'mentioned_lost' && ` · ${reason.toLowerCase()}`}
                </>
              ) : (
                <>
                  You had {our.name} · {formatInr(our.priceInr)}
                  {our.deliveryDays != null && ` · ${our.deliveryDays}-day delivery${our.deliveryIsSample ? ' (sample)' : ''}`}
                </>
              )}
            </p>
          </div>
        )}
      </div>
      {mode === 'win' ? (
        <OutcomePill outcome="picked" label={delivery ? `Picked · ${delivery}` : 'Picked'} className="w-fit" />
      ) : (
        <OutcomePill outcome={sale.outcome} label={reason && sale.outcome === 'mentioned_lost' ? `${outcomeLabel} · ${reason}` : outcomeLabel} className="w-fit" />
      )}
      <div className="flex-1" />
      <Button icon={Route} className="w-full" onClick={() => onOpen(sale.taskId)}>See how it decided</Button>
    </Card>
  );
}

/** Pick channels arrive raw ("myntra", "brand_site"); show them the way the design does. */
export function channelName(channel: string, marketplaces: Marketplace[] = [], ownDomain?: string): string {
  const c = channel.trim();
  if (c === 'brand_site') return ownDomain ?? 'Brand site';
  const lc = c.toLowerCase();
  const m = marketplaces.find((x) => x.name.toLowerCase() === lc || x.domains.some((d) => d.toLowerCase() === lc || d.toLowerCase().split('.')[0] === lc));
  if (m) return m.name;
  if (c.includes('.')) return c;
  return c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' ');
}

// ---------------------------------------------------------------- wins

type Tab = 'all' | Assistant;

export function WinsCard({
  wins, loading, error, onRetry, tab, onTab, total, available,
}: { wins?: Win[]; loading: boolean; error?: Error; onRetry: () => void; tab: Tab; onTab: (t: Tab) => void; total: number | null; available: Assistant[] }) {
  let rank = 0;
  return (
    <Card className="min-w-0 flex-1 gap-5">
      <CardHeader
        title="Who AI picked instead"
        sub={total != null ? `Winners across ${plural(total, 'answer')}` : 'Winners across all answers'}
        right={
          <Segmented<Tab>
            className="shrink-0 [&_button]:px-2.5"
            label="Assistant"
            value={tab}
            onValueChange={onTab}
            options={[{ value: 'all', label: 'All' }, ...available.map((a) => ({ value: a as Tab, label: ASSISTANT_LABEL[a] }))]}
          />
        }
      />
      {error && !wins ? (
        <ErrorNote error={error} onRetry={onRetry} />
      ) : !wins || loading ? (
        <BarRowsSkeleton rows={wins?.length || 6} />
      ) : wins.length === 0 ? (
        <p className="type-small text-ink-500">No picks yet.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {wins.map((w) => {
            const color = w.isFocus ? 'var(--color-brand-500)' : w.isPrimary ? 'var(--color-brand-300)' : w.brandId === null ? 'var(--color-comp-other)' : competitorColor(rank++);
            return (
              <BarRow
                key={w.brandId ?? w.brandName}
                name={w.brandName}
                n={w.picks}
                share={w.share}
                isYou={w.isPrimary}
                highlighted={w.isFocus}
                color={color}
                logo={<BrandLogo name={w.brandName} size={20} color={color} decorative />}
              />
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- loss reasons

export function LossReasonsCard({
  rows, focusName, loading, error, onRetry, onSee,
}: { rows?: LossReasonRow[]; focusName: string; loading: boolean; error?: Error; onRetry: () => void; onSee?: () => void }) {
  const notPicked = rows?.reduce((s, r) => s + r.n, 0) ?? null;
  return (
    <Card className="min-w-0 flex-1 gap-5">
      <CardHeader
        title={`Why ${focusName} lost`}
        sub={notPicked != null ? `${plural(notPicked, 'answer')} where ${focusName} wasn't picked` : `Answers where ${focusName} wasn't picked`}
        right={onSee && <Button variant="ghost" size="sm" icon={ArrowUpRight} onClick={onSee}>See these answers</Button>}
      />
      {error && !rows ? (
        <ErrorNote error={error} onRetry={onRetry} />
      ) : !rows || loading ? (
        <BarRowsSkeleton rows={rows?.length || 6} variant="reason" />
      ) : rows.length === 0 ? (
        <p className="type-small text-ink-500">No losses in this view.</p>
      ) : (
        <div className="flex flex-col gap-1">
          {rows.map((r) => <ReasonRow key={r.reason} reason={r.reason} n={r.n} share={r.share} />)}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- by assistant

function MiniStat({ label, value, tone }: { label: string; value: number | null; tone?: 'brand' }) {
  return (
    <div className={cn('flex flex-1 flex-col gap-0.5 rounded-input px-3 py-2.5', tone === 'brand' ? 'bg-brand-50' : 'bg-surface-sunken')}>
      <span className={cn('type-label', tone === 'brand' ? 'text-brand-700' : 'text-ink-500')}>{label}</span>
      <span className={cn('font-display text-[26px] leading-8 font-bold tabular-nums', value == null ? 'text-ink-400' : 'text-ink-900')}>{formatPercent(value)}</span>
    </div>
  );
}

export function ByAssistantSection({ rows, focusName, loading, error, onRetry }: { rows?: ByAssistant[]; focusName: string; loading: boolean; error?: Error; onRetry: () => void }) {
  const best = rows?.reduce<ByAssistant | null>((b, r) => (r.picked.rate != null && (b === null || (b.picked.rate ?? -1) < r.picked.rate) ? r : b), null);
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 className="type-h2 text-ink-900">By assistant</h2>
        <p className="type-small text-ink-500">Each dot is one answer. Filled dots are picks for {focusName}.</p>
      </div>
      {error && !rows ? (
        <ErrorNote error={error} onRetry={onRetry} />
      ) : !rows || loading ? (
        <div aria-busy="true" aria-label="Loading" className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {range(rows?.length || 3).map((i) => (
            <Card key={i} pad="sm" className="gap-5">
              <div className="flex h-7 items-center gap-2">
                <Skeleton className="size-6 rounded-pill!" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="flex gap-2">
                {range(3).map((j) => (
                  <div key={j} className="flex flex-1 flex-col gap-1.5 rounded-input px-3 py-2.5">
                    <Skeleton className="h-3 w-12" />
                    <Skeleton className="h-7 w-14" />
                  </div>
                ))}
              </div>
              <Skeleton className="h-[21px] w-full" />
              <Skeleton className="h-4 w-[70%]" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.assistant} pad="sm" className="gap-5">
              <div className="flex items-center justify-between">
                <AssistantBadge assistant={r.assistant} showLabel />
                {best?.assistant === r.assistant && rows.length > 1 && (
                  <span className="inline-flex h-7 items-center gap-1.5 rounded-pill bg-brand-100 px-3 text-[13px] font-semibold text-brand-700">
                    Best for {focusName}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <MiniStat label="Found" value={r.found.rate} />
                <MiniStat label="Named" value={r.mentioned.rate} />
                <MiniStat label="Picked" value={r.picked.rate} tone="brand" />
              </div>
              <div className="flex flex-wrap gap-[5px]" aria-label={`${r.picked.n} picks out of ${r.done} answers`}>
                {Array.from({ length: r.done }, (_, i) => (
                  <span key={i} className={cn('size-2 rounded-full', i < r.picked.n ? 'bg-brand-500' : 'bg-brand-100')} />
                ))}
              </div>
              <p className="type-body-strong text-ink-900">
                Picks {focusName} {r.picked.n} of {r.picked.of} times
              </p>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- sources

const TYPE_COLOR: Record<SourceType, string> = {
  marketplace: 'var(--color-ink-700)',
  listicle: 'var(--color-ink-500)',
  brand_site: 'var(--color-ink-400)',
  review: 'var(--color-ink-300)',
  other: 'var(--color-ink-200)',
};

export function SourcesCard({ data, answers, focusName, loading, error, onRetry }: { data?: SourcesBreakdown; answers: number | null; focusName: string; loading: boolean; error?: Error; onRetry: () => void }) {
  const total = data?.byType.reduce((s, t) => s + t.n, 0) ?? 0;
  return (
    <Card className="min-w-0 flex-[690] gap-5">
      <CardHeader title="Where AI shopped" sub={data ? `${formatCount(total)} pages read${answers != null ? ` across ${plural(answers, 'answer')}` : ''}` : 'Pages the AI read'} />
      {error && !data ? (
        <ErrorNote error={error} onRetry={onRetry} />
      ) : !data || loading ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full rounded-pill!" />
            <div className="flex flex-wrap gap-x-5 gap-y-1">{range(5).map((i) => <Skeleton key={i} className="h-5 w-24" />)}</div>
          </div>
          <div className="flex flex-col">
            <div className="flex h-9 items-center justify-between border-b border-ink-200"><Skeleton className="h-3 w-20" /><Skeleton className="h-3 w-32" /></div>
            {range(Math.min(data?.topDomains.length || 6, 8)).map((i) => (
              <div key={i} className="flex h-12 items-center gap-3 border-b border-ink-100 last:border-0">
                <Skeleton className="size-7 shrink-0 rounded-pill!" />
                <Skeleton className={cn('h-4 max-w-[180px]', NAME_W[i % NAME_W.length])} />
                <Skeleton className="h-6 w-20 shrink-0 rounded-pill!" />
                <span className="flex-1" />
                <Skeleton className="h-4 w-10 shrink-0" />
                <Skeleton className="ml-6 h-4 w-28 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex h-4 w-full gap-1 overflow-hidden rounded-pill">
              {data.byType.filter((t) => t.n > 0).map((t) => (
                <div key={t.type} title={`${SOURCE_TYPE_LABEL[t.type]} · ${t.n}`} style={{ flexGrow: t.n, backgroundColor: TYPE_COLOR[t.type] }} className="h-full first:rounded-l-pill last:rounded-r-pill" />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1">
              {data.byType.map((t) => (
                <span key={t.type} className="flex items-center gap-2 type-small text-ink-700">
                  <span aria-hidden className="size-2.5 rounded-[3px]" style={{ backgroundColor: TYPE_COLOR[t.type] }} />
                  {SOURCE_TYPE_LABEL[t.type]} <span className="font-semibold text-ink-900 tabular-nums">{formatCount(t.n)}</span>
                </span>
              ))}
            </div>
          </div>
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-ink-200 text-left">
                <th className="py-2 type-label text-ink-500">Top sites</th>
                <th className="w-20 py-2 text-right type-label text-ink-500">Reads</th>
                <th className="w-40 py-2 pl-6 type-label text-ink-500">{focusName} on page</th>
              </tr>
            </thead>
            <tbody>
              {data.topDomains.slice(0, 8).map((d) => (
                <tr key={d.domain} className="border-b border-ink-100 last:border-0">
                  <td className="py-2.5">
                    <div className="flex items-center gap-3">
                      {brandLogoSrc(null, d.domain) ? (
                        <span className="flex size-7 shrink-0 items-center justify-center">
                          <BrandLogo name={d.domain} domain={d.domain} size={24} decorative />
                        </span>
                      ) : (
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-sunken text-[12px] font-bold text-ink-700 uppercase">{d.domain.charAt(0)}</span>
                      )}
                      <span className="type-body-strong text-ink-900">{d.domain}</span>
                      <span className="inline-flex h-6 items-center rounded-pill bg-ink-100 px-2.5 text-[12px] font-semibold text-ink-700">{SOURCE_TYPE_LABEL[d.type]}</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right type-num text-ink-900">{formatCount(d.n)}</td>
                  <td className="py-2.5 pl-6">
                    {d.focusPresent ? (
                      <span className="flex items-center gap-1.5 type-small text-picked-700"><CircleCheck aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-picked-500" /> {focusName} present</span>
                    ) : (
                      <span className="flex items-center gap-1.5 type-small text-ink-500"><CircleDashed aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-ink-400" /> {focusName} missing</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

const DONUT_COLORS = ['var(--color-brand-500)', 'var(--color-brand-300)', 'var(--color-brand-200)', 'var(--color-brand-700)', 'var(--color-brand-100)'];

export function PickChannelsCard({ data, focusName, focusDomains, marketplaces = [], loading }: { data?: SourcesBreakdown; focusName: string; focusDomains: string[]; marketplaces?: Marketplace[]; loading: boolean }) {
  const channels = data?.focusPickChannels ?? [];
  const total = channels.reduce((s, c) => s + c.n, 0);
  const R = 70;
  const C = 2 * Math.PI * R;
  const arcs = channels.map((c, i) => {
    const len = (c.n / total) * C;
    const start = channels.slice(0, i).reduce((s, x) => s + (x.n / total) * C, 0);
    return { c, i, len, start };
  });
  const top = [...channels].sort((a, b) => b.n - a.n)[0];
  const name = (c: string) => channelName(c, marketplaces, focusDomains[0]);
  const logoFor = (c: string) => {
    const domain = c === 'brand_site' ? focusDomains : [c, ...(marketplaces.find((m) => m.name === name(c))?.domains ?? [])];
    return brandLogoSrc(name(c), domain) ? <BrandLogo name={name(c)} domain={domain} size={20} decorative /> : null;
  };
  const topIsOwn = top ? top.channel === 'brand_site' || focusDomains.some((d) => top.channel.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(top.channel.toLowerCase())) : false;
  return (
    <Card className="min-w-0 flex-[486] gap-5">
      <CardHeader title={`Where ${focusName} got picked`} sub={total ? `The page AI bought from, for ${plural(total, 'pick')}` : 'The page AI bought from'} />
      {!data || loading ? (
        <div aria-busy="true" aria-label="Loading" className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-8">
            <Skeleton className="size-[180px] shrink-0 rounded-pill!" />
            <div className="flex min-w-0 flex-1 flex-col gap-3">
              {range(channels.length || 4).map((i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <Skeleton className="mt-1.5 size-2.5 shrink-0 rounded-pill!" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-[70%]" />
                    <Skeleton className="h-3 w-[45%]" />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Skeleton className="mt-auto h-14 w-full" />
        </div>
      ) : total === 0 ? (
        <p className="type-small text-ink-500">AI hasn&apos;t picked {focusName} in this view yet.</p>
      ) : (
        <div className="flex flex-1 flex-col gap-5">
          <div className="flex items-center gap-8">
            <div className="relative size-[180px] shrink-0">
              <svg viewBox="0 0 180 180" className="size-full -rotate-90">
                <circle cx="90" cy="90" r={R} fill="none" stroke="var(--color-ink-100)" strokeWidth="28" />
                {arcs.map(({ c, i, len, start }) => (
                  <circle key={c.channel} cx="90" cy="90" r={R} fill="none" stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="28" strokeDasharray={`${Math.max(len - 2, 0)} ${C}`} strokeDashoffset={-start} />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-[40px] leading-[44px] font-bold text-ink-900">{total}</span>
                <span className="type-small text-ink-500">picks</span>
              </div>
            </div>
            <ul className="flex min-w-0 flex-col gap-3">
              {channels.map((c, i) => (
                <li key={c.channel} className="flex items-start gap-2.5">
                  <span aria-hidden className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
                  <span className="flex flex-col">
                    <span className="flex items-center gap-1.5 type-body-strong text-ink-900">{logoFor(c.channel)}{name(c.channel)}</span>
                    <span className="type-small text-ink-500">{plural(c.n, 'pick')} · {formatPercent(c.n / total)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          {top && (
            <p className="mt-auto flex items-start gap-2.5 rounded-inner bg-marigold-50 p-4 type-small text-marigold-700">
              <Lightbulb aria-hidden size={18} strokeWidth={ICON_STROKE} className="mt-0.5 shrink-0" />
              <span>
                {top.n} of {focusName}&apos;s {total} picks came through {name(top.channel)}
                {!topIsOwn && focusDomains[0] ? `, not ${focusDomains[0]}` : ''}.
              </span>
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------- fixes

export function FixesSection({
  fixes, status, focusName, loading, error, onRegenerate, regenerating,
}: { fixes?: Fix[]; status?: string; focusName: string; loading: boolean; error?: Error; onRegenerate?: () => void; regenerating?: boolean }) {
  const pending = status === 'pending' || status === 'running';
  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="type-h2 text-ink-900">{fixes?.length ? `${fixes.length} fixes for ${focusName}` : `Fixes for ${focusName}`}</h2>
          <p className="type-small text-ink-500">Ranked by how many lost sales each could win back</p>
        </div>
        {onRegenerate && (
          <Button variant="ghost" size="sm" icon={RefreshCw} loading={regenerating} onClick={onRegenerate}>
            Regenerate
          </Button>
        )}
      </div>
      {error && !fixes ? (
        <ErrorNote error={error} />
      ) : !fixes || loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[260px] rounded-card" />)}</div>
      ) : fixes.length === 0 ? (
        <p className="rounded-inner bg-surface px-5 py-4 type-small text-ink-500 elevation-flat">
          {pending ? 'Fixes are being written now — they appear when the run finishes.' : status === 'failed' ? 'Fixes failed to generate. Try Regenerate.' : 'No fixes for this run yet.'}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[...fixes].sort((a, b) => a.ord - b.ord).map((f) => <FixCard key={f.ord} ord={f.ord} title={f.title} why={f.why} action={f.action} fixType={f.fixType} />)}
        </div>
      )}
    </section>
  );
}

