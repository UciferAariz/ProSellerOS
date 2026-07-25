/**
 * Client actions — the copilot's hands inside the portal.
 *
 * Read tools answer questions; these let the agent *operate* ProSellerOS. The
 * agent runs on the server, but the OS surface (routing, the order/product
 * stores, downloads, theme) lives in the browser — so an action tool does its
 * server-side half (the SQL write) and returns one of these, which the route
 * streams to the client as an `action` event for `CopilotProvider` to execute.
 *
 * Every action is a complete, self-describing instruction: the client never has
 * to re-resolve which records were meant, and the receipt UI (and Undo) renders
 * straight off the payload.
 */
import type { OrderStatus } from "@/lib/mock/orders";
import type { MarketplaceId } from "@/lib/mock/marketplaces";

/** One order as printed on a shipping label. */
export interface LabelOrder {
  id: string;
  number: string;
  customer: string;
  city: string;
  marketplace: string;
  courier: string;
  tracking: string;
  itemCount: number;
  total: number;
}

/** An order the agent moved through the fulfillment flow. */
export interface TouchedOrder {
  id: string;
  number: string;
  from: OrderStatus;
}

export type ClientAction =
  /** Route the operator somewhere in the OS (optionally deep-linked/filtered). */
  | { kind: "navigate"; path: string; label: string }
  /** Advance/revert orders in the fulfillment flow. */
  | { kind: "order_status"; status: OrderStatus; courier?: string; orders: TouchedOrder[] }
  /** Download a print-ready shipping-label sheet. */
  | { kind: "labels"; orders: LabelOrder[] }
  /** Download a CSV of whatever the agent queried. */
  | { kind: "export"; filename: string; rows: Record<string, unknown>[] }
  /** Add a manual order to the queue. */
  | {
      kind: "create_order";
      order: {
        id: string;
        number: string;
        customer: string;
        marketplace: MarketplaceId;
        city: string;
        total: number;
        payment: "prepaid" | "cod";
      };
    }
  /** Re-price one or more SKUs across every channel. */
  | {
      kind: "price_change";
      updates: { id: string; sku: string; name: string; from: number; to: number }[];
    }
  /** Raise stock on hand for one SKU. */
  | { kind: "restock"; id: string; sku: string; name: string; from: number; to: number }
  /** Flip the UI theme. */
  | { kind: "theme"; mode: "light" | "dark" };

/** Short receipt line shown under the answer once an action has run. */
export function actionLabel(action: ClientAction): string {
  switch (action.kind) {
    case "navigate":
      return `Opened ${action.label}`;
    case "order_status": {
      const n = action.orders.length;
      return `${n} order${n === 1 ? "" : "s"} → ${action.status}`;
    }
    case "labels":
      return `${action.orders.length} shipping label${action.orders.length === 1 ? "" : "s"} downloaded`;
    case "export":
      return `Exported ${action.rows.length} rows to ${action.filename}.csv`;
    case "create_order":
      return `Created order ${action.order.number}`;
    case "price_change": {
      const n = action.updates.length;
      return `Re-priced ${n} SKU${n === 1 ? "" : "s"}`;
    }
    case "restock":
      return `${action.sku} restocked to ${action.to} units`;
    case "theme":
      return `Switched to ${action.mode} mode`;
  }
}
