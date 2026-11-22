import { json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { db, must } from '@/lib/supabase';
import { runExists } from '@/lib/runs';

// Cancels pending tasks; in-flight ones finish.
export const POST = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  if (!(await runExists(id))) throw notFound('run_not_found', `No run ${id}`);
  must(await db().rpc('stop_run', { p_run_id: id }), 'stop_run');
  return json({ ok: true });
});
