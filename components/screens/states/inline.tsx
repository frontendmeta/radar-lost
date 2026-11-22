import { CircleAlert, Rocket, RotateCcw, SearchX, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Banner, Button, EmptyState, ICON_STROKE, Tooltip, cn } from '@/components/ui';

// Frame 70 "Inside cards" + "Validation messages". Server-safe; handlers come from client parents.

export interface InlineErrorProps {
  /** Default: "Couldn't load this. Try again." */
  message?: ReactNode;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

/** A card section that failed to load (frame 70 "Error card"). Sits under the card title. */
export function InlineError({ message = "Couldn't load this. Try again.", onRetry, retrying, className }: InlineErrorProps) {
  return (
    <Banner
      tone="error"
      className={className}
      action={
        onRetry && (
          <Button variant="ghost" size="sm" icon={RotateCcw} loading={retrying} onClick={onRetry}>
            Retry
          </Button>
        )
      }
    >
      {message}
    </Banner>
  );
}

export interface FilterEmptyProps {
  /** Default: "No answers match this lens". */
  title?: string;
  body?: ReactNode;
  icon?: LucideIcon;
  /** Default: "Reset lens". */
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

/** Nothing matches the current filters (frame 70 "Empty filter card"). Centre it inside a card. */
export function FilterEmpty({
  title = 'No answers match this lens',
  body,
  icon: Icon = SearchX,
  actionLabel = 'Reset lens',
  onAction,
  actionHref,
  className,
}: FilterEmptyProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-4 py-2 text-center', className)}>
      <span aria-hidden className="flex size-12 items-center justify-center rounded-pill bg-surface-sunken">
        <Icon size={22} strokeWidth={ICON_STROKE} className="text-ink-500" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="type-h3 text-ink-900">{title}</p>
        {body && <p className="type-small max-w-sm text-ink-500">{body}</p>}
      </div>
      {actionHref ? (
        <Button href={actionHref} variant="ghost" icon={RotateCcw}>
          {actionLabel}
        </Button>
      ) : onAction ? (
        <Button variant="ghost" icon={RotateCcw} onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}

export interface NullValueProps {
  /** Why there's no number. Default: "Not enough answers yet". */
  reason?: string;
  className?: string;
}

/** An unknown number: an ink-400 dash with a tooltip (frame 70 "Null metric", "Brand added after the run"). */
export function NullValue({ reason = 'Not enough answers yet', className }: NullValueProps) {
  return (
    <Tooltip content={reason}>
      <span tabIndex={0} aria-label={reason} className={cn('cursor-help text-ink-400 outline-none', className)}>
        —
      </span>
    </Tooltip>
  );
}

/** Field validation message (frame 70 "Validation messages"): 14 px alert icon, 13 px lost-700. */
export function FieldError({ children, id, className }: { children: ReactNode; id?: string; className?: string }) {
  return (
    <p id={id} role="alert" className={cn('flex gap-2 text-[13px] leading-[1.4] text-lost-700', className)}>
      <CircleAlert aria-hidden size={14} strokeWidth={ICON_STROKE} className="mt-[2px] shrink-0" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

export interface NoRunsYetProps {
  /** How many shopper questions are set up (for the body copy). */
  queryCount?: number | null;
  /** Default: link to /runs. Pass onPlan to open a dialog instead. */
  onPlan?: () => void;
  className?: string;
}

/** No run has been made yet: the very first state after setup. */
export function NoRunsYet({ queryCount, onPlan, className }: NoRunsYetProps) {
  const questions = queryCount ? `your ${queryCount} questions` : 'your shopper questions';
  return (
    <EmptyState
      className={className}
      title="No AI shoppers sent yet"
      body={`Send ChatGPT, Claude and Gemini to shop ${questions}. A full run takes 15–25 minutes.`}
      action={
        onPlan ? (
          <Button icon={Rocket} onClick={onPlan}>
            Plan the first run
          </Button>
        ) : (
          <Button href="/runs" icon={Rocket}>
            Plan the first run
          </Button>
        )
      }
    />
  );
}
