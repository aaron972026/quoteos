import { DoorOpen, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GateType } from "@/lib/pricing/types";

interface SizeOption {
  type: GateType;
  label: string;
  sublabel: string;
}

const SIZES: SizeOption[] = [
  { type: "SW-4", label: "4'", sublabel: "Single walk" },
  { type: "SW-5", label: "5'", sublabel: "Single walk" },
  { type: "DD-10", label: "10'", sublabel: "Double drive" },
  { type: "DD-12", label: "12'", sublabel: "Double drive" },
  { type: "DD-14", label: "14'", sublabel: "Double drive" },
];

interface Props {
  lineExists: boolean;
  placementMode: boolean;
  pendingPoint: { lat: number; lng: number } | null;
  gateCount: number;
  onEnter: () => void;
  onCancelMode: () => void;
  onPickSize: (type: GateType) => void;
  onCancelSize: () => void;
}

export function GatePlacer({
  lineExists,
  placementMode,
  pendingPoint,
  gateCount,
  onEnter,
  onCancelMode,
  onPickSize,
  onCancelSize,
}: Props) {
  return (
    <>
      <button
        type="button"
        onClick={placementMode ? onCancelMode : onEnter}
        disabled={!lineExists}
        className={cn(
          "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
          placementMode
            ? "border-accent bg-accent text-navy"
            : "border-navy/15 bg-white text-navy/80 hover:border-navy/30"
        )}
        aria-pressed={placementMode}
      >
        <DoorOpen size={16} />
        {placementMode ? "Cancel" : "Add gate"}
        {gateCount > 0 && !placementMode && (
          <span className="ml-1 rounded-full bg-accent/20 px-1.5 text-xs">
            {gateCount}
          </span>
        )}
      </button>

      {placementMode && !pendingPoint && (
        <div className="pointer-events-none fixed left-1/2 top-20 z-30 -translate-x-1/2 rounded-full bg-navy px-4 py-2 text-sm font-medium text-white shadow-lg">
          Tap a point on your fence to drop a gate
        </div>
      )}

      {pendingPoint && (
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-navy/15 bg-white shadow-2xl"
          role="dialog"
          aria-label="Choose gate size"
        >
          <div className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-navy">
                  Pick a gate size
                </div>
                <div className="text-xs text-navy/60">
                  We&rsquo;ll drop it where you tapped.
                </div>
              </div>
              <button
                type="button"
                onClick={onCancelSize}
                aria-label="Cancel gate placement"
                className="rounded-full p-1 text-navy/60 hover:bg-navy/5"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {SIZES.map((s) => (
                <button
                  key={s.type}
                  type="button"
                  onClick={() => onPickSize(s.type)}
                  className="flex flex-col items-center rounded-lg border border-navy/15 bg-white px-3 py-3 hover:border-accent hover:bg-accent/5"
                >
                  <Plus size={14} className="text-accent" />
                  <span className="mt-0.5 text-lg font-bold text-navy">
                    {s.label}
                  </span>
                  <span className="text-[10px] text-navy/60">{s.sublabel}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
