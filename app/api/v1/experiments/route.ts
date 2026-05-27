import { NextRequest } from "next/server";
import { ok, tooManyRequests, unauthorized } from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import { getAllVariants } from "@/lib/experiments/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/experiments — returns `{ [experimentKey]: variantKey }` for all
 * active experiments, with the current session's sticky assignment. Used by
 * the `useVariant` client hook on initial mount.
 */
export async function GET(req: NextRequest) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  // Cheap query but lots of pages could call it on mount — gate with the
  // standard pricing-tier limit (30/min) keyed on session.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limit = checkLimit(
    `experiments:${sid ?? `ip:${ip}`}`,
    LIMITS.PRICING.max,
    LIMITS.PRICING.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  const variants = await getAllVariants();
  return ok({ variants });
}
