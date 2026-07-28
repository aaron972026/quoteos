import { NextRequest } from "next/server";
import { z } from "zod";
import { calculatePrice, stripInternal } from "@/lib/pricing/engine";
import { loadPricingConfig } from "@/lib/pricing/load-config";
import { PricingError } from "@/lib/pricing/types";
import { badRequest, fromZod, ok, tooManyRequests, serverError } from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";

const GateSchema = z.object({
  type: z.enum(["W3", "W4", "W5", "D10", "D12", "D16"]),
  count: z.number().int().min(0).max(20),
});

const Body = z.object({
  sku_code: z.string().min(2).max(16),
  linear_feet: z.number().positive().max(10000),
  corner_count: z.number().int().min(0).max(100).optional(),
  slope_code: z.number().int().min(0).max(4),
  demo_type: z.enum(["NONE", "CEDAR", "CHAIN", "METAL", "CONC"]),
  demo_lf: z.number().min(0).max(10000).optional(),
  gates: z.array(GateSchema).max(10),
  stain_seal: z.boolean().optional(),
  ironclad: z.boolean().optional(),
  board_on_board: z.boolean().optional(),
  post_type: z.enum(["pt", "cedar", "steel"]).optional(),
  steel_post_upgrade: z.boolean().optional(),
  cap_rail_trim: z.boolean().optional(),
  match_vinyl_posts: z.boolean().optional(),
  rock_drilling_posts: z.number().int().min(0).max(500).optional(),
  tear_concrete_posts: z.number().int().min(0).max(500).optional(),
  difficult_access: z.boolean().optional(),
  city: z.string().min(2).max(64).optional(),
  zip: z.string().regex(/^\d{5}$/).optional(),
});

export async function POST(req: NextRequest) {
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

    const config = await loadPricingConfig();
    const result = calculatePrice(parsed.data, config);
    return ok(stripInternal(result));
  } catch (err) {
    if (err instanceof PricingError) {
      return badRequest(err.code, err.message);
    }
    console.error("pricing/calculate error", err);
    return serverError();
  }
}
