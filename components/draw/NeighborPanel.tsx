"use client";

import { Compass } from "lucide-react";
import type { Direction } from "@/lib/integrations/regrid";

export interface NeighborSummary {
  parcelId: string | null;
  address: string | null;
  direction: Direction;
}

interface Props {
  neighbors: NeighborSummary[];
}

const DIRECTION_LABEL: Record<Direction, string> = {
  N: "North",
  S: "South",
  E: "East",
  W: "West",
  NE: "Northeast",
  NW: "Northwest",
  SE: "Southeast",
  SW: "Southwest",
};

/**
 * Adjacent-property panel. Surfaces "your west boundary borders 123 Main"
 * so the user can think about HOA conversations and shared-fence cost
 * splits while still drawing.
 *
 * Hides entirely when there are no neighbors — no value in showing an
 * empty card.
 */
export function NeighborPanel({ neighbors }: Props) {
  if (!neighbors || neighbors.length === 0) return null;

  // Dedupe by direction — only show the closest neighbor per cardinal/diagonal
  // since Regrid bbox can return overlapping corner parcels.
  const seen = new Set<Direction>();
  const unique: NeighborSummary[] = [];
  for (const n of neighbors) {
    if (seen.has(n.direction)) continue;
    seen.add(n.direction);
    unique.push(n);
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5">
        <Compass size={13} className="text-accent" />
        <div className="text-sm font-medium text-navy">Adjacent properties</div>
      </div>
      <ul className="space-y-1 rounded-lg border border-navy/10 bg-navy/[0.02] px-3 py-2">
        {unique.map((n) => (
          <li
            key={`${n.direction}-${n.parcelId ?? n.address ?? Math.random()}`}
            className="flex items-baseline gap-2 text-xs"
          >
            <span className="inline-flex min-w-[28px] justify-center rounded bg-navy/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
              {n.direction}
            </span>
            <span className="text-navy/80">
              {n.address ?? (
                <span className="italic text-navy/40">
                  unidentified neighbor ({DIRECTION_LABEL[n.direction]})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-navy/45">
        Shared boundaries may need HOA approval or cost-split conversations.
      </p>
    </div>
  );
}
