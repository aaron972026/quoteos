import { NextRequest } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, skus } from "@/lib/db/schema";
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
import { renderQuotePdf } from "@/lib/pdf/render-quote-pdf";
import { fromAddress, getResend } from "@/lib/integrations/resend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(256),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(`email-quote:${sid}`, LIMITS.QUOTE_SAVE.max, LIMITS.QUOTE_SAVE.windowMs);
  if (!limit.allowed) return tooManyRequests();

  const json = await req.json().catch(() => null);
  if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fromZod(parsed.error);
  const { email } = parsed.data;

  // Confirm ownership + load enough to render the PDF
  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");
  if (!row.skuCode) {
    return badRequest("INCOMPLETE_QUOTE", "Quote is missing a SKU — finish /configure first");
  }

  // Re-derive pricing snapshot for the PDF — keeps the rendered numbers
  // consistent with whatever the engine currently computes for this input.
  let priced;
  try {
    priced = calculatePrice({
      sku_code: row.skuCode,
      linear_feet: Number(row.linearFeet ?? 0),
      corner_count: row.cornerCount ?? 0,
      slope_code: row.slopeCode ?? 0,
      demo_type: row.demoType ?? "NONE",
      gates:
        (row.gates as Array<{ type: string; count: number }> | null)?.map((g) => ({
          type: g.type as "SW-4" | "SW-5" | "DD-10" | "DD-12" | "DD-14",
          count: g.count,
        })) ?? [],
      height_upgrade: !!row.heightUpgrade,
      french_gothic: !!row.frenchGothic,
      stain_seal: !!row.stainSeal,
    });
  } catch (err) {
    if (err instanceof PricingError) return badRequest(err.code, err.message);
    throw err;
  }

  // Pull SKU meta for the family name
  const [sku] = await db
    .select({ familyName: skus.familyName })
    .from(skus)
    .where(eq(skus.code, row.skuCode))
    .limit(1);
  const familyName = sku?.familyName ?? "Fence";

  // Render PDF
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
      familyName,
      selectedTier: row.tier ?? "better",
      demoRequired: !!row.demoRequired,
      heightUpgrade: !!row.heightUpgrade,
      frenchGothic: !!row.frenchGothic,
      stainSeal: !!row.stainSeal,
      tiers: priced.tiers,
      breakdown: {
        base_fence: priced.breakdown.base_fence,
        height_upgrade: priced.breakdown.height_upgrade,
        french_gothic: priced.breakdown.french_gothic,
        stain: priced.breakdown.stain,
        demo: priced.breakdown.demo,
        corners: priced.breakdown.corners,
        gates: priced.breakdown.gates,
      },
      validUntil: priced.valid_until,
    });
  } catch (err) {
    console.error("[email-quote] PDF render failed", err);
    return serverError("Could not render PDF");
  }

  // Send via Resend (returns 503 with a clear message if API key missing
  // or still the .env.example placeholder "re_xxx").
  const resendKey = process.env.RESEND_API_KEY;
  const resendConfigured =
    !!resendKey && /^re_[A-Za-z0-9_]{20,}/.test(resendKey);
  if (!resendConfigured) {
    return new Response(
      JSON.stringify({
        error: {
          code: "RESEND_NOT_CONFIGURED",
          message:
            "RESEND_API_KEY is missing or still the placeholder from .env.example. Create a real key at https://resend.com/api-keys and restart the dev server.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const tierLabel =
      (row.tier ?? "better").charAt(0).toUpperCase() + (row.tier ?? "better").slice(1);
    const subject = `Your FencePros quote — ${familyName} ${tierLabel}`;
    // Resend's emails.send returns { data, error } and does NOT always throw
    // on API rejection (unverified sender, blocked recipient, etc). Treat a
    // non-null `error` as failure so the route doesn't say "sent" for a
    // message that never left Resend.
    const result = await getResend().emails.send({
      from: fromAddress(),
      to: email,
      subject,
      text: [
        `Thanks for the time you spent on the quote tool.`,
        ``,
        `Attached is a PDF of your ${familyName} ${tierLabel} quote.`,
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
      console.error("[email-quote] Resend rejected", {
        to: email,
        from: fromAddress(),
        error: result.error,
      });
      return serverError(
        `Email send failed: ${result.error.message ?? result.error.name ?? "unknown reason"}`
      );
    }
    console.info("[email-quote] sent", { id: result.data?.id, to: email });
  } catch (err) {
    console.error("[email-quote] Resend send threw", err);
    return serverError("Could not send email");
  }

  // Persist captured email on the quote
  await db
    .update(quotes)
    .set({ customerEmail: email, updatedAt: new Date() })
    .where(eq(quotes.id, params.id));

  return ok({ sent: true, to: email });
}
