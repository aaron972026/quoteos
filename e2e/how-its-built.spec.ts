import { test, expect, devices } from "@playwright/test";

/**
 * TRIPWIRE for the ported /how-its-built build-story page. This route is unusual:
 * its DOM is built by a vanilla script (public/how-its-built/story.js) that
 * lazy-loads each stage's high-res sprite (public/how-its-built/sprites/<key>.webp)
 * via IntersectionObserver — so it breaks on the fetch/observer wiring or a CSS
 * compile error, not on normal React rendering. This asserts the sequence builds,
 * sprites load lazily (near stage, not all six upfront), no console errors, and
 * the page's global CSS doesn't bleed onto the rest of the site. Mobile = audience.
 */
test.use({ ...devices["Pixel 7"] });

test("build-story: stages build, sprites lazy-load, no console errors, no CSS bleed", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e?.stack || e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console.error: ${m.text()}`);
  });
  const spriteReqs = new Set<string>();
  page.on("request", (r) => {
    const m = r.url().match(/\/how-its-built\/sprites\/(\w+)\.webp/);
    if (m) spriteReqs.add(m[1]);
  });

  await page.goto("/how-its-built");

  // story.js builds 6 stages, each with a canvas, plus a progress dot.
  await expect(page.locator("#stages .stage-wrap")).toHaveCount(6, { timeout: 25000 });
  expect(await page.locator("#stages canvas").count()).toBeGreaterThanOrEqual(6);
  expect(await page.locator("#progressRail .progress-dot").count()).toBe(6);

  // Lazy loading: the first stage fetches near view; the last stage must NOT
  // preload while it's still several viewports away.
  await expect.poll(() => spriteReqs.has("hole"), { timeout: 15000 }).toBe(true);
  expect(spriteReqs.has("stained"), "last stage must not preload upfront").toBe(false);

  // Regression guard: the canvas backing store must be sized to the display on
  // load, not left at the 300x150 <canvas> default — that default rendered every
  // frame into a tiny buffer and stretched it (blurry) until a window resize.
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (document.querySelector("#stages .stage-wrap canvas") as HTMLCanvasElement)
            .width
      )
    )
    .toBeGreaterThan(300);

  // Scrolling to the bottom brings the last stage into range → it loads.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => spriteReqs.has("stained"), { timeout: 15000 }).toBe(true);

  // Scoped backdrop applied (source body noir, carried by .ivory-story).
  const bg = await page.evaluate(
    () => getComputedStyle(document.querySelector(".ivory-story")!).backgroundColor
  );
  expect(bg).toBe("rgb(22, 18, 13)");

  // Closer CTA wired into the real funnel.
  await expect(
    page.getByRole("link", { name: /get your instant quote/i })
  ).toHaveAttribute("href", "/address");

  expect(errors, errors.join("\n")).toEqual([]);

  // No global-CSS bleed: the landing page body must stay ivory, not noir.
  await page.goto("/");
  const bgHome = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(bgHome).not.toBe("rgb(22, 18, 13)");
});
