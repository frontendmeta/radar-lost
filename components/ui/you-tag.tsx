import { cn } from "./cn";

export interface YouTagProps {
  label?: string;
  className?: string;
}

/** Pencil: You tag (FlR3I). Marks the user's own brand. */
export function YouTag({ label = "You", className }: YouTagProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] shrink-0 items-center rounded-pill bg-brand-100 px-2 text-[12px] leading-4 font-bold text-brand-700",
        className,
      )}
    >
      {label}
    </span>
  );
}
