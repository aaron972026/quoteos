import { test, expect, devices, type Page } from "@playwright/test";

/**
 * TRIPWIRE: the ADDRESS step must load without an unhandled client-side
 * exception. A crash here ("Application error: a client-side exception has
 * occurred") shipped to production once with no test noticing — this is its
 * guard. Mobile emulation matches Aaron's device.
 */
test.use({ ...devices["Pixel 7"] });

function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err?.stack || err?.message || err)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

test("address page loads with no unhandled exception", async ({ page }) => {
  const errors = watchPageErrors(page);
  await page.goto("/address");
  // The heading renders (page mounted, not the crash boundary).
  await expect(page.locator("body")).toBeVisible();
  await page.waitForTimeout(1500); // let effects (BuildGuard) run
  // Next's production crash boundary text must never appear.
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
  const fatal = errors.filter(
    (e) => !/Google|Maps JavaScript API|places|ApiNotActivated|InvalidKey|RefererNotAllowed/i.test(e)
  );
  expect(fatal, `unhandled errors on /address:\n${fatal.join("\n")}`).toEqual([]);
});

test("address page survives ?debug=1 (overlay path)", async ({ page }) => {
  const errors = watchPageErrors(page);
  await page.goto("/address?debug=1");
  await expect(page.locator("body")).toBeVisible();
  await page.waitForTimeout(1500);
  await expect(page.getByText(/Application error/i)).toHaveCount(0);
  const fatal = errors.filter(
    (e) => !/Google|Maps JavaScript API|places|ApiNotActivated|InvalidKey|RefererNotAllowed/i.test(e)
  );
  expect(fatal, `unhandled errors on /address?debug=1:\n${fatal.join("\n")}`).toEqual([]);
});
