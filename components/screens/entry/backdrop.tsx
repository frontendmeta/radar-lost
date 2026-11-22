import type { CSSProperties } from 'react';
import { cn } from '@/components/ui';

// Booti pattern from the Pencil entry frames (60 Sign in, 61 Brand welcome): Lucide flower /
// flower-2 at 18 px on a 56 px grid, alternate rows offset 28 px, tinted brand-300 (Peacock on
// sign-in, the brand ramp elsewhere). Opacity peaks at 0.2 mid-height and fades to ~0.04 at the edges.
const FLOWER =
  '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9M7.5 12H9M16.5 12H15M12 16.5V15m-4-8.5 1.88 1.88M14.12 9.88 16 8m-8 8 1.88-1.88M14.12 14.12 16 16"/>';
const FLOWER_2 =
  '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5ZM12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>';
const at = (x: number, y: number, body: string) => `<g transform="translate(${x} ${y}) scale(0.75)">${body}</g>`;
const TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112" fill="none" stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${at(19, 19, FLOWER)}${at(75, 19, FLOWER_2)}${at(47, 75, FLOWER_2)}${at(103, 75, FLOWER)}${at(-9, 75, FLOWER)}</svg>`;
const TILE_URL = `url("data:image/svg+xml,${encodeURIComponent(TILE)}")`;

const PATTERN: CSSProperties = {
  maskImage: TILE_URL,
  WebkitMaskImage: TILE_URL,
  maskSize: '112px 112px',
  WebkitMaskSize: '112px 112px',
  maskRepeat: 'repeat',
  WebkitMaskRepeat: 'repeat',
  maskPosition: '0 0',
};
const FADE = 'linear-gradient(to bottom, rgb(0 0 0 / 0.036), rgb(0 0 0 / 0.2) 51%, rgb(0 0 0 / 0.04))';
const FADE_STYLE: CSSProperties = { maskImage: FADE, WebkitMaskImage: FADE };

/** Booti flower field; colour follows brand-300 (wrap in .theme-peacock for Peacock). */
export function BootiPattern({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)} style={FADE_STYLE}>
      <div className="absolute inset-0 bg-brand-300" style={PATTERN} />
    </div>
  );
}

export interface EntryBackdropProps {
  /** sign-in: big brand blob top-left + marigold bottom-right (frame 60 art panel).
   *  welcome: brand top-left, marigold top-right, brand bottom-right (frame 61). */
  variant?: 'sign-in' | 'welcome';
  className?: string;
}

/** Decorative page backdrop for entry and full-page state screens. Position: absolute, fills its parent. */
export function EntryBackdrop({ variant = 'welcome', className }: EntryBackdropProps) {
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}>
      {variant === 'sign-in' ? (
        <>
          <div className="absolute -top-[180px] -left-[220px] size-[760px] rounded-full bg-brand-100 opacity-80 blur-[100px]" />
          <div className="absolute top-[560px] left-[420px] size-[560px] rounded-full bg-marigold-100 opacity-80 blur-[100px]" />
        </>
      ) : (
        <>
          <div className="absolute -top-[260px] -left-[200px] size-[560px] rounded-full bg-brand-100 opacity-70 blur-[80px]" />
          <div className="absolute -top-[240px] -right-[120px] size-[480px] rounded-full bg-marigold-100 opacity-70 blur-[80px]" />
          <div className="absolute -right-[100px] -bottom-[256px] size-[640px] rounded-full bg-brand-100 opacity-60 blur-[100px]" />
        </>
      )}
      <BootiPattern />
    </div>
  );
}
