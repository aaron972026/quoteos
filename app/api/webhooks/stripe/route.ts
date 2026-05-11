import { NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { STRIPE_EVENTS, getStripe } from "@/lib/integrations/stripe";
import { pushGhl } from "@/lib/integrations/ghl";
import { pushHcpJob } from "@/lib/integrations/hcp";
import { FINANCING } from "@/lib/pricing/data";
import type { Feature, LineString, Polygon } from "geojson";

// Webhook needs raw body for signature verification + node runtime (Stripe SDK is not edge-compatible).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  // Also reject the .env.example placeholder ("whsec_xxx") so a forgotten
  // env doesn't masquerade as a signature mismatch.
  const looksReal = !!secret && /^whsec_[A-Za-z0-9]{20,}/.test(secret);
  if (!looksReal) {
    console.error(
      "[stripe-webhook] STRIPE_WEBHOOK_SECRET is missing or placeholder"
    );
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return new NextResponse("Missing stripe-signature header", { status: 400 });
  }

  // Read raw body — must come BEFORE any parsing; signature is computed
  // against the exact bytes Stripe sent.
  const rawBody = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Signature verification failed";
    console.error("[stripe-webhook] verify failed:", msg);
    return new NextResponse(`Webhook Error: ${msg}`, { status: 400 });
  }

  switch (event.type) {
    case STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED:
      return handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

    case STRIPE_EVENTS.CHECKOUT_SESSION_EXPIRED:
      // Acknowledge but don't act on expiry for now — abandoned-cart workflow
      // will own that signal in a later slice.
      return NextResponse.json({ received: true, processed: false, ignored: event.type });

    default:
      // Stripe expects 2xx for events we don't care about; otherwise it retries.
      return NextResponse.json({ received: true, processed: false, ignored: event.type });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const quoteId = session.metadata?.quote_id;
  if (!quoteId) {
    console.warn(
      `[stripe-webhook] checkout.session.completed session=${session.id} missing metadata.quote_id`
    );
    return NextResponse.json({ received: true, processed: false });
  }
  if (session.payment_status !== "paid") {
    console.info(
      `[stripe-webhook] session=${session.id} payment_status=${session.payment_status}; skipping`
    );
    return NextResponse.json({ received: true, processed: false });
  }

  const [existing] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, quoteId))
    .limit(1);

  if (!existing) {
    console.warn(
      `[stripe-webhook] unknown quote_id=${quoteId} on session=${session.id}`
    );
    return NextResponse.json({ received: true, processed: false });
  }

  // Idempotency: Stripe retries failed deliveries. If we've already advanced
  // this quote, ack and short-circuit instead of double-writing depositPaidAt.
  if (existing.status === "deposit_paid" || existing.status === "won") {
    console.info(
      `[stripe-webhook] quote=${quoteId} already ${existing.status}; idempotent ack`
    );
    return NextResponse.json({ received: true, processed: false, idempotent: true });
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : (session.payment_intent?.id ?? null);

  const customerEmail =
    session.customer_email ?? session.customer_details?.email ?? null;

  await db
    .update(quotes)
    .set({
      status: "deposit_paid",
      depositPaidAt: new Date(),
      stripePaymentIntent: paymentIntentId,
      ...(customerEmail ? { customerEmail } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, quoteId));

  console.info(
    `[stripe-webhook] quote=${quoteId} -> deposit_paid (session=${session.id})`
  );

  // Fire-and-forget GHL push — spec §9 trigger 3 (hot lead — deposit paid)
  pushGhl({
    event: "deposit_paid",
    quote_id: quoteId,
    customer_email: customerEmail,
    address_line: existing.addressLine ?? null,
    selected_tier_cents: existing.selectedTierCents ?? null,
    deposit_cents: FINANCING.DEPOSIT_CENTS,
    stripe_payment_intent: paymentIntentId,
    stage: "Hot Lead — Deposit Paid",
  });

  // Fire-and-forget HCP/Make.com — spec §9 (HCP job spawn after deposit)
  pushHcpJob({
    quote_id: quoteId,
    quote_number: existing.quoteNumber,
    stripe_payment_intent: paymentIntentId,
    deposit_cents: FINANCING.DEPOSIT_CENTS,
    selected_tier_cents: existing.selectedTierCents,
    customer_name:
      existing.customerName ?? session.customer_details?.name ?? null,
    customer_email: customerEmail,
    customer_phone:
      existing.customerPhone ?? session.customer_details?.phone ?? null,
    address_line: existing.addressLine,
    city: existing.city,
    state: existing.state,
    zip: existing.zip,
    lat: existing.lat != null ? Number(existing.lat) : null,
    lng: existing.lng != null ? Number(existing.lng) : null,
    sku_code: existing.skuCode,
    tier: existing.tier,
    linear_feet:
      existing.linearFeet != null ? Number(existing.linearFeet) : null,
    corner_count: existing.cornerCount,
    height_upgrade: !!existing.heightUpgrade,
    french_gothic: !!existing.frenchGothic,
    stain_seal: !!existing.stainSeal,
    demo_required: !!existing.demoRequired,
    demo_type: existing.demoType,
    gates: existing.gates ?? [],
    geometry: existing.geometry as
      | Feature<LineString | Polygon>
      | LineString
      | Polygon
      | null,
  });

  return NextResponse.json({ received: true, processed: true });
}
