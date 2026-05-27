"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DICTIONARIES, type Dictionary } from "./dictionaries";
import { DEFAULT_LOCALE, type Locale } from "./types";

/**
 * Client-side locale context. Server reads from cookie and seeds the provider;
 * client components read with `useT()` (returns the dictionary) or `useLocale()`
 * (returns the locale string).
 *
 * Switching the locale is a cookie write + full router refresh — we don't
 * try to swap dictionaries in-place because server-rendered chunks would go
 * out of sync.
 */

interface LocaleContextValue {
  locale: Locale;
  dict: Dictionary;
}

const LocaleContext = createContext<LocaleContextValue>({
  locale: DEFAULT_LOCALE,
  dict: DICTIONARIES[DEFAULT_LOCALE],
});

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={{ locale, dict: DICTIONARIES[locale] }}>
      {children}
    </LocaleContext.Provider>
  );
}

/** Returns the active dictionary. Use as `const t = useT(); t.draw.line` */
export function useT(): Dictionary {
  return useContext(LocaleContext).dict;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}
