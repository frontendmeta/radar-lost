import type { CSSProperties, ReactNode } from "react";
import { cn } from "./cn";

// "How any brand's ramp is made" (00 Tokens): keep the hue, set OKLCH lightness per step.
// Chroma is eased toward the light end so tints stay in gamut.
const STEPS: Array<[step: number, l: number | null, chroma: number]> = [
  [50, 0.975, 0.18],
  [100, 0.95, 0.3],
  [200, 0.9, 0.5],
  [300, 0.83, 0.75],
  [400, 0.73, 0.95],
  [500, null, 1],
  [600, 0.52, 0.95],
  [700, 0.44, 0.85],
  [800, 0.36, 0.75],
  [900, 0.27, 0.6],
];

/** CSS custom properties for a brand ramp built from one hex colour. */
export function brandRampVars(hex: string): CSSProperties {
  const vars: Record<string, string> = {};
  for (const [step, l, k] of STEPS) {
    // 500 is the brand's own colour, lightness held to 50–65%.
    const L = l === null ? "clamp(0.5, l, 0.65)" : String(l);
    vars[`--color-brand-${step}`] = `oklch(from ${hex} ${L} calc(c * ${k}) h)`;
  }
  return vars as CSSProperties;
}

/** True when a colour has almost no chroma (black, grey, white) → use Peacock. */
export function isColourless(hex: string): boolean {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return true;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return Math.max(r, g, b) - Math.min(r, g, b) < 24;
}

export interface BrandThemeProps {
  /** Brand's main colour from Settings. null/colourless → Peacock. Omit → design default (Libas sample). */
  color?: string | null;
  /** Text colour on brand-500: "white" (default) or "ink" when white fails 4.5:1. */
  onBrand?: "white" | "ink";
  children: ReactNode;
  className?: string;
}

/** Re-skins every brand-* utility inside it. Server-safe. */
export function BrandTheme({ color, onBrand = "white", children, className }: BrandThemeProps) {
  const peacock = color === null || (typeof color === "string" && isColourless(color));
  const style: CSSProperties = {
    ...(color && !peacock ? brandRampVars(color) : {}),
    ...(onBrand === "ink" ? ({ "--color-on-brand": "var(--color-ink-900)" } as CSSProperties) : {}),
  };
  return (
    <div data-brand-theme="" className={cn("contents", peacock && "theme-peacock", className)} style={style}>
      {children}
    </div>
  );
}
