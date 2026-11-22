import { cn } from "./cn";

export interface RadarMarkProps {
  size?: number;
  className?: string;
}

/** Product glyph from Top bar: three quarter-ring waves and a dot, in brand-500. Decorative. */
export function RadarMark({ size = 28, className }: RadarMarkProps) {
  // Geometry from Pencil (28×28 box, centre at 3,25; rings 3.2 px thick).
  const arc = (r: number) => `M ${3 + r} 25 A ${r} ${r} 0 0 0 3 ${25 - r}`;
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      className={cn("shrink-0 text-brand-500", className)}
    >
      <g stroke="currentColor" strokeWidth={3.2}>
        <path d={arc(7.4)} />
        <path d={arc(15.4)} />
        <path d={arc(23.4)} />
      </g>
      <circle cx={3} cy={25} r={3} fill="currentColor" />
    </svg>
  );
}
