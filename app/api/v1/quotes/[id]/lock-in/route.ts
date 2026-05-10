import { NextRequest } from "next/server";
import { z } from "zod";
import Stripe from "stripe";
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
import { FINANCING } from "@/lib/pricing/data";

const Body = z.object({
  tier: z.enum(["good", "better", "best"]),
});

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

  const json = await req.json().catch(() => null);
  if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fromZod(parsed.error);
  const { tier } = parsed.data;

  // Confirm ownership + load enough to build the Stripe line item
  const [row] = await db
    .select()
    .from(quotes)
    .where(and(eq(quotes.id, params.id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");
  if (row.status === "deposit_paid" || row.status === "won") {
    return badRequest("ALREADY_LOCKED", "Quote is already locked in");
  }

  const tierTotalCents =
    tier === "good" ? row.tierGoodCents :
    tier === "better" ? row.tierBetterCents :
    row.tierBestCents;
  if (!tierTotalCents) {
    return badRequest("MISSING_PRICING", "Quote pricing has not been computed");
  }

  // Persist the chosen tier + bump status to "finalized"
  await db
    .update(quotes)
    .set({
      tier,
      selectedTierCents: tierTotalCents,
      status: "finalized",
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, params.id));

  // ── Stripe Checkout Session ────────────────────────────────────
  const stripeSecret = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecret) {
    return new Response(
      JSON.stringify({
        error: {
          code: "STRIPE_NOT_CONFIGURED",
          message:
            "STRIPE_SECRET_KEY is not set. Add it to .env.local and restart the dev server.",
        },
      }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const stripe = new Stripe(stripeSecret);
    const origin = siteOrigin(req);
    const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "FencePros — Hold deposit",
              description: `Reserves your ${tierLabel} tier price for ${row.addressLine ?? "your project"}. Refundable for 7 days.`,
            },
            unit_amount: FINANCING.DEPOSIT_CENTS,
          },
          quantity: 1,
        },
      ],
      metadata: {
        quote_id: params.id,
        tier,
        tier_total_cents: String(tierTotalCents),
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
