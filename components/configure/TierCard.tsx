import { Check } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";

interface Props {
  tier: "good" | "better" | "best";
  description: string;
  pricePerLfCents: number;
  specBullets: string[];
  selected: boolean;
  onSelect: () => void;
}

const TIER_LABELS = {
  good: "Good",
  better: "Better",
  best: "Best",
} as const;

export function TierCard({
  tier,
  description,
  pricePerLfCents,
  specBullets,
  selected,
  onSelect,
}: Props) {
  const popular = tier === "better";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "relative flex w-full flex-col rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-accent bg-accent/5 shadow-sm ring-2 ring-accent/30"
          : "border-navy/10 bg-white hover:border-navy/30"
      )}
    >
      {popular && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
          Most popular
        </div>
      )}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-bold uppercase tracking-wider text-navy/60">
            {TIER_LABELS[tier]}
          </div>
          <div className="mt-1 text-sm text-navy/80">{description}</div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums text-navy">
            {formatCents(pricePerLfCents)}
          </div>
          <div className="text-xs text-navy/60">per LF</div>
        </div>
      </div>
      <ul className="mt-3 space-y-1">
        {specBullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-1.5 text-xs text-navy/70">
            <Check
              size={14}
              className={cn(
                "mt-0.5 flex-shrink-0",
                selected ? "text-accent" : "text-navy/40"
              )}
            />
            <span>{bullet}</span>
          </li>
        ))}
      </ul>
    </button>
  );
}
