/**
 * POST /api/listing — generate a marketplace listing with Google Gemini and
 * store the artifact in Amazon S3. Exposed directly (in addition to the copilot
 * tool) as clean evidence of the Hackathon B Gemini call.
 *
 * Body: { sku?: string }  →  { title, bullets[], keywords[], source }
 */
import { NextResponse } from "next/server";
import { isDbConfigured, isGeminiConfigured } from "@/lib/config";
import { SELLER_ID } from "@/lib/constants";
import { generateListingCopy } from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let sku: string | undefined;
  let name = "";
  let category = "General";
  let brand = "ProSellerOS";
  try {
    const body = (await req.json().catch(() => ({}))) as {
      sku?: string; name?: string; category?: string; brand?: string;
    };
    sku = body.sku;
    if (body.name) name = body.name;
    if (body.category) category = body.category;
    if (body.brand) brand = body.brand;
  } catch {
    /* use defaults */
  }

  // Pull real product context from CockroachDB when available.
  if (isDbConfigured()) {
    try {
      const { query } = await import("@/lib/db/client");
      const rows = await query<{ name: string; category: string; brand: string }>(
        sku
          ? `SELECT name, category, brand FROM products WHERE seller_id = $1 AND sku = $2 LIMIT 1`
          : `SELECT name, category, brand FROM products WHERE seller_id = $1 ORDER BY revenue_30d DESC LIMIT 1`,
        sku ? [SELLER_ID, sku] : [SELLER_ID],
      );
      if (rows.length) ({ name, category, brand } = rows[0]);
    } catch (err) {
      console.error("[listing] db lookup failed:", err);
    }
  }
  if (!name) name = `${brand} ${category} Item`;

  try {
    const copy = await generateListingCopy({ name, category, brand });
    let uri: string | null = null;
    try {
      const { putArtifact } = await import("@/lib/ai/s3");
      uri = await putArtifact(
        `listings/${SELLER_ID}/${Date.now()}.json`,
        JSON.stringify({ product: { name, category, brand }, ...copy }, null, 2),
      );
    } catch (err) {
      console.error("[listing] s3 store failed:", err);
    }
    return NextResponse.json({
      ...copy,
      artifact: uri,
      source: isGeminiConfigured() ? "gemini" : "template",
    });
  } catch (err) {
    console.error("[listing] generation failed:", err);
    return NextResponse.json({ error: "Listing generation failed" }, { status: 500 });
  }
}
