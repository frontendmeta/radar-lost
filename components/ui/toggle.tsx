"use client";

import { useState } from "react";
import { cn } from "./cn";

export interface ToggleProps {
  /** Accessible name (required: the switch has no visible label of its own). */
  label: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  name?: string;
  className?: string;
}

/** Pencil: Toggle (F5GDDP) on / off / disabled. 44×26, 20 px knob. */
export function Toggle({
  label,
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled = false,
  name,
  className,
}: ToggleProps) {
  const [inner, setInner] = useState(defaultChecked);
  const on = checked ?? inner;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      name={name}
      value={on ? "on" : "off"}
      disabled={disabled}
      onClick={() => {
        const next = !on;
        if (checked === undefined) setInner(next);
        onCheckedChange?.(next);
      }}
      className={cn(
        "inline-flex h-[26px] w-11 shrink-0 cursor-pointer items-center rounded-pill p-[3px] transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40",
        on ? "bg-brand-500" : "bg-ink-300",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-5 rounded-full bg-white shadow-[0_1px_2px_rgb(31_26_28/0.15)] transition-transform duration-150",
          on ? "translate-x-[18px]" : "translate-x-0",
        )}
      />
    </button>
  );
}
