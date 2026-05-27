"use client";

import { useEffect, useState } from "react";

/**
 * Client-side variant hook. Returns the sticky variant for `experimentKey`
 * (or null while still loading / no session / experiment not registered).
 *
 * Backed by a single per-page `/api/v1/experiments` call — multiple components
 * using the hook on the same page share one fetch via the in-memory promise
 * cache below. The result is keyed by session cookie (server-side) so an
 * incognito tab gets a fresh assignment.
 *
 * Callers should always provide a control fallback for the loading + null
 * cases:
 *
 *   const v = useVariant("address_cta_copy");
 *   const label =
 *     v === "variant" ? "Get my free quote" : "Yes, that's my home";
 */

type VariantMap = Record<string, string>;

// Module-level cache. Survives across components within the same page load
// (i.e. same JS bundle), invalidated by full navigation / refresh.
let cached: VariantMap | null = null;
let inflight: Promise<VariantMap> | null = null;

async function loadVariants(): Promise<VariantMap> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = fetch("/api/v1/experiments", { credentials: "include" })
    .then(async (r) => {
      if (!r.ok) return {};
      const body = (await r.json().catch(() => null)) as
        | { variants?: VariantMap }
        | null;
      return body?.variants ?? {};
    })
    .catch(() => ({}))
    .then((v) => {
      cached = v;
      inflight = null;
      return v;
    });
  return inflight;
}

/** Single-experiment hook. Returns the variant key, or null while loading. */
export function useVariant(experimentKey: string): string | null {
  const [variant, setVariant] = useState<string | null>(
    cached ? cached[experimentKey] ?? null : null
  );

  useEffect(() => {
    let cancelled = false;
    loadVariants().then((map) => {
      if (!cancelled) setVariant(map[experimentKey] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [experimentKey]);

  return variant;
}

/** Test-only — wipes the in-memory variant cache. */
export function __resetVariantCache(): void {
  cached = null;
  inflight = null;
}
