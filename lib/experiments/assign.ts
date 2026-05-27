import { createHash } from "crypto";
import type { Experiment } from "./registry";

/**
 * Deterministic, weighted-random variant assignment.
 *
 * The pair (sessionId, experimentKey) hashes to a 32-bit integer; we map that
 * to [0, totalWeight) and walk the variant list to find the bucket. Two calls
 * with the same inputs always return the same variant, so the assignment is
 * stable without persisting anything — but we DO persist (in sessions.variants)
 * so a downstream change to the registry doesn't surprise an existing session.
 *
 * Pure function, no I/O. Persistence happens in server.ts.
 */

export function assignVariant(
  experiment: Experiment,
  sessionId: string
): string {
  const totalWeight = experiment.variants.reduce(
    (sum, v) => sum + Math.max(0, v.weight),
    0
  );
  if (totalWeight <= 0) {
    // Misconfigured experiment — fall back to first variant rather than throw
    return experiment.variants[0].key;
  }

  // 32-bit unsigned hash → bucket in [0, totalWeight)
  const hash = createHash("sha256")
    .update(`${sessionId}::${experiment.key}`)
    .digest();
  // Read first 4 bytes as uint32
  const bucket =
    ((hash[0] << 24) | (hash[1] << 16) | (hash[2] << 8) | hash[3]) >>> 0;
  const point = (bucket / 0xffffffff) * totalWeight;

  let cumulative = 0;
  for (const v of experiment.variants) {
    cumulative += Math.max(0, v.weight);
    if (point < cumulative) return v.key;
  }
  // Floating-point edge — return the last variant
  return experiment.variants[experiment.variants.length - 1].key;
}
