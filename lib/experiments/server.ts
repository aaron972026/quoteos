import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import { assignVariant } from "./assign";
import { activeExperiments, getExperiment } from "./registry";

/**
 * Server-side variant resolution. Reads the current session, returns the
 * variant for `experimentKey`, persisting the assignment to sessions.variants
 * on first call so it never changes for the life of the session — even if
 * the registry weights are tuned later.
 *
 * Returns `null` if:
 *  - there's no session (anonymous landing pages before SessionInit fires)
 *  - the experiment isn't registered
 *  - the experiment is inactive AND the session hasn't been assigned yet
 *    (existing assignments are honored regardless of `active`)
 *
 * Callers should always provide a control fallback for the `null` case.
 */
export async function getVariant(experimentKey: string): Promise<string | null> {
  const sid = await getCurrentSessionId();
  if (!sid) return null;

  const experiment = getExperiment(experimentKey);
  if (!experiment) return null;

  const [row] = await db
    .select({ variants: sessions.variants })
    .from(sessions)
    .where(eq(sessions.id, sid))
    .limit(1);
  if (!row) return null;

  const cached = row.variants?.[experimentKey];
  if (cached) return cached;

  // No cached assignment — only assign when active. If inactive, return null
  // so callers fall back to control without polluting the variants column.
  if (!experiment.active) return null;

  const variant = assignVariant(experiment, sid);
  const merged = { ...(row.variants ?? {}), [experimentKey]: variant };

  // Fire-and-forget the write. Worst case under a race: the same value is
  // written twice. Block-and-wait would just add latency to every page that
  // reads an experiment.
  db.update(sessions)
    .set({ variants: merged })
    .where(eq(sessions.id, sid))
    .catch(() => {});

  return variant;
}

/**
 * Resolve every active experiment in one call. Useful for the client-side
 * hook so it only hits the API once per page load.
 */
export async function getAllVariants(): Promise<Record<string, string>> {
  const sid = await getCurrentSessionId();
  if (!sid) return {};

  const exps = activeExperiments();
  if (exps.length === 0) return {};

  const [row] = await db
    .select({ variants: sessions.variants })
    .from(sessions)
    .where(eq(sessions.id, sid))
    .limit(1);
  if (!row) return {};

  const cached = row.variants ?? {};
  const out: Record<string, string> = {};
  let dirty = false;

  for (const e of exps) {
    if (cached[e.key]) {
      out[e.key] = cached[e.key];
      continue;
    }
    const v = assignVariant(e, sid);
    out[e.key] = v;
    cached[e.key] = v;
    dirty = true;
  }

  if (dirty) {
    db.update(sessions)
      .set({ variants: cached })
      .where(eq(sessions.id, sid))
      .catch(() => {});
  }

  return out;
}
