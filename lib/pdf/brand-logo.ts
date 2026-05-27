import fs from "fs";
import path from "path";

/**
 * Lazy filesystem read of the PDF logo. react-pdf's <Image> needs a PNG
 * Buffer (it can't render SVG), so we keep a separate `public/logo.png` for
 * PDF rendering even when the web app uses SVG.
 *
 * Returns null if the file doesn't exist — PDF templates should fall back
 * to a text wordmark in that case, not crash.
 *
 * Cached for the lifetime of the Node process; the user uploads a new logo
 * roughly never, and a stale buffer on a hot reload is the right tradeoff.
 */

let cached: Buffer | null | undefined;

export function getBrandLogoBuffer(): Buffer | null {
  if (cached !== undefined) return cached;
  const p = path.join(process.cwd(), "public", "logo.png");
  try {
    cached = fs.readFileSync(p);
  } catch {
    // File not yet uploaded — templates fall back to wordmark
    cached = null;
  }
  return cached;
}
