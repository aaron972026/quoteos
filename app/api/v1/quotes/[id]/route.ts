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
import { loadPricingConfig } from "@/lib/pricing/load-config";
import { PricingError, type GateType, type DemoType } from "@/lib/pricing/types";
import { sendPriceHoldEmail } from "@/lib/email/price-hold";
import { getDict } from "@/lib/i18n/server";

const GateSchema = z.object({
  type: z.enum(["W3", "W4", "W5", "D10", "D12", "D16"]),
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
  demo_lf: z.number().min(0).max(10000).optional(),
  sku_code: z.string().min(2).max(16).optional(),
  height_upgrade: z.boolean().optional(),
  french_gothic: z.boolean().optional(),
  stain_seal: z.boolean().optional(),
  ironclad: z.boolean().optional(),
  board_on_board: z.boolean().optional(),
  steel_post_upgrade: z.boolean().optional(),
  cap_rail_trim: z.boolean().optional(),
  match_vinyl_posts: z.boolean().optional(),
  rock_drilling_posts: z.number().int().min(0).max(500).optional(),
  tear_concrete_posts: z.number().int().min(0).max(500).optional(),
  difficult_access: z.boolean().optional(),
  city: z.string().min(2).max(64).optional(),
  gates: z.array(GateSchema).max(10).optional(),
  ownership: z.enum(["owner", "consent"]).optional(),
  // Free "hold my price" lane. Only 'price_hold' is client-settable; the
  // 'reserved' lane is stamped server-side in the lock-in route. The expiry
  // is computed on the server (never trusted from the client) — see below.
  commitment_lane: z.enum(["price_hold"]).optional(),
  // Captured on the hold modal when we don't already have the customer's
  // email. Stored + sent the written-hold confirmation.
  hold_email: z.string().email().max(256).optional(),
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

    const [existing] = await db
      .select()
      .from(quotes)
      .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
      .limit(1);
    if (!existing) return notFound("Quote not found");
    if (existing.status === "deposit_paid" || existing.status === "won") {
      return badRequest("LOCKED", "Quote is locked and cannot be modified");
    }

    // Merge body with existing row so pricing computes from the full picture.
    // The /configure screen sends sku/addons; LF/slope/demo/gates were saved on /draw.
    const merged = {
      sku_code: d.sku_code ?? existing.skuCode,
      linear_feet:
        d.linear_feet ??
        (existing.linearFeet != null ? Number(existing.linearFeet) : null),
      corner_count: d.corner_count ?? existing.cornerCount ?? 0,
      slope_code: d.slope_code ?? existing.slopeCode,
      demo_type: d.demo_type ?? existing.demoType,
      stain_seal: d.stain_seal ?? !!existing.stainSeal,
      ironclad: d.ironclad ?? false,
      board_on_board: d.board_on_board ?? false,
      steel_post_upgrade: d.steel_post_upgrade ?? false,
      cap_rail_trim: d.cap_rail_trim ?? false,
      match_vinyl_posts: d.match_vinyl_posts ?? false,
      difficult_access: d.difficult_access ?? false,
      rock_drilling_posts: d.rock_drilling_posts ?? 0,
      tear_concrete_posts: d.tear_concrete_posts ?? 0,
      city: d.city ?? existing.city ?? "Tulsa",
      gates:
        d.gates ??
        (existing.gates as Array<{ type: GateType; count: number }> | null) ??
        [],
    };

    let pricingPatch: Partial<typeof quotes.$inferInsert> = {};
    const hasPricingInputs =
      merged.sku_code &&
      merged.linear_feet != null &&
      merged.slope_code != null &&
      merged.demo_type;

    if (hasPricingInputs) {
      try {
        const config = await loadPricingConfig();
        const priced = calculatePrice(
          {
            sku_code: merged.sku_code!,
            linear_feet: merged.linear_feet!,
            corner_count: merged.corner_count,
            slope_code: merged.slope_code!,
            demo_type: merged.demo_type as DemoType,
            gates: merged.gates.map((g) => ({ type: g.type, count: g.count })),
            stain_seal: merged.stain_seal,
            ironclad: merged.ironclad,
            board_on_board: merged.board_on_board,
            steel_post_upgrade: merged.steel_post_upgrade,
            cap_rail_trim: merged.cap_rail_trim,
            match_vinyl_posts: merged.match_vinyl_posts,
            difficult_access: merged.difficult_access,
            rock_drilling_posts: merged.rock_drilling_posts,
            tear_concrete_posts: merged.tear_concrete_posts,
            city: merged.city,
          },
          config
        );
        // Map new engine result → existing DB columns. The legacy tier-tier
        // columns get the same final price (the table will be cleaned up in
        // a future schema slice). `subtotalCents` carries the customer-facing
        // total = `final_price_cents`.
        pricingPatch = {
          subtotalCents: priced.final_price_cents,
          tierGoodCents: priced.final_price_cents,
          tierBetterCents: priced.final_price_cents,
          tierBestCents: priced.final_price_cents,
          selectedTierCents: priced.final_price_cents,
          depositCents: priced.deposit_cents,
          monthly24moCents: priced.monthly_24mo_cents,
          priceValidUntil: new Date(priced.valid_until),
          estimatedMaterialCostCents: priced.internal_margin.material_cost_cents,
          estimatedSubCostCents: priced.internal_margin.labor_cost_cents,
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

    // Compute the hold expiry once so the DB write and the email agree.
    const isPriceHold = d.commitment_lane === "price_hold";
    const holdExpiry = isPriceHold
      ? new Date(Date.now() + 14 * 86_400_000)
      : null;

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
        // tier column is legacy — pricing v2 uses SKU code as the variant.
        heightUpgrade: d.height_upgrade,
        frenchGothic: d.french_gothic,
        stainSeal: d.stain_seal,
        steelPostUpgrade: d.steel_post_upgrade,
        capRailTrim: d.cap_rail_trim,
        matchVinylPosts: d.match_vinyl_posts,
        ironclad: d.ironclad,
        boardOnBoard: d.board_on_board,
        gates: d.gates,
        ...(d.ownership !== undefined
          ? {
              ownership: d.ownership,
              ownershipConfirmedAt: new Date(),
            }
          : {}),
        // Free price-hold lane: server sets the 14-day expiry; reserved-week
        // stays null (that anchor only exists for the paid reservation lane).
        // hold_email, when supplied by the capture modal, becomes the contact.
        ...(isPriceHold
          ? {
              commitmentLane: "price_hold",
              priceHoldExpiresAt: holdExpiry!,
              reservedWeekStart: null,
              ...(d.hold_email ? { customerEmail: d.hold_email } : {}),
            }
          : {}),
        ...pricingPatch,
        updatedAt: new Date(),
      })
      .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)));

    // Written-hold confirmation email — fire-and-forget so the hold write
    // never waits on Resend. Stamp hold_email_sent_at only on success so a
    // failed send can be retried (or picked up by GHL).
    const holdEmail = isPriceHold
      ? d.hold_email ?? existing.customerEmail
      : null;
    if (isPriceHold && holdEmail && holdExpiry) {
      const priceCents =
        pricingPatch.selectedTierCents ??
        existing.selectedTierCents ??
        existing.subtotalCents ??
        null;
      const origin = (
        process.env.NEXT_PUBLIC_SITE_URL ??
        `${req.headers.get("x-forwarded-proto") ?? "https"}://${req.headers.get("host")}`
      ).replace(/\/$/, "");
      sendPriceHoldEmail({
        quoteId: params.id,
        to: holdEmail,
        priceCents,
        addressLine: existing.addressLine,
        city: existing.city,
        state: existing.state,
        zip: existing.zip,
        expiresAt: holdExpiry,
        locale: getDict().locale,
        origin,
        ironclad: d.ironclad ?? existing.ironclad ?? false,
      })
        .then((sent) => {
          if (sent) {
            return db
              .update(quotes)
              .set({ holdEmailSentAt: new Date() })
              .where(eq(quotes.id, params.id));
          }
        })
        .catch((e) => console.error("[hold-email] post-send stamp failed", e));
    }

    return ok({ id: params.id, updated: true });
  } catch (err) {
    console.error("quotes PATCH error", err);
    return serverError();
  }
}
