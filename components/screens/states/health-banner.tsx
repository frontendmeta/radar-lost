'use client';

import { useEffect, useState } from 'react';
import { api, isTerminal } from '@/lib/client/api';
import { useApi } from '@/lib/client/hooks';
import { WorkerOfflineBanner } from './banners';

export interface HealthBannerProps {
  /** Re-check /api/health every pollMs (default 30 s). */
  pollMs?: number;
  className?: string;
}

/**
 * Self-wired "worker offline" banner: renders nothing while GET /api/health says the
 * processor is reachable. "Wake it up" kicks the latest unfinished run, then re-checks.
 */
export function HealthBanner({ pollMs = 30_000, className }: HealthBannerProps) {
  const health = useApi('health', api.health);
  const { reload } = health;
  const [dismissed, setDismissed] = useState(false);
  const [waking, setWaking] = useState(false);

  useEffect(() => {
    const t = setInterval(reload, pollMs);
    return () => clearInterval(t);
  }, [reload, pollMs]);

  const h = health.data;
  if (!h || h.processorReachable || dismissed) return null;

  async function wake() {
    setWaking(true);
    try {
      const run = await api.latestRun();
      if (run && !isTerminal(run.status)) await api.kickRun(run.id);
    } catch {
      // No run to kick, or the kick failed: the re-check below tells the truth.
    } finally {
      setWaking(false);
      reload();
    }
  }

  return (
    <WorkerOfflineBanner
      className={className}
      lastKickAt={h.lastKickAt}
      onWake={wake}
      waking={waking}
      onDismiss={() => setDismissed(true)}
    />
  );
}
