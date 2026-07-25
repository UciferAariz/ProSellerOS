/**
 * Seeds CockroachDB from the deterministic mock generators in lib/mock/.
 *
 * Run: npm run db:seed   (run db:setup first)
 *
 * The seeded PRNG means every run produces identical data, so the polished
 * ProSellerOS UI looks pixel-identical — but the numbers now come from a real
 * distributed database instead of an in-memory array.
 */
import { config as loadEnv } from "dotenv";
import { SELLER_ID } from "@/lib/constants";

loadEnv({ path: ".env.local" });

async function main() {
  const { getPool } = await import("@/lib/db/client");
  const { isDbConfigured } = await import("@/lib/config");
  const { PRODUCTS } = await import("@/lib/mock/products");
  const { ORDERS } = await import("@/lib/mock/orders");
  const { MARKETPLACE_LIST } = await import("@/lib/mock/marketplaces");
  const { INSIGHTS } = await import("@/lib/mock/insights");
  const { DEMO_USER } = await import("@/lib/mock/user");

  if (!isDbConfigured()) {
    console.error("✗ COCKROACH_DSN is not set in .env.local. Aborting.");
    process.exit(1);
  }

  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Clean commerce tables (keep agent_memory — conversation history).
    await client.query(
      `TRUNCATE catalog_embeddings, order_items, orders, product_listings,
                insights, products, marketplaces, sellers CASCADE`,
    );

    // Seller (tenant)
    await client.query(
      `INSERT INTO sellers (id, name, email, org, plan)
       VALUES ($1,$2,$3,$4,$5)`,
      [SELLER_ID, DEMO_USER.name, DEMO_USER.email, DEMO_USER.org, DEMO_USER.plan],
    );

    // Marketplaces
    for (const m of MARKETPLACE_LIST) {
      await client.query(
        `INSERT INTO marketplaces (id, name, color, region, category)
         VALUES ($1,$2,$3,$4,$5)`,
        [m.id, m.name, m.color, m.region, m.category],
      );
    }

    // Products + listings
    for (const p of PRODUCTS) {
      await client.query(
        `INSERT INTO products
          (id, seller_id, sku, name, category, brand, price, cost, stock,
           reorder_point, status, rating, reviews, units_30d, revenue_30d,
           trend, margin, tags, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)`,
        [
          p.id, SELLER_ID, p.sku, p.name, p.category, p.brand, p.price, p.cost,
          p.stock, p.reorderPoint, p.status, p.rating, p.reviews, p.units30d,
          p.revenue30d, p.trend, p.margin, p.tags, p.createdAt,
        ],
      );
      for (const l of p.listings) {
        await client.query(
          `INSERT INTO product_listings (product_id, marketplace, status, price)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (product_id, marketplace) DO NOTHING`,
          [p.id, l.marketplace, l.status, l.price],
        );
      }
    }

    // Orders + items
    for (const o of ORDERS) {
      await client.query(
        `INSERT INTO orders
          (id, seller_id, number, marketplace, customer, city, status,
           payment, total, item_count, placed_at, flagged)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          o.id, SELLER_ID, o.number, o.marketplace, o.customer, o.city,
          o.status, o.payment, o.total, o.itemCount, o.placedAt, o.flagged,
        ],
      );
      let seq = 0;
      for (const it of o.items) {
        await client.query(
          `INSERT INTO order_items (order_id, product_id, name, sku, qty, price, seq)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [o.id, it.productId, it.name, it.sku, it.qty, it.price, seq++],
        );
      }
    }

    // Insights
    for (const ins of INSIGHTS) {
      await client.query(
        `INSERT INTO insights (id, seller_id, type, title, detail, impact, action)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [ins.id, SELLER_ID, ins.type, ins.title, ins.detail, ins.impact ?? null, ins.action ?? null],
      );
    }

    await client.query("COMMIT");
    console.log(
      `✓ Seeded ${PRODUCTS.length} products, ${ORDERS.length} orders, ` +
        `${MARKETPLACE_LIST.length} marketplaces, ${INSIGHTS.length} insights.`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
