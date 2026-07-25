/**
 * Persistent agent memory backed by CockroachDB.
 *
 * Every copilot turn is written to agent_memory with its embedding. On each new
 * turn we recall semantically-similar past turns/facts (long-term memory) plus
 * the most recent turns of the current session (short-term context). This is
 * the "CockroachDB memory layer" the copilot runs on.
 */
import { query, toVectorLiteral } from "@/lib/db/client";

export type MemoryRole = "user" | "assistant" | "fact";

export interface MemoryTurn {
  role: MemoryRole;
  content: string;
  createdAt: string;
}

/** Persist one turn (with its embedding) to long-term memory. */
export async function saveTurn(
  sellerId: string,
  sessionId: string,
  role: MemoryRole,
  content: string,
  embedding: number[],
): Promise<void> {
  await query(
    `INSERT INTO agent_memory (seller_id, session_id, role, content, embedding)
     VALUES ($1,$2,$3,$4,$5::VECTOR)`,
    [sellerId, sessionId, role, content, toVectorLiteral(embedding)],
  );
}

/** Most recent turns of the current session (chronological). */
export async function getRecentTurns(
  sellerId: string,
  sessionId: string,
  limit = 6,
): Promise<MemoryTurn[]> {
  const rows = await query<{ role: MemoryRole; content: string; created_at: string }>(
    `SELECT role, content, created_at
     FROM agent_memory
     WHERE seller_id = $1 AND session_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [sellerId, sessionId, limit],
  );
  return rows
    .reverse()
    .map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
}

/** Semantically-similar past turns/facts from any prior session. */
export async function recallMemory(
  sellerId: string,
  embedding: number[],
  limit = 4,
): Promise<MemoryTurn[]> {
  const rows = await query<{ role: MemoryRole; content: string; created_at: string }>(
    `SELECT role, content, created_at
     FROM agent_memory
     WHERE seller_id = $1
     ORDER BY embedding <-> $2::VECTOR
     LIMIT $3`,
    [sellerId, toVectorLiteral(embedding), limit],
  );
  return rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
}
