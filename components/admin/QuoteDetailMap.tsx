import type { Feature, Geometry, LineString, Polygon } from "geojson";

interface Props {
  geometry: Feature<LineString | Polygon> | LineString | Polygon | null;
  centerLat: number | null;
  centerLng: number | null;
  width?: number;
  height?: number;
}

const ACCENT = "F4A623";

function isFeature(g: object): g is Feature<Geometry> {
  return (g as Feature).type === "Feature";
}

/**
 * Server-rendered Mapbox Static Image. Cheap and cacheable — no client JS.
 * Falls back to a placeholder if geometry is missing or the token isn't set.
 */
export function QuoteDetailMap({
  geometry,
  centerLat,
  centerLng,
  width = 640,
  height = 320,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-navy/10 bg-navy/5 text-xs text-navy/40"
        style={{ width: "100%", aspectRatio: `${width}/${height}` }}
      >
        NEXT_PUBLIC_MAPBOX_TOKEN not set
      </div>
    );
  }

  const center =
    centerLat != null && centerLng != null
      ? `${centerLng.toFixed(6)},${centerLat.toFixed(6)},19`
      : "auto";

  let overlay = "";
  if (geometry) {
    // Wrap raw geometry in a Feature with stroke styling Mapbox respects
    const inner = isFeature(geometry) ? geometry.geometry : geometry;
    const styled: Feature<LineString | Polygon> = {
      type: "Feature",
      properties: {
        stroke: `#${ACCENT}`,
        "stroke-width": 4,
        "stroke-opacity": 1,
        fill: `#${ACCENT}`,
        "fill-opacity": 0.15,
      },
      geometry: inner as LineString | Polygon,
    };
    overlay = `/geojson(${encodeURIComponent(JSON.stringify(styled))})`;
  }

  const url =
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static` +
    overlay +
    `/${center}/${width}x${height}@2x?access_token=${token}&attribution=false`;

  return (
    // Mapbox Static Image API — URL is unique per-quote and changes whenever
    // the geometry changes. next/image would proxy + optimize unnecessarily.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt="Quote geometry on satellite map"
      width={width}
      height={height}
      className="block w-full rounded-lg border border-navy/10"
      style={{ aspectRatio: `${width}/${height}` }}
    />
  );
}
