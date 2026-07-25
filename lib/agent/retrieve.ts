/**
 * Semantic retrieval over CockroachDB's C-SPANN vector indexes.
 *
 * All providers store unit-length vectors (Titan normalizes server-side; the
 * Gemini adapter normalizes in `lib/ai/contract.ts`), so L2 distance (`<->`) and
 * cosine rank identically. Queries work with or without the vector index — the
 * index just makes them fast at scale.
 */
import { query, toVectorLiteral } from "@/lib/db/client";

export interface CatalogMatch {
  entityType: string;
  entityId: string;
  content: string;
  metadata: Record<string, unknown> | null;
  distance: number;
}

/** Nearest catalog items (products/insights) to an embedded query. */
export async function searchCatalog(
  sellerId: string,
  embedding: number[],
  limit = 6,
): Promise<CatalogMatch[]> {
  const rows = await query<{
    entity_type: string;
    entity_id: string;
    content: string;
    metadata: Record<string, unknown> | null;
    distance: number;
  }>(
    `SELECT entity_type, entity_id, content, metadata,
            embedding <-> $1::VECTOR AS distance
     FROM catalog_embeddings
     WHERE seller_id = $2
     ORDER BY embedding <-> $1::VECTOR
     LIMIT $3`,
    [toVectorLiteral(embedding), sellerId, limit],
  );
  return rows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    content: r.content,
    metadata: r.metadata,
    distance: Number(r.distance),
  }));
}
