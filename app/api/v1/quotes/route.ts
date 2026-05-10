import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { quotes } from "@/lib/db/schema";
import {
  badRequest,
  fromZod,
  ok,
  serverError,
  tooManyRequests,
  unauthorized,
} from "@/lib/api/respond";
import { LIMITS, checkLimit } from "@/lib/api/rate-limit";
import { getCurrentSessionId } from "@/lib/api/session-helper";

const Body = z.object({
  address_line: z.string().min(1).max(256),
  city: z.string().max(64).optional(),
  // State accepted as either short ("OK") or long ("Oklahoma") — we normalize later
  state: z.string().max(32).optional(),
  zip: z.string().regex(/^\d{5}$/),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  parcel_id: z.string().max(128).optional(),
});

export async function POST(req: NextRequest) {
  const sid = await getCurrentSessionId();
  if (!sid) return unauthorized("No session — call /api/v1/sessions/init first");

  const limit = checkLimit(`quote-create:${sid}`, LIMITS.QUOTE_SAVE.max, LIMITS.QUOTE_SAVE.windowMs);
  if (!limit.allowed) return tooManyRequests();

  try {
    const json = await req.json().catch(() => null);
    if (!json) return badRequest("INVALID_JSON", "Request body must be JSON");

    const parsed = Body.safeParse(json);
    if (!parsed.success) return fromZod(parsed.error);

    const data = parsed.data;
    const [row] = await db
      .insert(quotes)
      .values({
        sessionId: sid,
        status: "draft",
        addressLine: data.address_line,
        city: data.city ?? null,
        state: data.state ?? "OK",
        zip: data.zip,
        lat: data.lat.toString(),
        lng: data.lng.toString(),
        parcelId: data.parcel_id ?? null,
      })
      .returning({ id: quotes.id });

    return ok({ id: row.id }, { status: 201 });
  } catch (err) {
    console.error("quotes POST error", err);
    return serverError();
  }
}
