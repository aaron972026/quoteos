import { NextRequest, NextResponse } from "next/server";

const REALM = 'Basic realm="QuoteOS Admin", charset="UTF-8"';

function unauthorized(message: string): NextResponse {
  return new NextResponse(message, {
    status: 401,
    headers: { "WWW-Authenticate": REALM },
  });
}

/**
 * Gate every /admin/* page and /api/admin/* route with HTTP Basic Auth.
 * Dev-grade: plain ADMIN_PASSWORD env compare. For prod move to bcrypt +
 * session cookie + IP allowlist (spec §18). Username is ignored — admin
 * is whoever has the password.
 */
export function middleware(req: NextRequest) {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    return new NextResponse(
      "ADMIN_PASSWORD is not set. Add it to .env.local and restart.",
      { status: 503 }
    );
  }

  const auth = req.headers.get("authorization");
  if (!auth || !auth.toLowerCase().startsWith("basic ")) {
    return unauthorized("Authentication required");
  }

  let decoded: string;
  try {
    decoded = atob(auth.slice(6).trim());
  } catch {
    return unauthorized("Malformed credentials");
  }
  const idx = decoded.indexOf(":");
  const pass = idx === -1 ? decoded : decoded.slice(idx + 1);

  if (pass !== expected) {
    return unauthorized("Invalid credentials");
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
