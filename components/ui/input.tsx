"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  /** Helper line under the field. */
  helper?: ReactNode;
  /** Error message; replaces the helper and turns the field lost-500. */
  error?: string | null;
  /** Slot inside the field after the value, e.g. a unit or icon. */
  trailing?: ReactNode;
  /** Wrapper class (field width defaults to full). */
  className?: string;
}

/** Pencil: Input (loa85) with focus and error states. 48 px sunken field, radius 14. */
export function Input({ label, helper, error, trailing, className, id, ...rest }: InputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const hint = error || helper;
  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      <label htmlFor={inputId} className="text-[13px] leading-5 font-semibold text-ink-900">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-input border px-4 transition-colors",
          error
            ? "border-lost-500 bg-surface-sunken"
            : "border-transparent bg-surface-sunken focus-within:border-2 focus-within:border-brand-300 focus-within:bg-surface focus-within:px-[15px]",
        )}
      >
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={hint ? hintId : undefined}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] leading-6 text-ink-900 outline-none placeholder:text-ink-400 disabled:text-ink-400"
          {...rest}
        />
        {trailing}
      </div>
      {hint && (
        <p id={hintId} className={cn("text-[13px] leading-5", error ? "text-lost-700" : "text-ink-500")}>
          {error || helper}
        </p>
      )}
    </div>
  );
}
