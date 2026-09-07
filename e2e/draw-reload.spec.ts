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
};

function watchMapDiag(page: Page): MapDiag {
  const diag: MapDiag = { inits: [], loads: [], errors: [], drawBuilds: 0 };
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
