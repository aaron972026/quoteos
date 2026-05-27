import type {
  Feature,
  LineString,
  MultiPolygon,
  Polygon,
} from "geojson";

type AnyBoundary =
  | Feature<LineString | Polygon | MultiPolygon>
  | LineString
  | Polygon
  | MultiPolygon
  | null;

interface Props {
  lat: number;
  lng: number;
  /** Display address shown in the top-left "Located" chip. */
  address: string;
  /** Localized labels — defaults are English. */
  labels?: {
    located?: string;
    attribution?: string;
    scale?: string;
    compass?: string;
  };
  /** Optional parcel boundary GeoJSON drawn as a brass outline. */
  parcelBoundary?: AnyBoundary;
  /** Mapbox Static API zoom (1–22). Defaults to 19 — close-on-roof. */
  zoom?: number;
}

const ACCENT_HEX = "C8962E"; // brass — sent unprefixed to Mapbox Static API

/**
 * Static satellite preview for `/address/confirm`. Renders Mapbox's
 * server-rendered satellite tile as an <img>, then overlays the brand
 * chrome — "Located" address chip top-left, N compass top-right, scale bar
 * bottom-right, attribution below. A brick pin marks the geocoded centroid.
 *
 * Server-component friendly — no interactive map, no client JS required.
 * Optionally outlines the parcel boundary in brass when provided.
 */
export function SatellitePreview({
  lat,
  lng,
  address,
  labels,
  parcelBoundary,
  zoom = 19,
}: Props) {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const L = {
    located: labels?.located ?? "Located",
    attribution: labels?.attribution ?? "Mapbox Satellite · USDA NAIP Imagery",
    scale: labels?.scale ?? "30 ft",
    compass: labels?.compass ?? "N",
  };

  let imgSrc: string | null = null;
  if (token) {
    let overlay = "";
    // Optional brass-outlined parcel polygon overlay (GeoJSON-encoded)
    if (parcelBoundary) {
      const inner =
        "geometry" in parcelBoundary
          ? parcelBoundary.geometry
          : parcelBoundary;
      const styled: Feature<LineString | Polygon | MultiPolygon> = {
        type: "Feature",
        properties: {
          stroke: `#${ACCENT_HEX}`,
          "stroke-width": 2,
          "stroke-opacity": 0.85,
          fill: `#${ACCENT_HEX}`,
          "fill-opacity": 0.08,
        },
        geometry: inner,
      };
      overlay = `/geojson(${encodeURIComponent(JSON.stringify(styled))})`;
    }
    const center = `${lng.toFixed(6)},${lat.toFixed(6)},${zoom}`;
    imgSrc =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static` +
      overlay +
      `/${center}/720x576@2x?access_token=${token}&attribution=false&logo=false`;
  }

  return (
    <div>
      <div className="relative aspect-[5/4] overflow-hidden rounded-md border border-navy/20 bg-navy/5 shadow-map">
        {imgSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imgSrc}
            alt={`Satellite view of ${address}`}
            className="block h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-mono text-[11px] uppercase tracking-spec text-steel">
            Mapbox token missing
          </div>
        )}

        {/* Brick pin overlay at centroid — absolute-centered, no JS */}
        <div
          className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          aria-hidden="true"
        >
          <span className="absolute -left-3 -top-3 h-6 w-6 rounded-pill bg-brick/25" />
          <span className="absolute -left-1.5 -top-1.5 block h-3 w-3 rounded-pill border-[3px] border-cream bg-brick" />
        </div>

        {/* Top-left "Located" address chip */}
        <div className="absolute left-4 top-4 max-w-[60%] rounded-sm border border-brass/40 bg-navy/95 px-3.5 py-2.5 font-mono text-[11px] uppercase tracking-spec text-cream">
          <div className="mb-1 text-brass">{L.located}</div>
          <div className="truncate">{address}</div>
        </div>

        {/* Top-right N compass */}
        <div className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-pill border border-navy/20 bg-paper/90 font-display text-[12px] font-bold text-navy">
          {L.compass}
        </div>

        {/* Bottom-right scale bar */}
        <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-sm bg-paper/90 px-3 py-2 font-mono text-[10px] uppercase tracking-spec text-navy">
          <div className="h-[3px] w-8 bg-navy" />
          {L.scale}
        </div>
      </div>

      {/* Attribution caption under the map */}
      <div className="mt-4 flex items-center gap-3 font-mono text-[11px] uppercase tracking-spec text-steel">
        <span className="inline-block h-2 w-2 rounded-pill bg-brass" />
        {L.attribution}
      </div>
    </div>
  );
}
