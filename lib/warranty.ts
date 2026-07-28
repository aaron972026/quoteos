import type { Dictionary } from "@/lib/i18n/dictionaries";
import type { PostType } from "@/lib/pricing/types";

/**
 * The displayed post warranty derives from the selected post material — never
 * hardcoded per tier. Single source of truth for the matrix:
 *   pt    → 5-year post warranty
 *   cedar → 5-year structural post warranty (no rot)
 *   steel → lifetime post warranty + 10-year structure warranty
 * Workmanship (2-year, transferable) is separate and applies to every build.
 */
export function postWarrantyLine(
  dict: Dictionary,
  postType: PostType | string | null | undefined
): string {
  const c = dict.configure;
  if (postType === "steel") return c.warrantyPostSteel;
  if (postType === "cedar") return c.warrantyPostCedar;
  return c.warrantyPostPt;
}
