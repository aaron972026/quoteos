import type { SkuFamily } from "@/lib/pricing/types";
import type { FredObservation } from "@/lib/integrations/fred";
import type { TrackedIndex } from "./registry";

/**
 * Pure functions for turning raw FRED observations into actionable signals.
 * Input contract: observations are newest-first (matches `getFredSeries`
 * default `sort_order=desc`) and may contain nulls — FRED uses "." for
 * missing values which the client coerces to null.
 */

export interface IndexSignal {
  index: TrackedIndex;
  latestValue: number;
  latestDate: string;
  priorValue: number;
  priorDate: string;
  /** MoM percent change as a signed decimal (e.g. 0.045 for +4.5%). */
  changePct: number;
  /** True when `|changePct|` exceeds the registry threshold. */
  flagged: boolean;
}

/**
 * Pick the two most recent observations with real numeric values and
 * compute the MoM percent change. Returns null if we don't have two valid
 * data points (brand-new series, FRED outage, etc.).
 */
export function momChange(
  observations: FredObservation[]
): {
  latest: { value: number; date: string };
  prior: { value: number; date: string };
  changePct: number;
} | null {
  const valid = observations.filter(
    (o): o is { date: string; value: number } =>
      o.value !== null && Number.isFinite(o.value)
  );
  if (valid.length < 2) return null;
  const [latest, prior] = valid;
  if (prior.value === 0) return null; // avoid divide-by-zero in pathological data
  const changePct = (latest.value - prior.value) / prior.value;
  return {
    latest: { value: latest.value, date: latest.date },
    prior: { value: prior.value, date: prior.date },
    changePct,
  };
}

/** Build a signal from observations + the registry entry that owns them. */
export function buildSignal(
  index: TrackedIndex,
  observations: FredObservation[]
): IndexSignal | null {
  const mom = momChange(observations);
  if (!mom) return null;
  return {
    index,
    latestValue: mom.latest.value,
    latestDate: mom.latest.date,
    priorValue: mom.prior.value,
    priorDate: mom.prior.date,
    changePct: mom.changePct,
    flagged: Math.abs(mom.changePct * 100) >= index.thresholdPct,
  };
}

/** Format a signed decimal as "+4.5%" / "-2.1%". */
export function formatChange(changePct: number): string {
  const pct = (changePct * 100).toFixed(1);
  const signed = changePct > 0 ? `+${pct}` : pct;
  return `${signed}%`;
}

/** Collect SKU families touched by any flagged signal. */
export function affectedFamilies(signals: IndexSignal[]): SkuFamily[] {
  const set = new Set<SkuFamily>();
  for (const s of signals) {
    if (!s.flagged) continue;
    for (const f of s.index.families) set.add(f);
  }
  return Array.from(set);
}
