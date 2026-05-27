import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
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
import {
  getAdjacentParcels as regridGetAdjacent,
  getParcelByPoint as regridGetParcel,
  type Neighbor,
  type ParcelBoundary,
  type ParcelLookupError,
  type ParcelLookupResult,
} from "@/lib/integrations/regrid";
import {
  getAdjacentParcels as tulsaGetAdjacent,
  getParcelByPoint as tulsaGetParcel,
} from "@/lib/integrations/tulsa-county";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  quote_id: string;
}

/**
 * POST: look up the parcel boundary at the quote's lat/lng via Regrid and
 * persist it to `quotes.parcel_boundary`. Idempotent — if the quote already
 * has a boundary cached, returns it without hitting Regrid.
 */
export async function POST(req: NextRequest) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized();

  const limit = checkLimit(
    `parcel-lookup:${sid}`,
    LIMITS.QUOTE_SAVE.max,
    LIMITS.QUOTE_SAVE.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  const json = (await req.json().catch(() => null)) as Body | null;
  if (!json?.quote_id) {
    return badRequest("QUOTE_ID_REQUIRED", "Body must include { quote_id }");
  }

  const [row] = await db
    .select({
      id: quotes.id,
      lat: quotes.lat,
      lng: quotes.lng,
      parcelBoundary: quotes.parcelBoundary,
      parcelId: quotes.parcelId,
      adjacentParcels: quotes.adjacentParcels,
    })
    .from(quotes)
    .where(and(eq(quotes.id, json.quote_id), eq(quotes.sessionId, sid)))
    .limit(1);
  if (!row) return notFound("Quote not found");

  // Idempotent — return cached results if we already have them.
  // If we have the boundary but no neighbors, fall through to backfill
  // neighbors without re-fetching the boundary.
  if (row.parcelBoundary && row.adjacentParcels) {
    return ok({
      parcel_id: row.parcelId,
      parcel_boundary: row.parcelBoundary,
      adjacent_parcels: row.adjacentParcels,
      cached: true,
    });
  }

  // We either need to fetch the boundary fresh, or we have the boundary but
  // need to backfill neighbors. Track which so the response shape stays right.
  let boundary: ParcelBoundary | null =
    (row.parcelBoundary as ParcelBoundary | null) ?? null;
  let parcelId: string | null = row.parcelId ?? null;
  const persistedBoundaryAlready = boundary !== null;

  if (!boundary) {
    if (row.lat == null || row.lng == null) {
      return badRequest("QUOTE_MISSING_COORDS", "Quote has no lat/lng");
    }

    // Provider chain: Tulsa County GIS first (free + authoritative for Tulsa
    // proper), Regrid second for out-of-county addresses. "No parcel" from
    // the first provider triggers a fallback; configuration failures don't.
    const ctl = new AbortController();
    const timeoutId = setTimeout(() => ctl.abort(), 8000);
    let result: ParcelLookupResult | ParcelLookupError;
    let provider: "tulsa" | "regrid" = "tulsa";
    try {
      result = await tulsaGetParcel(
        Number(row.lat),
        Number(row.lng),
        ctl.signal
      );
      if (!result.ok && result.code === "REGRID_NO_PARCEL") {
        // Tulsa-only data doesn't have this parcel; try Regrid for outside
        // Tulsa proper (Bixby / Jenks / Owasso / etc).
        provider = "regrid";
        result = await regridGetParcel(
          Number(row.lat),
          Number(row.lng),
          ctl.signal
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }

    if (!result.ok) {
      if (result.code === "REGRID_NOT_CONFIGURED") {
        return new Response(
          JSON.stringify({
            error: { code: result.code, message: result.message },
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      if (result.code === "REGRID_NO_PARCEL") {
        return ok({
          parcel_id: null,
          parcel_boundary: null,
          adjacent_parcels: null,
          found: false,
        });
      }
      console.error("[parcels/lookup] both providers failed", result);
      return serverError(result.message);
    }

    boundary = result.boundary;
    parcelId = result.parcelId ?? parcelId;
    console.info(`[parcels/lookup] resolved via ${provider}`);
  }

  // Phase 2 — fetch neighbors. Try Tulsa County first to match the parcel
  // provider; if it yields nothing, fall back to Regrid. Best-effort across
  // both — boundary persistence is committed regardless.
  let neighbors: Neighbor[] = [];
  const ctl2 = new AbortController();
  const t2 = setTimeout(() => ctl2.abort(), 8000);
  try {
    let adj = await tulsaGetAdjacent(boundary, parcelId, ctl2.signal);
    if (adj.ok && adj.neighbors.length === 0) {
      adj = await regridGetAdjacent(boundary, parcelId, ctl2.signal);
    }
    if (adj.ok) {
      neighbors = adj.neighbors;
    } else if (adj.code !== "REGRID_NOT_CONFIGURED") {
      console.warn("[parcels/lookup] neighbor fetch failed", adj);
    }
  } finally {
    clearTimeout(t2);
  }

  await db
    .update(quotes)
    .set({
      ...(persistedBoundaryAlready ? {} : { parcelBoundary: boundary }),
      ...(parcelId && parcelId !== row.parcelId
        ? { parcelId }
        : {}),
      adjacentParcels: neighbors,
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, json.quote_id));

  return ok({
    parcel_id: parcelId,
    parcel_boundary: boundary,
    adjacent_parcels: neighbors,
    cached: false,
  });
}
