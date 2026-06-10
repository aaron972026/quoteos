"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quoteAudit, quotes, skus } from "@/lib/db/schema";
import { calculatePrice } from "@/lib/pricing/engine";
import { loadPricingConfig } from "@/lib/pricing/load-config";
import { PricingError, type GateType } from "@/lib/pricing/types";
import { renderQuotePdf } from "@/lib/pdf/render-quote-pdf";
import { fromAddress, getResend } from "@/lib/integrations/resend";
import { getStripe } from "@/lib/integrations/stripe";

// These actions run behind the /admin Basic Auth middleware. They write
// to quotes DIRECTLY (not through the public PATCH API) because the API
// deliberately blocks locked quotes — admin overrides are exactly the
// case where that lock must be bypassable, and every bypass lands an
// audit row with a required reason.

export interface ActionResult {
  ok: boolean;
  message: string;
}

function fail(message: string): ActionResult {
  return { ok: false, message };
}

function refresh(quoteId: string) {
  revalidatePath("/admin/quotes");
  revalidatePath(`/admin/quotes/${quoteId}`);
}

// ─── Price adjustment ───────────────────────────────────────────────────

export async function adjustQuotePrice(
  formData: FormData
): Promise<ActionResult> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const newTotalRaw = String(formData.get("newTotal") ?? "").replace(
    /[$,\s]/g,
    ""
  );

  if (!quoteId) return fail("Missing quote id.");
  if (!reason) return fail("A reason is required for every price change.");
  const newTotal = Number(newTotalRaw);
  if (!Number.isFinite(newTotal) || newTotal <= 0) {
    return fail("New total must be a positive dollar amount.");
  }
  const afterCents = Math.round(newTotal * 100);

  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!row) return fail("Quote not found.");
  if (row.status === "won") {
    return fail("Quote is marked won — adjust the job in Housecall Pro instead.");
  }

  const beforeCents = row.selectedTierCents ?? row.subtotalCents ?? null;

  await db
    .update(quotes)
    .set({
      subtotalCents: afterCents,
      tierGoodCents: afterCents,
      tierBetterCents: afterCents,
      tierBestCents: afterCents,
      selectedTierCents: afterCents,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  await db.insert(quoteAudit).values({
    quoteId,
    action: "price_adjust",
    reason,
    beforeCents,
    afterCents,
  });

  refresh(quoteId);
  return {
    ok: true,
    message: `Price set to $${(afterCents / 100).toLocaleString("en-US", {
      minimumFractionDigits: 2,
    })}. The customer quote page reflects it immediately — re-send the email so their PDF matches.`,
  };
}

// ─── Re-send quote email ────────────────────────────────────────────────

export async function resendQuoteEmail(
  formData: FormData
): Promise<ActionResult> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const toOverride = String(formData.get("to") ?? "").trim();

  if (!quoteId) return fail("Missing quote id.");

  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!row) return fail("Quote not found.");

  const to = toOverride || row.customerEmail || "";
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return fail("No valid recipient — the quote has no customer email on file.");
  }
  if (!row.skuCode) {
    return fail("Quote has no SKU yet — nothing priceable to send.");
  }

  // Re-derive pricing for the PDF body the same way the customer-facing
  // email route does...
  let priced;
  try {
    const config = await loadPricingConfig();
    priced = calculatePrice(
      {
        sku_code: row.skuCode,
        linear_feet: Number(row.linearFeet ?? 0),
        corner_count: row.cornerCount ?? 0,
        slope_code: row.slopeCode ?? 0,
        demo_type: row.demoType ?? "NONE",
        gates:
          (row.gates as Array<{ type: string; count: number }> | null)?.map(
            (g) => ({ type: g.type as GateType, count: g.count })
          ) ?? [],
        stain_seal: !!row.stainSeal,
        city: row.city ?? "Tulsa",
      },
      config
    );
  } catch (err) {
    if (err instanceof PricingError) return fail(`Pricing failed: ${err.message}`);
    throw err;
  }

  // ...EXCEPT: if an admin override is stored on the row, the stored
  // number wins. Otherwise a re-send after a price adjustment would
  // ship a PDF contradicting the price the customer was promised.
  let finalPriceCents = priced.final_price_cents;
  let displayLow = priced.display_range_low_cents;
  let displayHigh = priced.display_range_high_cents;
  if (
    row.selectedTierCents != null &&
    row.selectedTierCents !== priced.final_price_cents
  ) {
    const swing = priced.display_range_high_cents - priced.display_range_low_cents;
    finalPriceCents = row.selectedTierCents;
    displayHigh = row.selectedTierCents;
    displayLow = Math.max(0, row.selectedTierCents - swing);
  }

  const [sku] = await db
    .select({ familyName: skus.familyName })
    .from(skus)
    .where(eq(skus.code, row.skuCode))
    .limit(1);
  const familyName = sku?.familyName ?? "Fence";

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await renderQuotePdf({
      quoteNumber: row.quoteNumber,
      addressLine: row.addressLine,
      city: row.city,
      state: row.state,
      zip: row.zip,
      linearFeet: Number(row.linearFeet ?? 0),
      cornerCount: row.cornerCount ?? 0,
      skuCode: row.skuCode,
      familyName,
      demoRequired: !!row.demoRequired,
      heightUpgrade: !!row.heightUpgrade,
      frenchGothic: !!row.frenchGothic,
      stainSeal: !!row.stainSeal,
      finalPriceCents,
      displayRangeLowCents: displayLow,
      displayRangeHighCents: displayHigh,
      breakdown: priced.breakdown,
      // Delta between the stored (possibly admin-adjusted) total and the
      // engine derivation — rendered as its own line so the itemized
      // breakdown always sums to the printed Total.
      adjustmentCents: finalPriceCents - priced.final_price_cents,
      validUntil: priced.valid_until,
    });
  } catch (err) {
    console.error("[admin-resend] PDF render failed", err);
    return fail("Could not render the PDF.");
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey || !/^re_[A-Za-z0-9_]{20,}/.test(resendKey)) {
    return fail("RESEND_API_KEY is missing or a placeholder — email is not configured.");
  }

  try {
    const result = await getResend().emails.send({
      from: fromAddress(),
      to,
      subject: `Your FencePros quote — ${familyName} (${row.skuCode})`,
      text: [
        `Thanks for the time you spent on the quote tool.`,
        ``,
        `Attached is an updated PDF of your ${familyName} quote.`,
        `Price is held for 7 days. Lock it in with a $99 refundable deposit anytime.`,
        ``,
        `— FencePros Tulsa`,
      ].join("\n"),
      attachments: [
        {
          filename: `FencePros-Quote-${row.quoteNumber ?? row.id.slice(0, 8)}.pdf`,
          content: pdfBuffer,
        },
      ],
    });
    if (result.error) {
      return fail(`Resend rejected the message: ${result.error.message}`);
    }
  } catch (err) {
    console.error("[admin-resend] send failed", err);
    return fail("Email send failed — check Resend configuration.");
  }

  await db.insert(quoteAudit).values({
    quoteId,
    action: "email_resend",
    reason: null,
    meta: { to },
  });

  refresh(quoteId);
  return { ok: true, message: `Quote PDF sent to ${to}.` };
}

// ─── Refund deposit ─────────────────────────────────────────────────────

export async function refundDeposit(
  formData: FormData
): Promise<ActionResult> {
  const quoteId = String(formData.get("quoteId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!quoteId) return fail("Missing quote id.");
  if (!reason) return fail("A reason is required for every refund.");

  const [row] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);
  if (!row) return fail("Quote not found.");
  if (row.status !== "deposit_paid") {
    return fail(
      `Quote is "${row.status}" — refunds only apply to deposit_paid quotes. Won jobs refund through Housecall Pro.`
    );
  }
  if (!row.stripePaymentIntent) {
    return fail("No Stripe payment intent on file — refund manually in the Stripe dashboard.");
  }

  let refundId: string;
  try {
    const refund = await getStripe().refunds.create({
      payment_intent: row.stripePaymentIntent,
      reason: "requested_by_customer",
      metadata: { quote_id: quoteId, admin_reason: reason.slice(0, 450) },
    });
    refundId = refund.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown error";
    console.error("[admin-refund] stripe refund failed", err);
    return fail(`Stripe refund failed: ${msg}`);
  }

  await db
    .update(quotes)
    .set({ status: "refunded", updatedAt: new Date() })
    .where(eq(quotes.id, quoteId));

  await db.insert(quoteAudit).values({
    quoteId,
    action: "refund",
    reason,
    beforeCents: row.depositCents,
    afterCents: 0,
    meta: { stripeRefundId: refundId },
  });

  refresh(quoteId);
  return {
    ok: true,
    message: `Deposit refunded (${refundId}). Stripe returns the funds in 5–10 business days.`,
  };
}
