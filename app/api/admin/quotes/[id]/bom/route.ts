import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { quotes, skus } from "@/lib/db/schema";
import { generateBom } from "@/lib/bom/generator";
import type { BomInputs } from "@/lib/bom/types";
import { renderBomPdf } from "@/lib/pdf/render-bom-pdf";
import type { GateType, SkuFamily } from "@/lib/pricing/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/quotes/[id]/bom?format=pdf|json
 *
 * Auth is enforced by middleware.ts (Basic Auth, ADMIN_PASSWORD). Default
 * format is `pdf` so a plain `<a href>` from the admin UI downloads the
 * pull list directly.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "pdf";

  const [q] = await db
    .select()
    .from(quotes)
    .where(eq(quotes.id, params.id))
    .limit(1);
  if (!q) {
    return NextResponse.json(
      { error: { code: "NOT_FOUND", message: "Quote not found" } },
      { status: 404 }
    );
  }

  if (!q.skuCode || q.linearFeet == null) {
    return NextResponse.json(
      {
        error: {
          code: "QUOTE_INCOMPLETE",
          message: "BOM requires sku_code and linear_feet. Configure the quote first.",
        },
      },
      { status: 400 }
    );
  }

  const [sku] = await db
    .select({
      family: skus.family,
      heightInches: skus.heightInches,
    })
    .from(skus)
    .where(eq(skus.code, q.skuCode))
    .limit(1);
  if (!sku) {
    return NextResponse.json(
      { error: { code: "SKU_NOT_FOUND", message: `SKU ${q.skuCode} not found` } },
      { status: 400 }
    );
  }

  const inputs: BomInputs = {
    family: sku.family as SkuFamily,
    skuCode: q.skuCode,
    heightInches: sku.heightInches,
    heightUpgrade: !!q.heightUpgrade,
    frenchGothic: !!q.frenchGothic,
    stainSeal: !!q.stainSeal,
    linearFeet: Number(q.linearFeet),
    cornerCount: q.cornerCount ?? 0,
    gates: ((q.gates as Array<{ type: string; count: number }> | null) ?? []).map(
      (g) => ({ type: g.type as GateType, count: g.count })
    ),
  };
  const bom = generateBom(inputs);

  if (format === "json") {
    return NextResponse.json({
      quote_id: q.id,
      quote_number: q.quoteNumber,
      address: {
        line: q.addressLine,
        city: q.city,
        state: q.state,
        zip: q.zip,
      },
      bom,
    });
  }

  // PDF — return as a download. Don't block on render errors; surface them
  // as JSON so the admin can debug.
  let buffer: Buffer;
  try {
    buffer = await renderBomPdf({
      quoteNumber: q.quoteNumber,
      quoteId: q.id,
      addressLine: q.addressLine,
      city: q.city,
      state: q.state,
      zip: q.zip,
      bom,
    });
  } catch (err) {
    console.error("[bom] PDF render failed", err);
    return NextResponse.json(
      {
        error: {
          code: "PDF_RENDER_FAILED",
          message: err instanceof Error ? err.message : "PDF render failed",
        },
      },
      { status: 500 }
    );
  }

  const filename = `bom-${q.quoteNumber ?? q.id.slice(0, 8)}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
