"use client";

import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "prefix"> {
  /** Optional label rendered above the field — Oswald uppercase eyebrow. */
  label?: string;
  /** Helper text below the field (steel, replaced by error on error). */
  hint?: string;
  /** Error message — switches border + helper to brick. */
  error?: string;
  /** Slot at left of the input (e.g. brick map-pin icon). */
  prefix?: ReactNode;
  /** Slot at right of the input (e.g. submit button inset 6px). */
  suffix?: ReactNode;
}

/**
 * Brand text input — 56px tall, paper bg, navy/25 border, focuses to a
 * navy border + 3px navy/15 ring. Error state swaps both to brick. Use
 * the existing `<Input />` primitive for plain forms; this one is for
 * the customer-funnel hero / configure screens where the design calls
 * for the eyebrow label + prefix/suffix slots.
 */
export const TextInput = forwardRef<HTMLInputElement, Props>(
  ({ label, hint, error, prefix, suffix, className, ...rest }, ref) => {
    return (
      <label className="block">
        {label && (
          <span className="mb-2 block font-display text-[11px] font-semibold uppercase tracking-eyebrow text-navy">
            {label}
          </span>
        )}
        <div
          className={cn(
            "flex h-14 items-center rounded-sm border bg-paper px-4 transition",
            error ? "border-brick" : "border-navy/25",
            "focus-within:border-navy focus-within:ring-[3px] focus-within:ring-navy/15"
          )}
        >
          {prefix && <span className="mr-3 text-steel">{prefix}</span>}
          <input
            ref={ref}
            className={cn(
              "flex-1 bg-transparent font-body text-[17px] text-ink outline-none placeholder:text-steel/70",
              className
            )}
            {...rest}
          />
          {suffix && <span className="ml-3 text-steel">{suffix}</span>}
        </div>
        {hint && !error && (
          <span className="mt-2 block font-body text-[13px] text-steel">
            {hint}
          </span>
        )}
        {error && (
          <span className="mt-2 block font-body text-[13px] text-brick">
            {error}
          </span>
        )}
      </label>
    );
  }
);
TextInput.displayName = "TextInput";
