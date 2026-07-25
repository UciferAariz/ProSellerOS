/**
 * Operator tools — the copilot doing the work, not just describing it.
 *
 * Each tool here does two things: it writes the change to CockroachDB (so the
 * next SQL read agrees with what the operator sees), and it returns a
 * {@link ClientAction} that the browser applies to the live OS surface — the
 * order/product stores, the router, a file download. That split is what makes
 * "accept the pending Amazon orders and download their labels" one turn instead
 * of a walkthrough.
 *
 * Read tools live alongside these so the agent can look before it acts.
 */
import { query } from "@/lib/db/client";
import type { ToolResult } from "@/lib/agent/tools";
import type { ClientAction, LabelOrder, TouchedOrder } from "@/lib/agent/actions";
import type { OrderStatus } from "@/lib/mock/orders";
import type { MarketplaceId } from "@/lib/mock/marketplaces";

// ── Input normalization ─────────────────────────────────────────────────────
// The model paraphrases ("accept", "awaiting fulfillment", "48210"), so every
// selector is normalized before it reaches SQL.

const STATUS_ALIASES: Record<string, OrderStatus> = {
  pending: "pending",
  awaiting: "pending",
  unfulfilled: "pending",
  new: "pending",
  confirm: "confirmed",
  confirmed: "confirmed",
  accept: "confirmed",
  accepted: "confirmed",
  approve: "confirmed",
  approved: "confirmed",
  pack: "packed",
  packed: "packed",
  ship: "shipped",
  shipped: "shipped",
  dispatched: "shipped",
  deliver: "delivered",
  delivered: "delivered",
  complete: "delivered",
  completed: "delivered",
  cancel: "cancelled",
  cancelled: "cancelled",
  canceled: "cancelled",
  reject: "cancelled",
  return: "returned",
  returned: "returned",
  refunded: "returned",
};

function normalizeStatus(raw?: string): OrderStatus | undefined {
  if (!raw) return undefined;
  const key = raw.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? STATUS_ALIASES[key.replace(/\s+/g, "")];
}

/** "48210" / "PS-48210" / "#ps-48210" all mean order #PS-48210. */
function normalizeOrderNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  return digits ? `#PS-${digits}` : raw.trim();
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Loose filter over the order queue, shared by every order tool. */
export interface OrderSelector {
  order_numbers?: string[];
  from_status?: string;
  payment?: string;
  marketplace?: string;
  city?: string;
  customer?: string;
  flagged?: boolean;
  limit?: number;
}

interface OrderFilter {
  where: string;
  params: unknown[];
  limit: number;
  /** Human-readable filter, for the tool summary the model reads back. */
  description: string;
  /** True when nothing was specified — a bare "everything" match. */
  unscoped: boolean;
}

function buildOrderFilter(
  sellerId: string,
  sel: OrderSelector,
  defaultLimit = 25,
): OrderFilter {
  const clauses = ["seller_id = $1"];
  const params: unknown[] = [sellerId];
  const described: string[] = [];
  const bind = (value: unknown) => `$${params.push(value)}`;

  if (sel.order_numbers?.length) {
    const numbers = sel.order_numbers.map(normalizeOrderNumber);
    clauses.push(`number = ANY(${bind(numbers)}::STRING[])`);
    described.push(numbers.join(", "));
  }
  const from = normalizeStatus(sel.from_status);
  if (from) {
    clauses.push(`status = ${bind(from)}`);
    described.push(`status ${from}`);
  }
  if (sel.payment) {
    const payment = sel.payment.trim().toLowerCase().startsWith("c") ? "cod" : "prepaid";
    clauses.push(`payment = ${bind(payment)}`);
    described.push(payment.toUpperCase());
  }
  if (sel.marketplace) {
    clauses.push(`marketplace = ${bind(sel.marketplace.trim().toLowerCase())}`);
    described.push(sel.marketplace);
  }
  if (sel.city) {
    clauses.push(`city ILIKE ${bind(`%${sel.city.trim()}%`)}`);
    described.push(`to ${sel.city}`);
  }
  if (sel.customer) {
    clauses.push(`customer ILIKE ${bind(`%${sel.customer.trim()}%`)}`);
    described.push(`customer ${sel.customer}`);
  }
  if (sel.flagged !== undefined) {
    clauses.push(`flagged = ${bind(sel.flagged)}`);
    described.push(sel.flagged ? "flagged" : "not flagged");
  }

  return {
    where: clauses.join(" AND "),
    params,
    limit: clamp(Math.round(sel.limit ?? defaultLimit), 1, 100),
    description: described.length ? described.join(", ") : "all orders",
    unscoped: described.length === 0,
  };
}

interface OrderRow {
  id: string;
  number: string;
  customer: string;
  city: string;
  marketplace: string;
  status: OrderStatus;
  payment: "prepaid" | "cod";
  total: string;
  item_count: number;
}

const ORDER_COLUMNS =
  "id, number, customer, city, marketplace, status, payment, total, item_count";

async function selectOrders(filter: OrderFilter): Promise<OrderRow[]> {
  return query<OrderRow>(
    `SELECT ${ORDER_COLUMNS} FROM orders
     WHERE ${filter.where}
     ORDER BY placed_at DESC
     LIMIT ${filter.limit}`,
    filter.params,
  );
}

async function countOrders(filter: OrderFilter): Promise<number> {
  const [row] = await query<{ n: string }>(
    `SELECT COUNT(*) AS n FROM orders WHERE ${filter.where}`,
    filter.params,
  );
  return Number(row?.n ?? 0);
}

const money = (v: number) => `$${v.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// ── Read tools ──────────────────────────────────────────────────────────────

/** Find orders matching any combination of filters, with the true match count. */
export async function orderSearch(
  sellerId: string,
  sel: OrderSelector,
): Promise<ToolResult> {
  const filter = buildOrderFilter(sellerId, sel, 15);
  const [total, rows] = await Promise.all([countOrders(filter), selectOrders(filter)]);

  if (!total) {
    return { summary: `No orders match ${filter.description}.` };
  }

  const lines = rows
    .slice(0, 15)
    .map(
      (r) =>
        `${r.number} · ${r.customer} · ${r.city} · ${r.marketplace} · ${r.payment} · ` +
        `${money(Number(r.total))} · ${r.status}`,
    );
  const shown = Math.min(rows.length, 15);

  return {
    summary:
      `${total} order${total === 1 ? "" : "s"} match ${filter.description}` +
      `${shown < total ? ` (showing ${shown})` : ""}:\n${lines.join("\n")}`,
    widget: {
      kind: "orders",
      title: `Orders · ${filter.description}`,
      total,
      rows: rows.map((r) => ({
        id: r.id,
        number: r.number,
        customer: r.customer,
        city: r.city,
        marketplace: r.marketplace,
        status: r.status,
        payment: r.payment,
        total: Number(r.total),
      })),
    },
  };
}

/** Queue health: counts by status and payment, plus revenue on the books. */
export async function orderStats(sellerId: string): Promise<ToolResult> {
  const [byStatus, byPayment, [totals]] = await Promise.all([
    query<{ status: OrderStatus; n: string }>(
      `SELECT status, COUNT(*) AS n FROM orders WHERE seller_id = $1
       GROUP BY status ORDER BY n DESC`,
      [sellerId],
    ),
    query<{ payment: string; n: string; value: string }>(
      `SELECT payment, COUNT(*) AS n, COALESCE(SUM(total),0) AS value
       FROM orders WHERE seller_id = $1 GROUP BY payment ORDER BY n DESC`,
      [sellerId],
    ),
    query<{ n: string; revenue: string }>(
      `SELECT COUNT(*) AS n, COALESCE(SUM(total),0) AS revenue
       FROM orders WHERE seller_id = $1`,
      [sellerId],
    ),
  ]);

  const total = Number(totals?.n ?? 0);
  const revenue = Math.round(Number(totals?.revenue ?? 0));
  const statusText = byStatus.map((r) => `${r.n} ${r.status}`).join(", ");
  const paymentText = byPayment
    .map((r) => `${r.n} ${r.payment.toUpperCase()} (${money(Math.round(Number(r.value)))})`)
    .join(", ");

  return {
    summary:
      `${total} orders worth ${money(revenue)}. By status: ${statusText}. ` +
      `By payment: ${paymentText}.`,
    widget: {
      kind: "order-stats",
      total,
      revenue,
      byStatus: byStatus.map((r) => ({ label: r.status, count: Number(r.n) })),
      byPayment: byPayment.map((r) => ({ label: r.payment, count: Number(r.n) })),
    },
  };
}

// ── Write tools ─────────────────────────────────────────────────────────────

/**
 * Move orders through the fulfillment flow — "accept these", "mark them
 * shipped", "cancel the flagged ones".
 */
export async function setOrderStatus(
  sellerId: string,
  args: OrderSelector & { to_status?: string; courier?: string },
): Promise<ToolResult> {
  const target = normalizeStatus(args.to_status);
  if (!target) {
    return {
      summary:
        `Cannot act: "${args.to_status ?? ""}" is not a fulfillment state. ` +
        `Valid: pending, confirmed, packed, shipped, delivered, cancelled, returned.`,
    };
  }

  const filter = buildOrderFilter(sellerId, args, 50);
  if (filter.unscoped) {
    return {
      summary:
        "Refused: that would rewrite every order. Narrow it down first — by " +
        "order number, current status, channel, or payment method.",
    };
  }

  const matched = await selectOrders(filter);
  const movable = matched.filter((o) => o.status !== target);
  if (!movable.length) {
    return {
      summary: matched.length
        ? `All ${matched.length} matching orders are already ${target} — nothing to do.`
        : `No orders match ${filter.description}, so nothing was changed.`,
    };
  }

  const ids = movable.map((o) => o.id);
  await query(
    `UPDATE orders SET status = $1 WHERE seller_id = $2 AND id = ANY($3::STRING[])`,
    [target, sellerId, ids],
  );

  const orders: TouchedOrder[] = movable.map((o) => ({
    id: o.id,
    number: o.number,
    from: o.status,
  }));
  const value = movable.reduce((s, o) => s + Number(o.total), 0);

  return {
    summary:
      `Moved ${movable.length} order${movable.length === 1 ? "" : "s"} (${filter.description}) ` +
      `to ${target}, worth ${money(Math.round(value))}: ` +
      `${orders.slice(0, 8).map((o) => o.number).join(", ")}` +
      `${orders.length > 8 ? `, +${orders.length - 8} more` : ""}.`,
    action: {
      kind: "order_status",
      status: target,
      courier: args.courier,
      orders,
    },
  };
}

/**
 * Generate the shipping-label sheet for a set of orders. Printing a label is
 * what assigns the courier and tracking number, so the action carries both.
 */
export async function printLabels(
  sellerId: string,
  sel: OrderSelector & { courier?: string },
): Promise<ToolResult> {
  // Labels only make sense for orders that are accepted but not yet in transit.
  const scoped = sel.order_numbers?.length || sel.from_status ? sel : { ...sel, from_status: "confirmed" };
  const filter = buildOrderFilter(sellerId, scoped, 40);
  const rows = await selectOrders(filter);

  if (!rows.length) {
    return { summary: `No orders match ${filter.description}, so there are no labels to print.` };
  }

  const courier = sel.courier?.trim() || "Shiprocket";
  const orders: LabelOrder[] = rows.map((r) => ({
    id: r.id,
    number: r.number,
    customer: r.customer,
    city: r.city,
    marketplace: r.marketplace,
    courier,
    // A label is where tracking is born; derive it from the order number so a
    // reprint of the same order yields the same tracking id.
    tracking: `TRK${r.number.replace(/\D/g, "").padStart(9, "4")}`,
    itemCount: Number(r.item_count),
    total: Number(r.total),
  }));

  return {
    summary:
      `Prepared ${orders.length} ${courier} label${orders.length === 1 ? "" : "s"} ` +
      `for ${filter.description}: ${orders.slice(0, 8).map((o) => o.number).join(", ")}` +
      `${orders.length > 8 ? `, +${orders.length - 8} more` : ""}. ` +
      `The sheet downloads in the operator's browser, print-ready at 4x6.`,
    action: { kind: "labels", orders },
  };
}

/** Download a CSV of orders or products, filtered however the operator asked. */
export async function exportData(
  sellerId: string,
  args: OrderSelector & { entity?: string },
): Promise<ToolResult> {
  const entity = (args.entity ?? "orders").trim().toLowerCase() === "products" ? "products" : "orders";

  if (entity === "products") {
    const limit = clamp(Math.round(args.limit ?? 100), 1, 500);
    const rows = await query<Record<string, unknown>>(
      `SELECT sku, name, category, brand, price, cost, stock, status,
              units_30d, revenue_30d, trend, margin
       FROM products WHERE seller_id = $1 ORDER BY revenue_30d DESC LIMIT ${limit}`,
      [sellerId],
    );
    return {
      summary: `Exported ${rows.length} products to CSV; the download has started.`,
      action: { kind: "export", filename: "products", rows },
    };
  }

  const filter = buildOrderFilter(sellerId, { ...args, limit: args.limit ?? 100 }, 100);
  const rows = await query<Record<string, unknown>>(
    `SELECT number, customer, city, marketplace, status, payment, total,
            item_count, placed_at, flagged
     FROM orders WHERE ${filter.where} ORDER BY placed_at DESC LIMIT ${filter.limit}`,
    filter.params,
  );
  if (!rows.length) {
    return { summary: `No orders match ${filter.description}, so there was nothing to export.` };
  }
  return {
    summary: `Exported ${rows.length} orders (${filter.description}) to CSV; the download has started.`,
    action: { kind: "export", filename: "orders", rows },
  };
}

/** Log a manual order into the queue as pending fulfillment. */
export async function createOrder(
  sellerId: string,
  args: {
    customer?: string;
    total?: number;
    marketplace?: string;
    city?: string;
    payment?: string;
  },
): Promise<ToolResult> {
  const customer = args.customer?.trim();
  const total = Number(args.total);
  if (!customer || !Number.isFinite(total) || total <= 0) {
    return {
      summary: "Cannot create the order: a customer name and a positive order total are both required.",
    };
  }

  // Resolve the channel against the real marketplace list, by id or by name.
  const wanted = (args.marketplace ?? "amazon").trim().toLowerCase();
  const [channel] = await query<{ id: string; name: string }>(
    `SELECT id, name FROM marketplaces
     WHERE id = $1 OR lower(name) = $1 LIMIT 1`,
    [wanted],
  );
  if (!channel) {
    return { summary: `Unknown channel "${args.marketplace}". Nothing was created.` };
  }

  const [maxRow] = await query<{ n: string }>(
    `SELECT COALESCE(MAX(CAST(regexp_replace(number, '[^0-9]', '', 'g') AS INT)), 48210) AS n
     FROM orders WHERE seller_id = $1`,
    [sellerId],
  );
  const number = `#PS-${Number(maxRow?.n ?? 48210) + 1}`;
  const id = `order_${Date.now()}`;
  const payment = (args.payment ?? "prepaid").trim().toLowerCase().startsWith("c") ? "cod" : "prepaid";
  const city = args.city?.trim() || "Mumbai";
  const amount = +total.toFixed(2);

  await query(
    `INSERT INTO orders (id, seller_id, number, marketplace, customer, city,
                         status, payment, total, item_count, placed_at, flagged)
     VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8,1,now(),false)`,
    [id, sellerId, number, channel.id, customer, city, payment, amount],
  );
  await query(
    `INSERT INTO order_items (order_id, product_id, name, sku, qty, price, seq)
     VALUES ($1,'manual','Manual order line','MANUAL',1,$2,0)`,
    [id, amount],
  );

  return {
    summary:
      `Created order ${number} for ${customer} on ${channel.name} ` +
      `(${money(amount)}, ${payment}), shipping to ${city}. It is pending fulfillment.`,
    action: {
      kind: "create_order",
      order: {
        id,
        number,
        customer,
        marketplace: channel.id as MarketplaceId,
        city,
        total: amount,
        payment,
      },
    },
  };
}

/**
 * Look up one product by SKU or by a fuzzy name match.
 *
 * `price` and `stock` are coerced here rather than at each call site: node-pg
 * hands back CockroachDB's INT/DECIMAL columns as strings, and a string `stock`
 * would turn `stock + add_units` into string concatenation.
 */
async function findProduct(sellerId: string, sku?: string, name?: string) {
  const needle = sku?.trim() || name?.trim();
  if (!needle) return undefined;
  const [row] = await query<{
    id: string;
    sku: string;
    name: string;
    price: string;
    stock: string;
  }>(
    `SELECT id, sku, name, price, stock FROM products
     WHERE seller_id = $1 AND (sku ILIKE $2 OR name ILIKE $3)
     ORDER BY revenue_30d DESC LIMIT 1`,
    [sellerId, needle, `%${needle}%`],
  );
  return row && { ...row, price: Number(row.price), stock: Number(row.stock) };
}

/** Re-price a SKU, either to an absolute price or by a percentage. */
export async function updatePrice(
  sellerId: string,
  args: { sku?: string; product_name?: string; new_price?: number; percent_change?: number },
): Promise<ToolResult> {
  const product = await findProduct(sellerId, args.sku, args.product_name);
  if (!product) {
    return { summary: `No product matches "${args.sku ?? args.product_name ?? ""}". Nothing was changed.` };
  }

  const from = Number(product.price);
  const to =
    Number.isFinite(Number(args.new_price)) && Number(args.new_price) > 0
      ? +Number(args.new_price).toFixed(2)
      : Number.isFinite(Number(args.percent_change))
        ? +(from * (1 + Number(args.percent_change) / 100)).toFixed(2)
        : NaN;

  if (!Number.isFinite(to) || to <= 0) {
    return {
      summary: "Cannot re-price: provide either new_price or percent_change. Nothing was changed.",
    };
  }

  await query(
    `UPDATE products SET price = $1, margin = ROUND(((($1 - cost) / $1) * 100)::DECIMAL, 1)
     WHERE seller_id = $2 AND id = $3`,
    [to, sellerId, product.id],
  );
  await query(
    `UPDATE product_listings SET price = $1 WHERE product_id = $2`,
    [to, product.id],
  );

  const delta = (((to - from) / from) * 100).toFixed(1);
  return {
    summary:
      `Re-priced "${product.name}" (${product.sku}) from ${money(from)} to ${money(to)} ` +
      `(${Number(delta) > 0 ? "+" : ""}${delta}%) across every connected channel.`,
    action: {
      kind: "price_change",
      updates: [{ id: product.id, sku: product.sku, name: product.name, from, to }],
    },
  };
}

/** Raise stock on hand for a SKU — by an amount, or to a target level. */
export async function restockProduct(
  sellerId: string,
  args: { sku?: string; product_name?: string; add_units?: number; set_to?: number },
): Promise<ToolResult> {
  const product = await findProduct(sellerId, args.sku, args.product_name);
  if (!product) {
    return { summary: `No product matches "${args.sku ?? args.product_name ?? ""}". Nothing was changed.` };
  }

  const from = product.stock;
  const to = Number.isFinite(Number(args.set_to))
    ? Math.max(0, Math.round(Number(args.set_to)))
    : Number.isFinite(Number(args.add_units))
      ? Math.max(0, from + Math.round(Number(args.add_units)))
      : NaN;

  if (!Number.isFinite(to)) {
    return {
      summary: "Cannot restock: provide either add_units or set_to. Nothing was changed.",
    };
  }

  await query(
    `UPDATE products SET stock = $1, status = CASE WHEN $1 > 0 THEN 'active' ELSE status END
     WHERE seller_id = $2 AND id = $3`,
    [to, sellerId, product.id],
  );

  return {
    summary:
      `Restocked "${product.name}" (${product.sku}) from ${from} to ${to} units on hand.`,
    action: { kind: "restock", id: product.id, sku: product.sku, name: product.name, from, to },
  };
}

// ── Navigation ──────────────────────────────────────────────────────────────

const DESTINATIONS: Record<string, { path: string; label: string }> = {
  dashboard: { path: "/dashboard", label: "the Dashboard" },
  home: { path: "/dashboard", label: "the Dashboard" },
  overview: { path: "/dashboard", label: "the Dashboard" },
  products: { path: "/products", label: "Products" },
  catalog: { path: "/products", label: "Products" },
  orders: { path: "/orders", label: "Orders" },
  marketplaces: { path: "/marketplaces", label: "Marketplaces" },
  channels: { path: "/marketplaces", label: "Marketplaces" },
  assistant: { path: "/assistant", label: "the AI Assistant" },
  inventory: { path: "/inventory", label: "Inventory" },
  stock: { path: "/inventory", label: "Inventory" },
  warehouse: { path: "/inventory", label: "Inventory" },
  customers: { path: "/customers", label: "Customers" },
  buyers: { path: "/customers", label: "Customers" },
  finance: { path: "/finance", label: "Finance" },
  payouts: { path: "/finance", label: "Finance" },
  accounting: { path: "/finance", label: "Finance" },
  marketing: { path: "/marketing", label: "Marketing" },
  campaigns: { path: "/marketing", label: "Marketing" },
  ads: { path: "/marketing", label: "Marketing" },
  analytics: { path: "/analytics", label: "Analytics" },
  reports: { path: "/analytics", label: "Analytics" },
  automation: { path: "/automation", label: "Automation" },
  rules: { path: "/automation", label: "Automation" },
  workflows: { path: "/automation", label: "Automation" },
};

/** Take the operator somewhere in the OS, deep-linked where it helps. */
export async function navigateTo(
  sellerId: string,
  args: {
    destination?: string;
    order_number?: string;
    sku?: string;
    order_status?: string;
    flagged?: boolean;
  },
): Promise<ToolResult> {
  // A specific record beats a section: deep-link straight to its detail page.
  if (args.order_number) {
    const number = normalizeOrderNumber(args.order_number);
    const [order] = await query<{ id: string; number: string; customer: string }>(
      `SELECT id, number, customer FROM orders WHERE seller_id = $1 AND number = $2 LIMIT 1`,
      [sellerId, number],
    );
    if (!order) return { summary: `No order ${number} exists, so there is nothing to open.` };
    return {
      summary: `Opened order ${order.number} (${order.customer}).`,
      action: {
        kind: "navigate",
        path: `/orders/${order.id}`,
        label: `order ${order.number}`,
      },
    };
  }

  if (args.sku) {
    const product = await findProduct(sellerId, args.sku);
    if (!product) return { summary: `No product matches "${args.sku}", so there is nothing to open.` };
    return {
      summary: `Opened "${product.name}" (${product.sku}).`,
      action: {
        kind: "navigate",
        path: `/products/${product.id}`,
        label: product.name,
      },
    };
  }

  const key = (args.destination ?? "").trim().toLowerCase();
  const dest = DESTINATIONS[key];
  if (!dest) {
    return {
      summary:
        `"${args.destination ?? ""}" is not a page in ProSellerOS. ` +
        `Available: dashboard, products, orders, marketplaces, assistant, ` +
        `inventory, customers, finance, marketing, analytics, automation.`,
    };
  }

  // Orders reads its filters from the URL, so "show me the flagged pending
  // orders" lands on that exact view rather than the full queue.
  const orders = dest.path === "/orders";
  const status = orders ? normalizeStatus(args.order_status) : undefined;
  const flagged = orders && args.flagged === true;

  const params = [
    status ? `status=${status}` : "",
    flagged ? "flagged=1" : "",
  ].filter(Boolean);
  const path = params.length ? `${dest.path}?${params.join("&")}` : dest.path;
  const label =
    status || flagged
      ? `${[flagged ? "flagged" : "", status ?? ""].filter(Boolean).join(" ")} orders`
      : dest.label;

  return {
    summary: `Opened ${label}.`,
    action: { kind: "navigate", path, label },
  };
}

/** Flip the interface between light and dark. */
export function setTheme(args: { mode?: string }): ToolResult {
  const mode = (args.mode ?? "").trim().toLowerCase() === "light" ? "light" : "dark";
  return {
    summary: `Switched the interface to ${mode} mode.`,
    action: { kind: "theme", mode },
  };
}

/** Re-export so `loop.ts` has one import site for action types. */
export type { ClientAction };
