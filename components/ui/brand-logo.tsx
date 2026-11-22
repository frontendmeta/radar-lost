import type { ReactNode } from "react";
import { cn } from "./cn";

export type BrandLogoKind = "brand" | "marketplace";

/**
 * Public brand + marketplace marks saved under /public/logos (never hotlinked).
 * Keys: normalised names (lowercase, letters and digits only) and bare domains.
 */
const LOGOS: { src: string; srcLarge?: string; kind: BrandLogoKind; names: string[]; domains: string[] }[] = [
  // Small: favicon "L" (reads at 20 px). Large (>= 48 px): the app icon wordmark.
  { src: "/logos/brands/libas.png", srcLarge: "/logos/brands/libas-lg.png", kind: "brand", names: ["libas"], domains: ["libas.in"] },
  { src: "/logos/brands/jaipur-kurti.png", kind: "brand", names: ["jaipurkurti"], domains: ["jaipurkurti.com"] },
  { src: "/logos/brands/janasya.png", kind: "brand", names: ["janasya"], domains: ["janasya.com"] },
  { src: "/logos/brands/biba.png", kind: "brand", names: ["biba"], domains: ["biba.in"] },
  { src: "/logos/brands/aurelia.png", kind: "brand", names: ["aurelia"], domains: ["shopforaurelia.com"] },
  { src: "/logos/marketplaces/myntra.png", kind: "marketplace", names: ["myntra"], domains: ["myntra.com"] },
  { src: "/logos/marketplaces/ajio.svg", kind: "marketplace", names: ["ajio"], domains: ["ajio.com"] },
  { src: "/logos/marketplaces/amazon.png", kind: "marketplace", names: ["amazon", "amazonin", "amazonindia"], domains: ["amazon.in", "amazon.com"] },
  { src: "/logos/marketplaces/flipkart.png", kind: "marketplace", names: ["flipkart"], domains: ["flipkart.com"] },
  { src: "/logos/marketplaces/nykaa-fashion.png", kind: "marketplace", names: ["nykaafashion"], domains: ["nykaafashion.com"] },
];

const normName = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const normDomain = (s: string) =>
  s.trim().toLowerCase().replace(/^[a-z]+:\/\//, "").replace(/^www\./, "").split(/[/?#:]/)[0] ?? "";

function findLogo(name?: string | null, domain?: string | readonly string[] | null, kind?: BrandLogoKind) {
  const pool = kind ? LOGOS.filter((l) => l.kind === kind) : LOGOS;
  const domains = (Array.isArray(domain) ? domain : domain ? [domain] : []).map(normDomain).filter(Boolean);
  for (const d of domains) {
    const hit = pool.find((l) => l.domains.some((ld) => d === ld || d.endsWith(`.${ld}`)));
    if (hit) return hit;
  }
  const n = name ? normName(name) : "";
  return (n && pool.find((l) => l.names.includes(n))) || null;
}

/** Saved logo path for a brand or marketplace, or null when we have none. */
export function brandLogoSrc(
  name?: string | null,
  domain?: string | readonly string[] | null,
  kind?: BrandLogoKind,
  size = 20,
): string | null {
  const hit = findLogo(name, domain, kind);
  if (!hit) return null;
  return size >= 48 && hit.srcLarge ? hit.srcLarge : hit.src;
}

export interface BrandLogoProps {
  /** Brand or marketplace name; also the alt text and the fallback initial. */
  name: string;
  /** A domain (or the brand's domains) to match on, e.g. "libas.in". */
  domain?: string | readonly string[] | null;
  /** Restrict the lookup to brands or marketplaces. */
  kind?: BrandLogoKind;
  /** Pixel size (width = height). */
  size?: number;
  /** Fallback tile colour (CSS colour), e.g. competitorColor(i). */
  color?: string;
  /** Fallback content instead of the initial (e.g. an icon). */
  fallback?: ReactNode;
  /** Hide from assistive tech when the name sits next to it. */
  decorative?: boolean;
  className?: string;
}

/**
 * Brand / marketplace mark: a rounded-square logo on a white tile with a hairline border.
 * Unknown names (new competitors, "Other", house labels) fall back to a coloured initial.
 */
export function BrandLogo({
  name,
  domain,
  kind,
  size = 20,
  color = "var(--color-ink-500)",
  fallback,
  decorative = false,
  className,
}: BrandLogoProps) {
  const src = brandLogoSrc(name, domain, kind, size);
  const radius = Math.max(4, Math.round(size * 0.26));
  const box = { width: size, height: size, borderRadius: radius };

  if (!src) {
    const initial = name.trim().charAt(0).toUpperCase() || "·";
    return (
      <span
        role={decorative ? undefined : "img"}
        aria-label={decorative ? undefined : name}
        aria-hidden={decorative || undefined}
        className={cn("inline-flex shrink-0 items-center justify-center font-bold leading-none text-white select-none", className)}
        style={{ ...box, backgroundColor: color, fontSize: Math.max(9, Math.round(size * 0.46)) }}
      >
        {fallback ?? initial}
      </span>
    );
  }

  return (
    <span
      className={cn("relative inline-flex shrink-0 overflow-hidden bg-white", className)}
      style={box}
      aria-hidden={decorative || undefined}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- tiny local static mark, no optimisation needed */}
      <img
        src={src}
        width={size}
        height={size}
        alt={decorative ? "" : name}
        loading="eager"
        decoding="async"
        draggable={false}
        className="size-full object-contain"
      />
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-ink-900/10 ring-inset" />
    </span>
  );
}
