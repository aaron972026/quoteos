import { NextRequest, NextResponse } from "next/server";

const ADMIN_REALM = 'Basic realm="QuoteOS Admin", charset="UTF-8"';
// NOTE: realm must be ASCII — HTTP header values are Latin-1, and a
// non-ASCII character here makes the runtime throw (500 instead of 401).
const SITE_REALM = 'Basic realm="Ivory Fence Co. - private preview", charset="UTF-8"';

function unauthorized(message: string, realm: string): NextResponse {
  return new NextResponse(message, {
    status: 401,
    headers: { "WWW-Authenticate": realm },
  });
}

/** Extract the password half of a Basic auth header, or null if malformed. */
function basicPassword(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("basic ")) return null;
  let decoded: string;
  try {
    decoded = atob(auth.slice(6).trim());
  } catch {
    return null;
  }
  const idx = decoded.indexOf(":");
  return idx === -1 ? decoded : decoded.slice(idx + 1);
}

/**
 * Two independent gates:
 *
 * 1. ADMIN — every /admin/* page and /api/admin/* route requires
 *    ADMIN_PASSWORD. Fails closed (503) when the env is unset.
 *    Dev-grade: plain env compare. For prod move to bcrypt + session
 *    cookie + IP allowlist (spec §18). Username is ignored.
 *
 * 2. SITE-WIDE PRIVATE MODE — when SITE_PASSWORD is set, the ENTIRE site
 *    (customer funnel included) sits behind Basic Auth. Unset the env var
 *    to go public again; no code change needed. Use this to keep the site
 *    off the public internet while a rebrand / pre-launch work is in
 *    flight. ADMIN_PASSWORD also satisfies this gate so one credential
 *    works everywhere.
 *
 * Deliberately NOT gated (see `matcher` below): /api/webhooks/* — Stripe
 * posts server-to-server and cannot send Basic Auth, so gating it would
 * silently drop deposit-paid events — and /api/cron/*, which Vercel Cron
 * calls with its own Bearer secret.
 */
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdmin = path.startsWith("/admin") || path.startsWith("/api/admin");

  if (isAdmin) {
    const expected = process.env.ADMIN_PASSWORD;
    if (!expected) {
      return new NextResponse(
        "ADMIN_PASSWORD is not set. Add it to .env.local and restart.",
        { status: 503 }
      );
    }
    const pass = basicPassword(req);
    if (pass === null) return unauthorized("Authentication required", ADMIN_REALM);
    if (pass !== expected) return unauthorized("Invalid credentials", ADMIN_REALM);
    return NextResponse.next();
  }

  // Public site — open unless private mode is switched on via env.
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) return NextResponse.next();

  const pass = basicPassword(req);
  if (pass === null) {
    return unauthorized("This site is not yet open to the public.", SITE_REALM);
  }
  if (pass !== sitePassword && pass !== process.env.ADMIN_PASSWORD) {
    return unauthorized("Invalid credentials", SITE_REALM);
  }
  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, static assets, and the two
  // machine-called API paths that must stay reachable.
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/webhooks|api/cron|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};
