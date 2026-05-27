/**
 * Supported locales for customer-facing screens. Admin stays English-only.
 * Spec §12 calls for Spanish as the second locale for Tulsa.
 */
export type Locale = "en" | "es";

export const LOCALES: readonly Locale[] = ["en", "es"];
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "es";
}
