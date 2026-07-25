/**
 * POST /api/orders/status — revert order states the copilot changed.
 *
 * The action receipt in the copilot panel offers Undo, and an undo has to reach
 * the database too, or the next `order_search` would contradict the UI. Kept
 * deliberately narrow: it only sets `status` on orders belonging to the demo
 * tenant, addressed by order number.
 *
 * No-ops (successfully) when the DB isn't configured, so Undo still works on the
 * mock-only path where the change was browser-local to begin with.
 */
import { isDbConfigured } from "@/lib/config";
import { SELLER_ID } from "@/lib/constants";
import { ORDER_STATUS_META, type OrderStatus } from "@/lib/mock/orders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface StatusUpdate {
  number: string;
  status: OrderStatus;
}

const isStatus = (v: unknown): v is OrderStatus =>
  typeof v === "string" && v in ORDER_STATUS_META;

export async function POST(req: Request) {
  let updates: StatusUpdate[] = [];
  try {
    const body = (await req.json()) as { updates?: unknown };
    if (!Array.isArray(body.updates)) {
      return Response.json({ error: "Expected an `updates` array" }, { status: 400 });
    }
    updates = body.updates
      .slice(0, 100)
      .filter(
        (u): u is StatusUpdate =>
          !!u &&
          typeof u === "object" &&
          typeof (u as StatusUpdate).number === "string" &&
          isStatus((u as { status?: unknown }).status),
      );
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!updates.length) {
    return Response.json({ error: "No valid updates" }, { status: 400 });
  }
  if (!isDbConfigured()) {
    return Response.json({ ok: true, updated: 0, persisted: false });
  }

  // One statement per target status rather than one per order.
  const byStatus = new Map<OrderStatus, string[]>();
  for (const u of updates) {
    const numbers = byStatus.get(u.status) ?? [];
    numbers.push(u.number);
    byStatus.set(u.status, numbers);
  }

  try {
    const { query } = await import("@/lib/db/client");
    let updated = 0;
    for (const [status, numbers] of byStatus) {
      const rows = await query<{ id: string }>(
        `UPDATE orders SET status = $1
         WHERE seller_id = $2 AND number = ANY($3::STRING[])
         RETURNING id`,
        [status, SELLER_ID, numbers],
      );
      updated += rows.length;
    }
    return Response.json({ ok: true, updated, persisted: true });
  } catch (err) {
    console.error("[orders/status] update failed:", err);
    return Response.json({ error: "Update failed" }, { status: 500 });
  }
}
