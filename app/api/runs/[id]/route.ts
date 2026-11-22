import { json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { getRunStatus } from '@/lib/runs';

export const GET = route(async (_req, ctx: { params: Promise<{ id: string }> }) => {
  await requireUser();
  const { id } = await ctx.params;
  const run = await getRunStatus(id);
  if (!run) throw notFound('run_not_found', `No run ${id}`);
  return json(run);
});
