import { FileText, Globe, IndianRupee, Megaphone, PenLine, Store, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Chip } from "./chip";
import { cn } from "./cn";
import { FIX_TYPE_LABEL, type FixType } from "./meta";

const FIX_ICON: Record<FixType, LucideIcon> = {
  listing: FileText,
  content: PenLine,
  marketplace: Store,
  pr: Megaphone,
  site: Globe,
  pricing: IndianRupee,
};

export interface FixCardProps {
  ord: number;
  title: string;
  /** Evidence sentence; "Why: " is prefixed when missing. */
  why: string;
  /** The concrete action, shown in the "Do this" well. */
  action: string;
  fixType: FixType;
  /** Optional footer, e.g. an evidence link. */
  footer?: ReactNode;
  className?: string;
}

/** Pencil: Fix card (Fdodr). Number + type chip, title, why, sunken "Do this" well. */
export function FixCard({ ord, title, why, action, fixType, footer, className }: FixCardProps) {
  const whyText = /^why\b/i.test(why.trim()) ? why : `Why: ${why}`;
  return (
    <article
      className={cn(
        "flex w-full flex-col gap-3.5 rounded-inner border border-ink-200 bg-surface p-6",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-brand-50 font-display text-[22px] leading-none font-bold text-brand-500">
          {ord}
        </span>
        <Chip label={FIX_TYPE_LABEL[fixType] ?? fixType} icon={FIX_ICON[fixType]} />
      </div>
      <h3 className="type-h3 text-ink-900">{title}</h3>
      <p className="type-body text-ink-700">{whyText}</p>
      <div className="flex flex-col gap-1 rounded-input bg-surface-sunken px-4 py-3.5">
        <span className="type-label text-brand-600">Do this</span>
        <p className="text-[14px] leading-[22px] text-ink-900">{action}</p>
      </div>
      {footer}
    </article>
  );
}
