import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { loadSettingsBundle } from '@/lib/settings';

// GET /api/settings -> SettingsBundle
export const GET = route(async () => {
  await requireUser();
  return json(await loadSettingsBundle());
});
