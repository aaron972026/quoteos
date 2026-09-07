import type { Feature, LineString, MultiLineString, Position } from "geojson";
import { geometryLF } from "./linear-feet";

/**
 * Framework-agnostic fence draw state machine — the single source of truth
 * for BOTH input modes (desktop click-to-place and mobile aim-and-drop).
 * Mode only changes how a post coordinate is produced; every mutation flows
 * through this reducer, so LF, undo, and multi-run behaviour are identical.
 *
 * A "post" is a GeoJSON Position ([lng, lat]). A "run" (section) is an ordered
 * list of posts. The drawing may contain several disconnected runs — Finish
 * Line commits the active run and starts a fresh one.
 */

export type Post = Position; // [lng, lat]

export interface DrawRun {
  posts: Post[];
  /** True once the run's last post snapped back to its first (a closed loop). */
  closed: boolean;
}

/**
 * A gate placed on one segment of a committed run (ADJUST mode). Gates never
 * live on the active `current` run, so `runIndex` indexes `state.runs`
 * directly (NOT the [...runs, current] virtual list the draw actions use).
 * Selectors / toFeature / LF ignore gates entirely — they read posts only.
 */
export interface DrawGate {
  /** Stable id supplied by the caller (UI); the reducer never mints ids. */
  id: string;
  /** Index into state.runs. */
  runIndex: number;
  /** Segment between posts[segIndex] and posts[segIndex + 1]. */
  segIndex: number;
  type: "single" | "double" | "sliding";
  width_ft: number;
  /** Gate CENTRE offset from the segment's start post, in feet. */
  offset_ft: number;
}

export interface DrawState {
  /** Committed runs (each already Finished). */
  runs: DrawRun[];
  /** The active, still-being-drawn run. */
  current: Post[];
  /** Gates placed on committed runs. Undefined = none. */
  gates?: DrawGate[];
  /**
   * Undo history — snapshots of {runs, current, gates} pushed by each
   * structural action (drop / delete / split / branch / new-line / gate) and
   * by CHECKPOINT (drag start). Selectors ignore it. UNDO pops it, so it
   * spans runs and gates.
   */
  past?: DrawState[];
}

export type DrawAction =
  | { type: "DROP_POST"; pos: Post }
  | { type: "UNDO" }
  | { type: "FINISH_LINE"; closed?: boolean }
  | { type: "START_OVER" }
  /**
   * Move an existing post (Adjust mode drag). `runIndex` indexes the virtual
   * list [...runs, current] — i.e. runIndex === runs.length targets the active
   * run — matching allRunCoords() ordering.
   */
  | { type: "MOVE_POST"; runIndex: number; postIndex: number; coord: Post }
  /** Branch: commit the active run, then start a new one anchored at `anchor`
   * (shares the coordinate = a T-junction). */
  | { type: "START_RUN_FROM"; anchor: Post }
  /** Delete a single post from its own run only (never cascades to coincident
   * posts in other runs); drops the run if it falls below 2 posts. */
  | { type: "DELETE_POST"; runIndex: number; postIndex: number }
  /** Delete the segment after `segIndex`, splitting the run in two; sub-runs
   * with <2 posts are dropped. */
  | { type: "DELETE_SEGMENT"; runIndex: number; segIndex: number }
  /** Commit the active run (if ≥2 posts; a <2 fragment is discarded) and start
   * a fresh empty run. */
  | { type: "NEW_LINE" }
  /** Snapshot the present into history without changing it (drag start). */
  | { type: "CHECKPOINT" }
  /** Merge normalization: collapse posts within MERGE_TOLERANCE_FT — cross-run
   * unifies to a shared coord (junction), same-run adjacent removes the
   * degenerate segment. Run on drop / drag-release / finish / save. */
  | { type: "NORMALIZE" }
  /** Replace the whole state (e.g. hydrate a desktop edit into the model). */
  | { type: "SET"; state: DrawState }
  /** Place a gate on a committed run's segment. No-op if the segment is
   * missing or the gate is wider than the segment; offset is clamped. */
  | { type: "PLACE_GATE"; gate: DrawGate }
  /** Slide a gate along its segment (drag). Clamps offset; no history push
   * (the UI dispatches CHECKPOINT at drag start, mirroring MOVE_POST). */
  | { type: "MOVE_GATE"; id: string; offset_ft: number }
  /** Edit a gate's type/width. No-op if the new width exceeds the segment;
   * re-clamps offset for the new width. */
  | { type: "EDIT_GATE"; id: string; gateType?: DrawGate["type"]; width_ft?: number }
  /** Remove a gate. */
  | { type: "DELETE_GATE"; id: string };

export const EMPTY_DRAW_STATE: DrawState = { runs: [], current: [] };

/** Minimum posts before a run can be Finished (a segment needs two ends). */
export const MIN_POSTS_TO_FINISH = 2;

/** Screen-space magnet radius for snap-to-post (px). Used by FenceMap. */
export const SNAP_RADIUS_PX = 18;

/**
 * Real-world merge tolerance (feet). Posts within this collapse on
 * drop/drag-release/finish/save — screen px varies with zoom, feet doesn't.
 */
export const MERGE_TOLERANCE_FT = 0.5;

/** Feet between two coords (turf geodesic, exact at fence scale). */
function feetBetween(a: Post, b: Post): number {
  return runLF([a, b]);
}

const HISTORY_LIMIT = 60;

function snapshot(s: DrawState): DrawState {
  return { runs: s.runs, current: s.current, gates: s.gates }; // strip past
}

/** Present pushed onto history, capped. */
function pushHistory(s: DrawState): DrawState[] {
  const next = [...(s.past ?? []), snapshot(s)];
  return next.length > HISTORY_LIMIT
    ? next.slice(next.length - HISTORY_LIMIT)
    : next;
}

const sameCoord = (a: Post, b: Post) => a[0] === b[0] && a[1] === b[1];

// ─── Gate geometry helpers ────────────────────────────────────────────

/** Feet of the segment posts[segIndex]→posts[segIndex+1], or 0 if out of range. */
export function segmentLengthFt(
  runs: DrawRun[],
  runIndex: number,
  segIndex: number
): number {
  const run = runs[runIndex];
  if (!run) return 0;
  const a = run.posts[segIndex];
  const b = run.posts[segIndex + 1];
  if (!a || !b) return 0;
  return runLF([a, b]);
}

/**
 * Clamp a gate centre offset so the whole gate stays inside its segment:
 * offset ∈ [width/2, max(width/2, segLen - width/2)]. When segLen < width the
 * bounds collapse to width/2 (best-effort centre — the gate can't fit).
 */
export function clampGateOffset(
  offset_ft: number,
  width_ft: number,
  segLen: number
): number {
  const half = width_ft / 2;
  const max = Math.max(half, segLen - half);
  return Math.min(Math.max(offset_ft, half), max);
}

/** A gate fits a segment iff it is no wider than the segment. */
function gateFits(width_ft: number, segLen: number): boolean {
  return width_ft <= segLen;
}

/** Re-clamp every gate's offset to its current segment length (post moves). */
function reclampGates(
  runs: DrawRun[],
  gates: DrawGate[] | undefined
): DrawGate[] | undefined {
  if (!gates) return gates;
  return gates.map((g) => ({
    ...g,
    offset_ft: clampGateOffset(
      g.offset_ft,
      g.width_ft,
      segmentLengthFt(runs, g.runIndex, g.segIndex)
    ),
  }));
}

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case "DROP_POST":
      return {
        ...state,
        current: [...state.current, action.pos],
        past: pushHistory(state),
      };

    case "UNDO": {
      // History-based: restore the snapshot before the last structural action
      // (drop / delete / split / branch / new-line / drag). Spans runs.
      const past = state.past ?? [];
      if (past.length === 0) return state;
      const prev = past[past.length - 1];
      return {
        runs: prev.runs,
        current: prev.current,
        gates: prev.gates,
        past: past.slice(0, -1),
      };
    }

    case "FINISH_LINE": {
      if (state.current.length < MIN_POSTS_TO_FINISH) return state;
      return {
        runs: [...state.runs, { posts: state.current, closed: !!action.closed }],
        current: [],
        gates: state.gates, // appended run is last; existing gate indices hold
        past: pushHistory(state),
      };
    }

    case "NEW_LINE": {
      // Commit the active run if it's a real segment; a <2-post fragment is
      // discarded (the tap-New-Line-twice case). Empty current → no-op.
      if (state.current.length === 0) return state;
      const runs =
        state.current.length >= MIN_POSTS_TO_FINISH
          ? [...state.runs, { posts: state.current, closed: false }]
          : state.runs;
      return { runs, current: [], gates: state.gates, past: pushHistory(state) };
    }

    case "START_RUN_FROM": {
      // Commit the active run (real segments only), then anchor a new run at
      // the shared coordinate (T-junction — a separate run).
      const runs =
        state.current.length >= MIN_POSTS_TO_FINISH
          ? [...state.runs, { posts: state.current, closed: false }]
          : state.runs;
      return {
        runs,
        current: [action.anchor],
        gates: state.gates,
        past: pushHistory(state),
      };
    }

    case "MOVE_POST": {
      const { runIndex, postIndex, coord } = action;
      const all = [...state.runs.map((r) => r.posts), state.current];
      if (runIndex < 0 || runIndex >= all.length) return state;
      const target = all[runIndex];
      if (postIndex < 0 || postIndex >= target.length) return state;
      const old = target[postIndex];
      if (sameCoord(old, coord)) return state;
      // Junction integrity: every post sharing the old exact coordinate moves
      // together, so branches stay attached to the fence they tee into. Drag
      // is live — no history push here (CHECKPOINT at drag start owns undo).
      const move = (posts: Post[]) =>
        posts.some((p) => sameCoord(p, old))
          ? posts.map((p) => (sameCoord(p, old) ? coord : p))
          : posts;
      const nextRuns = state.runs.map((r) => {
        const m = move(r.posts);
        return m === r.posts ? r : { ...r, posts: m };
      });
      // A moved post reshapes its two adjacent segments; junction integrity
      // means the same coord can touch segments in several runs. Simplest
      // correct rule: re-clamp every gate to its (possibly new) segment length
      // so none overflows a post or orphans. Drag → no history push.
      return {
        ...state,
        runs: nextRuns,
        current: move(state.current),
        gates: reclampGates(nextRuns, state.gates),
      };
    }

    case "DELETE_POST": {
      // Delete from this run only — never cascade to coincident posts in other
      // runs (a junction anchor's branch survives free-standing).
      const { runIndex, postIndex } = action;
      if (runIndex < 0 || runIndex >= state.runs.length) return state;
      const posts = state.runs[runIndex].posts;
      if (postIndex < 0 || postIndex >= posts.length) return state;
      const next = [...posts.slice(0, postIndex), ...posts.slice(postIndex + 1)];
      const runs = state.runs.slice();
      const runRemoved = next.length < MIN_POSTS_TO_FINISH;
      if (!runRemoved) {
        runs[runIndex] = { ...runs[runIndex], posts: next };
      } else {
        runs.splice(runIndex, 1); // drop a degenerate <2-post run
      }
      // Gate cascade: removing a post reindexes this run's segments (the two
      // segments touching the post merge into one). Transfer gates onto the
      // merged/shifted segment (clamped), never silently misalign; drop gates
      // on a removed run and shift runIndex of gates on later runs.
      let gates = state.gates;
      if (gates) {
        if (runRemoved) {
          gates = gates
            .filter((g) => g.runIndex !== runIndex)
            .map((g) =>
              g.runIndex > runIndex ? { ...g, runIndex: g.runIndex - 1 } : g
            );
        } else {
          const p = postIndex;
          gates = gates
            .map((g): DrawGate | null => {
              if (g.runIndex !== runIndex) return g;
              // old segs before p keep their index (old p-1 is the merge target);
              // old seg p merges into p-1; segs after p shift down one.
              const newSeg =
                g.segIndex < p ? g.segIndex : g.segIndex === p ? p - 1 : g.segIndex - 1;
              if (newSeg < 0 || newSeg >= next.length - 1) return null;
              return { ...g, segIndex: newSeg };
            })
            .filter((g): g is DrawGate => g !== null);
          gates = reclampGates(runs, gates);
        }
      }
      return { ...state, runs, gates, past: pushHistory(state) };
    }

    case "DELETE_SEGMENT": {
      // Split the run at the deleted segment; sub-runs with <2 posts drop out.
      // This is how a traced loop loses its front side.
      const { runIndex, segIndex } = action;
      if (runIndex < 0 || runIndex >= state.runs.length) return state;
      const posts = state.runs[runIndex].posts;
      if (segIndex < 0 || segIndex >= posts.length - 1) return state;
      const firstPosts = posts.slice(0, segIndex + 1);
      const secondPosts = posts.slice(segIndex + 1);
      const firstOk = firstPosts.length >= MIN_POSTS_TO_FINISH;
      const secondOk = secondPosts.length >= MIN_POSTS_TO_FINISH;
      const subs: DrawRun[] = [];
      if (firstOk) subs.push({ posts: firstPosts, closed: false });
      if (secondOk) subs.push({ posts: secondPosts, closed: false });
      const runs = [
        ...state.runs.slice(0, runIndex),
        ...subs,
        ...state.runs.slice(runIndex + 1),
      ];
      // Gate cascade: drop the cut segment's gate; remap survivors across the
      // split (first sub-run keeps segIndex; second sub-run shifts by the cut)
      // and shift gates on LATER runs by the net run-count delta (subs.length-1).
      let gates = state.gates;
      if (gates) {
        const secondRunIndex = runIndex + (firstOk ? 1 : 0);
        gates = gates
          .map((g): DrawGate | null => {
            if (g.runIndex < runIndex) return g; // before the split — untouched
            if (g.runIndex > runIndex) {
              return { ...g, runIndex: g.runIndex + subs.length - 1 };
            }
            // On the split run itself.
            if (g.segIndex === segIndex) return null; // the deleted segment
            if (g.segIndex < segIndex) {
              return firstOk ? g : null; // first sub-run, same (runIndex, segIndex)
            }
            // After the cut → second sub-run, reindexed onto it.
            if (!secondOk) return null;
            return {
              ...g,
              runIndex: secondRunIndex,
              segIndex: g.segIndex - (segIndex + 1),
            };
          })
          .filter((g): g is DrawGate => g !== null);
      }
      return { ...state, runs, gates, past: pushHistory(state) };
    }

    case "CHECKPOINT":
      return { ...state, past: pushHistory(state) };

    case "NORMALIZE": {
      // Work on a mutable copy of every run (committed + current, current last).
      const arr: Post[][] = [
        ...state.runs.map((r) => [...r.posts]),
        [...state.current],
      ];
      // Per-array-row: original post indices removed by same-run collapse. A
      // gate on original segment s shifts down by |{removed k : k <= s}|, which
      // maps BOTH the degenerate segment (k-1) and the following segment (k)
      // onto the surviving merged segment (k-1) — a transfer, never a drop.
      const removed: number[][] = arr.map(() => []);
      let changed = false;

      // 1) Same-run adjacent collapse — remove a post within tolerance of its
      //    immediate predecessor (degenerate ~zero segment). Loop-close is
      //    last-vs-first (not adjacent), so it's never touched here. Descending
      //    k means the loop index equals the ORIGINAL post index at removal.
      for (let ri = 0; ri < arr.length; ri++) {
        const posts = arr[ri];
        for (let k = posts.length - 1; k >= 1; k--) {
          if (feetBetween(posts[k], posts[k - 1]) < MERGE_TOLERANCE_FT) {
            posts.splice(k, 1); // collapse to the older (k-1) post
            removed[ri].push(k);
            changed = true;
          }
        }
      }

      // 2) Cross-run unification — a later post within tolerance of an earlier
      //    post in another run snaps to that earlier post's EXACT coord (a
      //    junction). Older = earlier in [...runs, current] order.
      for (let r1 = 0; r1 < arr.length; r1++) {
        for (let i1 = 0; i1 < arr[r1].length; i1++) {
          const a = arr[r1][i1];
          for (let r2 = r1 + 1; r2 < arr.length; r2++) {
            for (let i2 = 0; i2 < arr[r2].length; i2++) {
              const b = arr[r2][i2];
              if (!sameCoord(a, b) && feetBetween(a, b) < MERGE_TOLERANCE_FT) {
                arr[r2][i2] = a; // unify to the older coord
                changed = true;
              }
            }
          }
        }
      }

      if (!changed) return state;
      const current = arr[arr.length - 1];
      const committedCount = state.runs.length;
      // Build final runs, tracking old committed-row → new run index (a row that
      // collapses below 2 posts is dropped, shifting later runs' indices).
      const committedArr = arr.slice(0, committedCount);
      const runRemap: number[] = new Array(committedCount).fill(-1);
      const runs: DrawRun[] = [];
      for (let ri = 0; ri < committedArr.length; ri++) {
        if (committedArr[ri].length >= MIN_POSTS_TO_FINISH) {
          runRemap[ri] = runs.length;
          runs.push({ posts: committedArr[ri], closed: false });
        }
      }
      // Remap gates: shift segIndex by removals at/below it, remap runIndex,
      // re-clamp to the final segment, and drop any that no longer resolve to a
      // valid segment. Cross-run unification only changed coords → the clamp
      // absorbs the new lengths.
      let gates = state.gates;
      if (gates) {
        gates = gates
          .map((g): DrawGate | null => {
            if (g.runIndex < 0 || g.runIndex >= committedCount) return null;
            const newRunIndex = runRemap[g.runIndex];
            if (newRunIndex < 0) return null; // run collapsed away
            const shift = removed[g.runIndex].filter((k) => k <= g.segIndex).length;
            const newSeg = g.segIndex - shift;
            const segLen = segmentLengthFt(runs, newRunIndex, newSeg);
            if (newSeg < 0 || segLen <= 0) return null; // segment gone
            return {
              ...g,
              runIndex: newRunIndex,
              segIndex: newSeg,
              offset_ft: clampGateOffset(g.offset_ft, g.width_ft, segLen),
            };
          })
          .filter((g): g is DrawGate => g !== null);
      }
      return { runs, current, gates, past: pushHistory(state) };
    }

    case "START_OVER":
      return EMPTY_DRAW_STATE; // also clears history

    case "SET":
      return action.state;

    case "PLACE_GATE": {
      const { gate } = action;
      const segLen = segmentLengthFt(state.runs, gate.runIndex, gate.segIndex);
      // Reject a missing segment or a gate wider than it (segLen 0 = missing).
      if (segLen <= 0 || !gateFits(gate.width_ft, segLen)) return state;
      const placed: DrawGate = {
        ...gate,
        offset_ft: clampGateOffset(gate.offset_ft, gate.width_ft, segLen),
      };
      return {
        ...state,
        gates: [...(state.gates ?? []), placed],
        past: pushHistory(state),
      };
    }

    case "MOVE_GATE": {
      const gates = state.gates ?? [];
      const idx = gates.findIndex((g) => g.id === action.id);
      if (idx < 0) return state; // unknown id — no-op
      const g = gates[idx];
      const segLen = segmentLengthFt(state.runs, g.runIndex, g.segIndex);
      const next = gates.slice();
      next[idx] = {
        ...g,
        offset_ft: clampGateOffset(action.offset_ft, g.width_ft, segLen),
      };
      return { ...state, gates: next }; // drag → no history push
    }

    case "EDIT_GATE": {
      const gates = state.gates ?? [];
      const idx = gates.findIndex((g) => g.id === action.id);
      if (idx < 0) return state; // unknown id — no-op
      const g = gates[idx];
      const segLen = segmentLengthFt(state.runs, g.runIndex, g.segIndex);
      const width = action.width_ft ?? g.width_ft;
      if (!gateFits(width, segLen)) return state; // new width won't fit — no-op
      const next = gates.slice();
      next[idx] = {
        ...g,
        type: action.gateType ?? g.type,
        width_ft: width,
        offset_ft: clampGateOffset(g.offset_ft, width, segLen),
      };
      return { ...state, gates: next, past: pushHistory(state) };
    }

    case "DELETE_GATE": {
      const gates = state.gates ?? [];
      if (!gates.some((g) => g.id === action.id)) return state; // no-op
      return {
        ...state,
        gates: gates.filter((g) => g.id !== action.id),
        past: pushHistory(state),
      };
    }

    default:
      return state;
  }
}

// ─── Selectors (pure derivations) ─────────────────────────────────────

/** All runs including the active one, as coordinate lists. */
export function allRunCoords(state: DrawState): Post[][] {
  const runs = state.runs.map((r) => r.posts);
  if (state.current.length > 0) runs.push(state.current);
  return runs;
}

/** Total posts placed across every run (including the active run). */
export function totalPosts(state: DrawState): number {
  return state.runs.reduce((n, r) => n + r.posts.length, 0) + state.current.length;
}

/** Linear feet of a single coordinate list (open run). */
export function runLF(posts: Post[]): number {
  if (posts.length < 2) return 0;
  return geometryLF({ type: "LineString", coordinates: posts });
}

/** Total committed LF across all runs + the active run's placed posts. */
export function totalLF(state: DrawState): number {
  const cents = allRunCoords(state).reduce(
    (sum, posts) => sum + Math.round(runLF(posts) * 100),
    0
  );
  return Math.round(cents) / 100;
}

/**
 * LF of the segment that a reticle at `aim` would add to the active run —
 * powers the live "(+XX ft)" delta while the map pans under the reticle.
 * Zero when there's no post yet to draw from.
 */
export function previewSegmentLF(state: DrawState, aim: Post | null): number {
  if (!aim || state.current.length === 0) return 0;
  const last = state.current[state.current.length - 1];
  return runLF([last, aim]);
}

/** Total LF including the live preview segment to the reticle. */
export function previewTotalLF(state: DrawState, aim: Post | null): number {
  return Math.round((totalLF(state) + previewSegmentLF(state, aim)) * 100) / 100;
}

export type DrawPhase = "aiming" | "drawing";

/** "aiming" only at the very start (nothing placed); "drawing" thereafter. */
export function drawPhase(state: DrawState): DrawPhase {
  return totalPosts(state) === 0 ? "aiming" : "drawing";
}

export function canFinish(state: DrawState): boolean {
  return state.current.length >= MIN_POSTS_TO_FINISH;
}

export function canUndo(state: DrawState): boolean {
  return state.current.length > 0 || state.runs.length > 0;
}

/** True once at least one run has been Finished (gates unlock on this). */
export function hasFinishedLine(state: DrawState): boolean {
  return state.runs.length > 0;
}

// ─── GeoJSON bridge (save-format reconciliation) ──────────────────────

/**
 * Export the drawing as a single GeoJSON feature for persistence.
 *  - one run  → LineString (back-compat with the existing single-feature save)
 *  - many runs → MultiLineString (additive; readers that only knew LineString
 *    must be taught MultiLineString — tracked for the integration step)
 * The active run is included only if it has ≥2 posts (a drawable segment).
 */
export function toFeature(
  state: DrawState
): Feature<LineString | MultiLineString> | null {
  const runs = allRunCoords(state).filter((r) => r.length >= 2);
  if (runs.length === 0) return null;
  if (runs.length === 1) {
    return {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: runs[0] },
    };
  }
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "MultiLineString", coordinates: runs },
  };
}
