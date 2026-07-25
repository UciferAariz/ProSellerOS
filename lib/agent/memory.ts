/**
 * Agent memory, backed by CockroachDB.
 *
 * Two layers, deliberately different in lifetime:
 *
 *   Working memory — the operator's open window. The client holds the running
 *   transcript and replays it as real conversation turns (see `buildMessages` in
 *   lib/agent/loop.ts), so "accept them" resolves against what was just said. It
 *   lives exactly as long as the window: closing it starts a new session id, and
 *   the copilot begins clean.
 *
 *   Recall — every turn is still written here with its embedding, and each new
 *   turn pulls back semantically-similar earlier turns via the C-SPANN vector
 *   index. Recall is scoped to the current session id, which is what keeps
 *   window-lifetime memory honest: the rows survive for audit, but a new window
 *   cannot reach them.
 */
import { query, toVectorLiteral } from "@/lib/db/client";

export type MemoryRole = "user" | "assistant" | "fact";

export interface MemoryTurn {
  role: MemoryRole;
  content: string;
  createdAt: string;
}

/** Persist one turn (with its embedding). Never throws into the request path. */
export async function saveTurn(
  sellerId: string,
  sessionId: string,
  role: MemoryRole,
  content: string,
  embedding: number[],
): Promise<void> {
  try {
    await query(
      `INSERT INTO agent_memory (seller_id, session_id, role, content, embedding)
       VALUES ($1,$2,$3,$4,$5::VECTOR)`,
      [sellerId, sessionId, role, content, toVectorLiteral(embedding)],
    );
  } catch (err) {
    // Memory is additive: a failed write must not cost the operator their answer.
    console.error("[memory] saveTurn failed:", err);
  }
}

/**
 * Semantically-similar earlier turns from *this* session — the long tail that
 * has already fallen out of the replayed transcript window.
 */
export async function recallMemory(
  sellerId: string,
  sessionId: string,
  embedding: number[],
  limit = 4,
): Promise<MemoryTurn[]> {
  try {
    const rows = await query<{ role: MemoryRole; content: string; created_at: string }>(
      `SELECT role, content, created_at
       FROM agent_memory
       WHERE seller_id = $1 AND session_id = $2
       ORDER BY embedding <-> $3::VECTOR
       LIMIT $4`,
      [sellerId, sessionId, toVectorLiteral(embedding), limit],
    );
    return rows.map((r) => ({ role: r.role, content: r.content, createdAt: r.created_at }));
  } catch (err) {
    console.error("[memory] recallMemory failed:", err);
    return [];
  }
}
