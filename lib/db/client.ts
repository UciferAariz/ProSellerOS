/**
 * CockroachDB connection pool (Postgres wire-compatible via `pg`).
 *
 * CockroachDB is our persistent memory + vector layer. A single lazily-created
 * pool is reused across serverless invocations (Lambda/Amplify keep the module
 * warm between requests).
 */
import { Pool, type PoolClient, type QueryResultRow } from "pg";
import { config, isDbConfigured } from "@/lib/config";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!isDbConfigured()) {
    throw new Error(
      "COCKROACH_DSN is not set. The DB layer is unavailable — callers should fall back to mock data.",
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.cockroachDsn,
      // CockroachDB Cloud requires TLS. The DSN carries sslmode; the CA is a
      // public root, so we don't ship a cert file. rejectUnauthorized:false
      // keeps local/dev connections simple; tighten with a CA in production.
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 15_000,
    });
  }
  return pool;
}

/** Run a parameterized query and return typed rows. */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await getPool().query<T>(text, params);
  return res.rows;
}

/** Run a set of statements inside a single transaction. */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** Serialize a JS number[] into the pgvector literal format: '[1,2,3]'. */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
