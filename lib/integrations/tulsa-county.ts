import type {
  Direction,
  Neighbor,
  ParcelBoundary,
  ParcelLookupError,
  ParcelLookupResult,
} from "./regrid";

/**
 * Tulsa County parcel data via CityofTulsaGIS ArcGIS REST. Free, no auth,
 * authoritative for Tulsa proper. Same interface as the Regrid adapter so the
 * route can chain providers.
 *
 * Endpoint: ResidentialParcels FeatureServer published by CityofTulsaGIS.
 * Field reference: `ParcelNo` (canonical id), `PropertyAddress`, `Owner`, etc.
 * We pull only the address fields — owner names are PII and don't render.
 *
 * Coverage limit: residential parcels inside Tulsa proper. Bixby / Jenks /
 * Broken Arrow / Owasso etc. may not be covered; route falls back to Regrid
 * for those.
 */

const SERVICE_URL =
  "https://services2.arcgis.com/XkZ90iCdbTJ9oNXl/arcgis/rest/services/ResidentialParcels/FeatureServer/0/query";
const OUT_FIELDS = "ParcelNo,PropertyAddress,PropertyCity,PropertyZIP";

interface ArcGisFeature {
  type: "Feature";
  geometry: ParcelBoundary | null;
  properties?: {
    ParcelNo?: string;
    PropertyAddress?: string;
    PropertyCity?: string;
    PropertyZIP?: string;
  };
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
  error?: { code?: number; message?: string };
}

async function arcgisQuery(
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<ArcGisResponse | { _err: string; _status?: number }> {
  const qs = new URLSearchParams({
    inSR: "4326",
    spatialRel: "esriSpatialRelIntersects",
    returnGeometry: "true",
    outFields: OUT_FIELDS,
    outSR: "4326",
    f: "geojson",
    ...params,
  });
  try {
    const r = await fetch(`${SERVICE_URL}?${qs.toString()}`, { signal });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return { _err: `Tulsa County GIS returned ${r.status}: ${text.slice(0, 200)}`, _status: r.status };
    }
    return (await r.json()) as ArcGisResponse;
  } catch (err) {
    return {
      _err: err instanceof Error ? err.message : "Network error",
    };
  }
}

function addressOf(props: ArcGisFeature["properties"]): string | null {
  if (!props?.PropertyAddress) return null;
  // Tulsa County formats like "9638 S 91 AV E"; render as-is, the user will
  // recognize it.
  return props.PropertyAddress;
}

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

function expandBbox(
  bbox: [number, number, number, number],
  meters: number
): [number, number, number, number] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const midLat = (minLat + maxLat) / 2;
  const dLat = meters / 111_320;
  const dLng = meters / (111_320 * Math.cos((midLat * Math.PI) / 180));
  return [minLng - dLng, minLat - dLat, maxLng + dLng, maxLat + dLat];
}

function directionOf(
  customer: [number, number],
  neighbor: [number, number]
): Direction {
  const dLng = neighbor[0] - customer[0];
  const dLat = neighbor[1] - customer[1];
  const ax = Math.abs(dLng);
  const ay = Math.abs(dLat);
  const dominant = Math.max(ax, ay);
  const ns = ay > 0.25 * dominant ? (dLat > 0 ? "N" : "S") : "";
  const ew = ax > 0.25 * dominant ? (dLng > 0 ? "E" : "W") : "";
  return (ns + ew || "N") as Direction;
}

export async function getParcelByPoint(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<ParcelLookupResult | ParcelLookupError> {
  const res = await arcgisQuery(
    {
      geometry: `${lng},${lat}`,
      geometryType: "esriGeometryPoint",
    },
    signal
  );
  if ("_err" in res) {
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message: `Tulsa County: ${res._err}`,
      status: res._status,
    };
  }
  const features = res.features ?? [];
  const feature = features.find(
    (f) =>
      f.geometry?.type === "Polygon" || f.geometry?.type === "MultiPolygon"
  );
  if (!feature || !feature.geometry) {
    return {
      ok: false,
      code: "REGRID_NO_PARCEL",
      message: "Tulsa County GIS has no residential parcel at that point",
    };
  }
  return {
    ok: true,
    parcelId: feature.properties?.ParcelNo ?? null,
    boundary: feature.geometry,
  };
}

export async function getAdjacentParcels(
  boundary: ParcelBoundary,
  selfParcelId: string | null,
  signal?: AbortSignal
): Promise<{ ok: true; neighbors: Neighbor[] } | ParcelLookupError> {
  const expanded = expandBbox(bboxOf(boundary), 25);
  const [minLng, minLat, maxLng, maxLat] = expanded;

  const res = await arcgisQuery(
    {
      geometry: `${minLng},${minLat},${maxLng},${maxLat}`,
      geometryType: "esriGeometryEnvelope",
    },
    signal
  );
  if ("_err" in res) {
    return {
      ok: false,
      code: "REGRID_UPSTREAM",
      message: `Tulsa County neighbor query: ${res._err}`,
      status: res._status,
    };
  }

  const customerCentroid = centroidOf(boundary);
  const neighbors: Neighbor[] = [];

  for (const f of res.features ?? []) {
    if (!f.geometry) continue;
    if (
      f.geometry.type !== "Polygon" &&
      f.geometry.type !== "MultiPolygon"
    ) {
      continue;
    }
    const id = f.properties?.ParcelNo ?? null;
    if (selfParcelId && id === selfParcelId) continue;
    if (
      !selfParcelId &&
      JSON.stringify(f.geometry.coordinates) ===
        JSON.stringify(boundary.coordinates)
    ) {
      continue;
    }
    neighbors.push({
      parcelId: id,
      address: addressOf(f.properties),
      direction: directionOf(customerCentroid, centroidOf(f.geometry)),
      boundary: f.geometry,
    });
  }

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
