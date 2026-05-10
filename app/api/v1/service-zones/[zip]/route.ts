import { NextRequest } from "next/server";
import { db } from "@/lib/db/client";
import { serviceZones } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { ok, badRequest, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic"; // DB-backed; cache via response header

export async function GET(_req: NextRequest, { params }: { params: { zip: string } }) {
  if (!/^\d{5}$/.test(params.zip)) {
    return badRequest("INVALID_ZIP", "Zip must be 5 digits");
  }

  try {
    const [row] = await db
      .select()
      .from(serviceZones)
      .where(eq(serviceZones.zip, params.zip))
      .limit(1);

    if (!row) {
      return ok({
        zip: params.zip,
        in_service_area: false,
        in_primary: false,
        in_extended: false,
        message: "We don't serve this area yet — but you can join our launch list.",
      });
    }

    return ok({
      zip: row.zip,
      city: row.city,
      state: row.state,
      in_service_area: row.inPrimary || row.inExtended,
      in_primary: row.inPrimary,
      in_extended: row.inExtended,
      travel_surcharge_per_mile_cents: row.travelSurchargePerMileCents,
    });
  } catch (err) {
    console.error("service-zones error", err);
    return serverError();
  }
}
