import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

// Refreshes the Supabase session on page requests and sends signed-out pages to /login.
// API routes are never redirected: they answer 401/403 JSON through requireUser().
const PUBLIC = (p: string) =>
  p === '/api' || p.startsWith('/api/') || p === '/login' || p.startsWith('/login/') || p.startsWith('/auth/');

export async function proxy(request: NextRequest) {
  if ((process.env.AUTH_DISABLED ?? 'true').toLowerCase() === 'true') return NextResponse.next();
  const { pathname, search } = request.nextUrl;
  if (PUBLIC(pathname)) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // getClaims() verifies the JWT (refreshing it when near expiry); nothing may run between
  // createServerClient and this call, or sessions can drop at random.
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === 'string' ? data.claims.email.toLowerCase() : null;

  const allowed = (process.env.ALLOWED_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  const denied = !!email && allowed.length > 0 && !allowed.includes(email);
  if (email && !denied) return response;

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = '';
  if (denied) url.searchParams.set('error', 'not_allowed');
  else if (pathname !== '/') url.searchParams.set('next', pathname + search);
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  // Skip Next internals and static files; the path checks above handle /api, /login and /auth.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest)$).*)'],
};
