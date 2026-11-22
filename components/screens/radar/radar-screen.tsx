'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Download, Rocket, ScanSearch, Search, Send } from 'lucide-react';
import type { Assistant } from '@/lib/api-types';
import { api, isApiError, type Lens } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { useLens } from '@/lib/client/lens';
import { AppShell, ErrorNote, Skeleton } from '../app-shell';
import { runDateLabel, runSubtitle } from '../format';
import { PlanRunDialog } from '../runs/plan-run-dialog';
import { TraceDrawer } from '../trace/trace-drawer';
import { Button, EmptyState, ICON_STROKE } from '../ui';
import { LensSentence } from './lens-sentence';
import {
  ByAssistantSection, FixesSection, FunnelCard, LossReasonsCard, LostSaleCard, PickChannelsCard, SourcesCard, WinsCard,
} from './sections';

const ALL: Assistant[] = ['openai', 'anthropic', 'gemini'];

const EMPTY_STEPS = [
  { icon: Send, title: 'Send AI shoppers', body: (n: number) => `ChatGPT, Claude and Gemini each ask your ${n} questions 3 times.` },
  { icon: Search, title: 'They search and read', body: () => 'We record every page they read and the product they pick.' },
  { icon: ScanSearch, title: 'See your radar', body: () => 'Found, named, picked, who won instead, and why.' },
];

/**
 * Home: Pencil "10 Radar" (jXoSH) · "11 Radar – focus Biba" (M1he4v) · "12 Radar – loading" (Tkwl8) ·
 * "13 Radar – empty" (FVYVD), with the "20 Trace" sheet (RqOOe) on ?trace=<taskId>.
 */
export function RadarScreen({ initialTrace }: { initialTrace?: string }) {
  const router = useRouter();
  const { lens, key, setLens, setParams, params } = useLens();
  const traceId = params.get('trace') ?? initialTrace ?? null;

  const options = useApi('lens-options', api.lensOptions);
  const setup = useApi('setup', api.setup);
  const summary = useApi(`summary:${key}`, () => api.summary(lens));

  // Everything else waits for the summary so it resolves the same run as the headline.
  const runId = summary.data?.lens.runId;
  const resolved: Lens = runId ? { ...lens, run: runId } : lens;
  const ready = summary.data ? key : null;
  const competitorFocus = summary.data ? !summary.data.focus.isPrimary : false;

  const [winsTab, setWinsTab] = useState<'all' | Assistant>('all');
  const lensAssistants = lens.assistants?.length ? lens.assistants : ALL;
  const winsLens: Lens = winsTab === 'all' ? resolved : { ...resolved, assistants: [winsTab] };

  const runStatus = useApi(runId ? `run:${runId}` : null, () => api.run(runId!));
  const wins = useApi(ready && `wins:${key}:${winsTab}`, () => api.wins(winsLens));
  const reasons = useApi(ready && `reasons:${key}`, () => api.lossReasons(resolved));
  const byAssistant = useApi(ready && `byas:${key}`, () => api.byAssistant(resolved));
  const sources = useApi(ready && `sources:${key}`, () => api.sources(resolved));
  const lostSales = useApi(ready && `lost:${key}`, () => api.lostSales(resolved, 100));
  // Competitor in focus: the hero card shows its biggest win = the primary brand's top lost sale to it.
  const primaryLost = useApi(ready && competitorFocus ? `lost-primary:${key}` : null, () => api.lostSales({ ...resolved, focus: undefined }, 100));
  const fixes = useApi(runId ? `fixes:${runId}` : null, () => api.fixes(runId!));

  const focusName = summary.data?.focus.name ?? options.data?.brands.find((b) => b.id === lens.focus)?.name ?? setup.data?.brand.name ?? 'your brand';
  const primaryName = setup.data?.brand.name ?? options.data?.brands.find((b) => b.isPrimary)?.name ?? 'your brand';
  const focusBrand = options.data?.brands.find((b) => b.id === summary.data?.focus.id);
  const focusDomains = focusBrand?.domains ?? setup.data?.brand.domains ?? [];

  const heroSale = competitorFocus
    ? primaryLost.data ? primaryLost.data.find((l) => l.winner?.toLowerCase() === focusName.toLowerCase()) ?? null : undefined
    : lostSales.data ? lostSales.data[0] ?? null : undefined;
  const heroTrace = useApi(heroSale ? `trace:${heroSale.taskId}` : null, () => api.trace(heroSale!.taskId));

  const [regenerating, setRegenerating] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const openTrace = useCallback((taskId: string) => setParams({ trace: taskId }), [setParams]);
  const closeTrace = useCallback(() => {
    if (initialTrace) router.push('/');
    else setParams({ trace: null });
  }, [initialTrace, router, setParams]);

  async function regenerate() {
    if (!runId) return;
    setRegenerating(true);
    setActionError(null);
    try {
      await api.regenerateFixes(runId);
      fixes.reload();
    } catch (e) {
      setActionError(isApiError(e) ? e.message : 'Could not regenerate fixes');
    } finally {
      setRegenerating(false);
    }
  }

  const noRuns = !summary.data && !!summary.error && isApiError(summary.error) && (summary.error.code === 'no_runs' || summary.error.code === 'run_not_found');
  const badLens = !!summary.error && isApiError(summary.error) && summary.error.code === 'bad_lens';
  const run = runStatus.data;
  const queryCount = setup.data?.queries.length ?? options.data?.queries.length ?? 10;
  // In the drawer, a competitor-focus hero trace walks the primary brand's lost sales.
  const pager = (competitorFocus ? primaryLost.data : lostSales.data)?.map((l) => l.taskId) ?? [];

  return (
    <AppShell active="radar">
      {/* Intro */}
      <div className="flex flex-col gap-7">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <h1 className="type-display text-ink-900">Radar</h1>
            <div className="type-small text-ink-500">
              {run ? runSubtitle(run) : noRuns ? `No runs yet · ${queryCount} shopper questions ready` : summary.data ? `${summary.data.done} answers` : <Skeleton className="h-4 w-72" />}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!noRuns && <Button variant="secondary" icon={Download} onClick={() => window.print()}>Export</Button>}
            <Button icon={Rocket} onClick={() => setPlanOpen(true)}>Run AI shoppers</Button>
          </div>
        </div>
        <div className={noRuns ? 'pointer-events-none opacity-50' : undefined} aria-disabled={noRuns || undefined}>
          <LensSentence lens={lens} setLens={setLens} options={options.data} summary={summary.data} />
        </div>
        {actionError && <ErrorNote error={new Error(actionError)} />}
        {badLens && summary.error && <ErrorNote error={summary.error} onRetry={() => router.replace('/')} retryLabel="Reset view" />}
      </div>

      {badLens ? null : noRuns ? (
        <div className="flex flex-col gap-6">
          <EmptyState
            title="No AI shoppers sent yet"
            body={`Send ChatGPT, Claude and Gemini to shop your ${queryCount} questions.`}
            action={<Button icon={Rocket} onClick={() => setPlanOpen(true)}>Run AI shoppers</Button>}
          />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {EMPTY_STEPS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-4 rounded-card bg-surface p-6 elevation-card">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Icon aria-hidden size={20} strokeWidth={ICON_STROKE} />
                </span>
                <div className="flex flex-col gap-1">
                  <p className="type-h3 text-ink-900">{title}</p>
                  <p className="type-small text-ink-500">{body(queryCount)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-10">
          <div className="flex flex-col gap-6 lg:flex-row">
            <FunnelCard summary={summary.data} loading={summary.loading} error={summary.error} onRetry={summary.reload} />
            <LostSaleCard
              mode={competitorFocus ? 'win' : 'loss'}
              sale={heroSale}
              trace={heroTrace.data}
              focusName={focusName}
              primaryName={primaryName}
              loading={!ready || (competitorFocus ? primaryLost.loading : lostSales.loading)}
              onOpen={openTrace}
            />
          </div>
          <div className="flex flex-col gap-6 lg:flex-row">
            <WinsCard
              wins={wins.data}
              loading={wins.loading}
              error={wins.error}
              onRetry={wins.reload}
              tab={winsTab}
              onTab={setWinsTab}
              total={summary.data?.done ?? null}
              available={lensAssistants}
            />
            <LossReasonsCard
              rows={reasons.data}
              focusName={focusName}
              loading={reasons.loading}
              error={reasons.error}
              onRetry={reasons.reload}
              onSee={lostSales.data?.[0] ? () => openTrace(lostSales.data![0].taskId) : undefined}
            />
          </div>
          <ByAssistantSection rows={byAssistant.data} focusName={focusName} loading={byAssistant.loading} error={byAssistant.error} onRetry={byAssistant.reload} />
          <div className="flex flex-col gap-6 lg:flex-row">
            <SourcesCard data={sources.data} answers={summary.data?.done ?? null} focusName={focusName} loading={sources.loading} error={sources.error} onRetry={sources.reload} />
            <PickChannelsCard
              data={sources.data}
              focusName={focusName}
              focusDomains={focusDomains}
              marketplaces={setup.data?.marketplaces ?? []}
              loading={sources.loading}
            />
          </div>
          <FixesSection
            fixes={fixes.data}
            status={run?.fixesStatus}
            focusName={primaryName}
            loading={fixes.loading && !fixes.data}
            error={fixes.error}
            onRegenerate={runId ? regenerate : undefined}
            regenerating={regenerating}
          />
        </div>
      )}

      {traceId && (
        <TraceDrawer
          taskId={traceId}
          pager={pager}
          focusBrandId={competitorFocus ? setup.data?.brand.id : summary.data?.focus.id}
          focusName={competitorFocus ? primaryName : focusName}
          fixes={fixes.data}
          runLabel={run ? `${run.label ?? 'Run'} · ${runDateLabel(run.createdAt)}` : undefined}
          onClose={closeTrace}
          onNavigate={openTrace}
        />
      )}
      {planOpen && <PlanRunDialog onClose={() => setPlanOpen(false)} />}
    </AppShell>
  );
}
