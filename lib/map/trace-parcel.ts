import type { Feature, LineString, Polygon, Position } from "geojson";

/**
 * Trace-my-lot-line — convert a Regrid parcel boundary into a pre-drawn
 * fence the customer can adjust instead of drawing from scratch.
 *
 * Heuristic: a residential fence usually follows the rear + side lot
 * lines and skips the street frontage. We can't see roads, but we DO
 * have the neighboring parcel boundaries (Regrid adjacent lookup), and
 * lot edges that border a neighbor are shared with that neighbor's
 * boundary (within survey tolerance). Edges shared with NO neighbor are
 * street/alley frontage. We drop the single longest contiguous run of
 * unshared edges (the front) and return the rest as an open LineString.
 *
 * Fallbacks return the full simplified perimeter as a closed Polygon:
 *   - no adjacent boundaries available
 *   - the unshared run covers most of the perimeter (corner lots /
 *     bad neighbor data — guessing the front would be wrong more often
 *     than right)
 *   - removing the run leaves fewer than 2 edges
 *
 * Everything here is planar math on a local meter projection — parcels
 * are far too small for spherical error to matter.
 */

export interface TracedFence {
  feature: Feature<LineString | Polygon>;
  /** true when the street frontage was identified and removed */
  frontageRemoved: boolean;
  /** simplified vertex count of the traced geometry */
  vertexCount: number;
}

type BoundaryLike = {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
};

// ── Tunables ────────────────────────────────────────────────────────
// Vertex closer than this to its predecessor is dropped (survey noise).
const MIN_VERTEX_SPACING_M = 0.6;
// Vertex whose perpendicular deviation from the chord of its neighbors
// is under this is collinear noise and dropped.
const COLLINEAR_TOLERANCE_M = 0.35;
// Edge midpoint within this distance of a neighbor ring = shared edge.
const SHARED_EDGE_TOLERANCE_M = 2.0;
// If the longest unshared run exceeds this fraction of the perimeter,
// the heuristic is unreliable — fall back to the full polygon.
const MAX_FRONTAGE_FRACTION = 0.5;
// Hard cap on output vertices; simplification tolerance ratchets up
// until the ring fits. Keeps Undo usable and the PATCH payload small.
const MAX_VERTICES = 48;

// ── Local planar projection ─────────────────────────────────────────
// Meters per degree at the parcel's latitude. Good to ~0.1% at parcel scale.
function metersPerDegree(latDeg: number): { mx: number; my: number } {
  const my = 111_320; // meters per degree latitude (≈ constant)
  const mx = Math.cos((latDeg * Math.PI) / 180) * my;
  return { mx, my };
}

function distM(a: Position, b: Position, mx: number, my: number): number {
  const dx = (b[0] - a[0]) * mx;
  const dy = (b[1] - a[1]) * my;
  return Math.hypot(dx, dy);
}

/** Perpendicular distance (meters) from point p to segment a–b. */
function pointToSegmentM(
  p: Position,
  a: Position,
  b: Position,
  mx: number,
  my: number
): number {
  const ax = a[0] * mx;
  const ay = a[1] * my;
  const bx = b[0] * mx;
  const by = b[1] * my;
  const px = p[0] * mx;
  const py = p[1] * my;
  const abx = bx - ax;
  const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * abx), py - (ay + t * aby));
}

// ── Ring extraction + simplification ────────────────────────────────

/** Outer ring of the largest polygon in a Polygon/MultiPolygon, closing dup removed. */
function extractOuterRing(boundary: BoundaryLike): Position[] | null {
  let rings: Position[][] = [];
  if (boundary.type === "Polygon") {
    rings = [(boundary.coordinates as number[][][])[0] as Position[]];
  } else if (boundary.type === "MultiPolygon") {
    rings = (boundary.coordinates as number[][][][]).map(
      (poly) => poly[0] as Position[]
    );
  }
  rings = rings.filter((r) => Array.isArray(r) && r.length >= 4);
  if (rings.length === 0) return null;
  // Largest by vertex-weighted bbox area proxy: actual shoelace area.
  let best: Position[] | null = null;
  let bestArea = -1;
  for (const r of rings) {
    let area = 0;
    for (let i = 0; i < r.length - 1; i++) {
      area += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
    }
    area = Math.abs(area / 2);
    if (area > bestArea) {
      bestArea = area;
      best = r;
    }
  }
  if (!best) return null;
  const ring = best.slice();
  // Drop the closing duplicate if present.
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) ring.pop();
  return ring.length >= 3 ? ring : null;
}

/** One pass: drop too-close + collinear vertices at the given tolerances. */
function simplifyPass(
  ring: Position[],
  mx: number,
  my: number,
  spacingM: number,
  collinearM: number
): Position[] {
  // Spacing pass
  const spaced: Position[] = [];
  for (const p of ring) {
    if (
      spaced.length === 0 ||
      distM(spaced[spaced.length - 1], p, mx, my) >= spacingM
    ) {
      spaced.push(p);
    }
  }
  // If the last point ended up on top of the first (circular), drop it.
  if (
    spaced.length > 3 &&
    distM(spaced[0], spaced[spaced.length - 1], mx, my) < spacingM
  ) {
    spaced.pop();
  }
  if (spaced.length <= 4) return spaced;
  // Collinearity pass (circular)
  const out: Position[] = [];
  const n = spaced.length;
  for (let i = 0; i < n; i++) {
    const prev = spaced[(i - 1 + n) % n];
    const cur = spaced[i];
    const next = spaced[(i + 1) % n];
    if (pointToSegmentM(cur, prev, next, mx, my) >= collinearM) {
      out.push(cur);
    }
  }
  return out.length >= 3 ? out : spaced;
}

function simplifyRing(ring: Position[], mx: number, my: number): Position[] {
  let spacing = MIN_VERTEX_SPACING_M;
  let collinear = COLLINEAR_TOLERANCE_M;
  let out = simplifyPass(ring, mx, my, spacing, collinear);
  // Ratchet tolerances until under the vertex cap (curved boundaries on
  // cul-de-sac lots can carry hundreds of survey points).
  let guard = 0;
  while (out.length > MAX_VERTICES && guard < 8) {
    spacing *= 1.6;
    collinear *= 1.8;
    out = simplifyPass(out, mx, my, spacing, collinear);
    guard++;
  }
  return out;
}

// ── Shared-edge classification ──────────────────────────────────────

/** All rings (outer + holes, every polygon) of a boundary as segment lists. */
function allRings(boundary: BoundaryLike): Position[][] {
  if (boundary.type === "Polygon") {
    return (boundary.coordinates as number[][][]) as Position[][];
  }
  const out: Position[][] = [];
  for (const poly of boundary.coordinates as number[][][][]) {
    for (const ring of poly) out.push(ring as Position[]);
  }
  return out;
}

/** Min distance (meters) from point p to any segment of any neighbor ring. */
function minDistToNeighbors(
  p: Position,
  neighborRings: Position[][],
  mx: number,
  my: number
): number {
  let best = Infinity;
  for (const ring of neighborRings) {
    for (let i = 0; i < ring.length - 1; i++) {
      const d = pointToSegmentM(p, ring[i], ring[i + 1], mx, my);
      if (d < best) best = d;
      if (best === 0) return 0;
    }
  }
  return best;
}

// ── Main ────────────────────────────────────────────────────────────

export function traceFenceFromParcel(
  parcel: BoundaryLike,
  adjacent: BoundaryLike[] | null | undefined
): TracedFence | null {
  const rawRing = extractOuterRing(parcel);
  if (!rawRing) return null;

  const { mx, my } = metersPerDegree(rawRing[0][1]);
  const ring = simplifyRing(rawRing, mx, my);
  if (ring.length < 3) return null;

  const fullPolygon = (): TracedFence => ({
    feature: {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [[...ring, ring[0]]] },
    },
    frontageRemoved: false,
    vertexCount: ring.length,
  });

  const neighborRings = (adjacent ?? []).flatMap(allRings);
  if (neighborRings.length === 0) return fullPolygon();

  // Classify each edge (i → i+1 circular) by its midpoint's distance to
  // the nearest neighbor boundary.
  const n = ring.length;
  const edgeLen: number[] = new Array(n);
  const shared: boolean[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    edgeLen[i] = distM(a, b, mx, my);
    const mid: Position = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    shared[i] = minDistToNeighbors(mid, neighborRings, mx, my) <= SHARED_EDGE_TOLERANCE_M;
  }

  const unsharedCount = shared.filter((s) => !s).length;
  if (unsharedCount === 0) return fullPolygon(); // landlocked / data oddity

  // Find the longest contiguous circular run of unshared edges = frontage.
  let bestStart = -1;
  let bestLen = 0;
  let bestCount = 0;
  let i = 0;
  while (i < n) {
    if (shared[i]) {
      i++;
      continue;
    }
    // walk the run (circular)
    let runLen = 0;
    let runCount = 0;
    let j = i;
    while (runCount < n && !shared[j % n]) {
      runLen += edgeLen[j % n];
      runCount++;
      j++;
    }
    if (runLen > bestLen) {
      bestLen = runLen;
      bestStart = i;
      bestCount = runCount;
    }
    i = j > i ? j : i + 1; // skip past the run (handles wrap)
    if (runCount >= n) break; // entire ring unshared
  }

  const perimeter = edgeLen.reduce((s, l) => s + l, 0);
  if (
    bestStart < 0 ||
    bestCount >= n - 1 ||
    bestLen / perimeter > MAX_FRONTAGE_FRACTION
  ) {
    return fullPolygon();
  }

  // Remaining edges form one contiguous open chain. The chain starts at
  // the vertex AFTER the removed run and walks the ring back around to
  // the vertex where the run began.
  const startVertex = (bestStart + bestCount) % n; // first vertex after frontage
  const chain: Position[] = [];
  for (let k = 0; k <= n - bestCount; k++) {
    chain.push(ring[(startVertex + k) % n]);
  }
  if (chain.length < 2) return fullPolygon();

  return {
    feature: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: chain },
    },
    frontageRemoved: true,
    vertexCount: chain.length,
  };
}

// ── Chain trim helpers (drag-to-shorten endpoint handles) ───────────
// The traced chain is kept as the full reference line; the customer
// drags an endpoint handle and we re-slice the chain between the two
// handle locations. Locations are planar meters along the chain.

export interface ChainLocation {
  /** distance along the chain, meters from the chain's first vertex */
  locationM: number;
  /** the snapped point on the chain */
  point: Position;
}

function cumulativeLengths(
  chain: Position[],
  mx: number,
  my: number
): number[] {
  const cum: number[] = [0];
  for (let i = 1; i < chain.length; i++) {
    cum.push(cum[i - 1] + distM(chain[i - 1], chain[i], mx, my));
  }
  return cum;
}

/** Total chain length in meters. */
export function chainLengthM(chain: Position[]): number {
  if (chain.length < 2) return 0;
  const { mx, my } = metersPerDegree(chain[0][1]);
  const cum = cumulativeLengths(chain, mx, my);
  return cum[cum.length - 1];
}

/** Nearest point on the chain to p, with its distance-along location. */
export function locateOnChain(chain: Position[], p: Position): ChainLocation {
  const { mx, my } = metersPerDegree(chain[0][1]);
  const cum = cumulativeLengths(chain, mx, my);
  let bestDist = Infinity;
  let bestLoc = 0;
  let bestPoint: Position = chain[0];
  for (let i = 0; i < chain.length - 1; i++) {
    const a = chain[i];
    const b = chain[i + 1];
    const ax = a[0] * mx;
    const ay = a[1] * my;
    const bx = b[0] * mx;
    const by = b[1] * my;
    const px = p[0] * mx;
    const py = p[1] * my;
    const abx = bx - ax;
    const aby = by - ay;
    const len2 = abx * abx + aby * aby;
    let t = len2 === 0 ? 0 : ((px - ax) * abx + (py - ay) * aby) / len2;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + t * abx;
    const qy = ay + t * aby;
    const d = Math.hypot(px - qx, py - qy);
    if (d < bestDist) {
      bestDist = d;
      bestLoc = cum[i] + t * (cum[i + 1] - cum[i]);
      bestPoint = [
        a[0] + t * (b[0] - a[0]),
        a[1] + t * (b[1] - a[1]),
      ];
    }
  }
  return { locationM: bestLoc, point: bestPoint };
}

/** Interpolated point at a distance-along location (meters). */
function pointAtLocation(
  chain: Position[],
  cum: number[],
  locM: number
): Position {
  const total = cum[cum.length - 1];
  const m = Math.max(0, Math.min(total, locM));
  for (let i = 0; i < cum.length - 1; i++) {
    if (m <= cum[i + 1] || i === cum.length - 2) {
      const segLen = cum[i + 1] - cum[i];
      const t = segLen === 0 ? 0 : (m - cum[i]) / segLen;
      const a = chain[i];
      const b = chain[i + 1];
      return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
    }
  }
  return chain[chain.length - 1];
}

/**
 * The sub-chain between two distance-along locations (meters). Endpoints
 * are interpolated; interior vertices strictly between are kept verbatim.
 */
export function sliceChainByLocation(
  chain: Position[],
  startM: number,
  endM: number
): Position[] {
  const { mx, my } = metersPerDegree(chain[0][1]);
  const cum = cumulativeLengths(chain, mx, my);
  const total = cum[cum.length - 1];
  const s = Math.max(0, Math.min(total, Math.min(startM, endM)));
  let e = Math.max(0, Math.min(total, Math.max(startM, endM)));
  if (e - s < 0.01) e = Math.min(total, s + 0.01);
  const out: Position[] = [pointAtLocation(chain, cum, s)];
  const EPS = 0.05; // skip interior vertices within 5cm of the cut points
  for (let i = 0; i < chain.length; i++) {
    if (cum[i] > s + EPS && cum[i] < e - EPS) out.push(chain[i]);
  }
  out.push(pointAtLocation(chain, cum, e));
  return out;
}
