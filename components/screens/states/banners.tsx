import { CircleAlert, Info, PlugZap, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RunListItem } from '@/lib/api-types';
import { Banner, Button, ICON_STROKE, cn } from '@/components/ui';

// Frame 70 "Page banners". Server-safe; pass handlers from a client parent.

export interface WorkerOfflineBannerProps {
  /** Health.lastKickAt: when the worker last checked in (null = never). */
  lastKickAt?: string | null;
  /** Shows "Wake it up". */
  onWake?: () => void;
  waking?: boolean;
  onDismiss?: () => void;
  className?: string;
}

function minutesSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(1, Math.round((Date.now() - t) / 60_000));
}

/** Background processor unreachable (GET /api/health → processorReachable: false). */
export function WorkerOfflineBanner({ lastKickAt, onWake, waking, onDismiss, className }: WorkerOfflineBannerProps) {
  const mins = minutesSince(lastKickAt);
  const since =
    mins === null ? "hasn't checked in yet" : mins < 120 ? `hasn't checked in for ${mins} minute${mins === 1 ? '' : 's'}` : "hasn't checked in for a while";
  return (
    <Banner
      tone="attention"
      icon={PlugZap}
      spin={false}
      className={cn('border-marigold-300!', className)}
      onDismiss={onDismiss}
      action={
        onWake && (
          <Button variant="secondary" size="sm" icon={Zap} loading={waking} onClick={onWake}>
            Wake it up
          </Button>
        )
      }
    >
      The background worker {since}. New runs will wait.
    </Banner>
  );
}

type RunLike = Pick<RunListItem, 'id' | 'status' | 'total' | 'done' | 'failed'>;

export interface RunBannerProps {
  run: RunLike;
  /** Link for "View progress" (default /runs/{id}); null hides it. */
  progressHref?: string | null;
  onDismiss?: () => void;
  className?: string;
}

/** A run still collecting answers: numbers on the page are provisional. */
export function RunInProgressBanner({ run, progressHref, onDismiss, className }: RunBannerProps) {
  const href = progressHref === undefined ? `/runs/${encodeURIComponent(run.id)}` : progressHref;
  return (
    <Banner
      tone="attention"
      className={className}
      onDismiss={onDismiss}
      action={href && <Button href={href} variant="secondary" size="sm">View progress</Button>}
    >
      This run is {run.done} of {run.total} answers in. Numbers update as answers arrive.
    </Banner>
  );
}

/** A finished run where some answers failed: numbers use the ones that finished. */
export function PartialRunBanner({ run, progressHref, onDismiss, className }: RunBannerProps) {
  const href = progressHref === undefined ? `/runs/${encodeURIComponent(run.id)}` : progressHref;
  return (
    <Banner
      tone="neutral"
      icon={Info}
      className={className}
      onDismiss={onDismiss}
      action={href && <Button href={href} variant="secondary" size="sm">View progress</Button>}
    >
      {run.failed} of {run.total} answers failed. Numbers use the {run.done} that finished.
    </Banner>
  );
}

/** Picks the right banner for a run: in progress, partial, or nothing. */
export function RunStateBanner(props: RunBannerProps) {
  const { status, failed } = props.run;
  if (status === 'queued' || status === 'processing') return <RunInProgressBanner {...props} />;
  if (status === 'partial' || (status === 'done' && failed > 0)) return <PartialRunBanner {...props} />;
  return null;
}

/** Frame 70 "Sign in error card" banner: lost-50, 14 px semibold. */
export function SignInError({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="alert" className={cn('flex items-center gap-2.5 rounded-inner bg-lost-50 px-3.5 py-3 text-[14px] leading-[18px] font-semibold text-lost-700', className)}>
      <CircleAlert aria-hidden size={18} strokeWidth={ICON_STROKE} className="shrink-0" />
      <span className="min-w-0">{children}</span>
    </div>
  );
}
