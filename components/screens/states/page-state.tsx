import { Compass, LogIn, Radar, Rocket, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, ICON_STROKE, cn } from '@/components/ui';
import { EntryBackdrop } from '../entry/backdrop';
import { ProductMark } from '../entry/marks';

export type PageStateTone = 'neutral' | 'error' | 'attention' | 'brand';

const TONE: Record<PageStateTone, string> = {
  neutral: 'bg-surface-sunken text-ink-500',
  error: 'bg-lost-50 text-lost-500',
  attention: 'bg-marigold-50 text-marigold-700',
  brand: 'bg-brand-50 text-brand-600',
};

export interface PageStateProps {
  icon: LucideIcon;
  tone?: PageStateTone;
  title: ReactNode;
  body?: ReactNode;
  /** Buttons, primary first. */
  actions?: ReactNode;
  /** Small print under the actions, e.g. an error reference. */
  footnote?: ReactNode;
  /** Peacock accent (signed-out screens, no brand yet). */
  peacock?: boolean;
  className?: string;
}

/**
 * Full-page state on the entry backdrop (booti field + blobs, product mark top-left):
 * not found, crashed, signed out. Server-safe; pass client buttons for handlers.
 */
export function PageState({ icon: Icon, tone = 'neutral', title, body, actions, footnote, peacock, className }: PageStateProps) {
  return (
    <main className={cn('relative isolate flex min-h-screen w-full flex-1 flex-col items-center bg-page px-4 sm:px-6', peacock && 'theme-peacock', className)}>
      <EntryBackdrop variant="welcome" />
      <header className="flex w-full max-w-[1200px] items-center py-6">
        <ProductMark href="/" />
      </header>
      <div className="flex w-full flex-1 items-center justify-center pt-6 pb-24">
        <section className="flex w-full max-w-[560px] animate-pop-in flex-col items-center gap-5 rounded-card bg-surface px-7 py-10 text-center elevation-card sm:px-12 sm:py-12">
          <span aria-hidden className={cn('flex size-14 items-center justify-center rounded-pill', TONE[tone])}>
            <Icon size={26} strokeWidth={ICON_STROKE} />
          </span>
          <div className="flex flex-col gap-2">
            <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.4px] text-ink-900">{title}</h1>
            {body && <p className="type-body mx-auto max-w-[420px] text-ink-700">{body}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center justify-center gap-3 pt-1">{actions}</div>}
          {footnote && <p className="type-small text-ink-400">{footnote}</p>}
        </section>
      </div>
    </main>
  );
}

/** 404: unknown route, deleted run, or missing task. */
export function NotFoundState({ title = "This page isn't on the radar", body = 'The link may be old, or the run it pointed to was deleted.' }: { title?: ReactNode; body?: ReactNode }) {
  return (
    <PageState
      icon={Compass}
      title={title}
      body={body}
      actions={
        <>
          <Button href="/" icon={Radar}>
            Back to the radar
          </Button>
          <Button href="/runs" variant="secondary" icon={Rocket}>
            See all runs
          </Button>
        </>
      }
    />
  );
}

/** Session ended (an API call answered 401). `next` is where to return after sign-in. */
export function SignedOutState({ next, body = 'Your session ended. Sign in again to pick up where you left off.' }: { next?: string | null; body?: ReactNode }) {
  const safe = next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/login') ? next : null;
  const href = safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
  return (
    <PageState
      peacock
      tone="brand"
      icon={LogIn}
      title="You're signed out"
      body={body}
      actions={
        <Button href={href} icon={LogIn}>
          Sign in again
        </Button>
      }
    />
  );
}
