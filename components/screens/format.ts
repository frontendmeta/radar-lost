// Screen-level formatting helpers (dates in IST, run titles). Numbers use '@/components/ui' formatters.

import type { RunListItem, RunState } from '@/lib/api-types';

const TZ = 'Asia/Kolkata';

/** "22 Nov" or "22 Nov, 3:15 PM" (IST). */
export function runDateLabel(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: TZ });
  if (!withTime) return date;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: TZ });
  return `${date}, ${time}`;
}

/** "3 min ago", "2 h ago", else the date. */
export function relativeTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '—';
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return runDateLabel(iso, true);
}

export const RUN_STATE_LABEL: Record<RunState, string> = {
  queued: 'Queued',
  processing: 'Running',
  done: 'Done',
  partial: 'Partial',
  failed: 'Failed',
  cancelled: 'Stopped',
};

/** "Full run · 22 Nov, 3:15 PM · 87 of 90 answers" */
export function runSubtitle(r: Pick<RunListItem, 'label' | 'trigger' | 'createdAt' | 'done' | 'total'>): string {
  const name = r.label ?? (r.trigger === 'live' ? 'Live test' : 'Full run');
  return `${name} · ${runDateLabel(r.createdAt, true)} · ${r.done} of ${r.total} answers`;
}

export const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
