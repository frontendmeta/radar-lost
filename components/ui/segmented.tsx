"use client";

import { useState } from "react";
import { cn } from "./cn";

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedProps<T extends string = string> {
  /** Accessible name for the group. */
  label: string;
  options: SegmentedOption<T>[];
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  className?: string;
}

/** Pencil: Segmented (E2LosD). 40 px sunken pill; selected option is a white card pill. */
export function Segmented<T extends string = string>({
  label,
  options,
  value,
  defaultValue,
  onValueChange,
  className,
}: SegmentedProps<T>) {
  const [inner, setInner] = useState<T | undefined>(defaultValue ?? options[0]?.value);
  const current = value ?? inner;
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex h-10 items-center gap-0.5 rounded-pill bg-surface-sunken p-1", className)}
    >
      {options.map((o) => {
        const selected = o.value === current;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={o.disabled}
            onClick={() => {
              if (value === undefined) setInner(o.value);
              onValueChange?.(o.value);
            }}
            className={cn(
              "flex h-8 cursor-pointer items-center rounded-pill px-3.5 text-[13px] leading-5 font-semibold whitespace-nowrap transition-[background-color,color,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-40",
              selected ? "bg-surface text-ink-900 shadow-card" : "text-ink-500 hover:text-ink-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
