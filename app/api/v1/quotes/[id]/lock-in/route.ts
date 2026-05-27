import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  badRequest,
  notFound,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import { pushGhl } from "@/lib/integrations/ghl";
import { FINANCING } from "@/lib/pricing/data";

// Pricing v2: SKU IS the variant. The lock-in request no longer needs a tier;
// the price already locked on PATCH /quotes/:id sits on `selectedTierCents`.

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(`lock-in:${sid}`, LIMITS.DEPOSIT.max, LIMITS.DEPOSIT.windowMs);
  if (!limit.allowed) return tooManyRequests();

  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");
  if (row.status === "deposit_paid" || row.status === "won") {
    return badRequest("ALREADY_LOCKED", "Quote is already locked in");
  }

  const totalCents = row.selectedTierCents ?? row.subtotalCents;
  if (!totalCents) {
    return badRequest("MISSING_PRICING", "Quote pricing has not been computed");
  }

  await db
    .update(quotes)
    .set({
      selectedTierCents: totalCents,
      status: "finalized",
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, params.id));

  pushGhl({
    event: "quote_finalized",
    quote_id: params.id,
    customer_email: row.customerEmail,
    customer_phone: row.customerPhone,
    address_line: row.addressLine,
    zip: row.zip,
    linear_feet: row.linearFeet != null ? Number(row.linearFeet) : null,
    sku_code: row.skuCode,
    selected_tier_cents: totalCents,
    price_valid_until: row.priceValidUntil?.toISOString() ?? null,
  });

  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  const looksReal =
    !!stripeSecret && /^sk_(test|live)_[A-Za-z0-9]{20,}/.test(stripeSecret);
  if (!looksReal) {
    return new Response(
      JSON.stringify({
        error: {
          code: "STRIPE_NOT_CONFIGURED",
          message:
            "STRIPE_SECRET_KEY is missing or still the placeholder from .env.example. Get a real test key from https://dashboard.stripe.com/test/apikeys and restart the dev server.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const stripe = new Stripe(stripeSecret);
    const origin = siteOrigin(req);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "FencePros — Hold deposit",
              description: `Reserves your ${row.skuCode ?? "fence"} quote for ${row.addressLine ?? "your project"}. Refundable for 7 days.`,
            },
            unit_amount: FINANCING.DEPOSIT_CENTS,
          },
          quantity: 1,
        },
      ],
      metadata: {
        quote_id: params.id,
        sku_code: row.skuCode ?? "",
        total_cents: String(totalCents),
      },
      success_url: `${origin}/quote/${params.id}/success?cs={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/quote/${params.id}`,
      customer_email: row.customerEmail ?? undefined,
    });

    await db
      .update(quotes)
      .set({ stripePaymentIntent: session.id, updatedAt: new Date() })
      .where(eq(quotes.id, params.id));

    return ok({ checkout_url: session.url, session_id: session.id });
  } catch (err) {
    console.error("Stripe checkout creation failed", err);
    return serverError("Could not start checkout");
  }
}
