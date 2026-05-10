import { NextRequest } from "next/server";
import { z } from "zod";
import { calculatePrice, stripInternal } from "@/lib/pricing/engine";
import { PricingError } from "@/lib/pricing/types";
import { badRequest, fromZod, ok, tooManyRequests, serverError } from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";

const GateSchema = z.object({
  type: z.enum(["SW-4", "SW-5", "DD-10", "DD-12", "DD-14"]),
  count: z.number().int().min(0).max(20),
});

const Body = z.object({
  sku_code: z.string().min(2).max(16),
  linear_feet: z.number().positive().max(10000),
  corner_count: z.number().int().min(0).max(100),
  slope_code: z.number().int().min(0).max(4),
  demo_type: z.enum(["NONE", "CEDAR", "CHAIN", "METAL", "CONC"]),
  gates: z.array(GateSchema).max(10),
  height_upgrade: z.boolean().optional(),
  french_gothic: z.boolean().optional(),
  stain_seal: z.boolean().optional(),
  permit_required: z.boolean().optional(),
  hoa_admin: z.boolean().optional(),
  travel_miles_over_25: z.number().min(0).max(200).optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
});

export async function POST(req: NextRequest) {
  // Rate limit by session (or IP if no session yet)
  const sid = await getCurrentSessionId();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limitKey = `pricing:${sid ?? `ip:${ip}`}`;
  const limit = checkLimit(limitKey, LIMITS.PRICING.max, LIMITS.PRICING.windowMs);
  if (!limit.allowed) return tooManyRequests();

  try {
    const json = await req.json().catch(() => null);
    if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");

    const parsed = Body.safeParse(json);
    if (!parsed.success) return fromZod(parsed.error);

    const result = calculatePrice(parsed.data);
    // Strip internal margin block — never returned to public clients
    return ok(stripInternal(result));
  } catch (err) {
    if (err instanceof PricingError) {
      return badRequest(err.code, err.message);
    }
    console.error("pricing/calculate error", err);
    return serverError();
  }
}
