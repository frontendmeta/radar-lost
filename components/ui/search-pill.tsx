import { Search } from "lucide-react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface SearchPillProps {
  /** A web search the assistant ran. */
  text: string;
  className?: string;
}

/** Pencil: Search pill (TXGvN). 36 px sunken pill with search icon. */
export function SearchPill({ text, className }: SearchPillProps) {
  return (
    <span
      className={cn(
        "inline-flex h-9 max-w-full items-center gap-2 rounded-pill bg-surface-sunken px-3.5",
        className,
      )}
      title={text}
    >
      <Search aria-hidden size={16} strokeWidth={ICON_STROKE} className="shrink-0 text-ink-500" />
      <span className="truncate text-[14px] leading-5 font-medium text-ink-700">{text}</span>
    </span>
  );
}
