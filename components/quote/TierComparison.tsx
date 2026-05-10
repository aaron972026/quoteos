import { Check, Circle } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

type Tier = "good" | "better" | "best";

interface TierTotal {
  total_cents: number;
  monthly_24mo_cents: number;
}

interface Props {
  tiers: { good: TierTotal; better: TierTotal; best: TierTotal };
  selected: Tier;
  onSelect: (tier: Tier) => void;
}

const META: Record<Tier, { label: string; subtitle: string }> = {
  good: { label: "Good", subtitle: "The basics, done right" },
  better: { label: "Better", subtitle: "Our most popular package" },
  best: { label: "Best", subtitle: "Premium, end-to-end" },
};

export function TierComparison({ tiers, selected, onSelect }: Props) {
  return (
    <div role="radiogroup" aria-label="Tier comparison" className="space-y-3">
      {(Object.keys(META) as Tier[]).map((t) => {
        const tier = tiers[t];
        const isSelected = selected === t;
        const isPopular = t === "better";
        const isBest = t === "best";
        return (
          <button
            key={t}
            type="button"
            role="radio"
            aria-checked={isSelected}
            onClick={() => onSelect(t)}
            className={cn(
              "relative flex w-full flex-col rounded-xl border-2 p-5 text-left transition-all",
              isSelected
                ? "border-accent bg-accent/5 shadow-lg"
                : "border-navy/10 bg-white hover:border-navy/30",
              isBest && !isSelected && "border-navy/20"
            )}
          >
            {isPopular && (
              <div className="absolute -top-2.5 left-5 rounded-full bg-accent px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
                Most popular
              </div>
            )}

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                {isSelected ? (
                  <div className="mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent">
                    <Check size={14} className="text-white" />
                  </div>
                ) : (
                  <Circle
                    size={20}
                    className="mt-0.5 flex-shrink-0 text-navy/25"
                  />
                )}
                <div>
                  <div className="text-base font-bold text-navy">
                    {META[t].label}
                  </div>
                  <div className="text-xs text-navy/60">{META[t].subtitle}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold tabular-nums text-navy">
                  {formatCents(tier.total_cents)}
                </div>
                <div className="text-xs text-navy/60">
                  or{" "}
                  <span className="font-semibold text-navy/80">
                    {formatCents(tier.monthly_24mo_cents)}/mo
                  </span>{" "}
                  with Wisetack
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
