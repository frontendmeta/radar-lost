import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { HttpError } from './http';

export interface SessionUser { id: string | null; email: string; name: string | null; avatarUrl: string | null }

const DEMO_USER: SessionUser = { id: null, email: 'demo@lostsaleradar.local', name: 'Demo user', avatarUrl: null };

export const authDisabled = () => (process.env.AUTH_DISABLED ?? 'true').toLowerCase() === 'true';

/** Cookie-bound Supabase client (anon key) for reading the session. */
export async function sessionClient() {
  const store = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try { list.forEach(({ name, value, options }) => store.set(name, value, options)); } catch { /* read-only context */ }
      },
    },
  });
}

/**
 * Every route except /api/health calls this first.
 * No session -> 401 unauthenticated; email outside ALLOWED_EMAILS -> 403 not_allowed.
 * AUTH_DISABLED=true (default) -> fixed demo user.
 */
export async function requireUser(): Promise<SessionUser> {
  if (authDisabled()) return DEMO_USER;
  const supabase = await sessionClient();
  // getClaims() verifies the session JWT locally against the project's cached ES256 public keys,
  // so a request no longer waits on a round trip to Supabase Auth (getUser() made one every call).
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const rawEmail = typeof claims?.email === 'string' ? claims.email : '';
  if (error || !claims?.sub || !rawEmail) throw new HttpError(401, 'unauthenticated', 'Sign in required');
  const email = rawEmail.toLowerCase();
  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email)) throw new HttpError(403, 'not_allowed', `${email} is not allowed`);
  const meta = (claims.user_metadata ?? {}) as Record<string, string | undefined>;
  return { id: claims.sub, email, name: meta.full_name ?? meta.name ?? null, avatarUrl: meta.avatar_url ?? meta.picture ?? null };
}
