'use client';

import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { Archive, CircleAlert, X, type LucideIcon } from 'lucide-react';
import { ApiError, isApiError } from '@/lib/client/api';
import { Button, ICON_STROKE, Toast, cn } from '@/components/ui';

// ---------- errors ----------

/** Fallback copy for the Settings validation codes, used when the server sends no message. */
const CODE_COPY: Record<string, string> = {
  alias_too_short: 'Use at least 4 letters for an alias.',
  alias_conflict: 'That alias already belongs to another brand.',
  bad_domain: 'Use a bare domain like libas.in (no https://, path or www.).',
  domain_conflict: 'That domain already belongs to another brand or marketplace.',
  brand_needs_alias: 'Add at least one alias.',
  primary_locked: "Your own brand can't be archived.",
  product_in_use: 'Active queries use this product. Archive or move them first.',
  bad_query: 'Text 10–500 characters, budget ₹100–₹1,00,000, deadline 0–14 days, and an active product.',
  key_missing: "This assistant isn't connected right now, so it can't be turned on.",
  bad_attempts: 'Attempts must be between 1 and 5.',
  key_invalid: 'The provider rejected this key. Check it and try again.',
  bad_key: 'The key looks malformed (20–400 characters, no spaces).',
  code_conflict: 'Another active product already uses this code.',
};

/** Codes whose server message is outdated or too technical for the form. */
const OVERRIDE = new Set(['key_missing']);

export interface FormError {
  field?: string;
  code?: string;
  message: string;
}

export function toFormError(e: unknown): FormError {
  if (isApiError(e)) {
    const message = OVERRIDE.has(e.code) ? CODE_COPY[e.code] : e.message || CODE_COPY[e.code] || 'Something went wrong';
    return { field: e.field, code: e.code, message };
  }
  return { message: e instanceof Error ? e.message : 'Something went wrong' };
}

/** Error text for one field (when the server named it), else undefined. */
export function fieldError(err: FormError | null, ...fields: string[]): string | undefined {
  return err && err.field && fields.includes(err.field) ? err.message : undefined;
}

/** Error text not tied to a known field. */
export function generalError(err: FormError | null, known: string[]): string | undefined {
  return err && (!err.field || !known.includes(err.field)) ? err.message : undefined;
}

export function InlineError({ children }: { children?: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-input bg-lost-50 px-3 py-2 type-small text-lost-700">
      <CircleAlert aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0" />
      {children}
    </p>
  );
}

/** Helper / error line under a field, with the alert icon when it's an error (Brand frame). */
export function FieldHint({ error, helper }: { error?: string; helper?: ReactNode }) {
  if (!error && !helper) return null;
  return (
    <p role={error ? 'alert' : undefined} className={cn('flex items-start gap-1.5 text-[13px] leading-5', error ? 'text-lost-700' : 'text-ink-500')}>
      {error && <CircleAlert aria-hidden size={14} strokeWidth={ICON_STROKE} className="mt-[3px] shrink-0" />}
      <span>{error || helper}</span>
    </p>
  );
}

export { ApiError };

// ---------- tag input (aliases, domains, sizes) ----------

export function TagInput({
  label, values, onChange, placeholder = 'Add and press Enter', helper, error, lowercase = false, invalid,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  helper?: ReactNode;
  error?: string;
  lowercase?: boolean;
  /** Marks a chip in lost colours (e.g. an alias that's too short). */
  invalid?: (v: string) => boolean;
}) {
  const [draft, setDraft] = useState('');
  const commit = () => {
    const v = (lowercase ? draft.toLowerCase() : draft).trim();
    if (v && !values.some((x) => x.toLowerCase() === v.toLowerCase())) onChange([...values, v]);
    setDraft('');
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1));
    }
  };
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <span className="text-[13px] leading-5 font-semibold text-ink-900">{label}</span>
      <div
        className={cn(
          'flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-input border px-2.5 py-[8px] transition-colors',
          error ? 'border-lost-500 bg-surface-sunken' : 'border-transparent bg-surface-sunken focus-within:border-brand-300',
        )}
      >
        {values.map((v) => {
          const bad = invalid?.(v) ?? false;
          return (
            <span
              key={v}
              className={cn(
                'inline-flex h-[30px] items-center gap-1 rounded-pill pr-1.5 pl-3 text-[13px] font-semibold',
                bad ? 'bg-lost-50 text-lost-700' : 'bg-surface text-ink-900',
              )}
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="flex size-5 cursor-pointer items-center justify-center rounded-full text-ink-500 hover:bg-ink-100 hover:text-ink-900"
              >
                <X aria-hidden size={14} strokeWidth={ICON_STROKE} />
              </button>
            </span>
          );
        })}
        <input
          aria-label={label}
          aria-invalid={error ? true : undefined}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          onBlur={commit}
          placeholder={placeholder}
          className="h-[30px] min-w-[140px] flex-1 bg-transparent px-1.5 text-[14px] text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>
      <FieldHint error={error} helper={helper} />
    </div>
  );
}

// ---------- panel chrome ----------

export function PanelHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 px-2 pb-2">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="type-h2 text-ink-900">{title}</h2>
        {sub && <p className="type-small text-ink-500">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

/** "Unsaved changes · Discard · Save" bar from the Brand frame. */
export function SaveBar({ dirty, saving, onDiscard, onSave }: { dirty: boolean; saving: boolean; onDiscard: () => void; onSave: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-5">
      <span className="flex items-center gap-3 type-body text-ink-900">
        <span aria-hidden className={cn('size-2 rounded-full', dirty ? 'bg-marigold-500' : 'bg-picked-500')} />
        {dirty ? 'Unsaved changes' : 'All changes saved'}
      </span>
      <div className="flex items-center gap-3">
        <Button variant="secondary" disabled={!dirty || saving} onClick={onDiscard}>Discard</Button>
        <Button disabled={!dirty} loading={saving} onClick={onSave}>Save</Button>
      </div>
    </div>
  );
}

/** Two-step destructive action: first click asks, second click does it. */
export function ConfirmButton({
  onConfirm, label = 'Archive', icon = Archive, iconOnly = false, subject,
}: { onConfirm: () => Promise<void> | void; label?: string; icon?: LucideIcon; iconOnly?: boolean; subject?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!confirming) {
    return (
      <Button
        variant="ghost"
        size="sm"
        icon={icon}
        iconOnly={iconOnly}
        className="text-ink-700! hover:bg-ink-100! [&>svg]:text-ink-500"
        onClick={() => setConfirming(true)}
      >
        {iconOnly && subject ? `${label} ${subject}` : label}
      </Button>
    );
  }
  return (
    <span className="flex shrink-0 items-center gap-1">
      <Button
        variant="danger"
        size="sm"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
          } finally {
            setBusy(false);
            setConfirming(false);
          }
        }}
      >
        Confirm {label.toLowerCase()}
      </Button>
      <Button variant="ghost" size="sm" className="text-ink-500! hover:bg-ink-100!" disabled={busy} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}

/** Kept for the panels that still import it. */
export function ArchiveButton({ onArchive, label = 'Archive', iconOnly, subject }: { onArchive: () => Promise<void> | void; label?: string; iconOnly?: boolean; subject?: string }) {
  return <ConfirmButton onConfirm={onArchive} label={label} iconOnly={iconOnly} subject={subject} />;
}

/** A select styled like the design's Input. */
export function SelectField({
  label, value, onChange, options, error,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string }) {
  return (
    <label className="flex w-full flex-col gap-2">
      <span className="text-[13px] leading-5 font-semibold text-ink-900">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn('h-12 w-full rounded-input border bg-surface-sunken px-3 text-[15px] text-ink-900 outline-none focus:border-brand-300 focus:bg-surface', error ? 'border-lost-500' : 'border-transparent')}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <FieldHint error={error} />
    </label>
  );
}

export function TextArea({
  label, value, onChange, error, helper, rows = 3,
}: { label: string; value: string; onChange: (v: string) => void; error?: string; helper?: ReactNode; rows?: number }) {
  return (
    <label className="flex w-full flex-col gap-2">
      <span className="text-[13px] leading-5 font-semibold text-ink-900">{label}</span>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn('w-full resize-y rounded-input border bg-surface-sunken px-4 py-3 text-[15px] leading-6 text-ink-900 outline-none focus:border-brand-300 focus:bg-surface', error ? 'border-lost-500' : 'border-transparent')}
      />
      <FieldHint error={error} helper={helper} />
    </label>
  );
}

/** Editing well that replaces a row. */
export const FORM_WELL = 'flex flex-col gap-5 rounded-inner border border-brand-200 bg-brand-50/40 p-5';

// ---------- toast ----------

export type ToastTone = 'success' | 'error' | 'info';
export type ToastMsg = { title: string; body?: string; tone?: ToastTone } | null;

export function useToast() {
  const [toast, setToast] = useState<ToastMsg>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (t: NonNullable<ToastMsg>) => {
    if (timer.current) clearTimeout(timer.current);
    setToast(t);
    timer.current = setTimeout(() => setToast(null), 3200);
  };
  const node = toast ? (
    <div className="fixed right-6 bottom-28 z-50" aria-live="polite">
      <Toast title={toast.title} body={toast.body} tone={toast.tone ?? 'success'} />
    </div>
  ) : null;
  return { show, node };
}

/** Parse a number input; '' → null. */
export const num = (s: string): number | null => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s));
export const str = (n: number | null | undefined): string => (n == null ? '' : String(n));

export function sameList(a: string[], b: string[]) {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}
