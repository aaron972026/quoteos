"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = ["Address", "Confirm", "Draw", "Configure", "Quote"] as const;
export type FunnelStep = 0 | 1 | 2 | 3 | 4;

interface Props {
  step: FunnelStep;
  /** Dark variant — used over map screens. */
  dark?: boolean;
  /** Optional click handler — forward jumps should be gated by caller. */
  onJump?: (i: FunnelStep) => void;
}

/**
 * Five-step funnel indicator per brand spec. Each step renders as a numbered
 * chip + label + connector bar. State map:
 *  - done   → brass chip with check icon, brass connector
 *  - current→ navy or cream chip with brass ring, solid connector
 *  - todo   → empty outlined chip, muted connector
 *
 * Labels hide on mobile (md breakpoint).
 */
export function Progress({ step, dark = false, onJump }: Props) {
  const wrapBg = dark
    ? "bg-navy-deep border-b border-brass/25"
    : "bg-paper border-b border-navy/10";
  const mutedColor = dark ? "text-cream/55" : "text-steel";

  return (
    <div className={cn("w-full", wrapBg)}>
      <div className="mx-auto max-w-[1280px] px-5 py-3.5 md:px-10">
        <ol className="flex items-center gap-2 md:gap-3">
          {STEPS.map((label, i) => {
            const state: "done" | "current" | "todo" =
              i < step ? "done" : i === step ? "current" : "todo";
            const barCls =
              state === "done"
                ? "bg-brass"
                : state === "current"
                  ? dark
                    ? "bg-cream"
                    : "bg-navy"
                  : "bg-steel-soft/55";
            const numCls =
              state === "done"
                ? "bg-brass text-navy"
                : state === "current"
                  ? dark
                    ? "bg-cream text-navy ring-2 ring-brass"
                    : "bg-navy text-cream ring-2 ring-brass"
                  : dark
                    ? "bg-transparent text-cream/55 border border-cream/30"
                    : "bg-transparent text-steel border border-steel-soft";
            const labelCls =
              state === "current"
                ? dark
                  ? "text-cream"
                  : "text-navy"
                : mutedColor;

            return (
              <li key={label} className="flex min-w-0 flex-1 items-center">
                <button
                  type="button"
                  onClick={() => onJump?.(i as FunnelStep)}
                  className="group flex min-w-0 items-center gap-2.5"
                  aria-current={state === "current" ? "step" : undefined}
                  aria-label={`Step ${i + 1}: ${label}`}
                >
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-pill font-mono text-[10px] font-medium tracking-wider",
                      numCls
                    )}
                  >
                    {state === "done" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : (
                      String(i + 1).padStart(2, "0")
                    )}
                  </span>
                  <span
                    className={cn(
                      "hidden font-display text-[11px] font-semibold uppercase tracking-eyebrow md:inline",
                      labelCls
                    )}
                  >
                    {label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <span className={cn("mx-2 h-px flex-1 md:mx-3", barCls)} />
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
