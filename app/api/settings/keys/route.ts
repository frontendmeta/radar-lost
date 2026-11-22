import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import { listProviderKeys } from '@/lib/provider-keys';

// GET /api/settings/keys -> ProviderKeyInfo[] (metadata only; keys are never returned)
export const GET = route(async () => {
  await requireUser();
  return json(await listProviderKeys());
});
