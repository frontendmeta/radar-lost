'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Check, GitCompareArrows } from 'lucide-react';
import type { Assistant, LensOptions, Summary } from '@/lib/api-types';
import type { Lens } from '@/lib/client/api';
import { ASSISTANT_LABEL, AssistantBadge, ICON_STROKE, LensChip, cn } from '../ui';
import { runDateLabel } from '../format';

const ALL: Assistant[] = ['openai', 'anthropic', 'gemini'];

function Popover({ open, onClose, children, className }: { open: boolean; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role="listbox"
      className={cn('absolute top-[60px] left-0 z-30 flex max-h-[420px] w-[340px] animate-pop-in flex-col gap-0.5 overflow-y-auto rounded-inner border border-card-line bg-surface p-2 shadow-overlay', className)}
    >
      {children}
    </div>
  );
}

function Option({ selected, onClick, children, multi }: { selected: boolean; onClick: () => void; children: ReactNode; multi?: boolean }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn('flex w-full cursor-pointer items-start gap-3 rounded-input px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken', selected && 'bg-brand-50 hover:bg-brand-50')}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center border',
          multi ? 'rounded-[6px]' : 'rounded-full',
          selected ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-ink-300 bg-surface text-transparent',
        )}
      >
        <Check size={14} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1 type-small text-ink-900">{children}</span>
    </button>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="px-3 pt-2 pb-1 type-label text-ink-400 uppercase">{children}</p>;
}

type Which = 'focus' | 'queries' | 'assistants' | 'run' | null;

export function LensSentence({
  lens, setLens, options, summary,
}: { lens: Lens; setLens: (p: Partial<Lens>) => void; options: LensOptions | undefined; summary: Summary | undefined }) {
  const [open, setOpen] = useState<Which>(null);
  const close = () => setOpen(null);
  const toggle = (w: Which) => setOpen((o) => (o === w ? null : w));

  const brands = options?.brands ?? [];
  const focusBrand = brands.find((b) => b.id === lens.focus) ?? brands.find((b) => b.isPrimary);
  const focusName = summary?.focus.name ?? focusBrand?.name ?? 'your brand';

  const assistants = lens.assistants?.length ? lens.assistants : ALL;
  const assistantsLabel =
    assistants.length === ALL.length ? 'all assistants' : assistants.map((a) => ASSISTANT_LABEL[a]).join(' + ');

  const prodSel = lens.products ?? [];
  const qSel = lens.queries ?? [];
  const queriesLabel =
    !prodSel.length && !qSel.length
      ? 'all queries'
      : qSel.length === 1
        ? options?.queries.find((q) => q.id === qSel[0])?.code ?? '1 query'
        : qSel.length
          ? `${qSel.length} queries`
          : prodSel.length === 1
            ? options?.products.find((p) => p.id === prodSel[0])?.code
              ? `${options?.products.find((p) => p.id === prodSel[0])?.code} queries`
              : '1 product'
            : `${prodSel.length} products`;

  const runs = options?.runs ?? [];
  const selectedRun = lens.run ? runs.find((r) => r.id === lens.run) : undefined;
  const runLabel = !lens.run || lens.run === 'latest' ? 'the latest run' : selectedRun ? `the ${runDateLabel(selectedRun.createdAt)} run` : 'that run';

  const toggleIn = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const cmp = summary?.compare;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 type-lens text-ink-700">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span>Does AI pick</span>
        <span className="relative">
          <LensChip label={focusName} open={open === 'focus'} onClick={() => toggle('focus')} />
          <Popover open={open === 'focus'} onClose={close}>
            <GroupLabel>Brand in focus</GroupLabel>
            {brands.map((b) => (
              <Option key={b.id} selected={b.id === focusBrand?.id} onClick={() => { setLens({ focus: b.isPrimary ? undefined : b.id }); close(); }}>
                <span className="font-semibold">{b.name}</span>
                {b.isPrimary && <span className="text-ink-400"> · your brand</span>}
              </Option>
            ))}
          </Popover>
        </span>
        <span>for</span>
        <span className="relative">
          <LensChip label={queriesLabel} open={open === 'queries'} onClick={() => toggle('queries')} />
          <Popover open={open === 'queries'} onClose={close} className="w-[440px]">
            <Option selected={!prodSel.length && !qSel.length} onClick={() => { setLens({ products: undefined, queries: undefined }); close(); }}>
              <span className="font-semibold">All queries</span>
            </Option>
            <GroupLabel>By product</GroupLabel>
            {(options?.products ?? []).map((p) => (
              <Option key={p.id} multi selected={prodSel.includes(p.id)} onClick={() => setLens({ products: toggleIn(prodSel, p.id) })}>
                <span className="font-semibold">{p.code}</span> · {p.name}
              </Option>
            ))}
            <GroupLabel>By query</GroupLabel>
            {(options?.queries ?? []).map((q) => (
              <Option key={q.id} multi selected={qSel.includes(q.id)} onClick={() => setLens({ queries: toggleIn(qSel, q.id) })}>
                <span className="font-semibold">{q.code}</span> · <span className="text-ink-700">{q.text}</span>
              </Option>
            ))}
          </Popover>
        </span>
        <span>on</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="relative">
          <LensChip label={assistantsLabel} open={open === 'assistants'} onClick={() => toggle('assistants')} />
          <Popover open={open === 'assistants'} onClose={close} className="w-[280px]">
            <GroupLabel>Assistants</GroupLabel>
            {ALL.map((a) => (
              <Option
                key={a}
                multi
                selected={assistants.includes(a)}
                onClick={() => {
                  const next = toggleIn(assistants, a);
                  setLens({ assistants: next.length ? next : ALL });
                }}
              >
                <span className="inline-flex items-center gap-2 font-semibold">
                  <AssistantBadge assistant={a} className="size-6" /> {ASSISTANT_LABEL[a]}
                </span>
              </Option>
            ))}
          </Popover>
        </span>
        <span>in</span>
        <span className="relative">
          <LensChip label={runLabel} open={open === 'run'} onClick={() => toggle('run')} />
          <Popover open={open === 'run'} onClose={close} className="right-0 left-auto w-[360px]">
            <Option selected={!lens.run} onClick={() => { setLens({ run: undefined }); close(); }}>
              <span className="font-semibold">The latest run</span>
            </Option>
            <GroupLabel>Runs</GroupLabel>
            {runs.map((r) => (
              <Option key={r.id} selected={lens.run === r.id} onClick={() => { setLens({ run: r.id }); close(); }}>
                <span className="font-semibold">{r.label ?? 'Run'} · {runDateLabel(r.createdAt, true)}</span>
                <span className="block text-ink-500">{r.done} of {r.total} answers · {r.status}</span>
              </Option>
            ))}
          </Popover>
        </span>
        <span>?</span>
      </div>
      </div>
      {cmp && (
        <p className="flex items-center gap-2 type-small text-ink-500">
          <GitCompareArrows aria-hidden size={16} strokeWidth={ICON_STROKE} />
          Compared with the {cmp.label ? `${cmp.label.toLowerCase()} ` : ''}run
          {options?.runs.find((r) => r.id === cmp.runId) ? ` of ${runDateLabel(options.runs.find((r) => r.id === cmp.runId)!.createdAt)}` : ''} on {cmp.sharedPairs} shared query × assistant pairs
          <button type="button" onClick={() => setLens({ compare: 'none' })} className="cursor-pointer text-ink-400 underline-offset-2 hover:text-ink-700 hover:underline">
            hide
          </button>
        </p>
      )}
      {lens.compare === 'none' && (
        <button type="button" onClick={() => setLens({ compare: undefined })} className="flex w-fit cursor-pointer items-center gap-2 type-small text-ink-500 hover:text-ink-900">
          <GitCompareArrows aria-hidden size={16} strokeWidth={ICON_STROKE} /> Compare with the previous run
        </button>
      )}
    </div>
  );
}
