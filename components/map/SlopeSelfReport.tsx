import { cn } from "@/lib/utils";

export interface DetectedSlope {
  slope_code: number;
  max_grade_pct: number;
  resolved_samples: number;
  total_samples: number;
}

interface Props {
  value: number;
  onChange: (v: 0 | 2) => void;
  detected?: DetectedSlope | null;
  detecting?: boolean;
}

const SLOPE_LABEL: Record<number, string> = {
  0: "Flat",
  1: "Mild",
  2: "Moderate",
  3: "Severe",
  4: "Extreme",
};

export function SlopeSelfReport({ value, onChange, detected, detecting }: Props) {
  const opts: Array<{ v: 0 | 2; label: string; desc: string }> = [
    { v: 0, label: "Mostly flat", desc: "<10% grade" },
    { v: 2, label: "It's hilly", desc: "Steep yard" },
  ];
  // Map any slope_code 0..4 to the binary buttons: 0/1 -> flat, 2..4 -> hilly.
  const flatSelected = value <= 1;
  const detectedConfident =
    !!detected && detected.resolved_samples >= 2;

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <div className="text-sm font-medium text-navy">Yard slope</div>
        {detecting && (
          <div className="text-[10px] text-navy/40">Detecting…</div>
        )}
        {!detecting && detectedConfident && (
          <div className="text-[10px] text-navy/50">
            Detected:{" "}
            <span className="font-semibold text-navy/80">
              {SLOPE_LABEL[detected.slope_code]}
            </span>
            {" · "}
            {detected.max_grade_pct.toFixed(1)}%
          </div>
        )}
      </div>
      <div role="radiogroup" className="flex gap-2">
        {opts.map((o) => {
          const isSelected =
            (o.v === 0 && flatSelected) || (o.v === 2 && !flatSelected);
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(o.v)}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2.5 text-left transition-colors",
                isSelected
                  ? "border-accent bg-accent/10 text-navy"
                  : "border-navy/15 bg-white text-navy/70 hover:border-navy/30"
              )}
            >
              <div className="text-sm font-semibold">{o.label}</div>
              <div className="text-xs text-navy/50">{o.desc}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
