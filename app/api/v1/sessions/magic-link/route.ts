import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, sessions } from "@/lib/db/schema";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyMagicLinkToken } from "@/lib/auth/magic-link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_RESUME = new Set(["draw", "configure", "quote"]);

/**
 * GET /api/v1/sessions/magic-link?t=...&r=draw
 *
 * Verifies the magic-link JWT, sets the session cookie for the embedded
 * session, and redirects the user back into the quote flow at the requested
 * resume point. Used by abandoned-cart SMS/email recovery.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("t");
  const resume = req.nextUrl.searchParams.get("r") ?? "draw";
  const safeResume = ALLOWED_RESUME.has(resume) ? resume : "draw";

  if (!token) {
    return NextResponse.redirect(new URL("/?magic=missing", req.url));
  }

  const payload = await verifyMagicLinkToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/?magic=expired", req.url));
  }

  // Verify the session still exists and the quote still belongs to it.
  // Defense against a leaked token after a session deletion.
  const [sessionRow] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.id, payload.sid))
    .limit(1);
  if (!sessionRow) {
    return NextResponse.redirect(new URL("/?magic=expired", req.url));
  }

  const [quoteRow] = await db
    .select({ id: quotes.id, sessionId: quotes.sessionId })
    .from(quotes)
    .where(eq(quotes.id, payload.qid))
    .limit(1);
  if (!quoteRow || quoteRow.sessionId !== payload.sid) {
    return NextResponse.redirect(new URL("/?magic=expired", req.url));
  }

  await setSessionCookie(payload.sid);

  const redirectPath =
    safeResume === "quote"
      ? `/quote/${payload.qid}`
      : safeResume === "configure"
        ? `/configure?q=${payload.qid}`
        : `/draw?q=${payload.qid}`;

  return NextResponse.redirect(new URL(redirectPath, req.url));
}
