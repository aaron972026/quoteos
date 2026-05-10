import { Hexagon, Ruler } from "lucide-react";

interface Props {
  linearFeet: number;
  cornerCount: number;
}

export function DrawingHud({ linearFeet, cornerCount }: Props) {
  return (
    <div
      className="pointer-events-none flex items-center justify-center gap-6 bg-white/95 px-4 py-3 backdrop-blur-sm shadow-sm"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        <Ruler size={18} className="text-accent" aria-hidden />
        <span className="text-2xl font-bold tabular-nums text-navy">
          {linearFeet.toFixed(0)}
        </span>
        <span className="text-sm font-medium text-navy/70">LF</span>
      </div>

      <div className="h-6 w-px bg-navy/15" aria-hidden />

      <div className="flex items-center gap-2">
        <Hexagon size={16} className="text-navy/60" aria-hidden />
        <span className="text-lg font-semibold tabular-nums text-navy">
          {cornerCount}
        </span>
        <span className="text-sm font-medium text-navy/70">
          {cornerCount === 1 ? "corner" : "corners"}
        </span>
      </div>
    </div>
  );
}
