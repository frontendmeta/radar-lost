'use client'; // Replaces the root layout when it crashes, so it brings its own <html>, <body> and styles.

import { useEffect } from 'react';
import './globals.css';

export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-page px-4 font-sans text-ink-900">
        <title>Something went wrong · Lost Sale Radar</title>
        <main className="flex w-full max-w-[480px] flex-col items-center gap-4 rounded-card bg-surface px-8 py-10 text-center elevation-card">
          <h1 className="font-display text-[28px] leading-[34px] font-bold tracking-[-0.4px]">Lost Sale Radar hit a snag</h1>
          <p className="text-[15px] leading-6 text-ink-700">Your runs and settings are safe. Reload to carry on.</p>
          <div className="flex flex-wrap justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => retry()}
              className="h-11 cursor-pointer rounded-pill bg-brand-500 px-[22px] text-[15px] font-semibold text-on-brand hover:bg-brand-600"
            >
              Try again
            </button>
            <button
              type="button"
              // Full reload on purpose: the root layout crashed, so start clean.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              onClick={() => window.location.assign(`${window.location.origin}/`)}
              className="h-11 cursor-pointer rounded-pill border border-ink-200 bg-surface px-[22px] text-[15px] font-semibold text-ink-900 hover:bg-surface-sunken"
            >
              Back to the radar
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
