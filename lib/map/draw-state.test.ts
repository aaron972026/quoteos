import { describe, expect, it } from "vitest";
import {
  EMPTY_DRAW_STATE,
  canFinish,
  canUndo,
  clampGateOffset,
  drawPhase,
  drawReducer,
  hasFinishedLine,
  previewSegmentLF,
  previewTotalLF,
  runLF,
  segmentLengthFt,
  toFeature,
  totalLF,
  totalPosts,
  type DrawGate,
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

describe("snap merge normalization (NORMALIZE)", () => {
  const E: Post = [-95.9922, 36.1543];
  // deg latitude per foot (turf haversine, R=6371.0088km) — for sub-foot offsets
  const FT = 2.7411e-6;
  const near = (base: Post, ft: number): Post => [base[0], base[1] + ft * FT];
  const set = (runs: Post[][], current: Post[] = []): DrawState => ({
    runs: runs.map((posts) => ({ posts, closed: false })),
    current,
  });

  it("collapses a same-run adjacent degenerate segment (keeps the older post)", () => {
    const s = set([[A, near(A, 0.3), B]]); // A and its near-dup are adjacent
    const n = drawReducer(s, { type: "NORMALIZE" });
    expect(n.runs[0].posts).toEqual([A, B]); // near-dup removed, A kept
  });

  it("unifies a cross-run near-coincidence to the older exact coord (junction)", () => {
    const cNear = near(C, 0.3);
    const s = set([
      [A, B, C],
      [cNear, D],
    ]);
    const n = drawReducer(s, { type: "NORMALIZE" });
    // run2's first post becomes C's EXACT coord — bit-identical junction.
    expect(n.runs[1].posts[0]).toEqual(C);
    expect(n.runs[1].posts[0][0] === C[0] && n.runs[1].posts[0][1] === C[1]).toBe(
      true
    );
  });

  it("the snapped junction then drags as one under MOVE_POST", () => {
    const s = drawReducer(set([[A, B, C], [near(C, 0.3), D]]), {
      type: "NORMALIZE",
    });
    // Move C (run 0, index 2) — the unified run-1 endpoint moves with it.
    const moved = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 2,
      coord: E,
    });
    expect(moved.runs[0].posts[2]).toEqual(E);
    expect(moved.runs[1].posts[0]).toEqual(E); // junction carried
  });

  it("preserves an intentional loop-close (last == first, not adjacent)", () => {
    const ring = [A, B, C, A];
    const n = drawReducer(set([ring]), { type: "NORMALIZE" });
    expect(n.runs[0].posts).toEqual([A, B, C, A]); // untouched
  });

  it("tolerance boundary: 0.49 ft merges, 0.51 ft does not", () => {
    const bNear = near(B, 0.49);
    const bFar = near(B, 0.51);
    expect(runLF([B, bNear])).toBeLessThan(0.5); // preconditions
    expect(runLF([B, bFar])).toBeGreaterThan(0.5);

    const merged = drawReducer(set([[A, B], [bNear, D]]), { type: "NORMALIZE" });
    expect(merged.runs[1].posts[0]).toEqual(B); // unified

    const untouched = drawReducer(set([[A, B], [bFar, D]]), {
      type: "NORMALIZE",
    });
    expect(untouched.runs[1].posts[0]).toEqual(bFar); // left alone
  });

  it("is a no-op (no history push) when nothing is within tolerance", () => {
    const s = set([[A, B, C]]);
    expect(drawReducer(s, { type: "NORMALIZE" })).toEqual(s);
  });

  it("UNDO restores the pre-merge state", () => {
    const before = set([[A, B, C], [near(C, 0.3), D]]);
    const merged = drawReducer(before, { type: "NORMALIZE" });
    const u = drawReducer(merged, { type: "UNDO" });
    expect(u.runs.map((r) => r.posts)).toEqual([
      [A, B, C],
      [near(C, 0.3), D],
    ]);
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

describe("gates (G2)", () => {
  // deg latitude per foot (matches the NORMALIZE block above); moving along
  // latitude keeps segment length independent of longitude/cos(lat) scaling.
  const FT = 2.7411e-6;
  const G0: Post = [-95.99, 36.15];
  const G1: Post = [-95.99, 36.15 + 40 * FT]; // ~40 ft north of G0
  const G1short: Post = [-95.99, 36.15 + 30 * FT]; // ~30 ft north of G0

  // A single committed run of the given posts, no active run, no gates.
  const runState = (posts: Post[]): DrawState => ({
    runs: [{ posts, closed: false }],
    current: [],
  });

  const gate = (over: Partial<DrawGate> = {}): DrawGate => ({
    id: "g1",
    runIndex: 0,
    segIndex: 0,
    type: "single",
    width_ft: 4,
    offset_ft: 5,
    ...over,
  });

  it("clampGateOffset keeps the whole gate inside the segment", () => {
    expect(clampGateOffset(50, 4, 40)).toBe(38); // past far end → segLen - w/2
    expect(clampGateOffset(0, 4, 40)).toBe(2); // past near end → w/2
    expect(clampGateOffset(20, 4, 40)).toBe(20); // already inside → unchanged
    expect(clampGateOffset(10, 40, 30)).toBe(20); // wider than seg → w/2 centre
  });

  it("PLACE_GATE adds the gate and clamps its offset", () => {
    const seg = runLF([G0, G1]);
    expect(seg).toBeGreaterThan(39); // precondition: ~40 ft segment
    const s = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: 4, offset_ft: 1000 }),
    });
    expect(s.gates).toHaveLength(1);
    expect(s.gates![0].offset_ft).toBeCloseTo(seg - 2, 5); // clamped to far edge
  });

  it("PLACE_GATE accepts width == segLen but rejects width just over", () => {
    const seg = runLF([G0, G1]);
    const fits = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: seg }), // exactly the segment length → fits
    });
    expect(fits.gates).toHaveLength(1);

    const over = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: seg + 0.01 }), // just over → rejected, no-op
    });
    expect(over.gates).toBeUndefined();
    expect(over.past).toBeUndefined(); // no history pushed on a rejected place
  });

  it("PLACE_GATE is a no-op on a missing segment", () => {
    const s = runState([G0, G1]);
    expect(
      drawReducer(s, { type: "PLACE_GATE", gate: gate({ segIndex: 5 }) })
    ).toBe(s);
  });

  it("MOVE_GATE clamps the offset into the segment; unknown id is a no-op", () => {
    const seg = runLF([G0, G1]);
    let s = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: 4, offset_ft: 10 }),
    });
    s = drawReducer(s, { type: "MOVE_GATE", id: "g1", offset_ft: 1000 });
    expect(s.gates![0].offset_ft).toBeCloseTo(seg - 2, 5); // clamped to far edge

    const noop = drawReducer(s, { type: "MOVE_GATE", id: "nope", offset_ft: 1 });
    expect(noop).toBe(s);
  });

  it("EDIT_GATE rejects a width that exceeds the segment", () => {
    const s = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: 4, offset_ft: 20 }),
    });
    const edited = drawReducer(s, { type: "EDIT_GATE", id: "g1", width_ft: 1000 });
    expect(edited).toBe(s); // no-op — width won't fit
  });

  it("EDIT_GATE re-clamps the offset when the width grows", () => {
    const seg = runLF([G0, G1]); // ~40 ft
    let s = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: 4, offset_ft: 38 }), // near far end (span [36,40])
    });
    expect(s.gates![0].offset_ft).toBeCloseTo(38, 1);
    s = drawReducer(s, {
      type: "EDIT_GATE",
      id: "g1",
      gateType: "double",
      width_ft: 20,
    });
    expect(s.gates![0].type).toBe("double");
    expect(s.gates![0].width_ft).toBe(20);
    expect(s.gates![0].offset_ft).toBeCloseTo(seg - 10, 5); // re-clamped for w=20
  });

  it("DELETE_GATE removes the gate; UNDO restores it", () => {
    const placed = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate(),
    });
    const deleted = drawReducer(placed, { type: "DELETE_GATE", id: "g1" });
    expect(deleted.gates).toEqual([]);
    const restored = drawReducer(deleted, { type: "UNDO" });
    expect(restored.gates).toHaveLength(1);
    expect(restored.gates![0].id).toBe("g1");
  });

  it("MOVE_POST clamps a gate on a shortened adjacent segment (38'→30')", () => {
    let s = drawReducer(runState([G0, G1]), {
      type: "PLACE_GATE",
      gate: gate({ width_ft: 4, offset_ft: 38 }), // at the far end of ~40 ft seg
    });
    expect(s.gates![0].offset_ft).toBeCloseTo(38, 1);
    // Move the far post inward so the segment shrinks to ~30 ft.
    s = drawReducer(s, {
      type: "MOVE_POST",
      runIndex: 0,
      postIndex: 1,
      coord: G1short,
    });
    const shortLen = runLF([G0, G1short]);
    expect(shortLen).toBeLessThan(31);
    expect(s.gates![0].offset_ft).toBeLessThan(38); // clamped inward
    expect(s.gates![0].offset_ft).toBeCloseTo(shortLen - 2, 5); // fits the 30 ft
  });

  it("NORMALIZE transfers a gate off a collapsed same-run segment (not deleted)", () => {
    const FT_LAT = 2.7411e-6;
    const nearA: Post = [A[0], A[1] + 0.3 * FT_LAT]; // 0.3 ft from A → collapses
    // Gate on segment 1 (nearA → B), the real segment after the degenerate one.
    const s = drawReducer(runState([A, nearA, B]), {
      type: "PLACE_GATE",
      gate: gate({ segIndex: 1, width_ft: 4, offset_ft: 10 }),
    });
    expect(s.gates![0].segIndex).toBe(1);
    const n = drawReducer(s, { type: "NORMALIZE" });
    expect(n.runs[0].posts).toEqual([A, B]); // nearA collapsed into A
    expect(n.gates).toHaveLength(1); // transferred, NOT dropped
    expect(n.gates![0].runIndex).toBe(0);
    expect(n.gates![0].segIndex).toBe(0); // now on the surviving (A,B) segment
    expect(segmentLengthFt(n.runs, 0, 0)).toBeGreaterThan(0); // valid segment
  });

  it("DELETE_SEGMENT drops the cut segment's gate and reindexes survivors", () => {
    // Run A-B-C-D: gate on seg 1 (B→C, the cut) and seg 2 (C→D, survives).
    let s = runState([A, B, C, D]);
    s = drawReducer(s, {
      type: "PLACE_GATE",
      gate: gate({ id: "cut", segIndex: 1, width_ft: 4, offset_ft: 10 }),
    });
    s = drawReducer(s, {
      type: "PLACE_GATE",
      gate: gate({ id: "keep", segIndex: 2, width_ft: 4, offset_ft: 10 }),
    });
    const d = drawReducer(s, { type: "DELETE_SEGMENT", runIndex: 0, segIndex: 1 });
    expect(d.runs).toHaveLength(2); // [A,B] | [C,D]
    expect(d.gates).toHaveLength(1); // "cut" gone
    const kept = d.gates![0];
    expect(kept.id).toBe("keep");
    expect(kept.runIndex).toBe(1); // moved to the second sub-run
    expect(kept.segIndex).toBe(0); // C→D is seg 0 there — same physical segment
    expect(d.runs[kept.runIndex].posts).toEqual([C, D]);
  });

  it("UNDO restores a DELETE_SEGMENT split with its segment and gates", () => {
    let s = runState([A, B, C, D]);
    s = drawReducer(s, {
      type: "PLACE_GATE",
      gate: gate({ id: "cut", segIndex: 1 }),
    });
    s = drawReducer(s, {
      type: "PLACE_GATE",
      gate: gate({ id: "keep", segIndex: 2 }),
    });
    const d = drawReducer(s, { type: "DELETE_SEGMENT", runIndex: 0, segIndex: 1 });
    const u = drawReducer(d, { type: "UNDO" });
    expect(u.runs).toHaveLength(1);
    expect(u.runs[0].posts).toEqual([A, B, C, D]); // segment restored
    expect(u.gates?.map((g) => g.id).sort()).toEqual(["cut", "keep"]); // gates back
  });

  it("DELETE_SEGMENT shifts runIndex of gates on later runs", () => {
    // Two committed runs; splitting run 0 adds a run, so run 1's gate shifts +1.
    let s: DrawState = {
      runs: [
        { posts: [A, B, C, D], closed: false },
        { posts: [C, D], closed: false },
      ],
      current: [],
    };
    s = drawReducer(s, {
      type: "PLACE_GATE",
      gate: gate({ id: "later", runIndex: 1, segIndex: 0 }),
    });
    const d = drawReducer(s, { type: "DELETE_SEGMENT", runIndex: 0, segIndex: 1 });
    expect(d.runs).toHaveLength(3); // [A,B] | [C,D] | [C,D]
    const later = d.gates!.find((g) => g.id === "later")!;
    expect(later.runIndex).toBe(2); // shifted from 1 by the +1 net run delta
    expect(d.runs[later.runIndex].posts).toEqual([C, D]);
  });
});

describe("gates — DELETE_POST cascade (reindex, don't misalign)", () => {
  const gate = (segIndex: number, id: string): DrawGate => ({
    id,
    runIndex: 0,
    segIndex,
    type: "single",
    width_ft: 4,
    offset_ft: 5,
  });
  const setup = (): DrawState => {
    const s = drop(EMPTY_DRAW_STATE, A, B, C, D);
    return drawReducer(s, { type: "NEW_LINE" }); // runs=[{[A,B,C,D]}], 3 segments
  };

  it("reindexes a gate on a later segment when an earlier post is deleted", () => {
    let s = drawReducer(setup(), { type: "PLACE_GATE", gate: gate(2, "g1") }); // C→D
    s = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 1 }); // remove B
    const g = s.gates!.find((x) => x.id === "g1")!;
    expect(g.segIndex).toBe(1); // C→D is segment 1 in [A,C,D]
  });

  it("transfers a gate on a merged segment instead of deleting it", () => {
    let s = drawReducer(setup(), { type: "PLACE_GATE", gate: gate(1, "g2") }); // B→C
    s = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 1 }); // remove B
    const g = s.gates!.find((x) => x.id === "g2");
    expect(g).toBeDefined(); // not silently dropped
    expect(g!.segIndex).toBe(0); // merged into A→C
  });

  it("drops gates when the post deletion removes the run", () => {
    let s = drop(EMPTY_DRAW_STATE, A, B);
    s = drawReducer(s, { type: "NEW_LINE" });
    s = drawReducer(s, { type: "PLACE_GATE", gate: gate(0, "g3") });
    s = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 0 });
    expect(s.gates ?? []).toHaveLength(0);
  });

  it("UNDO restores a gate after a post deletion", () => {
    let s = drawReducer(setup(), { type: "PLACE_GATE", gate: gate(2, "g4") });
    const before = s.gates;
    s = drawReducer(s, { type: "DELETE_POST", runIndex: 0, postIndex: 1 });
    const u = drawReducer(s, { type: "UNDO" });
    expect(u.gates).toEqual(before);
  });
});
