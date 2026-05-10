import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCents } from "@/lib/utils";

interface Props {
  family: string;
  familyName: string;
  startingAtCents: number;
  description: string;
  selected: boolean;
  onSelect: () => void;
}

export function FamilyCard({
  familyName,
  startingAtCents,
  description,
  selected,
  onSelect,
}: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all",
        selected
          ? "border-accent bg-accent/5 shadow-sm"
          : "border-navy/10 bg-white hover:border-navy/30"
      )}
    >
      {/* Hero placeholder — swap to actual photos in admin/SKU manager later */}
      <div
        className={cn(
          "h-16 w-16 flex-shrink-0 rounded-lg",
          selected ? "bg-accent/20" : "bg-navy/5"
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-navy">{familyName}</div>
        <div className="truncate text-xs text-navy/60">{description}</div>
        <div className="mt-1 text-sm text-navy/70">
          Starting at{" "}
          <span className="font-semibold text-navy">
            {formatCents(startingAtCents)}
          </span>
          /LF
        </div>
      </div>
      <ChevronRight
        size={20}
        className={cn(
          "flex-shrink-0 transition-colors",
          selected ? "text-accent" : "text-navy/30"
        )}
      />
    </button>
  );
}
