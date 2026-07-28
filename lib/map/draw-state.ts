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

export interface DrawState {
  /** Committed runs (each already Finished). */
  runs: DrawRun[];
  /** The active, still-being-drawn run. */
  current: Post[];
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
  /** Replace the whole state (e.g. hydrate a desktop edit into the model). */
  | { type: "SET"; state: DrawState };

export const EMPTY_DRAW_STATE: DrawState = { runs: [], current: [] };

/** Minimum posts before a run can be Finished (a segment needs two ends). */
export const MIN_POSTS_TO_FINISH = 2;

export function drawReducer(state: DrawState, action: DrawAction): DrawState {
  switch (action.type) {
    case "DROP_POST":
      return { ...state, current: [...state.current, action.pos] };

    case "UNDO": {
      // Pop the most recent post from the active run. If the active run is
      // empty, the last thing that happened was a Finish — reopen the most
      // recent run so undo crosses the finish boundary intuitively.
      if (state.current.length > 0) {
        return { ...state, current: state.current.slice(0, -1) };
      }
      if (state.runs.length > 0) {
        const last = state.runs[state.runs.length - 1];
        return { runs: state.runs.slice(0, -1), current: [...last.posts] };
      }
      return state;
    }

    case "FINISH_LINE": {
      if (state.current.length < MIN_POSTS_TO_FINISH) return state;
      return {
        runs: [...state.runs, { posts: state.current, closed: !!action.closed }],
        current: [],
      };
    }

    case "MOVE_POST": {
      const { runIndex, postIndex, coord } = action;
      // Active run lives at index runs.length in the [...runs, current] view.
      if (runIndex === state.runs.length) {
        if (postIndex < 0 || postIndex >= state.current.length) return state;
        const current = state.current.slice();
        current[postIndex] = coord;
        return { ...state, current };
      }
      if (runIndex < 0 || runIndex >= state.runs.length) return state;
      const posts = state.runs[runIndex].posts;
      if (postIndex < 0 || postIndex >= posts.length) return state;
      const nextPosts = posts.slice();
      nextPosts[postIndex] = coord;
      const runs = state.runs.slice();
      runs[runIndex] = { ...runs[runIndex], posts: nextPosts };
      return { ...state, runs };
    }

    case "START_OVER":
      return EMPTY_DRAW_STATE;

    case "SET":
      return action.state;

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
