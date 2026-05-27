import { Check } from "lucide-react";
import { cn, formatCents } from "@/lib/utils";
import { FenceSketch } from "./FenceSketch";

interface Props {
  family: string;
  familyName: string;
  startingAtCents: number;
  description: string;
  selected: boolean;
  onSelect: () => void;
  fromLabel?: string;
  perLF?: string;
}

export function FamilyCard({
  family,
  familyName,
  startingAtCents,
  description,
  selected,
  onSelect,
  fromLabel = "FROM",
  perLF = "/LF",
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex w-full flex-col rounded-sm border p-5 text-left transition-all",
        selected
          ? "border-navy bg-cream shadow-card-lg ring-2 ring-brass/40"
          : "border-navy/15 bg-paper hover:border-navy/40"
      )}
    >
      {selected && (
        <span className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-pill bg-brass text-navy shadow-card-lg">
          <Check size={14} strokeWidth={3} />
        </span>
      )}

      <div
        className={cn(
          "mb-4 flex h-[60px] w-[80px] items-center justify-center rounded-sm border",
          selected ? "border-navy/30 bg-paper text-navy" : "border-navy/15 bg-navy/5 text-navy/60"
        )}
      >
        <FenceSketch family={family} />
      </div>

      <div className="font-display text-[13px] font-semibold uppercase tracking-eyebrow text-navy">
        {familyName}
      </div>
      <p className="mt-2 line-clamp-2 font-body text-[12.5px] leading-[1.45] text-steel">
        {description}
      </p>

      <div className="mt-4 flex items-baseline gap-2">
        <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
          {fromLabel}
        </span>
        <span className="font-display text-[20px] font-bold tabular-nums text-brick">
          {formatCents(startingAtCents)}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-spec text-steel">
          {perLF}
        </span>
      </div>
    </button>
  );
}
