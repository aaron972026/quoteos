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
  /**
   * Undo history — snapshots of {runs, current} pushed by each structural
   * action (drop / delete / split / branch / new-line) and by CHECKPOINT
   * (drag start). Selectors ignore it. UNDO pops it, so it spans runs.
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
  /** Replace the whole state (e.g. hydrate a desktop edit into the model). */
  | { type: "SET"; state: DrawState };

export const EMPTY_DRAW_STATE: DrawState = { runs: [], current: [] };

/** Minimum posts before a run can be Finished (a segment needs two ends). */
export const MIN_POSTS_TO_FINISH = 2;

const HISTORY_LIMIT = 60;

function snapshot(s: DrawState): DrawState {
  return { runs: s.runs, current: s.current }; // strip past — no nesting
}

/** Present pushed onto history, capped. */
function pushHistory(s: DrawState): DrawState[] {
  const next = [...(s.past ?? []), snapshot(s)];
  return next.length > HISTORY_LIMIT
    ? next.slice(next.length - HISTORY_LIMIT)
    : next;
}

const sameCoord = (a: Post, b: Post) => a[0] === b[0] && a[1] === b[1];

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
      return { runs: prev.runs, current: prev.current, past: past.slice(0, -1) };
    }

    case "FINISH_LINE": {
      if (state.current.length < MIN_POSTS_TO_FINISH) return state;
      return {
        runs: [...state.runs, { posts: state.current, closed: !!action.closed }],
        current: [],
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
      return { runs, current: [], past: pushHistory(state) };
    }

    case "START_RUN_FROM": {
      // Commit the active run (real segments only), then anchor a new run at
      // the shared coordinate (T-junction — a separate run).
      const runs =
        state.current.length >= MIN_POSTS_TO_FINISH
          ? [...state.runs, { posts: state.current, closed: false }]
          : state.runs;
      return { runs, current: [action.anchor], past: pushHistory(state) };
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
      return {
        ...state,
        runs: state.runs.map((r) => {
          const m = move(r.posts);
          return m === r.posts ? r : { ...r, posts: m };
        }),
        current: move(state.current),
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
      if (next.length >= MIN_POSTS_TO_FINISH) {
        runs[runIndex] = { ...runs[runIndex], posts: next };
      } else {
        runs.splice(runIndex, 1); // drop a degenerate <2-post run
      }
      return { ...state, runs, past: pushHistory(state) };
    }

    case "DELETE_SEGMENT": {
      // Split the run at the deleted segment; sub-runs with <2 posts drop out.
      // This is how a traced loop loses its front side.
      const { runIndex, segIndex } = action;
      if (runIndex < 0 || runIndex >= state.runs.length) return state;
      const posts = state.runs[runIndex].posts;
      if (segIndex < 0 || segIndex >= posts.length - 1) return state;
      const subs = [posts.slice(0, segIndex + 1), posts.slice(segIndex + 1)]
        .filter((p) => p.length >= MIN_POSTS_TO_FINISH)
        .map((p) => ({ posts: p, closed: false }));
      const runs = [
        ...state.runs.slice(0, runIndex),
        ...subs,
        ...state.runs.slice(runIndex + 1),
      ];
      return { ...state, runs, past: pushHistory(state) };
    }

    case "CHECKPOINT":
      return { ...state, past: pushHistory(state) };

    case "START_OVER":
      return EMPTY_DRAW_STATE; // also clears history

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
