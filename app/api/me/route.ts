import { json, route } from '@/lib/http';
import { requireUser } from '@/lib/auth';
import type { Me } from '@/lib/api-types';

export const GET = route(async () => {
  const u = await requireUser();
  const me: Me = { email: u.email, name: u.name, avatarUrl: u.avatarUrl };
  return json(me);
});
