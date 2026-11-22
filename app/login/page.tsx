'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { LoaderCircle, ShieldCheck } from 'lucide-react';
import { ICON_STROKE } from '@/components/ui';
import { GoogleMark } from '@/components/screens/entry/marks';
import { SignInArt } from '@/components/screens/entry/sign-in-art';
import { SignInError } from '@/components/screens/states';

// Errors the callback (or the proxy) sends back as ?error=, in plain words.
function describe(error: string): string {
  const e = error.toLowerCase();
  if (e === 'not_allowed') return "That account isn't on the invite list.";
  if (e === 'missing_code') return "Google didn't send a sign-in code. Try again.";
  if (e === 'access_denied' || e.includes('denied') || e.includes('cancel')) return 'Sign-in was cancelled. Try again when you are ready.';
  if (e === 'exchange_failed' || e.includes('code verifier') || e.includes('pkce'))
    return 'That sign-in link expired. Start again from this page.';
  return error;
}

// Frame 60 "Sign in card" (+ the error variant from frame 70).
function GoogleSignIn() {
  const params = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(params.get('error'));

  async function signIn() {
    setBusy(true);
    setError(null);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const next = params.get('next');
    const redirectTo = `${location.origin}/auth/callback${next && next.startsWith('/') && !next.startsWith('//') ? `?next=${encodeURIComponent(next)}` : ''}`;
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) {
      setError(error.message);
      setBusy(false);
    }
  }

  return (
    <>
      {error && <SignInError>{describe(error)}</SignInError>}
      <button
        type="button"
        onClick={signIn}
        disabled={busy}
        aria-busy={busy || undefined}
        className="flex h-[52px] w-full cursor-pointer items-center justify-center gap-3 rounded-pill border border-ink-200 bg-surface px-6 text-[15px] leading-6 font-semibold text-ink-900 transition-colors duration-150 hover:bg-surface-sunken active:bg-ink-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-progress disabled:opacity-70"
      >
        {busy ? (
          <LoaderCircle aria-hidden size={20} strokeWidth={ICON_STROKE} className="shrink-0 animate-spin text-brand-500" />
        ) : (
          <GoogleMark />
        )}
        {busy ? 'Opening Google…' : 'Continue with Google'}
      </button>
    </>
  );
}

function SignInFallback() {
  return (
    <div className="flex h-[52px] w-full items-center justify-center gap-3 rounded-pill border border-ink-200 bg-surface text-[15px] font-semibold text-ink-900">
      <GoogleMark />
      Continue with Google
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="theme-peacock grid min-h-dvh w-full flex-1 grid-cols-1 grid-rows-[auto_1fr] bg-page lg:h-dvh lg:grid-cols-[55fr_45fr] lg:grid-rows-1 lg:overflow-hidden">
      <SignInArt />
      <section className="flex items-center justify-center bg-surface-sunken px-4 py-8 sm:px-6 lg:py-0">
        <div className="flex w-full max-w-[420px] flex-col gap-5 rounded-card bg-surface p-7 elevation-card sm:p-9">
          <div className="flex flex-col gap-1.5">
            <h2 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.4px] text-ink-900">Sign in</h2>
            <p className="text-[15px] leading-5 text-ink-700">Use your work Google account.</p>
          </div>
          <Suspense fallback={<SignInFallback />}>
            <GoogleSignIn />
          </Suspense>
          <p className="flex items-center gap-2 text-[13px] leading-4 font-medium text-ink-500">
            <ShieldCheck aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-brand-600" />
            Your data stays in your workspace.
          </p>
        </div>
      </section>
    </main>
  );
}
