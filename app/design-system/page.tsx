import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Download, IndianRupee, MapPin, RefreshCw, Rocket, Sparkles, Store, Truck, CircleStop, RotateCcw, Bell, KeyRound, Globe } from "lucide-react";
import {
  AssistantBadge,
  Banner,
  BarRow,
  BrandTheme,
  Button,
  Card,
  Chip,
  DeltaBadge,
  Dock,
  EmptyState,
  FixCard,
  HeroBand,
  Input,
  LensChip,
  OutcomeDot,
  OutcomePill,
  ProgressBar,
  QueryBubble,
  ReasonRow,
  RunRow,
  Segmented,
  SearchPill,
  SkeletonCard,
  SourceRow,
  StatBlock,
  Stepper,
  Toast,
  Toggle,
  Tooltip,
  TooltipBubble,
  TopBar,
  VerticalTab,
  YouTag,
  competitorColor,
  type Outcome,
} from "@/components/ui";

export const metadata: Metadata = { title: "Design system · Lost Sale Radar" };

const RAMPS: { title: string; tokens: string[] }[] = [
  { title: "Brand accent · Libas sample (swaps per brand)", tokens: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => `brand-${s}`) },
  { title: "Default accent · Peacock (sign-in, colourless logos)", tokens: [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => `peacock-${s}`) },
  { title: "Neutrals · warm, slightly rosy", tokens: ["page", "surface", "surface-sunken", "ink-900", "ink-700", "ink-500", "ink-400", "ink-300", "ink-200", "ink-100"] },
  { title: "Marigold · headline gap, needs attention", tokens: ["marigold-50", "marigold-100", "marigold-300", "marigold-500", "marigold-700"] },
  { title: "Outcomes", tokens: ["picked-50", "picked-500", "picked-700", "lost-50", "lost-500", "lost-700", "seen-50", "seen-500", "seen-700"] },
  { title: "Competitors · in order of wins", tokens: ["comp-teal", "comp-indigo", "comp-marigold", "comp-olive", "comp-sky", "comp-plum", "comp-clay", "comp-other"] },
  { title: "Assistant identity", tokens: ["chatgpt", "claude", "gemini"] },
];

const SEMANTIC = [
  "bg", "surface", "sunken", "ink", "ink-soft", "muted", "subtle", "line", "line-strong", "accent", "accent-strong", "accent-soft", "attention",
  "outcome-picked", "outcome-named-lost", "outcome-seen", "outcome-never-found", "outcome-failed",
];

const TYPE: { name: string; spec: string; cls: string; sample: string }[] = [
  { name: "Display", spec: "type-display · Bricolage 56/60 · 700 · −2%", cls: "type-display", sample: "Radar" },
  { name: "Lens sentence", spec: "type-lens · Bricolage 34/48 · 500, chips 600", cls: "type-lens text-ink-500", sample: "Does AI pick Libas for all queries?" },
  { name: "Stat", spec: "type-stat · Bricolage 48/52 · 700", cls: "type-stat", sample: "64%" },
  { name: "Heading 2", spec: "type-h2 · Bricolage 22/28 · 600", cls: "type-h2", sample: "The AI shopping funnel for Libas" },
  { name: "Heading 3", spec: "type-h3 · Jakarta 17/24 · 600", cls: "type-h3", sample: "It shortlisted" },
  { name: "Body", spec: "type-body · Jakarta 15/24 · 400", cls: "type-body", sample: "We ask ChatGPT, Claude and Gemini what your customers ask." },
  { name: "Body strong", spec: "type-body-strong · Jakarta 15/24 · 600", cls: "type-body-strong", sample: "Picks Libas 5 of 28 times" },
  { name: "Small", spec: "type-small · Jakarta 13/20 · 500", cls: "type-small text-ink-500", sample: "54 of 84 searched answers found Libas" },
  { name: "Label", spec: "type-label · Jakarta 12/16 · 600 · +2%", cls: "type-label text-ink-500", sample: "Biggest lost sale" },
  { name: "Table number", spec: "type-num · Jakarta 15/24 · 600 · tabular", cls: "type-num", sample: "₹1,299 · 19 · 22%" },
];

const RADII = [
  ["rounded-card", "Page card · 28"],
  ["rounded-inner", "Inner card, well · 18"],
  ["rounded-input", "Input · 14"],
  ["rounded-pill", "Pill · buttons, chips, dock"],
  ["rounded-bar", "Chart bar · 8"],
];

const SPACING = [4, 8, 12, 16, 20, 24, 32, 40, 56, 80];

const ELEVATION = [
  ["elevation-flat", "Flat", "1px ink-200 border · inner cards, wells"],
  ["elevation-card", "Card", "0 1 2 / 4% + 0 8 24 / 6% · page cards"],
  ["shadow-raised", "Raised", "0 12 32 / 12% · dock, popovers, hover"],
  ["shadow-overlay", "Overlay", "0 24 64 / 18% · modals, trace drawer"],
];

const OUTCOMES: Outcome[] = ["picked", "mentioned_lost", "found_not_mentioned", "not_found", "failed"];

function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h2 className="type-h2 text-ink-900">{title}</h2>
        {sub && <p className="type-small text-ink-500">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

function Spec({ caption, children, className }: { caption: string; children: ReactNode; className?: string }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className ?? ""}`}>
      <span className="text-[12px] leading-4 font-semibold text-ink-500">{caption}</span>
      {children}
    </div>
  );
}

function Swatch({ token }: { token: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="h-[72px] rounded-inner border border-ink-200" style={{ backgroundColor: `var(--color-${token})` }} />
      <div className="flex flex-col gap-0.5">
        <span className="truncate text-[13px] leading-5 font-semibold text-ink-900">{token}</span>
        <code className="truncate text-[12px] leading-4 text-ink-500">--color-{token}</code>
      </div>
    </div>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="flex flex-col">
      <HeroBand height={320}>
        <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8 px-6">
          <TopBar
            workerStatus="online"
            userInitials="PV"
            actions={<Button variant="secondary" icon={Sparkles}>Live test</Button>}
          />
          <div className="flex flex-col gap-3 pt-6 pb-10">
            <span className="type-label text-brand-600">Lost Sale Radar · Design system</span>
            <h1 className="type-display text-ink-900">Tokens &amp; components</h1>
            <p className="type-body max-w-2xl text-ink-500">
              Living style guide for app/globals.css tokens and components/ui. Brand-coloured parts follow the
              brand ramp; outcomes use fixed meaning colours, always icon + word.
            </p>
          </div>
        </div>
      </HeroBand>

      <main className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-6 pb-40">
        {/* ---------------- Tokens ---------------- */}
        <Section title="Colour" sub="Tailwind: bg-*, text-*, border-* with these names. Brand ramp swaps per brand via <BrandTheme>.">
          <Card className="flex flex-col gap-8">
            {RAMPS.map((r) => (
              <div key={r.title} className="flex flex-col gap-2.5">
                <span className="type-label text-ink-500">{r.title}</span>
                <div className="flex flex-wrap gap-3 sm:flex-nowrap">
                  {r.tokens.map((t) => (
                    <Swatch key={t} token={t} />
                  ))}
                </div>
              </div>
            ))}
            <div className="flex flex-col gap-2.5">
              <span className="type-label text-ink-500">Semantic aliases</span>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                {SEMANTIC.map((t) => (
                  <Swatch key={t} token={t} />
                ))}
              </div>
            </div>
          </Card>
        </Section>

        <Section title="Brand theming" sub="<BrandTheme color={hex}> rebuilds the ramp in OKLCH; null or a colourless hex falls back to Peacock.">
          <Card className="flex flex-wrap gap-6">
            {[
              ["Default (Libas sample)", undefined],
              ["#2B6CB0", "#2B6CB0"],
              ["#7C3AED", "#7C3AED"],
              ["Colourless → Peacock", "#222222"],
            ].map(([label, color]) => (
              <BrandTheme key={label ?? "x"} color={color}>
                <div className="flex flex-col gap-3">
                  <span className="text-[12px] leading-4 font-semibold text-ink-500">{label}</span>
                  <div className="flex gap-1">
                    {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((s) => (
                      <span key={s} className="size-6 rounded-[6px]" style={{ backgroundColor: `var(--color-brand-${s})` }} />
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" icon={Rocket}>Run</Button>
                    <LensChip label="Libas" className="scale-75 origin-left" />
                  </div>
                </div>
              </BrandTheme>
            ))}
          </Card>
        </Section>

        <Section title="Type" sub="Bricolage Grotesque for display, headings and big numbers. Plus Jakarta Sans for everything else.">
          <Card className="flex flex-col p-0">
            {TYPE.map((t) => (
              <div key={t.name} className="flex flex-col gap-2 border-b border-ink-200 px-7 py-5 last:border-b-0 sm:flex-row sm:items-center sm:gap-8">
                <div className="flex w-[260px] shrink-0 flex-col gap-0.5">
                  <span className="text-[13px] leading-5 font-semibold text-ink-900">{t.name}</span>
                  <span className="text-[12px] leading-4 font-medium text-ink-500">{t.spec}</span>
                </div>
                <span className={`${t.cls} min-w-0`}>{t.sample}</span>
              </div>
            ))}
          </Card>
        </Section>

        <div className="grid gap-6 lg:grid-cols-3">
          <Section title="Radius">
            <Card className="flex flex-col gap-4">
              {RADII.map(([cls, label]) => (
                <div key={cls} className="flex items-center gap-4">
                  <span className={`h-10 w-16 shrink-0 border-2 border-brand-300 bg-brand-50 ${cls}`} />
                  <div className="flex flex-col">
                    <span className="text-[13px] leading-5 font-semibold text-ink-900">{label}</span>
                    <code className="text-[12px] text-ink-500">{cls}</code>
                  </div>
                </div>
              ))}
            </Card>
          </Section>
          <Section title="Spacing">
            <Card className="flex flex-col gap-2.5">
              {SPACING.map((s) => (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-8 text-right text-[12px] font-semibold text-ink-500 tabular-nums">{s}</span>
                  <span className="h-3 rounded-[4px] bg-brand-300" style={{ width: s * 2 }} />
                  <code className="text-[12px] text-ink-500">{s / 4}</code>
                </div>
              ))}
              <p className="type-small pt-2 text-ink-500">Card padding 28 (hero 32) · card gap 24 · section gap 40</p>
            </Card>
          </Section>
          <Section title="Elevation">
            <div className="grid grid-cols-2 gap-4">
              {ELEVATION.map(([cls, name, note]) => (
                <div key={name} className={`flex flex-col gap-1 rounded-inner bg-surface p-4 ${cls}`}>
                  <span className="text-[13px] leading-5 font-semibold text-ink-900">{name}</span>
                  <span className="text-[12px] leading-4 text-ink-500">{note}</span>
                  <code className="text-[11px] text-ink-400">{cls}</code>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ---------------- Components ---------------- */}
        <Section title="Buttons" sub="<Button variant size icon loading iconOnly href>">
          <Card className="flex flex-wrap items-end gap-8">
            <Spec caption="Primary"><Button icon={Rocket}>Run AI shoppers</Button></Spec>
            <Spec caption="Secondary"><Button variant="secondary" icon={Download}>Export</Button></Spec>
            <Spec caption="Ghost"><Button variant="ghost" icon={RefreshCw}>Regenerate</Button></Spec>
            <Spec caption="Disabled"><Button icon={Rocket} disabled>Run AI shoppers</Button></Spec>
            <Spec caption="Loading"><Button icon={Rocket} loading>Run AI shoppers</Button></Spec>
            <Spec caption="Large 52"><Button size="lg" icon={Rocket}>Run AI shoppers</Button></Spec>
            <Spec caption="Small 36"><Button size="sm" variant="secondary">View progress</Button></Spec>
            <Spec caption="Ghost danger"><Button variant="danger" icon={CircleStop}>Stop run</Button></Spec>
            <Spec caption="Icon only"><Button variant="secondary" icon={Bell} iconOnly>Notifications</Button></Spec>
            <Spec caption="Link"><Button href="/design-system" variant="ghost">As a link</Button></Spec>
          </Card>
        </Section>

        <Section title="Chips, tags and badges">
          <Card className="flex flex-wrap items-end gap-8">
            <Spec caption="Chip · neutral"><Chip label="₹1,500" icon={IndianRupee} /></Spec>
            <Spec caption="Chip · brand"><Chip label="Best for Libas" tone="brand" /></Spec>
            <Spec caption="Product code"><Chip label="P2" tone="code" /></Spec>
            <Spec caption="Constraint"><Chip label="1 day" icon={Truck} /></Spec>
            <Spec caption="Constraint"><Chip label="Mumbai" icon={MapPin} /></Spec>
            <Spec caption="Outline"><Chip label="Cited" tone="outline" /></Spec>
            <Spec caption="You tag"><YouTag /></Spec>
            <Spec caption="Delta ▲ / ▼ / none / null">
              <div className="flex gap-2">
                <DeltaBadge value={0.04} />
                <DeltaBadge value={-0.02} />
                <DeltaBadge value={0} />
                <DeltaBadge value={null} />
              </div>
            </Spec>
            <Spec caption="Assistant badges">
              <div className="flex items-center gap-2.5">
                <AssistantBadge assistant="openai" />
                <AssistantBadge assistant="anthropic" />
                <AssistantBadge assistant="gemini" />
                <AssistantBadge assistant="gemini" disabled />
                <AssistantBadge assistant="anthropic" showLabel />
              </div>
            </Spec>
          </Card>
        </Section>

        <Section title="Outcomes" sub="Fixed meaning. Always icon + word, never colour alone.">
          <Card className="flex flex-wrap items-end gap-8">
            <Spec caption="Outcome dots 14 px">
              <div className="flex items-center gap-2">
                {OUTCOMES.map((o) => (
                  <OutcomeDot key={o} outcome={o} />
                ))}
              </div>
            </Spec>
            <Spec caption="Outcome pills 26 px">
              <div className="flex flex-wrap items-center gap-2">
                {OUTCOMES.map((o) => (
                  <OutcomePill key={o} outcome={o} />
                ))}
              </div>
            </Spec>
            <Spec caption="On tint">
              <div className="flex gap-2 rounded-inner bg-picked-50 p-3">
                <OutcomePill outcome="picked" onTint />
              </div>
            </Spec>
          </Card>
        </Section>

        <Section title="Form controls">
          <Card className="flex flex-col gap-8">
            <div className="flex flex-wrap items-start gap-8">
              <Spec caption="Input" className="w-80">
                <Input label="Brand name" defaultValue="Libas" helper="Shown across the app and in reports." />
              </Spec>
              <Spec caption="Focus (click in)" className="w-60">
                <Input label="Brand name" defaultValue="Libas" />
              </Spec>
              <Spec caption="Error" className="w-[300px]">
                <Input label="Domains" defaultValue="https://www.libas.in" error="Enter a site like libas.in, without https:// or www." />
              </Spec>
            </div>
            <div className="flex flex-wrap items-start gap-8">
              <Spec caption="Toggle on"><Toggle label="ChatGPT enabled" defaultChecked /></Spec>
              <Spec caption="Toggle off"><Toggle label="Claude enabled" /></Spec>
              <Spec caption="Disabled"><Toggle label="Gemini enabled" disabled /></Spec>
              <Spec caption="Stepper"><Stepper label="Attempts per query" defaultValue={3} min={1} max={10} /></Spec>
              <Spec caption="Segmented control">
                <Segmented
                  label="Assistant"
                  options={[
                    { value: "all", label: "All" },
                    { value: "openai", label: "ChatGPT" },
                    { value: "anthropic", label: "Claude" },
                    { value: "gemini", label: "Gemini" },
                  ]}
                />
              </Spec>
              <Spec caption="Vertical tab · active / idle" className="w-[220px]">
                <VerticalTab label="Brand" icon={Store} active />
                <VerticalTab label="Assistants" icon={KeyRound} />
                <VerticalTab label="Domains" icon={Globe} />
              </Spec>
            </div>
          </Card>
        </Section>

        <Section title="Data display">
          <Card className="flex flex-col gap-8 lg:flex-row">
            <div className="flex gap-8">
              <Spec caption="Stat block">
                <StatBlock label="Found" value={0.64} delta={0.04} caption="54 of 84 searched answers" className="w-[220px]" />
              </Spec>
              <Spec caption="Stat · null">
                <StatBlock label="Picked" value={null} delta={0.02} caption="Not enough answers yet" tone="picked" className="w-40" />
              </Spec>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <span className="text-[12px] leading-4 font-semibold text-ink-500">Bar row · focus and competitor</span>
              <BarRow name="Libas" n={12} share={0.14} isYou />
              <BarRow name="Jaipur Kurti" n={19} share={0.22} color={competitorColor(0)} />
              <BarRow name="Biba" n={9} share={0.11} color={competitorColor(1)} />
              <BarRow name="Unknown" n={null} share={null} color={competitorColor(null)} />
              <span className="pt-4 text-[12px] leading-4 font-semibold text-ink-500">Reason row</span>
              <ReasonRow reason="delivery_unclear_or_slow" n={24} share={0.32} />
              <ReasonRow reason="over_budget" n={14} share={0.19} />
              <ReasonRow reason="found_not_mentioned" n={9} share={0.12} />
              <ReasonRow reason="not_found" n={null} share={null} />
            </div>
          </Card>
        </Section>

        <Section title="Lens and conversation">
          <Card className="flex flex-col gap-8">
            <div className="flex flex-wrap items-end gap-8">
              <Spec caption="Lens chip"><LensChip label="Libas" /></Spec>
              <Spec caption="Lens chip · open"><LensChip label="all queries" open /></Spec>
            </div>
            <p className="type-lens flex flex-wrap items-center gap-x-3 gap-y-2 text-ink-500">
              Does AI pick <LensChip label="Libas" /> for <LensChip label="all queries" />?
            </p>
            <div className="grid gap-8 lg:grid-cols-2">
              <Spec caption="Query bubble">
                <QueryBubble text="Cotton kurta set with dupatta under ₹1,500, delivered in Mumbai in 1 day." />
              </Spec>
              <Spec caption="Search pill">
                <div className="flex flex-wrap gap-2">
                  <SearchPill text="cotton kurta set with dupatta under 1500" />
                  <SearchPill text="libas kurta delivery mumbai" />
                </div>
              </Spec>
            </div>
          </Card>
        </Section>

        <Section title="App shell">
          <div className="flex flex-col items-center gap-8 rounded-card bg-brand-50 p-8">
            <TopBar
              workerStatus="online"
              userInitials="PV"
              actions={<Button variant="secondary" icon={Sparkles}>Live test</Button>}
            />
            <TopBar workerStatus="offline" userInitials="AB" />
            <Dock active="radar" />
            <Dock active="runs" />
          </div>
        </Section>

        <Section title="Lists and rows">
          <Card className="flex flex-col gap-8 lg:flex-row">
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <Spec caption="Source row">
                <SourceRow domain="myntra.com" title="Biba printed cotton kurta set with dupatta" sourceType="marketplace" brand="Biba" cited url="https://www.myntra.com" />
                <SourceRow domain="myntra.com" title="Libas cotton kurta set with dupatta" sourceType="marketplace" brand="Libas" cited={false} isFocusBrand url="https://www.myntra.com" />
                <SourceRow domain="libas.in" title={null} sourceType="brand_site" brand={null} cited={false} />
              </Spec>
              <Spec caption="Progress bar">
                <ProgressBar assistant="openai" value={18} max={30} />
                <ProgressBar assistant="anthropic" value={30} max={30} />
                <ProgressBar assistant="gemini" value={null} max={30} />
              </Spec>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-6">
              <Spec caption="Fix card">
                <FixCard
                  ord={1}
                  fixType="listing"
                  title="Show Mumbai delivery dates on product pages"
                  why="24 of 75 losses were 'delivery unclear'."
                  action="Put 'Delivered by tomorrow' for Mumbai pincodes in the page itself, not only after a pincode check."
                />
              </Spec>
            </div>
          </Card>
          <Card className="flex flex-col gap-2">
            <span className="text-[12px] leading-4 font-semibold text-ink-500">Run row · running / done / partial / failed / queued</span>
            <RunRow title="Full run · 22 Nov, 3:15 PM" meta="Started by Prathm" trigger="manual" status="processing" total={90} done={46} failed={0} assistants={["openai", "anthropic", "gemini"]} city="Mumbai" costUsd={2.1} href="/design-system" />
            <RunRow title="Live test · 22 Nov, 3:02 PM" meta="Started by Prathm" trigger="live" status="done" total={1} done={1} failed={0} assistants={["openai"]} city="Mumbai" costUsd={0.05} />
            <RunRow title="Full run · 21 Nov, 6:40 PM" meta="Started by Prathm" trigger="manual" status="partial" total={90} done={87} failed={3} assistants={["openai", "anthropic", "gemini"]} city="Mumbai" costUsd={4.2} />
            <RunRow title="Full run · 20 Nov, 1:10 PM" meta={null} trigger="manual" status="failed" total={90} done={0} failed={90} assistants={["gemini"]} city={null} costUsd={null} />
            <RunRow title="Full run · queued" meta="Started by Prathm" trigger="manual" status="queued" total={90} done={0} failed={0} assistants={["openai", "anthropic"]} city="Delhi" costUsd={null} />
          </Card>
        </Section>

        <Section title="Feedback">
          <Card className="flex flex-col gap-6">
            <Spec caption="Banner · attention / error / neutral">
              <Banner tone="attention" action={<Button size="sm" variant="secondary">View progress</Button>}>
                This run is 46 of 90 answers in. Numbers update as answers arrive.
              </Banner>
              <div className="grid gap-4 lg:grid-cols-2">
                <Banner tone="error" action={<Button size="sm" variant="ghost" icon={RotateCcw}>Retry</Button>}>
                  Couldn&apos;t load this. Try again.
                </Banner>
                <Banner tone="neutral">3 of 90 answers failed. Numbers use the 87 that finished.</Banner>
              </div>
            </Spec>
            <div className="flex flex-wrap items-start gap-8">
              <Spec caption="Toast · success / error / info">
                <Toast title="Run finished" body="87 of 90 answers are in. See what changed." />
                <Toast tone="error" title="Run failed" body="All Gemini answers failed. Check the key." />
                <Toast tone="info" title="Fixes are being written" />
              </Spec>
              <Spec caption="Tooltip (bubble · hover the button)">
                <TooltipBubble>Not enough answers yet</TooltipBubble>
                <div className="pt-12">
                  <Tooltip content="Not enough answers yet">
                    <Button variant="secondary" size="sm">Hover me</Button>
                  </Tooltip>
                </div>
              </Spec>
              <Spec caption="Skeleton" className="min-w-[280px] flex-1">
                <SkeletonCard />
              </Spec>
            </div>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <EmptyState
              title="No AI shoppers sent yet"
              body="Send ChatGPT, Claude and Gemini to shop your 10 questions."
              action={<Button icon={Rocket}>Run AI shoppers</Button>}
            />
            <EmptyState
              illustration={false}
              title="No answers match this lens"
              body="Try a wider lens, or reset it to see every answer."
              action={<Button variant="ghost" icon={RotateCcw}>Reset lens</Button>}
            />
          </div>
        </Section>
      </main>

      <Dock active="radar" floating />
    </div>
  );
}
