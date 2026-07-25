/**
 * Embeds products + insights with the configured provider (see AI_PROVIDER in
 * lib/ai/provider.ts) and writes the vectors into
 * CockroachDB's catalog_embeddings table (C-SPANN indexed) for semantic search.
 *
 * Run: npm run db:ingest   (run db:setup and db:seed first)
 * Requires: COCKROACH_DSN + AWS credentials with Bedrock access.
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

import { SELLER_ID } from "@/lib/constants";

interface Row {
  entityType: string;
  entityId: string;
  content: string;
  metadata: Record<string, unknown>;
}

async function main() {
  const { query, toVectorLiteral } = await import("@/lib/db/client");
  const { embed } = await import("@/lib/ai/provider");
  const { isDbConfigured } = await import("@/lib/config");

  if (!isDbConfigured()) {
    console.error("✗ COCKROACH_DSN is not set in .env.local. Aborting.");
    process.exit(1);
  }

  // Build the corpus from the real seeded tables.
  const products = await query<{
    id: string; name: string; category: string; brand: string;
    price: string; stock: number; trend: string; units_30d: number;
    revenue_30d: string; rating: string; tags: string[]; status: string;
  }>(
    `SELECT id, name, category, brand, price, stock, trend, units_30d,
            revenue_30d, rating, tags, status
     FROM products WHERE seller_id = $1`,
    [SELLER_ID],
  );

  const insights = await query<{
    id: string; title: string; detail: string; impact: string | null; type: string;
  }>(
    `SELECT id, title, detail, impact, type FROM insights WHERE seller_id = $1`,
    [SELLER_ID],
  );

  const rows: Row[] = [
    ...products.map((p) => ({
      entityType: "product",
      entityId: p.id,
      content:
        `${p.name} — ${p.category} by ${p.brand}. Price $${p.price}, ` +
        `${p.stock} in stock, ${p.trend}% 30-day sales trend, ${p.units_30d} units sold, ` +
        `$${p.revenue_30d} revenue, ${p.rating}★ rating. Status: ${p.status}. ` +
        `Tags: ${(p.tags ?? []).join(", ") || "none"}.`,
      metadata: {
        name: p.name, category: p.category, brand: p.brand,
        trend: Number(p.trend), stock: p.stock,
        revenue30d: Number(p.revenue_30d),
      },
    })),
    ...insights.map((i) => ({
      entityType: "insight",
      entityId: i.id,
      content: `${i.title}. ${i.detail}${i.impact ? ` Impact: ${i.impact}.` : ""}`,
      metadata: { type: i.type, title: i.title, impact: i.impact },
    })),
  ];

  const { activeProvider } = await import("@/lib/config");
  console.log(`Embedding ${rows.length} items via ${activeProvider() ?? "no"} provider…`);
  let done = 0;
  for (const r of rows) {
    const vec = await embed(r.content);
    await query(
      `INSERT INTO catalog_embeddings (seller_id, entity_type, entity_id, content, metadata, embedding)
       VALUES ($1,$2,$3,$4,$5::JSONB,$6::VECTOR)
       ON CONFLICT (entity_type, entity_id)
       DO UPDATE SET content = excluded.content,
                     metadata = excluded.metadata,
                     embedding = excluded.embedding`,
      [SELLER_ID, r.entityType, r.entityId, r.content, JSON.stringify(r.metadata), toVectorLiteral(vec)],
    );
    done++;
    if (done % 10 === 0 || done === rows.length) {
      console.log(`  … ${done}/${rows.length}`);
    }
  }

  console.log(`✓ Ingested ${rows.length} embeddings into catalog_embeddings.`);
  const { getPool } = await import("@/lib/db/client");
  await getPool().end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
