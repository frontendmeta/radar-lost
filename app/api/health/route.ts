import { json, route } from '@/lib/http';
import { db, must } from '@/lib/supabase';
import { ASSISTANTS } from '@/lib/models';
import type { Assistant, Health } from '@/lib/api-types';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Is process-run up? POST it with a deliberately wrong secret: the function's own secret check
 * answers 401 before any work starts, so this proves it is deployed and serving without kicking
 * a run. A gateway-level 401 (verify_jwt left on) mentions JWT/authorization and does not count,
 * since real kicks would be refused the same way.
 */
async function probeProcessor(): Promise<boolean> {
  const url = process.env.PROCESSOR_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-processor-secret': `health-probe-${crypto.randomUUID()}` },
      body: '{}',
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    const text = await res.text().catch(() => '');
    return res.status === 401 && !/jwt|authorization header/i.test(text);
  } catch {
    return false;
  }
}

export const GET = route(async () => {
  const [reachable, infoRes] = await Promise.all([probeProcessor(), db().rpc('health_info')]);
  const info = (must(infoRes, 'health_info') ?? {}) as any;
  const keys = (info.keysPresent ?? {}) as Record<string, unknown>;
  const health: Health = {
    processorReachable: reachable,
    lastKickAt: info.lastKickAt ?? null,
    lastKickStatus: info.lastKickStatus == null ? null : String(info.lastKickStatus),
    leaseUntil: info.leaseUntil ?? null,
    queuedTasks: Number(info.queuedTasks ?? 0),
    oldestQueuedAgeSec: info.oldestQueuedAgeSec == null ? null : Number(info.oldestQueuedAgeSec),
    openBreakers: ((info.openBreakers ?? []) as string[]).filter((a): a is Assistant => (ASSISTANTS as string[]).includes(a)),
    keysPresent: Object.fromEntries(ASSISTANTS.map((a) => [a, !!keys[a]])) as Record<Assistant, boolean>,
  };
  return json(health);
});
