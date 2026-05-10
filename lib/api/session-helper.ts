import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSessionFromCookies } from "@/lib/auth/session";

/**
 * Resolve current session from cookie. Returns null if missing or invalid.
 * Touches last_activity_at as a side-effect for active sessions.
 */
export async function getCurrentSessionId(): Promise<string | null> {
  const payload = await getSessionFromCookies();
  if (!payload) return null;

  // touch — fire and forget
  db.update(sessions)
    .set({ lastActivityAt: new Date() })
    .where(eq(sessions.id, payload.sid))
    .catch(() => {});

  return payload.sid;
}
