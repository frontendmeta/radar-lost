'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { Check, IndianRupee, MapPin, Truck, type LucideIcon } from 'lucide-react';
import type { Query, QueryRow, RunTask, Win } from '@/lib/api-types';
import { BrandLogo, ICON_STROKE, OutcomeDot, YouTag, cn, competitorColor, formatInr, type Outcome } from '../ui';

// ---------------------------------------------------------------- outcomes from counts

type PerAssistant = QueryRow['perAssistant'][number];

/**
 * One dot per done attempt, best outcome first. The API gives counts only
 * (found / mentioned / picked of attempts), so the attempt order is not known.
 */
export function outcomeDots(pa: PerAssistant): Outcome[] {
  const picked = Math.max(0, pa.picked);
  const namedLost = Math.max(0, pa.mentioned - pa.picked);
  const rest = Math.max(0, pa.attempts - picked - namedLost);
  const seen = Math.min(rest, Math.max(0, pa.found - pa.mentioned));
  const never = rest - seen;
  return [
    ...Array<Outcome>(picked).fill('picked'),
    ...Array<Outcome>(namedLost).fill('mentioned_lost'),
    ...Array<Outcome>(seen).fill('found_not_mentioned'),
    ...Array<Outcome>(never).fill('not_found'),
  ];
}

/**
 * Dots from the run's real tasks, in attempt order, failed ones included.
 * The analysis counts stay the source of truth: if the done tasks don't add up
 * to the row's attempts, fall back to the count-built dots (plus any failures).
 */
export function taskDots(pa: PerAssistant | undefined, tasks: RunTask[] | undefined): Outcome[] {
  const sorted = [...(tasks ?? [])].sort((a, b) => a.attempt - b.attempt);
  const done = sorted.filter((t) => t.status === 'done');
  const failed = sorted.filter((t) => t.status === 'failed' || t.status === 'cancelled');
  if (sorted.length && done.length === (pa?.attempts ?? 0)) {
    return sorted.flatMap<Outcome>((t) =>
      t.status === 'done' ? [t.focusOutcome ?? 'not_found'] : t.status === 'failed' || t.status === 'cancelled' ? ['failed'] : [],
    );
  }
  return [...(pa ? outcomeDots(pa) : []), ...failed.map<Outcome>(() => 'failed')];
}

export function AttemptDots({ pa, tasks, className }: { pa: PerAssistant | undefined; tasks?: RunTask[]; className?: string }) {
  const dots = taskDots(pa, tasks);
  if (!dots.length) return <span className={cn('type-small text-ink-400', className)}>—</span>;
  return (
    <span className={cn('flex flex-wrap items-center gap-1', className)}>
      {dots.map((o, i) => (
        <OutcomeDot key={i} outcome={o} />
      ))}
    </span>
  );
}

// ---------------------------------------------------------------- winners

/**
 * The query's usual winner: the most common per-assistant top winner.
 * The focus brand only "usually wins" when it leads outright; other ties go to
 * the brand with more picks overall in this lens (wins order).
 */
export function usualWinner(row: QueryRow, wins: Win[] | undefined): string | null {
  const tally = new Map<string, { name: string; n: number }>();
  for (const pa of row.perAssistant) {
    if (!pa.topWinner) continue;
    const k = pa.topWinner.toLowerCase();
    const t = tally.get(k) ?? { name: pa.topWinner, n: 0 };
    t.n += 1;
    tally.set(k, t);
  }
  if (!tally.size) return null;
  const rank = (name: string) => {
    const i = wins?.findIndex((w) => w.brandName.toLowerCase() === name.toLowerCase()) ?? -1;
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const focus = wins?.find((w) => w.isFocus)?.brandName.toLowerCase();
  const isFocus = (name: string) => (name.toLowerCase() === focus ? 1 : 0);
  return [...tally.values()].sort((a, b) => b.n - a.n || isFocus(a.name) - isFocus(b.name) || rank(a.name) - rank(b.name))[0].name;
}

export interface WinnerStyle {
  color: string;
  isFocus: boolean;
  isPrimary: boolean;
}

/** Same colouring as the Radar's "Who AI picked instead" card, so a brand keeps its colour across screens. */
export function winnerStyles(wins: Win[] | undefined): (name: string) => WinnerStyle {
  const map = new Map<string, WinnerStyle>();
  let rank = 0;
  for (const w of wins ?? []) {
    const color = w.isFocus
      ? 'var(--color-brand-500)'
      : w.isPrimary
        ? 'var(--color-brand-300)'
        : w.brandId === null
          ? 'var(--color-comp-other)'
          : competitorColor(rank++);
    map.set(w.brandName.toLowerCase(), { color, isFocus: w.isFocus, isPrimary: w.isPrimary });
  }
  return (name) => map.get(name.toLowerCase()) ?? { color: 'var(--color-comp-other)', isFocus: false, isPrimary: false };
}

/** Winner chip: small pill with the brand's dot. The focus brand gets the brand tint; your brand gets "You". */
export function WinnerChip({ name, style }: { name: string | null | undefined; style: (name: string) => WinnerStyle }) {
  if (!name) return <span className="type-small text-ink-400">—</span>;
  const s = style(name);
  return (
    <span
      className={cn(
        'inline-flex h-6 max-w-full min-w-0 items-center gap-1.5 rounded-pill border pr-2.5 pl-0.5',
        s.isFocus ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-surface',
      )}
    >
      <BrandLogo name={name} size={18} color={s.color} decorative className="rounded-full!" />
      <span className="truncate text-[12px] leading-4 font-semibold text-ink-900">{name}</span>
      {s.isPrimary && <YouTag className="h-4! px-1! text-[10px]!" />}
    </span>
  );
}

// ---------------------------------------------------------------- chips

/** Pencil: Chip (ObqUG) in its compact 24 px row size, or the 28 px drawer size. */
export function MiniChip({ label, icon: Icon, code, size = 'sm', title }: { label: string; icon?: LucideIcon; code?: boolean; size?: 'sm' | 'md'; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex shrink-0 items-center rounded-pill font-semibold whitespace-nowrap',
        size === 'sm' ? 'h-6 gap-1 px-[9px] text-[12px] leading-4' : 'h-7 gap-1.5 px-3 text-[13px] leading-5',
        code ? 'border border-ink-200 bg-surface-sunken text-ink-700' : 'bg-ink-100 text-ink-700',
      )}
    >
      {Icon && <Icon aria-hidden size={size === 'sm' ? 14 : 16} strokeWidth={ICON_STROKE} className="shrink-0" />}
      {label}
    </span>
  );
}

/** Budget, deadline and city chips for a query. */
export function QueryChips({ query, size = 'sm' }: { query: Query | undefined; size?: 'sm' | 'md' }) {
  if (!query) return null;
  return (
    <>
      {query.budgetInr ? <MiniChip size={size} icon={IndianRupee} label={formatInr(query.budgetInr)} title="Budget" /> : null}
      {query.deadlineDays ? (
        <MiniChip size={size} icon={Truck} label={`${query.deadlineDays} ${query.deadlineDays === 1 ? 'day' : 'days'}`} title="Delivery deadline" />
      ) : null}
      {query.city ? <MiniChip size={size} icon={MapPin} label={query.city} title="Delivery city" /> : null}
    </>
  );
}

// ---------------------------------------------------------------- filter pills

export function Popover({
  open, onClose, children, className, role = 'listbox', label,
}: { open: boolean; onClose: () => void; children: ReactNode; className?: string; role?: 'listbox' | 'dialog'; label?: string }) {
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
      role={role}
      aria-label={label}
      className={cn(
        'absolute top-[52px] left-0 z-30 flex max-h-[420px] w-[320px] animate-pop-in flex-col gap-0.5 overflow-y-auto rounded-inner border border-card-line bg-surface p-2 shadow-overlay',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function MenuOption({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={cn(
        'flex w-full cursor-pointer items-start gap-3 rounded-input px-3 py-2.5 text-left transition-colors hover:bg-surface-sunken',
        selected && 'bg-brand-50 hover:bg-brand-50',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-brand-500 bg-brand-500 text-on-brand' : 'border-ink-300 bg-surface text-transparent',
        )}
      >
        <Check size={14} strokeWidth={2.5} />
      </span>
      <span className="min-w-0 flex-1 type-small text-ink-900">{children}</span>
    </button>
  );
}
