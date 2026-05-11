import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  badRequest,
  fromZod,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import { calculatePrice } from "@/lib/pricing/engine";
import { PricingError } from "@/lib/pricing/types";

const GateSchema = z.object({
  type: z.enum(["SW-4", "SW-5", "DD-10", "DD-12", "DD-14"]),
  count: z.number().int().min(0).max(20),
  position: z.object({ lat: z.number(), lng: z.number() }).optional(),
});

const PatchBody = z.object({
  geometry: z.unknown().optional(),
  linear_feet: z.number().positive().max(10000).optional(),
  corner_count: z.number().int().min(0).max(100).optional(),
  slope_code: z.number().int().min(0).max(4).optional(),
  slope_self_reported: z.boolean().optional(),
  demo_required: z.boolean().optional(),
  demo_type: z.enum(["NONE", "CEDAR", "CHAIN", "METAL", "CONC"]).optional(),
  sku_code: z.string().min(2).max(16).optional(),
  tier: z.enum(["good", "better", "best"]).optional(),
  height_upgrade: z.boolean().optional(),
  french_gothic: z.boolean().optional(),
  stain_seal: z.boolean().optional(),
  gates: z.array(GateSchema).max(10).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);

  if (!row) return notFound("Quote not found");

  // Strip internal-margin fields from client response
  const safe = { ...row };
  delete (safe as Partial<typeof row>).estimatedMaterialCostCents;
  delete (safe as Partial<typeof row>).estimatedSubCostCents;
  delete (safe as Partial<typeof row>).estimatedGrossMarginPct;
  delete (safe as Partial<typeof row>).marginFlag;
  return ok(safe);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(
    `quote-update:${sid}`,
    LIMITS.QUOTE_SAVE.max,
    LIMITS.QUOTE_SAVE.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  try {
    const json = await req.json().catch(() => null);
    if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");
    const parsed = PatchBody.safeParse(json);
    if (!parsed.success) return fromZod(parsed.error);
    const d = parsed.data;

    // Confirm ownership + load the existing row in full. We need it both to
    // gate locked statuses AND to merge with the PATCH body so we can compute
    // pricing using whatever fields are now available — Screen 4 only sends
    // sku/tier/addons in the body, but linear_feet/corner_count/slope_code/
    // demo_type were saved on Screen 3 and are already on the row.
    const [existing] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
      .limit(1);
    if (!existing) return notFound("Quote not found");
    if (existing.status === "deposit_paid" || existing.status === "won") {
      return badRequest("LOCKED", "Quote is locked and cannot be modified");
    }

    // Merge body with existing row so pricing computes from the full picture
    const merged = {
      sku_code: d.sku_code ?? existing.skuCode,
      linear_feet:
        d.linear_feet ??
        (existing.linearFeet != null ? Number(existing.linearFeet) : null),
      corner_count: d.corner_count ?? existing.cornerCount,
      slope_code: d.slope_code ?? existing.slopeCode,
      demo_type: d.demo_type ?? existing.demoType,
      height_upgrade: d.height_upgrade ?? !!existing.heightUpgrade,
      french_gothic: d.french_gothic ?? !!existing.frenchGothic,
      stain_seal: d.stain_seal ?? !!existing.stainSeal,
      gates:
        d.gates ??
        (existing.gates as
          | Array<{ type: "SW-4" | "SW-5" | "DD-10" | "DD-12" | "DD-14"; count: number }>
          | null) ??
        [],
    };

    // If we have enough info, compute pricing snapshot inline
    let pricingPatch: Partial<typeof quotes.$inferInsert> = {};
    const hasPricingInputs =
      merged.sku_code &&
      merged.linear_feet != null &&
      merged.corner_count != null &&
      merged.slope_code != null &&
      merged.demo_type;

    if (hasPricingInputs) {
      try {
        const priced = calculatePrice({
          sku_code: merged.sku_code!,
          linear_feet: merged.linear_feet!,
          corner_count: merged.corner_count!,
          slope_code: merged.slope_code!,
          demo_type: merged.demo_type!,
          gates: merged.gates.map((g) => ({ type: g.type, count: g.count })),
          height_upgrade: merged.height_upgrade,
          french_gothic: merged.french_gothic,
          stain_seal: merged.stain_seal,
        });
        pricingPatch = {
          subtotalCents: priced.subtotal_cents,
          tierGoodCents: priced.tiers.good.total_cents,
          tierBetterCents: priced.tiers.better.total_cents,
          tierBestCents: priced.tiers.best.total_cents,
          depositCents: priced.deposit_cents,
          monthly24moCents: priced.tiers.better.monthly_24mo_cents,
          priceValidUntil: new Date(priced.valid_until),
          estimatedMaterialCostCents: priced.internal_margin.material_cost_cents,
          estimatedSubCostCents: priced.internal_margin.sub_labor_cost_cents,
          estimatedGrossMarginPct: priced.internal_margin.gross_margin_pct.toString(),
          marginFlag: priced.internal_margin.margin_flag,
        };
      } catch (err) {
        if (err instanceof PricingError) {
          return badRequest(err.code, err.message);
        }
        throw err;
      }
    }

    await db
      .update(quotes)
      .set({
        geometry: d.geometry as object | undefined,
        linearFeet: d.linear_feet?.toString(),
        cornerCount: d.corner_count,
        slopeCode: d.slope_code,
        slopeSelfReported: d.slope_self_reported,
        demoRequired: d.demo_required,
        demoType: d.demo_type,
        skuCode: d.sku_code,
        tier: d.tier,
        heightUpgrade: d.height_upgrade,
        frenchGothic: d.french_gothic,
        stainSeal: d.stain_seal,
        gates: d.gates,
        ...pricingPatch,
        updatedAt: new Date(),
      })
      .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)));

    return ok({ id: params.id, updated: true });
  } catch (err) {
    console.error("quotes PATCH error", err);
    return serverError();
  }
}
