/**
 * Housecall Pro hand-off via Make.com.
 *
 * QuoteOS doesn't talk to HCP's API directly. Per spec §9, the integration
 * fires a single webhook to a Make.com scenario after deposit_paid; the
 * Make.com side handles HCP customer + job + estimate creation and attaches
 * the GeoJSON as a job note.
 *
 * Fire-and-forget — a Make.com outage must never block the Stripe webhook
 * handler's 2xx response (Stripe will retry the webhook indefinitely on
 * non-2xx, doubling the load).
 */

import type { Feature, LineString, Polygon } from "geojson";

export interface HcpJobPayload {
  quote_id: string;
  quote_number: string | null;
  stripe_payment_intent: string | null;
  deposit_cents: number;
  selected_tier_cents: number | null;

  // Customer
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;

  // Service location
  address_line: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  lat: number | null;
  lng: number | null;

  // Job scope
  sku_code: string | null;
  tier: "good" | "better" | "best" | null;
  linear_feet: number | null;
  corner_count: number | null;
  height_upgrade: boolean;
  french_gothic: boolean;
  stain_seal: boolean;
  demo_required: boolean;
  demo_type: string | null;
  gates: Array<{ type: string; count: number; position?: { lat: number; lng: number } }>;

  // For the HCP job note — Make.com stringifies and attaches
  geometry: Feature<LineString | Polygon> | LineString | Polygon | null;
}

/**
 * Fire-and-forget POST to the Make.com HCP scenario. Silently no-ops if
 * MAKE_HCP_WEBHOOK_URL isn't set (dev convenience).
 */
export function pushHcpJob(payload: HcpJobPayload): void {
  const url = process.env.MAKE_HCP_WEBHOOK_URL;
  if (!url) return;

  const body = {
    ...payload,
    sent_at: new Date().toISOString(),
    source: "quoteOS",
  };

  // Explicitly NOT awaited — see file header.
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) {
        console.error(
          `[hcp/make] ${r.status} ${r.statusText} (quote=${payload.quote_id})`
        );
      }
    })
    .catch((err) => {
      console.error(`[hcp/make] fetch failed (quote=${payload.quote_id})`, err);
    });
}
