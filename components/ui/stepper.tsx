"use client";

import { Minus, Plus } from "lucide-react";
import { useState } from "react";
import { cn } from "./cn";
import { ICON_STROKE } from "./meta";

export interface StepperProps {
  /** Accessible name, e.g. "Attempts per query". */
  label: string;
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

/** Pencil: Stepper (AVz8H). 44 px pill: − · value · +. */
export function Stepper({
  label,
  value,
  defaultValue = 0,
  min = -Infinity,
  max = Infinity,
  step = 1,
  onValueChange,
  disabled = false,
  className,
}: StepperProps) {
  const [inner, setInner] = useState(defaultValue);
  const v = value ?? inner;
  const set = (n: number) => {
    const next = Math.max(min, Math.min(max, n));
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };
  const btn =
    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-pill bg-surface-sunken text-ink-900 transition-colors hover:bg-ink-100 disabled:cursor-not-allowed disabled:text-ink-300";
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex h-11 items-center gap-1 rounded-pill border border-ink-200 bg-surface p-1",
        disabled && "opacity-40",
        className,
      )}
    >
      <button type="button" className={btn} aria-label={`Decrease ${label}`} disabled={disabled || v <= min} onClick={() => set(v - step)}>
        <Minus aria-hidden size={18} strokeWidth={ICON_STROKE} />
      </button>
      <output aria-live="polite" className="w-11 text-center text-[15px] leading-6 font-semibold text-ink-900 tabular-nums">
        {v}
      </output>
      <button type="button" className={btn} aria-label={`Increase ${label}`} disabled={disabled || v >= max} onClick={() => set(v + step)}>
        <Plus aria-hidden size={18} strokeWidth={ICON_STROKE} />
      </button>
    </div>
  );
}
