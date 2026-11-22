import { ExternalLink, Quote } from "lucide-react";
import type { SourceType } from "@/lib/api-types";
import { Chip } from "./chip";
import { cn } from "./cn";
import { ICON_STROKE, SOURCE_TYPE_LABEL } from "./meta";

export interface SourceRowProps {
  domain: string;
  title: string | null;
  sourceType: SourceType;
  /** Brand the page is about; null hides the chip. */
  brand: string | null;
  cited: boolean;
  url?: string | null;
  /** The page is about the focus brand: brand-50 row, brand chip. */
  isFocusBrand?: boolean;
  className?: string;
}

/** Pencil: Source row (p7woWI). Initial · domain/title · type, brand, cited chips · open link. */
export function SourceRow({
  domain,
  title,
  sourceType,
  brand,
  cited,
  url,
  isFocusBrand = false,
  className,
}: SourceRowProps) {
  const letter = domain.replace(/^www\./, "").charAt(0).toUpperCase() || "?";
  return (
    <div
      className={cn(
        "flex h-14 w-full items-center gap-3 rounded-input px-3",
        isFocusBrand && "bg-brand-50",
        className,
      )}
    >
      <span
        aria-hidden
        className="flex size-7 shrink-0 items-center justify-center rounded-pill border border-ink-200 bg-surface-sunken text-[12px] leading-none font-bold text-ink-700"
      >
        {letter}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[15px] leading-[21px] font-semibold text-ink-900">{domain}</span>
        <span className="truncate text-[13px] leading-[18px] text-ink-500">{title ?? "—"}</span>
      </div>
      <Chip label={SOURCE_TYPE_LABEL[sourceType] ?? sourceType} />
      {brand && <Chip label={brand} tone={isFocusBrand ? "brand" : "neutral"} />}
      {cited && <Chip label="Cited" icon={Quote} tone="outline" />}
      {url ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open ${domain} in a new tab`}
          className="flex size-7 shrink-0 items-center justify-center rounded-pill text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
        >
          <ExternalLink aria-hidden size={16} strokeWidth={ICON_STROKE} />
        </a>
      ) : (
        <span className="size-7 shrink-0" aria-hidden />
      )}
    </div>
  );
}
