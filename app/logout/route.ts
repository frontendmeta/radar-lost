import { NextResponse } from 'next/server';
import { sessionClient } from '@/lib/auth';

// GET /logout — clears the Supabase session cookies and sends the browser to /login.
// A plain link target, so sign-out works from any page without client JS.
export async function GET(req: Request) {
  try {
    const supabase = await sessionClient();
    await supabase.auth.signOut();
  } catch {
    // Already signed out or auth not configured: still go to /login.
  }
  return NextResponse.redirect(new URL('/login', req.url), { status: 303 });
}
