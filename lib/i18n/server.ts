import { cookies } from "next/headers";
import { DICTIONARIES, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale, isLocale } from "./types";

export const LOCALE_COOKIE = "qos_locale";

/**
 * Read the active locale from the cookie. Server-side only. Used by server
 * components and route handlers — client components get the locale from the
 * LocaleProvider context instead.
 */
export function getLocale(): Locale {
  const value = cookies().get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/** Convenience: locale + dictionary in one call. */
export function getDict(): { locale: Locale; dict: Dictionary } {
  const locale = getLocale();
  return { locale, dict: DICTIONARIES[locale] };
}
