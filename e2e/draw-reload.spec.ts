import { test, expect, devices, type Page } from "@playwright/test";

/**
 * TRIPWIRE: the /draw map must load fresh AND on return AND on hard reload.
 * This bug ("map inits fine fresh, dead on return") has escaped twice; this is
 * its permanent guard. Reproduces Aaron's real flow: MOBILE (aim mode), a real
 * saved drawing, Continue via the app button (client-side router.push), then
 * the browser Back button — not a full-page goto.
 *
 * Signal: FenceMap logs `[map-diag] init run #N` per init and
 * `[map-diag] load fired run #N · canvas=W×H` when the style loads.
 */

// Mobile = pointer:coarse = aim mode (Aaron's device).
test.use({ ...devices["Pixel 7"] });

type MapDiag = {
  inits: number[];
  loads: { run: number; w: number; h: number }[];
  errors: string[];
  drawBuilds: number; // per-instance place_gate registrations (one per mount)
  gateModes: string[]; // the mode the map lands in each time gates arm
  ghostPurges: number; // reconcile-and-purge fires
};

function watchMapDiag(page: Page): MapDiag {
  const diag: MapDiag = {
    inits: [],
    loads: [],
    errors: [],
    drawBuilds: 0,
    gateModes: [],
    ghostPurges: 0,
  };
  page.on("console", (msg) => {
    const t = msg.text();
    const init = t.match(/\[map-diag\] init run #(\d+)/);
    if (init) diag.inits.push(Number(init[1]));
    const load = t.match(/\[map-diag\] load fired run #(\d+) · canvas=(\d+)×(\d+)/);
    if (load)
      diag.loads.push({ run: Number(load[1]), w: Number(load[2]), h: Number(load[3]) });
    // Per-instance mode registration — proves mount #2 got its own place_gate
    // (the old module-mutation-behind-a-guard skipped this on remount).
    if (t.includes("draw created with per-instance place_gate mode")) diag.drawBuilds++;
    // The mode the map actually lands in when gates arm. Must be "place_gate"
    // (or the simple_select fallback) — NEVER "draw_line_string", which is the
    // "tap draws a line instead of placing a gate" trap.
    const gm = t.match(/\[map-diag\] gate mode active=true → mode is now: (\S+)/);
    if (gm) diag.gateModes.push(gm[1]);
    // Reconcile-and-purge fired: an orphan gl-draw feature was removed in aim.
    if (t.includes("[map-diag] ghost purge")) diag.ghostPurges++;
    // A setup exception during init aborts the rest → dead map. This is the
    // signature the remount-collision bug left behind ("[FenceMap] map error").
    if (msg.type() === "error" && /\[FenceMap\]/.test(t)) diag.errors.push(t);
  });
  return diag;
}

/**
 * Seed a quote WITH a saved drawing so Continue is enabled + /draw rehydrates.
 * withGate seeds a new-model gate on run 0 / segment 0 so the gate wiring is
 * exercised on EVERY mount (rehydration renders the marker) — the ingredient
 * the earlier headless pass was missing.
 */
async function seedQuote(page: Page, withGate = false): Promise<string> {
  const initRes = await page.request.post("/api/v1/sessions/init");
  expect(initRes.ok(), "session init").toBeTruthy();
  const res = await page.request.post("/api/v1/quotes", {
    data: {
      address_line: "1234 S Yorktown Ave",
      city: "Tulsa",
      state: "OK",
      zip: "74114",
      lat: 36.1266,
      lng: -95.9797,
    },
  });
  expect(res.ok(), "seed quote").toBeTruthy();
  const id = (await res.json())?.id as string;
  expect(id, "quote id").toBeTruthy();
  const patch = await page.request.patch(`/api/v1/quotes/${id}`, {
    data: {
      geometry: {
        type: "LineString",
        coordinates: [
          [-95.9797, 36.1266],
          [-95.9793, 36.1266],
          [-95.9793, 36.1269],
          [-95.9797, 36.1269],
        ],
      },
      linear_feet: 300,
      corner_count: 2,
      slope_code: 0,
      demo_type: "NONE",
      ...(withGate
        ? {
            gates: [
              {
                type: "double",
                width_ft: 6,
                runIndex: 0,
                segIndex: 0,
                position: { lat: 36.1266, lng: -95.9795 },
              },
            ],
          }
        : {}),
    },
  });
  expect(patch.ok(), "seed geometry").toBeTruthy();
  return id;
}

async function expectMapUp(page: Page, diag: MapDiag, minLoads: number) {
  await expect
    .poll(() => diag.loads.filter((l) => l.w > 0 && l.h > 0).length, {
      message: `>= ${minLoads} nonzero-canvas load event(s)`,
    })
    .toBeGreaterThanOrEqual(minLoads);
}

test("map loads fresh, then again after Back to /draw", async ({ page }) => {
  const diag = watchMapDiag(page);
  const id = await seedQuote(page);

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1); // fresh

  await page.goto(`/configure?q=${id}`);
  await expect(page).toHaveURL(/\/configure/);
  await page.goBack(); // return to /draw
  await expect(page).toHaveURL(/\/draw/);
  await expectMapUp(page, diag, 2); // must re-init + paint on return

  // NOTE: Aaron's exact repro also uses the in-app "Pick Materials" button
  // (client-side router.push) then browser Back — verify on a real device;
  // headless Chromium does not reproduce the dead map on any of these paths.
});

test("map loads on a hard reload of /draw", async ({ page }) => {
  const diag = watchMapDiag(page);
  const id = await seedQuote(page);

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);

  await page.reload();
  await expectMapUp(page, diag, 2);
});

// The remount-collision repro: a quote WITH a gate. Rehydration renders the
// gate on every mount, so the gate wiring runs on the return mount — exactly
// where the old module-level place_gate registration (behind a run-once guard)
// left mount #2 without its custom mode, aborting init into a dead map.
test("map survives return-from-/configure with a gate placed", async ({ page }) => {
  const diag = watchMapDiag(page);
  const id = await seedQuote(page, /* withGate */ true);

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);
  expect(diag.drawBuilds, "place_gate registered on first mount").toBeGreaterThanOrEqual(1);

  await page.goto(`/configure?q=${id}`);
  await expect(page).toHaveURL(/\/configure/);
  await page.goBack();
  await expect(page).toHaveURL(/\/draw/);
  await expectMapUp(page, diag, 2); // must re-init + paint on return

  // The fix: per-instance registration fires again on the remount...
  await expect
    .poll(() => diag.drawBuilds, {
      message: "place_gate registered again on the return mount (per-instance)",
    })
    .toBeGreaterThanOrEqual(2);
  // ...and no setup exception aborted init (the dead-map signature).
  expect(diag.errors, "no [FenceMap] console.error during the flow").toEqual([]);
});

test("map survives hard reload with a gate placed", async ({ page }) => {
  const diag = watchMapDiag(page);
  const id = await seedQuote(page, /* withGate */ true);

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);

  await page.reload();
  await expectMapUp(page, diag, 2);
  await expect.poll(() => diag.drawBuilds).toBeGreaterThanOrEqual(2);
  expect(diag.errors, "no [FenceMap] console.error on reload").toEqual([]);
});

// Bug #1 guard, on a REMOUNTED map — where the original evidence came from.
// Opening the gates sheet MUST arm place_gate; if the map were still in
// draw_line_string, a fence-line tap would draw a line instead of a gate.
test("opening gates on a remounted map arms place_gate (no line-drawing trap)", async ({
  page,
}) => {
  const diag = watchMapDiag(page);
  const id = await seedQuote(page); // geometry only → aim rehydrates into ADJUST

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);

  // Remount via back-from-/configure — the exact path the dead-map came from.
  await page.goto(`/configure?q=${id}`);
  await expect(page).toHaveURL(/\/configure/);
  await page.goBack();
  await expect(page).toHaveURL(/\/draw/);
  await expectMapUp(page, diag, 2);

  // Enter gates from the ADJUST sheet on the remounted map.
  const addGates = page.getByRole("button", { name: /add gates/i });
  await addGates.first().click();

  // The invariant: gates armed → mode is place_gate (or the safe fallback),
  // recorded AFTER the remount. Never draw_line_string.
  await expect
    .poll(() => diag.gateModes.length, { message: "gate mode armed after remount" })
    .toBeGreaterThanOrEqual(1);
  const landed = diag.gateModes[diag.gateModes.length - 1];
  expect(landed, "armed mode after remount").not.toBe("draw_line_string");
  expect(["place_gate", "simple_select"]).toContain(landed);
  expect(diag.errors, "no [FenceMap] console.error").toEqual([]);
});

// Slice 3 — ONE gate flow on aim: the Zone 2 "Add Gate" tab must open the NEW
// sheet and arm place_gate, never the legacy "Pick a gate size" sheet.
test("aim Add Gate tab opens the new sheet, not the legacy size picker", async ({
  page,
}) => {
  const diag = watchMapDiag(page);
  // Returning user — suppress the first-visit onboarding modal so it can't
  // intercept taps on the mode tabs.
  await page.addInitScript(() => {
    try {
      localStorage.setItem("qos-draw-onboarded-v1", "1");
    } catch {
      /* private mode */
    }
  });
  const id = await seedQuote(page); // geometry only → aim rehydrates into ADJUST

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);

  // The Zone 2 tab is exactly "Add Gate" (badge absent at 0 gates); the ADJUST
  // sheet's button is "Add Gates" (plural) — exact:true disambiguates. It's
  // disabled until rehydration lands linear_feet > 0, so wait for enabled.
  const tab = page.getByRole("button", { name: "Add Gate", exact: true });
  await expect(tab).toBeEnabled();
  await tab.click();

  // New sheet is up (aria-label "Add gates") and gate mode armed to place_gate.
  await expect(page.getByRole("dialog", { name: /add gates/i })).toBeVisible();
  await expect
    .poll(() => diag.gateModes[diag.gateModes.length - 1])
    .not.toBe("draw_line_string");
  // Legacy size picker must never appear in aim.
  await expect(page.getByText("Pick a gate size")).toHaveCount(0);
  expect(diag.errors, "no [FenceMap] console.error").toEqual([]);
});

// Slice 4 — gl-draw is a RENDER TARGET in aim: no feature may exist in the
// gl-draw store that the reducer didn't put there. Inject a raw ghost → it is
// reconciled away; Start Over leaves the store empty.
test("aim reconciles away a ghost gl-draw feature; Start Over empties the store", async ({
  page,
}) => {
  const diag = watchMapDiag(page);
  await page.addInitScript(() => {
    try {
      localStorage.setItem("qos-draw-onboarded-v1", "1");
    } catch {
      /* private mode */
    }
  });
  const id = await seedQuote(page);

  await page.goto(`/draw?q=${id}`);
  await expectMapUp(page, diag, 1);

  // The dev-only test seam exposes the live draw instance.
  await expect.poll(() => page.evaluate(() => !!(window as any).__qosDraw)).toBe(true);

  // Inject a raw gl-draw line the reducer knows nothing about — a ghost.
  await page.evaluate(() => {
    (window as any).__qosDraw.add({
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: [
          [-95.9797, 36.1266],
          [-95.979, 36.127],
        ],
      },
    });
  });

  // Reconciliation removes it and logs the purge; the store returns to empty.
  await expect
    .poll(() => page.evaluate(() => (window as any).__qosDraw.getAll().features.length), {
      message: "ghost reconciled away",
    })
    .toBe(0);
  expect(diag.ghostPurges, "purge was logged").toBeGreaterThanOrEqual(1);

  // Start Over leaves a genuinely empty gl-draw store.
  await page.getByRole("button", { name: /start over/i }).first().click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__qosDraw.getAll().features.length))
    .toBe(0);
});
