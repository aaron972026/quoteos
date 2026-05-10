/**
 * GoHighLevel inbound-webhook push. Three event types per spec §9:
 *   quote_started   → "POST anonymous lead to GHL" (Screen 2)
 *   quote_finalized → "Update GHL contact" (Screen 5)
 *   deposit_paid    → "Stage: Hot Lead — Deposit Paid" (Stripe webhook)
 *
 * GHL's inbound webhook returns a generic 200 with no contact_id, so we
 * can't track the contact server-side (the GHL workflow handles dedup on
 * their end based on email/phone/address). For contact-id tracking we'd
 * need the OAuth REST API — out of scope for Phase 1.
 *
 * All callers should fire-and-forget (no `await`). A GHL outage must
 * never block the quote/checkout/webhook flow on our side.
 */

const BASE_TAGS = ["source-quoteOS"];

export interface QuoteStartedEvent {
  event: "quote_started";
  quote_id: string;
  session_id: string | null;
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
}

export interface QuoteFinalizedEvent {
  event: "quote_finalized";
  quote_id: string;
  customer_email: string | null;
  customer_phone: string | null;
  address_line: string | null;
  zip: string | null;
  linear_feet: number | null;
  sku_code: string | null;
  selected_tier: "good" | "better" | "best" | null;
  tier_good_cents: number | null;
  tier_better_cents: number | null;
  tier_best_cents: number | null;
  selected_tier_cents: number | null;
  price_valid_until: string | null; // ISO
}

export interface DepositPaidEvent {
  event: "deposit_paid";
  quote_id: string;
  customer_email: string | null;
  address_line: string | null;
  selected_tier_cents: number | null;
  deposit_cents: number;
  stripe_payment_intent: string | null;
  stage: "Hot Lead — Deposit Paid";
}

export type GhlEvent =
  | QuoteStartedEvent
  | QuoteFinalizedEvent
  | DepositPaidEvent;

const TAGS_BY_EVENT: Record<GhlEvent["event"], string[]> = {
  quote_started: [...BASE_TAGS, "quote-started"],
  quote_finalized: [...BASE_TAGS, "quote-viewed"],
  deposit_paid: [...BASE_TAGS, "quote-deposited"],
};

/**
 * Fire-and-forget POST to GHL's inbound webhook. Silently no-ops if
 * GHL_INBOUND_WEBHOOK_URL isn't configured (dev convenience).
 *
 * Caller pattern:
 *   pushGhl({...}); // do NOT await; let it run in the background
 */
export function pushGhl(event: GhlEvent): void {
  const url = process.env.GHL_INBOUND_WEBHOOK_URL;
  if (!url) {
    // No webhook configured — common in dev. Stay silent.
    return;
  }

  const payload = {
    ...event,
    tags: TAGS_BY_EVENT[event.event],
    sent_at: new Date().toISOString(),
  };

  // Fire-and-forget: explicitly NOT awaited. catch() swallows errors so
  // unhandled rejections don't crash the route. We log so an outage
  // shows up in the dev console / production logs.
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((r) => {
      if (!r.ok) {
        console.error(
          `[ghl] ${event.event} → ${r.status} ${r.statusText} (quote=${event.quote_id})`
        );
      }
    })
    .catch((err) => {
      console.error(`[ghl] ${event.event} fetch failed`, err);
    });
}
