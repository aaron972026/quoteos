/**
 * Active experiments — define each one here as a constant. The registry is
 * code-defined (not DB-backed) because experiment definitions change rarely
 * and a code-review touchpoint is the right gate for them.
 *
 * Add a new experiment:
 *  1. Add an entry below — pick a stable `key` (used as cookie / DB key — never
 *     rename, retire instead).
 *  2. List 2+ variants with relative `weight` values. Weights are normalized,
 *     so [50, 50] and [1, 1] behave identically.
 *  3. Use it from server/client code via `getVariant("<key>")` /
 *     `useVariant("<key>")`. Variant for a given session is sticky for the
 *     life of the session (persisted in sessions.variants).
 *
 * Retire an experiment: set `active: false` and leave the entry — keeps
 * historical funnel queries valid. Delete the entry only after the funnel
 * data you care about has aged out.
 */

export interface Variant {
  /** Stable identifier for the variant. Never rename. */
  key: string;
  /** Human label for admin/analytics views. */
  label: string;
  /** Relative weight; auto-normalized against sibling weights. */
  weight: number;
}

export interface Experiment {
  /** Stable experiment identifier. Used as registry key + sessions.variants[key]. */
  key: string;
  /** Human label. */
  name: string;
  /** Short description of the hypothesis being tested. */
  hypothesis?: string;
  variants: [Variant, Variant, ...Variant[]];
  /** When false, new sessions are not assigned; sessions already assigned keep their variant. */
  active: boolean;
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    key: "address_cta_copy",
    name: "Address page CTA copy",
    variants: [
      { key: "control", label: "Yes, that's my home", weight: 1 },
      { key: "variant", label: "Get my free quote", weight: 1 },
    ],
    active: true,
  },
];

export function getExperiment(key: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.key === key);
}

export function activeExperiments(): Experiment[] {
  return EXPERIMENTS.filter((e) => e.active);
}
