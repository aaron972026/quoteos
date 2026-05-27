import { NextRequest } from "next/server";
import { z } from "zod";
import {
  badRequest,
  fromZod,
  ok,
  serverError,
  tooManyRequests,
} from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";
import {
  gradeFromSamples,
  sampleLineEvenly,
  type ElevationSample,
} from "@/lib/map/slope-detect";
import type { Feature, LineString, Polygon } from "geojson";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PositionSchema = z.tuple([z.number(), z.number()]);

const GeometrySchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("LineString"),
    coordinates: z.array(PositionSchema).min(2).max(500),
  }),
  z.object({
    type: z.literal("Polygon"),
    coordinates: z.array(z.array(PositionSchema).min(3)).min(1),
  }),
]);

const Body = z.object({
  geometry: GeometrySchema,
  sample_count: z.number().int().min(2).max(24).optional(),
});

const DEFAULT_SAMPLE_COUNT = 12;

interface ElevationLookup {
  elevation_m: number | null;
  status: number | null;
  body_excerpt?: string;
}

/**
 * USGS Elevation Point Query Service — free, no auth, US-only, returns true
 * per-point elevation at ~10m resolution. We switched from Mapbox Tilequery
 * contours because contours are quantized to ~10-20m intervals: every sample
 * point within a single residential yard would return the same nearest
 * contour's elevation, producing a flat 0% grade for any normal property.
 */
async function elevationAt(
  lng: number,
  lat: number,
  signal?: AbortSignal
): Promise<ElevationLookup> {
  const url =
    `https://epqs.nationalmap.gov/v1/json` +
    `?x=${lng}&y=${lat}&wkid=4326&units=Meters&includeDate=false`;
  try {
    const r = await fetch(url, { signal });
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return {
        elevation_m: null,
        status: r.status,
        body_excerpt: text.slice(0, 200),
      };
    }
    const json = (await r.json()) as { value?: number | string };
    // EPQS returns -1000000 (or similar sentinel) for "no data" outside coverage
    const raw = json.value;
    const num = typeof raw === "string" ? Number(raw) : raw;
    if (typeof num !== "number" || !Number.isFinite(num) || num < -500) {
      return { elevation_m: null, status: r.status };
    }
    return { elevation_m: num, status: r.status };
  } catch (err) {
    return {
      elevation_m: null,
      status: null,
      body_excerpt: err instanceof Error ? err.message.slice(0, 200) : undefined,
    };
  }
}

export async function POST(req: NextRequest) {
  const sid = await getCurrentSessionId();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const limit = checkLimit(
    `slope-detect:${sid ?? `ip:${ip}`}`,
    LIMITS.PRICING.max,
    LIMITS.PRICING.windowMs
  );
  if (!limit.allowed) return tooManyRequests();

  const json = await req.json().catch(() => null);
  if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");
  const parsed = Body.safeParse(json);
  if (!parsed.success) return fromZod(parsed.error);

  const geom = parsed.data.geometry as Feature<LineString | Polygon> | LineString | Polygon;
  const n = parsed.data.sample_count ?? DEFAULT_SAMPLE_COUNT;

  let positions: number[][];
  try {
    positions = sampleLineEvenly(geom, n);
  } catch (err) {
    return badRequest(
      "INVALID_GEOMETRY",
      err instanceof Error ? err.message : "Could not sample geometry"
    );
  }
  if (positions.length < 2) {
    return badRequest("INVALID_GEOMETRY", "Geometry has too few points to sample");
  }

  const ctl = new AbortController();
  // Cap wall-clock so a slow Mapbox response can't pin a request indefinitely
  const timeoutId = setTimeout(() => ctl.abort(), 6000);
  try {
    const lookups = await Promise.all(
      positions.map((p) => elevationAt(p[0], p[1], ctl.signal))
    );
    const samples: ElevationSample[] = positions.map((p, i) => ({
      position: p,
      elevation_m: lookups[i].elevation_m,
    }));
    const result = gradeFromSamples(samples);

    // Surface upstream failures so a silently-zero detect is debuggable. If
    // every sample came back with the same non-2xx status (e.g. 401 from a
    // URL-restricted token), the user/log will see it instead of "flat".
    const statuses = lookups.map((l) => l.status);
    const allBad = statuses.every((s) => s !== 200 && s !== null);
    const firstBad = lookups.find((l) => l.status !== null && l.status !== 200);
    if (allBad && firstBad) {
      console.error(
        `[slope-detect] All ${lookups.length} USGS EPQS calls returned ${firstBad.status}. Body: ${firstBad.body_excerpt ?? "(empty)"}`
      );
      return badRequest(
        "ELEVATION_UPSTREAM",
        `USGS EPQS returned ${firstBad.status} on every sample. Body: ${firstBad.body_excerpt ?? "(empty)"}`
      );
    }

    return ok({
      ...result,
      samples: samples.map((s) => ({
        lng: s.position[0],
        lat: s.position[1],
        elevation_m: s.elevation_m,
      })),
      upstream_statuses: statuses,
    });
  } catch (err) {
    console.error("slope-detect error", err);
    return serverError("Slope detection failed");
  } finally {
    clearTimeout(timeoutId);
  }
}
