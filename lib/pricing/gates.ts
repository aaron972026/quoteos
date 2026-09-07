import { GATE_MODEL } from "./data";
import type { GateType, NewGateType, PricingGate } from "./types";

/**
 * Map stored dual-shape gates to engine PricingGate[]: new gates keep
 * {type, width_ft}, legacy gates keep {type, count}. Every calculatePrice call
 * site must use this — mapping a new gate to {type, count} drops width_ft and
 * the engine throws INVALID_GATE_WIDTH.
 */
export function toPricingGates(
  gates:
    | Array<{ type?: string; count?: number; width_ft?: number }>
    | null
    | undefined
): PricingGate[] {
  return (gates ?? []).map((g) =>
    g.type === "single" || g.type === "double" || g.type === "sliding"
      ? { type: g.type as NewGateType, width_ft: Number(g.width_ft) }
      : { type: g.type as GateType, count: Number(g.count ?? 0) }
  );
}

/**
 * Gates the locked price promise won't guess at — sliding gates, or new-model
 * gates whose per-leaf width exceeds the priced max. Mirrors the engine's
 * `deferred_gate_count` but works straight off a stored gates array, so the
 * quote page, commitment step, and PDF can all label the "priced at your visit"
 * line without recomputing pricing. Legacy {W3…D16} gates are never deferred.
 */
export function countDeferredGates(
  gates:
    | Array<{ type?: string; width_ft?: number; count?: number }>
    | null
    | undefined
): number {
  if (!gates) return 0;
  return gates.filter(
    (g) =>
      g.type === "sliding" ||
      ((g.type === "single" || g.type === "double") &&
        Number(g.width_ft) > GATE_MODEL.MAX_PRICED_WIDTH_FT)
  ).length;
}
