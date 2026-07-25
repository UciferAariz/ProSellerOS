/**
 * Applies db/schema.sql to the CockroachDB cluster in COCKROACH_DSN.
 *
 * Run: npm run db:setup
 *
 * Vector-index statements are tolerated: on clusters older than v25.2 (no
 * C-SPANN), those lines fail and we continue — semantic search still works via
 * exact nearest-neighbour scans, just without the distributed index.
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnv({ path: ".env.local" });

async function main() {
  const { getPool } = await import("@/lib/db/client");
  const { isDbConfigured } = await import("@/lib/config");

  if (!isDbConfigured()) {
    console.error("✗ COCKROACH_DSN is not set in .env.local. Aborting.");
    process.exit(1);
  }

  const sql = readFileSync(resolve(process.cwd(), "db/schema.sql"), "utf8");
  const statements = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  const pool = getPool();
  let applied = 0;
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      applied++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/vector index/i.test(stmt)) {
        console.warn(
          `⚠ Skipped vector index (cluster may predate v25.2): ${msg}`,
        );
      } else {
        console.error(`✗ Failed statement:\n${stmt}\n→ ${msg}`);
        throw err;
      }
    }
  }

  console.log(`✓ Schema applied (${applied} statements).`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
