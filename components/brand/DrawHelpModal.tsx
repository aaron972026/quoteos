"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { Eyebrow } from "./Eyebrow";
import { cn } from "@/lib/utils";

interface DrawHelpModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  steps: Array<{ title: string; body: string }>;
  closeCta: string;
  /** Localized "Next" / "Back" / "Step X of Y" copy. Falls back to English. */
  nextLabel?: string;
  backLabel?: string;
  stepLabel?: string; // pattern: "Step {n} of {total}"
}

export function DrawHelpModal({
  open,
  onClose,
  title,
  steps,
  closeCta,
  nextLabel = "Next",
  backLabel = "Back",
  stepLabel = "Step {n} of {total}",
}: DrawHelpModalProps) {
  const [index, setIndex] = useState(0);

  // Reset to step 0 every time the modal is reopened.
  useEffect(() => {
    if (open) setIndex(0);
  }, [open]);

  if (!open) return null;
  const step = steps[index];
  const total = steps.length;
  const isLast = index === total - 1;
  const isFirst = index === 0;
  const indicator = stepLabel
    .replace("{n}", String(index + 1))
    .replace("{total}", String(total));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          "relative w-full max-w-[520px] rounded-md bg-paper shadow-card-lg",
          "border border-navy/20"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-pill text-steel hover:bg-navy/5 hover:text-navy"
          aria-label="Close"
        >
          <X size={18} strokeWidth={2.5} />
        </button>

        <div className="px-7 pb-7 pt-8">
          <Eyebrow>{indicator}</Eyebrow>
          <h3 className="mt-3 font-display text-[28px] font-bold uppercase leading-[1.05] tracking-[0.01em] text-navy">
            {title}
          </h3>

          {/* Step content */}
          <div className="mt-6 flex gap-4">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-pill border-2 border-brick bg-paper font-display text-[16px] font-bold text-brick">
              {index + 1}
            </span>
            <div>
              <div className="font-display text-[16px] font-semibold uppercase tracking-eyebrow text-navy">
                {step.title}
              </div>
              <p className="mt-2 font-body text-[14.5px] leading-[1.55] text-char">
                {step.body}
              </p>
            </div>
          </div>

          {/* Step dots */}
          <div className="mt-7 flex items-center justify-center gap-2">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIndex(i)}
                aria-label={`Go to step ${i + 1}`}
                aria-current={i === index ? "step" : undefined}
                className={cn(
                  "h-2 rounded-pill transition-all",
                  i === index
                    ? "w-6 bg-brick"
                    : "w-2 bg-steel-soft hover:bg-steel"
                )}
              />
            ))}
          </div>

          {/* Nav row */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={isFirst}
              className={cn(
                "flex h-11 items-center gap-2 rounded-sm px-4",
                "font-display text-[12px] font-semibold uppercase tracking-eyebrow",
                isFirst
                  ? "cursor-not-allowed text-steel-soft"
                  : "text-steel hover:bg-navy/5 hover:text-navy"
              )}
            >
              <ArrowLeft size={14} strokeWidth={2.5} />
              {backLabel}
            </button>

            <button
              type="button"
              onClick={() => (isLast ? onClose() : setIndex((i) => i + 1))}
              className={cn(
                "flex h-12 items-center gap-2 rounded-sm bg-brick px-6",
                "font-display text-[13px] font-semibold uppercase tracking-eyebrow text-cream",
                "transition-colors hover:bg-brick-deep"
              )}
            >
              {isLast ? closeCta : nextLabel}
              {!isLast && <ArrowRight size={14} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
