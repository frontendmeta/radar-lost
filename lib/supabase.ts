import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from './http';

// Server-only service-role client. Call only after requireUser().
let client: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return client;
}

/** Throw a 500 HttpError when a Supabase call returned an error. */
export function must<T>(res: { data: T; error: { message: string; code?: string } | null }, what = 'database'): T {
  if (res.error) {
    // Surface SQL raise codes like "key_missing: ..." as 400s (see lib/http.ts).
    throw dbError(res.error, what);
  }
  return res.data;
}

/** SQL functions raise exceptions as '<code>: <message>' (e.g. 'key_missing: openai has no key'). */
export function dbError(err: { message: string; code?: string }, what = 'database'): HttpError {
  const m = /^([a-z_]+): ([\s\S]*)$/.exec(err.message ?? '');
  if (m) return new HttpError(400, m[1], m[2]);
  return new HttpError(500, 'db_error', `${what}: ${err.message}`);
}
