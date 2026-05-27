/**
 * Regrid parcel API — point-in-parcel lookup. Returns the GeoJSON boundary of
 * the parcel containing the given lat/lng plus the canonical parcel ID.
 *
 * API docs: https://app.regrid.com/store/api
 * Endpoint we use: GET /api/v2/parcels/point?lat=X&lon=Y&token=...
 */

export interface ParcelLookupResult {
  ok: true;
  parcelId: string | null;
  boundary: ParcelBoundary;
}

export interface ParcelLookupError {
  ok: false;
  code:
    | "REGRID_NOT_CONFIGURED"
    | "REGRID_UPSTREAM"
    | "REGRID_NO_PARCEL"
    | "REGRID_BAD_RESPONSE";
  message: string;
  status?: number;
}

export type ParcelBoundary = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

interface RegridFeature {
  type: "Feature";
  geometry: ParcelBoundary;
  properties?: {
    fields?: {
      ll_uuid?: string;
      parcelnumb?: string;
      geoid?: string;
      // Display-friendly address bits returned by Regrid
      address?: string;
      saddress?: string;
      saddno?: string;
      saddstr?: string;
      saddsttyp?: string;
      scity?: string;
    };
    ll_uuid?: string;
  };
}

interface RegridResponse {
  parcels?: { features?: RegridFeature[] } | RegridFeature[];
  features?: RegridFeature[];
}

export async function getParcelByPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<ParcelLookupResult | ParcelLookupError> {
  const token = process.env.REGRID_API_KEY;
  if (!token) {
    return {
      ok: false,
      code: "REGRID_NOT_CONFIGURED",
      message:
        "Regrid not configured. Set REGRID_API_KEY in .env.local — see .env.example.",
    };
  }

  const url =
    `https://app.regrid.com/api/v2/parcels/point` +
    `?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}` +
    `&token=${encodeURIComponent(token)}`;

  let r: Response;
  try {
    r = await fetch(url, { signal });
  } catch (err) {
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message:
        err instanceof Error ? err.message : "Network error calling Regrid",
    };
  }

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message: `Regrid returned ${r.status}: ${text.slice(0, 240)}`,
      status: r.status,
    };
  }

  const json = (await r.json().catch(() => null)) as RegridResponse | null;
  if (!json) {
    return {
      ok: false,
      code: "REGRID_BAD_RESPONSE",
      message: "Regrid returned non-JSON",
    };
  }

  // Tolerate the two shapes Regrid has shipped — flat features array or
  // nested parcels.features. Pick the first parcel feature.
  let features: RegridFeature[] = [];
  if (Array.isArray(json.parcels)) features = json.parcels;
  else if (json.parcels?.features) features = json.parcels.features;
  else if (json.features) features = json.features;

  const feature = features.find(
    (f) =>
      f?.geometry?.type === "Polygon" || f?.geometry?.type === "MultiPolygon"
  );
  if (!feature) {
    return {
      ok: false,
      code: "REGRID_NO_PARCEL",
      message: "No parcel found at that point",
    };
  }

  const parcelId =
    feature.properties?.fields?.ll_uuid ??
    feature.properties?.fields?.parcelnumb ??
    feature.properties?.ll_uuid ??
    null;

  return { ok: true, parcelId, boundary: feature.geometry };
}

// ─── Adjacent parcels (Phase 2 — neighbor split detection) ───────────

export type Direction = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW";

export interface Neighbor {
  parcelId: string | null;
  address: string | null;
  direction: Direction;
  boundary: ParcelBoundary;
}

/**
 * Compute axis-aligned bbox [minLng, minLat, maxLng, maxLat] of a polygon
 * or multi-polygon by flattening to vertices. Treats lng/lat as Cartesian —
 * fine at residential-parcel scale.
 */
function bboxOf(boundary: ParcelBoundary): [number, number, number, number] {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;

  const rings: number[][][] =
    boundary.type === "Polygon"
      ? (boundary.coordinates as number[][][])
      : (boundary.coordinates as number[][][][]).flat();

  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }
  return [minLng, minLat, maxLng, maxLat];
}

/** Approximate centroid via mean of vertices. Good enough for direction labels. */
function centroidOf(boundary: ParcelBoundary): [number, number] {
  const rings: number[][][] =
    boundary.type === "Polygon"
      ? (boundary.coordinates as number[][][])
      : (boundary.coordinates as number[][][][]).flat();
  let sumLng = 0,
    sumLat = 0,
    n = 0;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      sumLng += lng;
      sumLat += lat;
      n++;
    }
  }
  return [sumLng / n, sumLat / n];
}

/** Expand a bbox by `meters` on each side. Uses a flat-earth approximation. */
function expandBbox(
  bbox: [number, number, number, number],
  meters: number
): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const dLat = meters / 111_320; // 1 deg lat ≈ 111.32 km
  const dLng = meters / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return [minLng - dLng, minLat - dLat, maxLng + dLng, maxLat + dLat];
}

function directionOf(
  customer: [number, number],
  neighbor: [number, number]
): Direction {
  const dLng = neighbor[0] - customer[0];
  const dLat = neighbor[1] - customer[1];
  // Threshold to avoid flipping a near-cardinal neighbor into a diagonal
  // when there's a tiny perpendicular offset. ~25% of the larger axis.
  const ax = Math.abs(dLng);
  const ay = Math.abs(dLat);
  const dominant = Math.max(ax, ay);
  const ns = ay > 0.25 * dominant ? (dLat > 0 ? "N" : "S") : "";
  const ew = ax > 0.25 * dominant ? (dLng > 0 ? "E" : "W") : "";
  return (ns + ew || "N") as Direction;
}

function addressOf(f: RegridFeature): string | null {
  const fields = f.properties?.fields;
  if (!fields) return null;
  // Prefer the assembled address first; otherwise stitch components.
  if (fields.address) return fields.address;
  if (fields.saddress) return fields.saddress;
  const parts = [fields.saddno, fields.saddstr, fields.saddsttyp]
    .filter(Boolean)
    .join(" ");
  return parts.length > 0 ? parts : null;
}

function idOf(f: RegridFeature): string | null {
  return (
    f.properties?.fields?.ll_uuid ??
    f.properties?.fields?.parcelnumb ??
    f.properties?.ll_uuid ??
    null
  );
}

/**
 * Find parcels adjacent to `boundary` by querying Regrid's bbox endpoint
 * within a buffered bounding box. Filters out the customer's own parcel
 * by ID match (or, as a fallback, identical coordinate ring).
 *
 * Direction is computed centroid-to-centroid relative to the customer.
 */
export async function getAdjacentParcels(
  boundary: ParcelBoundary,
  selfParcelId: string | null,
  signal?: AbortSignal
): Promise<{ ok: true; neighbors: Neighbor[] } | ParcelLookupError> {
  const token = process.env.REGRID_API_KEY;
  if (!token) {
    return {
      ok: false,
      code: "REGRID_NOT_CONFIGURED",
      message: "Regrid not configured.",
    };
  }

  const expanded = expandBbox(bboxOf(boundary), 25); // 25m ≈ 80 ft buffer
  const [minLng, minLat, maxLng, maxLat] = expanded;

  const url =
    `https://app.regrid.com/api/v2/parcels.json` +
    `?bbox=${minLng},${minLat},${maxLng},${maxLat}` +
    `&token=${encodeURIComponent(token)}`;

  let r: Response;
  try {
    r = await fetch(url, { signal });
  } catch (err) {
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message:
        err instanceof Error ? err.message : "Network error calling Regrid",
    };
  }
  if (!r.ok) {
    const text = await r.text().catch(() => "");
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message: `Regrid bbox returned ${r.status}: ${text.slice(0, 240)}`,
      status: r.status,
    };
  }

  const json = (await r.json().catch(() => null)) as RegridResponse | null;
  if (!json) {
    return {
      ok: false,
      code: "REGRID_BAD_RESPONSE",
      message: "Regrid bbox returned non-JSON",
    };
  }

  let features: RegridFeature[] = [];
  if (Array.isArray(json.parcels)) features = json.parcels;
  else if (json.parcels?.features) features = json.parcels.features;
  else if (json.features) features = json.features;

  const customerCentroid = centroidOf(boundary);
  const neighbors: Neighbor[] = [];

  for (const f of features) {
    if (!f.geometry) continue;
    if (
      f.geometry.type !== "Polygon" &&
      f.geometry.type !== "MultiPolygon"
    ) {
      continue;
    }
    const id = idOf(f);
    if (selfParcelId && id === selfParcelId) continue;
    if (
      !selfParcelId &&
      JSON.stringify(f.geometry.coordinates) ===
        JSON.stringify(boundary.coordinates)
    ) {
      continue; // bench fallback when we have no canonical ID
    }
    neighbors.push({
      parcelId: id,
      address: addressOf(f),
      direction: directionOf(customerCentroid, centroidOf(f.geometry)),
      boundary: f.geometry,
    });
  }

  // Stable order: cardinals first, then by parcel ID for determinism
  const ORDER: Record<Direction, number> = {
    N: 0, S: 1, E: 2, W: 3, NE: 4, NW: 5, SE: 6, SW: 7,
  };
  neighbors.sort((a, b) => {
    const d = ORDER[a.direction] - ORDER[b.direction];
    if (d !== 0) return d;
    return (a.parcelId ?? "").localeCompare(b.parcelId ?? "");
  });

  return { ok: true, neighbors };
}
