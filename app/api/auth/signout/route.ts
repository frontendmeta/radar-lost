import { json, route } from '@/lib/http';
import { sessionClient } from '@/lib/auth';

// Clears the Supabase session cookies. No requireUser(): signing out must work in any session state.
export const POST = route(async () => {
  const supabase = await sessionClient();
  await supabase.auth.signOut();
  return json({ ok: true });
});
