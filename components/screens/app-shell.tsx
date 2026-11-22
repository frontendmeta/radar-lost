'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { api } from '@/lib/client/api';
import { useApi, usePrefetchCommon, useUsingMocks } from '@/lib/client/hooks';
import { Button, Dock, HeroBand, TopBar as TopBarView, cn, type WorkerStatus } from './ui';
import { LiveTestDialog } from './live-test';

function initials(name: string | null | undefined, email: string | undefined) {
  const src = (name ?? email ?? '').trim();
  if (!src) return '·';
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || src[0].toUpperCase();
}

/** Pencil: Top bar (JeCO7), wired to /api/health and /api/me. */
export function TopBar() {
  usePrefetchCommon();
  const health = useApi('health', api.health);
  const me = useApi('me', api.me);
  const usingMocks = useUsingMocks();
  const [liveOpen, setLiveOpen] = useState(false);

  const h = health.data;
  const workerStatus: WorkerStatus = !h ? 'unknown' : h.processorReachable ? 'online' : 'offline';
  const workerLabel = !h ? (health.error ? 'Worker unknown' : 'Checking worker…') : !h.processorReachable ? 'Worker offline' : h.openBreakers.length ? `Worker online · ${h.openBreakers.length} paused` : h.queuedTasks ? `Worker online · ${h.queuedTasks} queued` : 'Worker online';

  return (
    <>
      <TopBarView
        homeHref="/"
        workerStatus={workerStatus}
        workerLabel={workerLabel}
        userInitials={initials(me.data?.name, me.data?.email)}
        userAvatarUrl={me.data?.avatarUrl ?? null}
        userEmail={me.data?.email ?? null}
        actions={
          <>
            {usingMocks && (
              <span
                title="Some numbers on this page are sample data because a backend route isn't answering yet."
                className="inline-flex h-7 items-center rounded-pill bg-marigold-100 px-3 text-[12px] font-semibold text-marigold-700"
              >
                Sample data
              </span>
            )}
            <Button variant="secondary" icon={Sparkles} onClick={() => setLiveOpen(true)}>
              Live test
            </Button>
          </>
        }
      />
      {liveOpen && <LiveTestDialog onClose={() => setLiveOpen(false)} />}
    </>
  );
}

/** Page chrome: hero band, top bar, content column, floating dock. */
export function AppShell({ active, children, className }: { active: 'radar' | 'queries' | 'runs' | 'settings'; children: ReactNode; className?: string }) {
  return (
    <HeroBand className="flex min-h-screen flex-col items-center">
      <div className={cn('relative flex w-full max-w-[1200px] flex-col gap-10 px-6 pb-36 xl:px-0', className)}>
        <TopBar />
        {children}
      </div>
      <Dock active={active} floating />
    </HeroBand>
  );
}

/** Generic white page card (Pencil card style: 28 px radius, soft shadow). */
export function Card({ children, className, tone = 'surface', pad = 'md' }: { children: ReactNode; className?: string; tone?: 'surface' | 'brand'; pad?: 'sm' | 'md' | 'lg' }) {
  return (
    <section
      className={cn(
        'flex flex-col rounded-card',
        pad === 'lg' ? 'p-8' : pad === 'md' ? 'p-7' : 'p-6',
        tone === 'surface' ? 'bg-surface elevation-card' : 'border border-brand-200 bg-brand-50 shadow-card',
        className,
      )}
    >
      {children}
    </section>
  );
}

export function CardHeader({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <h2 className="type-h2 truncate text-ink-900">{title}</h2>
        {sub && <p className="type-small text-ink-500">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

/** Shimmer block for loading states. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('animate-shimmer rounded-inner bg-[linear-gradient(90deg,var(--color-ink-100),var(--color-surface-sunken),var(--color-ink-100))] bg-[length:200%_100%]', className)}
    />
  );
}

export function ErrorNote({ error, onRetry, retryLabel = 'Retry' }: { error: Error; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-inner bg-lost-50 px-4 py-3 type-small text-lost-700">
      <span>{error.message || 'Something went wrong'}</span>
      {onRetry && (
        <button type="button" onClick={onRetry} className="cursor-pointer font-semibold underline">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
