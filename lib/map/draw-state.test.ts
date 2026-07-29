import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAW_STATE,
  canFinish,
  canUndo,
  drawPhase,
  drawReducer,
  hasFinishedLine,
  previewSegmentLF,
  previewTotalLF,
  runLF,
  toFeature,
  totalLF,
  totalPosts,
  type DrawState,
  type Post,
} from "./draw-state";

// A ~100ft-ish square in Tulsa lng/lat. Exact feet come from turf via the
// same geometryLF the app uses; tests assert behaviour + parity, not magic
// distances, so they stay robust to the geodesic math.
const A: Post = [-95.9928, 36.154];
const B: Post = [-95.9925, 36.154];
const C: Post = [-95.9925, 36.1543];
const D: Post = [-95.9928, 36.1543];

function drop(state: DrawState, ...posts: Post[]): DrawState {
  return posts.reduce(
    (s, pos) => drawReducer(s, { type: "DROP_POST", pos }),
    state
  );
}

describe("drawReducer — placing posts", () => {
  it("starts in the aiming phase with nothing placed", () => {
    expect(drawPhase(EMPTY_DRAW_STATE)).toBe("aiming");
    expect(totalPosts(EMPTY_DRAW_STATE)).toBe(0);
    expect(canUndo(EMPTY_DRAW_STATE)).toBe(false);
    expect(canFinish(EMPTY_DRAW_STATE)).toBe(false);
  });

  it("drops a post into the active run and enters the drawing phase", () => {
    const s = drop(EMPTY_DRAW_STATE, A);
    expect(s.current).toEqual([A]);
    expect(totalPosts(s)).toBe(1);
    expect(drawPhase(s)).toBe("drawing");
    expect(canFinish(s)).toBe(false); // one post is not a segment
    expect(canUndo(s)).toBe(true);
  });

  it("can finish only once the active run has ≥2 posts", () => {
    expect(canFinish(drop(EMPTY_DRAW_STATE, A))).toBe(false);
    expect(canFinish(drop(EMPTY_DRAW_STATE, A, B))).toBe(true);
  });
});

describe("drawReducer — undo", () => {
  it("pops the most recent post from the active run", () => {
    const s = drop(EMPTY_DRAW_STATE, A, B, C);
    const u = drawReducer(s, { type: "UNDO" });
    expect(u.current).toEqual([A, B]);
  });

  it("reopens the last finished run when the active run is empty (undo crosses finish)", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "FINISH_LINE" });
    expect(s.current).toEqual([]);
    expect(s.runs).toHaveLength(1);
    const u = drawReducer(s, { type: "UNDO" });
    expect(u.runs).toHaveLength(0);
    expect(u.current).toEqual([A, B]);
  });

  it("is a no-op on an empty drawing", () => {
    expect(drawReducer(EMPTY_DRAW_STATE, { type: "UNDO" })).toEqual(
      EMPTY_DRAW_STATE
    );
  });
});

describe("drawReducer — finish line + multiple runs", () => {
  it("commits the active run and starts a fresh one", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "FINISH_LINE" });
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].posts).toEqual([A, B, C]);
    expect(s.current).toEqual([]);
    expect(hasFinishedLine(s)).toBe(true);
  });

  it("supports several disconnected runs (sections)", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "FINISH_LINE" });
    s = drop(s, C, D);
    s = drawReducer(s, { type: "FINISH_LINE" });
    expect(s.runs).toHaveLength(2);
    expect(totalPosts(s)).toBe(4);
  });

  it("refuses to finish a run with fewer than two posts", () => {
    const s = drop(EMPTY_DRAW_STATE, A);
    expect(drawReducer(s, { type: "FINISH_LINE" })).toEqual(s);
  });

  it("carries the closed flag when a loop is closed", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "FINISH_LINE", closed: true });
    expect(s.runs[0].closed).toBe(true);
  });
});

describe("drawReducer — move post (Adjust mode)", () => {
  const E: Post = [-95.9922, 36.154];

  it("moves a post in the active run (runIndex === runs.length)", () => {
    const s = drop(EMPTY_DRAW_STATE, A, B, C); // current, runs empty
    const m = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 1,
      coord: E,
    });
    expect(m.current).toEqual([A, E, C]);
    expect(m.current.length).toBe(3); // order + count preserved
  });

  it("moves a post in a finished run", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "FINISH_LINE" });
    const m = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 2,
      coord: E,
    });
    expect(m.runs[0].posts).toEqual([A, B, E]);
  });

  it("recalculates LF after a move", () => {
    const s = drop(EMPTY_DRAW_STATE, A, B);
    const before = totalLF(s);
    const m = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 1,
      coord: E,
    });
    expect(totalLF(m)).toBeCloseTo(runLF([A, E]), 2);
    expect(totalLF(m)).not.toBeCloseTo(before, 2);
  });

  it("is a no-op for an out-of-range post or run", () => {
    const s = drop(EMPTY_DRAW_STATE, A, B);
    expect(
      drawReducer(s, { type: "MOVE_POST", runIndex: 0, postIndex: 9, coord: E })
    ).toEqual(s);
    expect(
      drawReducer(s, { type: "MOVE_POST", runIndex: 5, postIndex: 0, coord: E })
    ).toEqual(s);
  });

  it("does not change post count or run count", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "FINISH_LINE" });
    s = drop(s, C, D);
    const m = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 1,
      postIndex: 0,
      coord: E,
    });
    expect(totalPosts(m)).toBe(totalPosts(s));
    expect(m.runs.length).toBe(s.runs.length);
    expect(m.current).toEqual([E, D]);
  });
});

describe("branching, delete, split (B1)", () => {
  const E: Post = [-95.9922, 36.1543];
  const F: Post = [-95.992, 36.1541];
  const has = (s: DrawState, c: Post) =>
    [...s.runs.flatMap((r) => r.posts), ...s.current].some(
      (p) => p[0] === c[0] && p[1] === c[1]
    );

  it("START_RUN_FROM commits the active run and anchors a branch at the shared coord", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "START_RUN_FROM", anchor: C });
    expect(s.runs).toHaveLength(1);
    expect(s.runs[0].posts).toEqual([A, B, C]);
    expect(s.current).toEqual([C]); // T-junction: branch shares C
  });

  it("MOVE_POST on a junction carries every coincident endpoint (integrity)", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "START_RUN_FROM", anchor: C });
    s = drawReducer(s, { type: "DROP_POST", pos: E }); // runs [A,B,C], current [C,E]
    const moved = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 2,
      coord: F,
    });
    // No run endpoint still holds the old junction coord C.
    expect(has(moved, C)).toBe(false);
    expect(moved.runs[0].posts).toEqual([A, B, F]);
    expect(moved.current).toEqual([F, E]);
  });

  it("DELETE_POST on a junction anchor deletes from its own run only; the branch survives", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C);
    s = drawReducer(s, { type: "START_RUN_FROM", anchor: C });
    s = drawReducer(s, { type: "DROP_POST", pos: E }); // runs [A,B,C], current [C,E]
    const d = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 2 });
    expect(d.runs[0].posts).toEqual([A, B]); // C removed from its run
    expect(d.current).toEqual([C, E]); // branch untouched — C still anchors it
  });

  it("DELETE_POST drops a run that falls below 2 posts", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "NEW_LINE" });
    const d = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 0 });
    expect(d.runs).toHaveLength(0);
  });

  it("DELETE_SEGMENT splits a run in two", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C, D);
    s = drawReducer(s, { type: "NEW_LINE" });
    const d = drawReducer(s, { type: "DELETE_SEGMENT", runIndex: 0, segIndex: 1 });
    expect(d.runs).toHaveLength(2);
    expect(d.runs[0].posts).toEqual([A, B]);
    expect(d.runs[1].posts).toEqual([C, D]);
  });

  it("DELETE_SEGMENT drops the traced loop's front side (fragment dropped)", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C, D, A); // closed ring
    s = drawReducer(s, { type: "NEW_LINE" });
    const d = drawReducer(s, { type: "DELETE_SEGMENT", runIndex: 0, segIndex: 0 });
    expect(d.runs).toHaveLength(1); // [A] fragment dropped
    expect(d.runs[0].posts).toEqual([B, C, D, A]);
  });

  it("NEW_LINE commits a real run, but discards a <2-post fragment (tap-twice)", () => {
    const committed = drawReducer(drop(EMPTY_DRAW_STATE, A, B), {
      type: "NEW_LINE",
    });
    expect(committed.runs).toHaveLength(1);
    expect(committed.current).toEqual([]);

    const discarded = drawReducer(drop(EMPTY_DRAW_STATE, A), {
      type: "NEW_LINE",
    });
    expect(discarded.runs).toHaveLength(0);
    expect(discarded.current).toEqual([]);
    // Second tap with an empty current is a no-op.
    expect(drawReducer(discarded, { type: "NEW_LINE" })).toEqual(discarded);
  });

  it("UNDO restores a Delete-section join (history spans runs)", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B, C, D);
    s = drawReducer(s, { type: "NEW_LINE" });
    const split = drawReducer(s, {
      type: "DELETE_SEGMENT",
      runIndex: 0,
      segIndex: 1,
    });
    expect(split.runs).toHaveLength(2);
    const u = drawReducer(split, { type: "UNDO" });
    expect(u.runs).toHaveLength(1);
    expect(u.runs[0].posts).toEqual([A, B, C, D]); // join restored
  });

  it("CHECKPOINT + drag is one undo step back to the pre-drag coord", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "CHECKPOINT" }); // drag start
    const m = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 1,
      coord: E,
    });
    expect(m.current).toEqual([A, E]);
    const u = drawReducer(m, { type: "UNDO" });
    expect(u.current).toEqual([A, B]);
  });
});

describe("start over", () => {
  it("clears every run and the active run", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "FINISH_LINE" });
    s = drop(s, C);
    expect(drawReducer(s, { type: "START_OVER" })).toEqual(EMPTY_DRAW_STATE);
  });
});

describe("linear feet", () => {
  it("is zero with fewer than two posts", () => {
    expect(totalLF(EMPTY_DRAW_STATE)).toBe(0);
    expect(totalLF(drop(EMPTY_DRAW_STATE, A))).toBe(0);
  });

  it("sums LF across the active run and finished runs", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B); // one segment
    const oneSeg = totalLF(s);
    expect(oneSeg).toBeGreaterThan(0);
    s = drawReducer(s, { type: "FINISH_LINE" });
    s = drop(s, C, D); // a second, separate segment
    expect(totalLF(s)).toBeCloseTo(oneSeg + runLF([C, D]), 2);
  });

  it("preview LF adds the reticle segment without committing it", () => {
    const s = drop(EMPTY_DRAW_STATE, A);
    expect(previewSegmentLF(s, B)).toBeCloseTo(runLF([A, B]), 2);
    expect(previewTotalLF(s, B)).toBeCloseTo(runLF([A, B]), 2);
    // Nothing was mutated by the preview.
    expect(s.current).toEqual([A]);
  });

  it("preview is zero when there is no post to draw from", () => {
    expect(previewSegmentLF(EMPTY_DRAW_STATE, B)).toBe(0);
  });
});

describe("toFeature — save-format bridge", () => {
  it("is null with nothing drawable", () => {
    expect(toFeature(EMPTY_DRAW_STATE)).toBeNull();
    expect(toFeature(drop(EMPTY_DRAW_STATE, A))).toBeNull();
  });

  it("exports a single run as a LineString (back-compat)", () => {
    const f = toFeature(drop(EMPTY_DRAW_STATE, A, B, C));
    expect(f?.geometry.type).toBe("LineString");
    expect(f?.geometry.coordinates).toEqual([A, B, C]);
  });

  it("exports multiple runs as a MultiLineString", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "FINISH_LINE" });
    s = drop(s, C, D);
    const f = toFeature(s);
    expect(f?.geometry.type).toBe("MultiLineString");
    expect(f?.geometry.coordinates).toEqual([
      [A, B],
      [C, D],
    ]);
  });
});
