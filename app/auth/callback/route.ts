import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/auth';

/** Only same-origin paths, never '//host' or a full URL (open redirect). */
const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') && !n.startsWith('/\\') ? n : '/');

// Google -> Supabase -> here with ?code=. Exchange it for a session (PKCE verifier is in a cookie).
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get('next'));
  const fail = (msg: string) => NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(msg)}`);

  const providerError = searchParams.get('error_description') ?? searchParams.get('error');
  if (providerError) return fail(providerError);
  const code = searchParams.get('code');
  if (!code) return fail('missing_code');

  try {
    const supabase = await sessionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail(error.message);
  } catch (e) {
    return fail(e instanceof Error ? e.message : 'exchange_failed');
  }
  return NextResponse.redirect(`${origin}${next}`);
}
