import { NextRequest, NextResponse } from "next/server";
import { LOCALES, isLocale } from "@/lib/i18n/types";
import { LOCALE_COOKIE } from "@/lib/i18n/server";

export const runtime = "nodejs";

/**
 * POST /api/v1/locale — set the locale cookie. Body: { locale: "en" | "es" }.
 * Client redirects/refreshes after to pick up new server-rendered text.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const locale = body?.locale;

  if (!isLocale(locale)) {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_LOCALE",
          message: `Locale must be one of: ${LOCALES.join(", ")}`,
        },
      },
      { status: 400 }
    );
  }

  const res = NextResponse.json({ locale });
  res.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: "lax",
    httpOnly: false, // accessible to client-side LocaleToggle to read the current value
  });
  return res;
}
