import { NextRequest, NextResponse } from "next/server";
import { and, gte, isNotNull, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quoteEvents, quotes } from "@/lib/db/schema";
import { pushGhl, type AbandonedInterval } from "@/lib/integrations/ghl";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Per Vercel docs, cron requests carry `Authorization: Bearer <CRON_SECRET>`.
// We also accept POST without auth in dev to make manual triggering easy.
function authorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

const INTERVALS: Array<{
  key: AbandonedInterval;
  event: "abandoned_15m" | "abandoned_1h" | "abandoned_24h";
  ageMin: number; // quotes at least this old in minutes
  ageMaxHours?: number; // and at most this many hours old (window cap)
  sentMarker: string; // quote_events.event_type written on send
}> = [
  { key: "15m", event: "abandoned_15m", ageMin: 15, ageMaxHours: 1, sentMarker: "abandoned_15m_sent" },
  { key: "1h", event: "abandoned_1h", ageMin: 60, ageMaxHours: 24, sentMarker: "abandoned_1h_sent" },
  { key: "24h", event: "abandoned_24h", ageMin: 60 * 24, ageMaxHours: 24 * 7, sentMarker: "abandoned_24h_sent" },
];

function siteOrigin(req: NextRequest): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const proto = req.headers.get("x-forwarded-proto") ?? "https";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const origin = siteOrigin(req);
  const now = Date.now();
  const fired: Record<string, number> = {};

  for (const cfg of INTERVALS) {
    const olderThan = new Date(now - cfg.ageMin * 60_000);
    const youngerThan =
      cfg.ageMaxHours != null
        ? new Date(now - cfg.ageMaxHours * 60 * 60_000)
        : new Date(0);

    // Quotes that:
    //   - aren't deposited / won / expired
    //   - reached at least the "drew" step (real engagement signal)
    //   - are in the age window
    //   - haven't already had this reminder fired
    const candidates = await db
      .select({
        id: quotes.id,
        sessionId: quotes.sessionId,
        customerEmail: quotes.customerEmail,
        customerPhone: quotes.customerPhone,
        addressLine: quotes.addressLine,
        zip: quotes.zip,
        linearFeet: quotes.linearFeet,
        skuCode: quotes.skuCode,
        selectedTierCents: quotes.selectedTierCents,
        tierBetterCents: quotes.tierBetterCents,
      })
      .from(quotes)
      .where(
        and(
          notInArray(quotes.status, ["deposit_paid", "won", "expired", "lost"]),
          isNotNull(quotes.linearFeet),
          // numeric column comparison via sql expression
          sql`${quotes.linearFeet}::numeric > 0`,
          lt(quotes.createdAt, olderThan),
          gte(quotes.createdAt, youngerThan),
          sql`NOT EXISTS (
            SELECT 1 FROM ${quoteEvents}
            WHERE ${quoteEvents.quoteId} = ${quotes.id}
              AND ${quoteEvents.eventType} = ${cfg.sentMarker}
          )`
        )
      )
      .limit(500);

    let count = 0;
    for (const q of candidates) {
      // Record the send FIRST so a retry of this cron run won't double-fire
      // even if the GHL push hangs. quote_events is the source of truth.
      try {
        await db.insert(quoteEvents).values({
          quoteId: q.id,
          sessionId: q.sessionId,
          eventType: cfg.sentMarker,
          step: "abandoned",
          payload: { interval: cfg.key, ts: new Date().toISOString() },
        });
      } catch (err) {
        // If insert fails we still want to know — but skip the push to avoid
        // the double-fire we were trying to prevent.
        console.error(`[cron/abandoned] quote=${q.id} event insert failed`, err);
        continue;
      }

      pushGhl({
        event: cfg.event,
        interval: cfg.key,
        quote_id: q.id,
        customer_email: q.customerEmail,
        customer_phone: q.customerPhone,
        address_line: q.addressLine,
        zip: q.zip,
        linear_feet: q.linearFeet != null ? Number(q.linearFeet) : null,
        sku_code: q.skuCode,
        selected_tier_cents: q.selectedTierCents,
        tier_better_cents: q.tierBetterCents,
        quote_link: `${origin}/quote/${q.id}`,
      });
      count++;
    }

    fired[cfg.key] = count;
  }

  console.info("[cron/abandoned] fired", fired);
  return NextResponse.json({ ok: true, fired });
}

// POST is the same handler — Vercel can fire either; manual `curl` in dev
// is friendlier as POST.
export const POST = GET;
