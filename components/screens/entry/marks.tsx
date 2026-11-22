import Link from 'next/link';
import type { Assistant } from '@/lib/api-types';
import { ASSISTANT_LABEL, AssistantLogo, RadarMark, cn } from '@/components/ui';

/** Official multi-colour Google "G" (22 px in frame 60). */
export function GoogleMark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg aria-hidden width={size} height={size} viewBox="0 0 48 48" className={cn('shrink-0', className)}>
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

/** Product mark: radar glyph + "Lost Sale Radar" wordmark (17 px display, 600). */
export function ProductMark({ href, className }: { href?: string; className?: string }) {
  const body = (
    <>
      <RadarMark size={28} />
      <span className="font-display text-[17px] leading-5 font-semibold text-ink-900">Lost Sale Radar</span>
    </>
  );
  const cls = cn('inline-flex items-center gap-2.5', className);
  return href ? (
    <Link href={href} className={cls} aria-label="Lost Sale Radar home">
      {body}
    </Link>
  ) : (
    <span className={cls}>{body}</span>
  );
}

/** 36 px overlapping assistant logos with a page-coloured ring (frame 60 "Assistants"). */
export function AssistantStack({ assistants = ['openai', 'anthropic', 'gemini'] }: { assistants?: Assistant[] }) {
  return (
    <div className="flex items-center pt-2">
      {assistants.map((a, i) => (
        <span
          key={a}
          role="img"
          aria-label={ASSISTANT_LABEL[a]}
          title={ASSISTANT_LABEL[a]}
          className={cn(
            'inline-flex size-9 items-center justify-center rounded-pill border-2 border-page bg-surface',
            i > 0 && '-ml-1.5',
          )}
        >
          <AssistantLogo assistant={a} size={18} decorative />
        </span>
      ))}
    </div>
  );
}
