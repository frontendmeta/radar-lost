import { json, notFound, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { latestRunId } from '@/lib/lens';
import { getRunStatus } from '@/lib/runs';

// RunStatus of the lens default run: the newest manual run with status done or partial.
export const GET = route(async () => {
  await requireUser();
  const id = await latestRunId();
  const run = id ? await getRunStatus(id) : null;
  if (!run) throw notFound('no_runs', 'No finished manual run yet');
  return json(run);
});
