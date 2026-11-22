import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

// Booti pattern: Lucide flower / flower-2 at 18 px on a 56 px grid, alternate rows offset 28 px.
// Used as a CSS mask so the colour follows the brand ramp (brand-300).
const FLOWER =
  '<circle cx="12" cy="12" r="3"/><path d="M12 16.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 1 1 12 7.5a4.5 4.5 0 1 1 4.5 4.5 4.5 4.5 0 1 1-4.5 4.5"/><path d="M12 7.5V9M7.5 12H9M16.5 12H15M12 16.5V15m-4-8.5 1.88 1.88M14.12 9.88 16 8m-8 8 1.88-1.88M14.12 14.12 16 16"/>';
const FLOWER_2 =
  '<path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1"/><circle cx="12" cy="8" r="2"/><path d="M12 10v12M12 22c4.2 0 7-1.667 7-5-4.2 0-7 1.667-7 5ZM12 22c-4.2 0-7-1.667-7-5 4.2 0 7 1.667 7 5Z"/>';
const icon = (x: number, y: number, body: string) =>
  `<g transform="translate(${x} ${y}) scale(0.75)">${body}</g>`;
const TILE = `<svg xmlns="http://www.w3.org/2000/svg" width="112" height="112" viewBox="0 0 112 112" fill="none" stroke="black" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${icon(19, 19, FLOWER)}${icon(75, 19, FLOWER_2)}${icon(47, 75, FLOWER_2)}${icon(103, 75, FLOWER)}${icon(-9, 75, FLOWER)}</svg>`;
const TILE_URL = `url("data:image/svg+xml,${encodeURIComponent(TILE)}")`;

export interface HeroBandProps {
  children?: ReactNode;
  /** Band height in px (design: 320). Content can extend it. */
  height?: number;
  /** Hide the booti flower pattern. */
  plain?: boolean;
  className?: string;
}

/**
 * Pencil: Hero band (cddCj). Page-top backdrop: blurred brand-100 blob (left), marigold-100
 * blob (right) and a fading booti pattern in brand-300. Children render on top.
 */
export function HeroBand({ children, height = 320, plain = false, className }: HeroBandProps) {
  const patternStyle: CSSProperties = {
    maskImage: TILE_URL,
    WebkitMaskImage: TILE_URL,
    maskSize: "112px 112px",
    WebkitMaskSize: "112px 112px",
    maskRepeat: "repeat",
    WebkitMaskRepeat: "repeat",
  };
  const fadeStyle: CSSProperties = {
    maskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0) 100%)",
    WebkitMaskImage: "linear-gradient(to bottom, rgb(0 0 0 / 0.2), rgb(0 0 0 / 0) 100%)",
  };
  return (
    <div className={cn("relative isolate w-full overflow-hidden bg-page", className)} style={{ minHeight: height }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10" style={{ height }}>
        <div
          className="absolute -top-[260px] -left-[200px] size-[560px] rounded-full bg-brand-100 opacity-70 blur-[80px]"
        />
        <div
          className="absolute -top-[240px] right-[-120px] size-[480px] rounded-full bg-marigold-100 opacity-70 blur-[80px]"
        />
        {!plain && (
          <div className="absolute inset-0" style={fadeStyle}>
            <div className="absolute inset-0 bg-brand-300" style={patternStyle} />
          </div>
        )}
      </div>
      {children}
    </div>
  );
}
