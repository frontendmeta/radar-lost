'use client';

import { useCallback, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, CircleHelp, Plus, Rocket, Search, SlidersHorizontal, X } from 'lucide-react';
import type { Assistant, QueryRow, RunTask } from '@/lib/api-types';
import { api, isApiError } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { useLens } from '@/lib/client/lens';
import { AppShell, ErrorNote, Skeleton } from '../app-shell';
import { runDateLabel } from '../format';
import {
  ASSISTANT_LABEL, AssistantBadge, Button, EmptyState, ICON_STROKE, OUTCOME_LABEL, OutcomeDot, Segmented, Tooltip, cn, formatCount, type Outcome,
} from '../ui';
import { QueryDrawer } from './query-drawer';
import { AttemptDots, MenuOption, Popover, WinnerChip, usualWinner, winnerStyles } from './shared';

const ALL: Assistant[] = ['openai', 'anthropic', 'gemini'];
const LEGEND: Outcome[] = ['picked', 'mentioned_lost', 'found_not_mentioned', 'not_found', 'failed'];
type OutcomeFilter = 'all' | 'won' | 'lost';

// Question takes the rest; the other columns are fixed so header and rows line up.
const COL_QUERY = 'min-w-0 flex-1 pr-6';
const COL_DOTS = 'flex w-[236px] shrink-0 items-center gap-1';
const SLOT = 'flex w-[52px] shrink-0 justify-center';
const COL_PICKED = 'w-[120px] shrink-0';
const COL_WINNER = 'flex w-[168px] shrink-0 min-w-0 pr-3';

function PickedCell({ rate }: { rate: QueryRow['picked'] }) {
  const unknown = rate.rate == null;
  return (
    <span className={cn('text-[14px] leading-5 font-semibold tabular-nums', unknown ? 'text-ink-400' : rate.n === 0 ? 'text-lost-700' : 'text-ink-900')}>
      {unknown ? '—' : `${formatCount(rate.n)}/${formatCount(rate.of)}`}
    </span>
  );
}

function RowSkeleton({ first, slots }: { first?: boolean; slots: number }) {
  return (
    <div className={cn('flex h-14 items-center px-4', !first && 'border-t border-ink-200/70')}>
      <div className={COL_QUERY}>
        <Skeleton className="h-4 w-[70%]" />
      </div>
      <div className={COL_DOTS}>
        {Array.from({ length: slots }, (_, i) => (
          <span key={i} className={SLOT}><Skeleton className="size-3.5 rounded-pill" /></span>
        ))}
      </div>
      <div className={COL_PICKED}>
        <Skeleton className="h-4 w-8" />
      </div>
      <div className={COL_WINNER}>
        <Skeleton className="h-6 w-20 rounded-pill" />
      </div>
      <span className="w-5 shrink-0" />
    </div>
  );
}

function DotsHelp() {
  return (
    <Tooltip
      side="bottom"
      content={
        <span className="flex flex-col gap-1.5 py-0.5">
          <span className="font-semibold">Each dot is one answer</span>
          {LEGEND.map((o) => (
            <span key={o} className="inline-flex items-center gap-2">
              <OutcomeDot outcome={o} />
              {OUTCOME_LABEL[o]}
            </span>
          ))}
        </span>
      }
    >
      <button type="button" aria-label="What the dots mean" className="flex size-5 cursor-help items-center justify-center rounded-full text-ink-400 hover:text-ink-900 focus-visible:text-ink-900">
        <CircleHelp aria-hidden size={14} strokeWidth={ICON_STROKE} />
      </button>
    </Tooltip>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="px-3 pt-2 pb-1 text-[11px] leading-4 font-semibold tracking-[0.04em] text-ink-500 uppercase">{children}</p>;
}

/** Pencil: "30 Queries" (gvmRw) with the "31 Queries – row drawer" (eSOZP) on ?q=<queryId>. */
export function QueriesScreen() {
  const { lens, key, setLens, setParams, params } = useLens();
  const openId = params.get('q');

  const options = useApi('lens-options', api.lensOptions);
  const setup = useApi('setup', api.setup);
  const summary = useApi(`summary:${key}`, () => api.summary(lens));
  const queries = useApi(`queries:${key}`, () => api.queries(lens));
  const wins = useApi(`wins:${key}`, () => api.wins(lens));

  const [search, setSearch] = useState('');
  const [outcome, setOutcome] = useState<OutcomeFilter>('all');
  const [sortAsc, setSortAsc] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const closeFilters = useCallback(() => setFiltersOpen(false), []);

  const brands = options.data?.brands ?? [];
  const focusName = summary.data?.focus.name ?? brands.find((b) => b.id === lens.focus)?.name ?? setup.data?.brand.name ?? 'Your brand';
  const brandName = setup.data?.brand.name ?? brands.find((b) => b.isPrimary)?.name ?? 'Your';
  const runs = options.data?.runs ?? [];
  const runId = summary.data?.lens.runId ?? (lens.run && lens.run !== 'latest' ? lens.run : undefined);
  const run = runs.find((r) => r.id === runId);
  const lensAssistants = lens.assistants;
  const assistants = useMemo(() => (lensAssistants?.length ? ALL.filter((a) => lensAssistants.includes(a)) : ALL), [lensAssistants]);

  // Real tasks for the lens run. Their focusOutcome is the primary brand's, so they're only used when it's in focus.
  const runTasks = useApi(runId ? `run-tasks:${runId}` : null, () => api.runTasks(runId!));
  const tasksUsable = !!summary.data?.focus.isPrimary && !!runTasks.data;
  const tasksByQuery = useMemo(() => {
    const m = new Map<string, RunTask[]>();
    if (!tasksUsable) return m;
    for (const t of runTasks.data ?? []) {
      if (!assistants.includes(t.assistant)) continue;
      const list = m.get(t.queryId) ?? [];
      list.push(t);
      m.set(t.queryId, list);
    }
    return m;
  }, [tasksUsable, runTasks.data, assistants]);

  const style = useMemo(() => winnerStyles(wins.data), [wins.data]);
  const queryById = useMemo(() => new Map((setup.data?.queries ?? options.data?.queries ?? []).map((q) => [q.id, q])), [setup.data, options.data]);
  const products = useMemo(() => setup.data?.products ?? options.data?.products ?? [], [setup.data, options.data]);
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const enriched = useMemo(
    () => (queries.data ?? []).map((row) => ({ row, winner: usualWinner(row, wins.data) })),
    [queries.data, wins.data],
  );

  const visible = useMemo(() => {
    const s = search.trim().toLowerCase();
    const focusLc = focusName.toLowerCase();
    return enriched
      .filter(({ row }) => !s || row.text.toLowerCase().includes(s) || row.code.toLowerCase().includes(s))
      .filter(({ winner }) =>
        outcome === 'all' ? true : outcome === 'won' ? winner?.toLowerCase() === focusLc : !!winner && winner.toLowerCase() !== focusLc,
      )
      .sort((a, b) => {
        const ra = a.row.picked.rate;
        const rb = b.row.picked.rate;
        if (ra == null && rb == null) return a.row.code.localeCompare(b.row.code, undefined, { numeric: true });
        if (ra == null) return 1;
        if (rb == null) return -1;
        return (sortAsc ? ra - rb : rb - ra) || a.row.code.localeCompare(b.row.code, undefined, { numeric: true });
      });
  }, [enriched, search, outcome, focusName, sortAsc]);

  const openRow = enriched.find((e) => e.row.queryId === openId);
  const openQuery = useCallback((id: string) => setParams({ q: id }), [setParams]);
  const closeQuery = useCallback(() => setParams({ q: null }), [setParams]);

  const noRuns = !!summary.error && isApiError(summary.error) && (summary.error.code === 'no_runs' || summary.error.code === 'run_not_found');
  const err = queries.error && !queries.data ? queries.error : null;

  // ---- lens filters (behind the one "Filters" button)
  const prodSel = lens.products ?? [];
  const assistantFiltered = assistants.length !== ALL.length;
  const activeFilters = (prodSel.length ? 1 : 0) + (assistantFiltered ? 1 : 0) + (lens.run ? 1 : 0);
  // A multi-assistant lens (set on the Radar) has no single segment, so none is highlighted.
  const assistantValue = (assistants.length === 1 ? assistants[0] : assistantFiltered ? '' : 'all') as Assistant | 'all';

  const subtitle = noRuns
    ? `${queryById.size || 'Your'} questions · no runs yet`
    : queries.data
      ? `${queries.data.length} ${queries.data.length === 1 ? 'question' : 'questions'}${run ? ` · ${runDateLabel(run.createdAt)} run` : ''}`
      : null;

  return (
    <AppShell active="queries">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div className="flex flex-col gap-1">
          <h1 className="type-display text-ink-900">Queries</h1>
          <div className="min-h-6 text-[15px] leading-[1.6] text-ink-500">{subtitle ?? <Skeleton className="mt-1 h-4 w-48" />}</div>
        </div>
        <Button variant="secondary" icon={Plus} href="/settings/queries">
          Add query
        </Button>
      </div>

      {noRuns ? (
        <EmptyState
          title="No AI shoppers sent yet"
          body="Once ChatGPT, Claude and Gemini shop your questions, every question gets a row here."
          action={<Button icon={Rocket} href="/">Go to Radar</Button>}
        />
      ) : (
        <div className="-mt-2 flex flex-col gap-5">
          {/* Toolbar: search, one Filters button, All/Won/Lost */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex h-11 w-full items-center gap-2.5 rounded-pill border border-ink-200 bg-surface px-4 transition-colors focus-within:border-brand-300 sm:w-[320px]">
              <Search aria-hidden size={18} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search queries"
                aria-label="Search queries"
                className="min-w-0 flex-1 bg-transparent text-[15px] text-ink-900 outline-none placeholder:text-ink-400 [&::-webkit-search-cancel-button]:hidden"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear search" className="cursor-pointer text-ink-400 hover:text-ink-900">
                  <X aria-hidden size={16} strokeWidth={ICON_STROKE} />
                </button>
              )}
            </label>

            <span className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={filtersOpen}
                onClick={() => setFiltersOpen((v) => !v)}
                className={cn(
                  'inline-flex h-11 cursor-pointer items-center gap-2 rounded-pill border bg-surface px-4 text-[14px] leading-[18px] font-semibold text-ink-900 transition-colors hover:border-ink-300',
                  filtersOpen || activeFilters ? 'border-brand-300' : 'border-ink-200',
                )}
              >
                <SlidersHorizontal aria-hidden size={16} strokeWidth={ICON_STROKE} className="text-ink-500" />
                Filters
                {activeFilters > 0 && (
                  <span className="flex size-5 items-center justify-center rounded-full bg-brand-500 text-[11px] leading-none text-on-brand tabular-nums">{activeFilters}</span>
                )}
              </button>
              <Popover open={filtersOpen} onClose={closeFilters} role="dialog" label="Filters" className="w-[340px] max-h-[min(560px,70vh)] gap-1 p-2">
                <div className="flex items-center justify-between px-3 pt-1">
                  <span className="type-small font-semibold text-ink-900">Filters</span>
                  {activeFilters > 0 && (
                    <button
                      type="button"
                      onClick={() => setLens({ products: undefined, assistants: undefined, run: undefined })}
                      className="cursor-pointer type-small font-semibold text-brand-600 hover:text-brand-700"
                    >
                      Reset
                    </button>
                  )}
                </div>

                <SectionLabel>Assistant</SectionLabel>
                <div className="px-2 pb-1">
                  <Segmented<Assistant | 'all'>
                    label="Assistant"
                    value={assistantValue}
                    onValueChange={(v) => setLens({ assistants: v === 'all' ? undefined : [v] })}
                    options={[{ value: 'all', label: 'All' }, ...ALL.map((a) => ({ value: a, label: ASSISTANT_LABEL[a] }))]}
                  />
                </div>

                <SectionLabel>Product</SectionLabel>
                <div role="listbox" aria-label="Product" className="flex flex-col gap-0.5">
                  <MenuOption selected={!prodSel.length} onClick={() => setLens({ products: undefined })}>
                    <span className="font-semibold">All products</span>
                  </MenuOption>
                  {products.map((p) => (
                    <MenuOption key={p.id} selected={prodSel.length === 1 && prodSel[0] === p.id} onClick={() => setLens({ products: [p.id] })}>
                      <span className="font-semibold">{p.code}</span> · <span className="text-ink-700">{p.name}</span>
                    </MenuOption>
                  ))}
                </div>

                {runs.length > 0 && (
                  <>
                    <SectionLabel>Run</SectionLabel>
                    <div role="listbox" aria-label="Run" className="flex flex-col gap-0.5">
                      <MenuOption selected={!lens.run} onClick={() => setLens({ run: undefined })}>
                        <span className="font-semibold">Latest run</span>
                      </MenuOption>
                      {runs.map((r) => (
                        <MenuOption key={r.id} selected={lens.run === r.id} onClick={() => setLens({ run: r.id })}>
                          <span className="font-semibold">{runDateLabel(r.createdAt, true)}</span>
                          <span className="text-ink-500"> · {r.done} of {r.total} answers</span>
                        </MenuOption>
                      ))}
                    </div>
                  </>
                )}
              </Popover>
            </span>

            <span className="hidden flex-1 lg:block" />
            <Segmented<OutcomeFilter>
              label="Outcome"
              value={outcome}
              onValueChange={setOutcome}
              options={[
                { value: 'all', label: 'All' },
                { value: 'won', label: 'Won' },
                { value: 'lost', label: 'Lost' },
              ]}
              className="border border-ink-200 bg-surface [&_[aria-checked=true]]:bg-brand-500 [&_[aria-checked=true]]:text-on-brand"
            />
          </div>

          {/* Table */}
          {err ? (
            <ErrorNote error={err} onRetry={queries.reload} />
          ) : (
            <section className="rounded-card border border-ink-200/70 bg-surface elevation-card">
              <div className="max-lg:overflow-x-auto">
                <div className="flex min-w-[860px] flex-col p-2">
                  {/* Header row */}
                  <div className="flex h-10 items-center px-4 text-[12px] leading-[15px] font-semibold text-ink-500">
                    <span className={COL_QUERY}>Question</span>
                    <span className={COL_DOTS}>
                      {assistants.map((a) => (
                        <span key={a} className={SLOT}>
                          <AssistantBadge assistant={a} className="size-6! text-[10px]!" />
                        </span>
                      ))}
                      <DotsHelp />
                    </span>
                    <button
                      type="button"
                      onClick={() => setSortAsc((v) => !v)}
                      aria-label={`Sort by ${focusName} picked, ${sortAsc ? 'most first' : 'fewest first'}`}
                      className={cn(COL_PICKED, 'flex cursor-pointer items-center gap-1 text-left text-ink-700 hover:text-ink-900')}
                    >
                      <span className="truncate">{summary.data || setup.data ? `${focusName} picked` : 'Picked'}</span>
                      {sortAsc ? (
                        <ArrowUp aria-hidden size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-brand-600" />
                      ) : (
                        <ArrowDown aria-hidden size={14} strokeWidth={ICON_STROKE} className="shrink-0 text-brand-600" />
                      )}
                    </button>
                    <span className={COL_WINNER}>Usually won by</span>
                    <span className="w-5 shrink-0" />
                  </div>

                  {/* Rows */}
                  {!queries.data || queries.loading ? (
                    Array.from({ length: Math.min(visible.length || 6, 40) }, (_, i) => <RowSkeleton key={i} first={i === 0} slots={assistants.length} />)
                  ) : queries.data.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                      <p className="type-h3 text-ink-900">No answers in this view</p>
                      <p className="type-small text-ink-500">Nothing matches these filters.</p>
                      <Button variant="secondary" size="sm" className="mt-2" onClick={() => setLens({ products: undefined, assistants: undefined, queries: undefined })}>
                        Clear filters
                      </Button>
                    </div>
                  ) : visible.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 px-6 py-16 text-center">
                      <p className="type-h3 text-ink-900">No queries match</p>
                      <p className="type-small text-ink-500">
                        {search ? `Nothing matches “${search.trim()}”` : outcome === 'won' ? `${focusName} doesn't usually win any of these yet.` : `${focusName} usually wins every one of these.`}
                      </p>
                      <Button variant="secondary" size="sm" className="mt-2" onClick={() => { setSearch(''); setOutcome('all'); }}>
                        Show all queries
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-col">
                      {visible.map(({ row, winner }, i) => (
                        <button
                          key={row.queryId}
                          type="button"
                          onClick={() => openQuery(row.queryId)}
                          aria-haspopup="dialog"
                          className={cn(
                            'group flex h-14 w-full cursor-pointer items-center rounded-inner px-4 text-left transition-colors hover:bg-surface-sunken/70 focus-visible:bg-surface-sunken focus-visible:outline-none',
                            i > 0 && 'border-t border-ink-200/70',
                            openId === row.queryId && 'bg-surface-sunken',
                          )}
                        >
                          <span className={cn(COL_QUERY, 'truncate text-[15px] leading-5 font-medium text-ink-900')} title={row.text}>
                            {row.text}
                          </span>
                          <span className={COL_DOTS}>
                            {assistants.map((a) => (
                              <AttemptDots
                                key={a}
                                className={SLOT}
                                pa={row.perAssistant.find((p) => p.assistant === a)}
                                tasks={tasksByQuery.get(row.queryId)?.filter((t) => t.assistant === a)}
                              />
                            ))}
                          </span>
                          <span className={COL_PICKED}>
                            <PickedCell rate={row.picked} />
                          </span>
                          <span className={COL_WINNER}>
                            <WinnerChip name={winner} style={style} />
                          </span>
                          <span className="flex w-5 shrink-0 justify-end">
                            <ChevronRight aria-hidden size={18} strokeWidth={ICON_STROKE} className="text-ink-300 transition-transform group-hover:translate-x-0.5 group-hover:text-ink-500" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {openRow && (
        <QueryDrawer
          row={openRow.row}
          query={queryById.get(openRow.row.queryId)}
          product={productById.get(openRow.row.productId)}
          brandName={brandName}
          lens={lens}
          runId={runId}
          focusName={focusName}
          winnerStyle={style}
          tasks={tasksUsable ? tasksByQuery.get(openRow.row.queryId) ?? [] : undefined}
          onClose={closeQuery}
        />
      )}
    </AppShell>
  );
}
