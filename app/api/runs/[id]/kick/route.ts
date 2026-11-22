import { errorJson, json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { kickProcessor } from '@/lib/kick';
import { runExists } from '@/lib/runs';

// Manual kick, so the demo never depends on cron. The processor works on every open run, not just this one.
export const POST = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!(await runExists(id))) throw notFound('run_not_found', `No run ${id}`);
  const kick = await kickProcessor();
  if (!kick.ok) {
    console.warn('[api/runs/kick] kick failed', kick.status ?? kick.error);
    return errorJson(502, 'kick_failed', `Processor did not accept the kick (${kick.status ?? kick.error})`);
  }
  return json({ ok: true });
});
