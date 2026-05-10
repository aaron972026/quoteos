import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { sessions } from "@/lib/db/schema";
import { setSessionCookie, getSessionFromCookies } from "@/lib/auth/session";
import { ok, serverError } from "@/lib/api/respond";
import { z } from "zod";

const InitBody = z.object({
  fingerprint: z.string().max(256).optional(),
  utm_source: z.string().max(128).optional(),
  utm_medium: z.string().max(128).optional(),
  utm_campaign: z.string().max(128).optional(),
  referrer: z.string().max(2048).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const existing = await getSessionFromCookies();
    if (existing) {
      return ok({ session_id: existing.sid, reused: true });
    }

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const parsed = InitBody.safeParse(body);
    const data = parsed.success ? parsed.data : {};

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const [row] = await db
      .insert(sessions)
      .values({
        fingerprint: data.fingerprint ?? null,
        ipAddress: ip,
        userAgent: req.headers.get("user-agent") ?? null,
        utmSource: data.utm_source ?? null,
        utmMedium: data.utm_medium ?? null,
        utmCampaign: data.utm_campaign ?? null,
        referrer: data.referrer ?? null,
      })
      .returning({ id: sessions.id });

    await setSessionCookie(row.id);

    return ok({ session_id: row.id, reused: false }, { status: 201 });
  } catch (err) {
    console.error("sessions/init error", err);
    return serverError();
  }
}
