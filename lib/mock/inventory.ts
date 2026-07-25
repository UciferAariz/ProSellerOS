/**
 * Inventory — stock positions layered over the live product catalog.
 *
 * Stock on hand lives on `Product` (and the copilot's restock tool writes to
 * it), so inventory is *derived* rather than duplicated: pass the current
 * product list in and get back positions, cover, and per-warehouse splits. The
 * per-product jitter (reserved units, warehouse allocation) is hashed off the
 * product id instead of a sequential RNG so a position stays stable even when
 * products are added, edited, or removed at runtime.
 */
import { makeRng } from "./rng";
import { PRODUCTS, type Product } from "./products";

const REF = new Date("2026-07-23T14:30:00Z").getTime();
const hoursAgo = (h: number) => new Date(REF - h * 3600000).toISOString();
const daysAhead = (d: number) => new Date(REF + d * 86400000).toISOString();

/** Stable 0..1 value derived from a string key — survives list mutation. */
function hash01(key: string, salt = 0): number {
  let h = (2166136261 ^ salt) >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ── Warehouses ──────────────────────────────────────────────────────────────

export interface Warehouse {
  id: string;
  name: string;
  code: string;
  city: string;
  kind: "owned" | "3pl" | "marketplace";
  capacity: number;
}

export const WAREHOUSES: Warehouse[] = [
  { id: "wh_bom", name: "Mumbai Fulfilment Centre", code: "BOM-1", city: "Mumbai", kind: "owned", capacity: 42000 },
  { id: "wh_blr", name: "Bengaluru Hub", code: "BLR-2", city: "Bengaluru", kind: "owned", capacity: 26000 },
  { id: "wh_del", name: "Delhi NCR 3PL", code: "DEL-3", city: "Gurugram", kind: "3pl", capacity: 18000 },
  { id: "wh_fba", name: "Amazon FBA", code: "FBA-US", city: "Newark", kind: "marketplace", capacity: 24000 },
  { id: "wh_fks", name: "Flipkart Smart", code: "FKS-1", city: "Hyderabad", kind: "marketplace", capacity: 12000 },
];

export const WAREHOUSE_BY_ID: Record<string, Warehouse> = Object.fromEntries(
  WAREHOUSES.map((w) => [w.id, w])
);

// ── Stock positions ─────────────────────────────────────────────────────────

export type StockStatus = "out" | "critical" | "low" | "healthy" | "overstock";

export const STOCK_STATUS_META: Record<
  StockStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" }
> = {
  out: { label: "Out of stock", variant: "danger" },
  critical: { label: "Critical", variant: "danger" },
  low: { label: "Low", variant: "warning" },
  healthy: { label: "Healthy", variant: "success" },
  overstock: { label: "Overstock", variant: "info" },
};

export interface StockLocation {
  warehouseId: string;
  name: string;
  code: string;
  units: number;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  brand: string;
  image: string;
  /** Physical units across every location. */
  onHand: number;
  /** Allocated to unfulfilled orders — not sellable. */
  reserved: number;
  /** onHand − reserved. */
  available: number;
  /** Units on an open purchase order. */
  incoming: number;
  reorderPoint: number;
  cost: number;
  price: number;
  /** Stock value at cost. */
  value: number;
  /** Units sold per day over the last 30 days. */
  velocity: number;
  /** Days until `available` runs out at current velocity (capped at 999). */
  daysOfCover: number;
  status: StockStatus;
  locations: StockLocation[];
  lastCountedAt: string;
}

function statusFor(item: {
  onHand: number;
  available: number;
  reorderPoint: number;
  daysOfCover: number;
}): StockStatus {
  if (item.onHand <= 0) return "out";
  if (item.available <= item.reorderPoint * 0.5) return "critical";
  if (item.available <= item.reorderPoint) return "low";
  if (item.daysOfCover > 120) return "overstock";
  return "healthy";
}

/** Split stock across 2–4 warehouses, weighted but deterministic per product. */
function allocate(productId: string, onHand: number): StockLocation[] {
  const count = 2 + Math.floor(hash01(productId, 7) * 3); // 2..4
  const picked = [...WAREHOUSES]
    .sort((a, b) => hash01(productId + a.id, 3) - hash01(productId + b.id, 3))
    .slice(0, count);
  const weights = picked.map((w) => 0.15 + hash01(productId + w.id, 11));
  const totalWeight = weights.reduce((s, w) => s + w, 0);

  let assigned = 0;
  return picked.map((w, i) => {
    // Last location absorbs the rounding remainder so the split always sums to onHand.
    const units =
      i === picked.length - 1
        ? onHand - assigned
        : Math.round((weights[i] / totalWeight) * onHand);
    assigned += units;
    return { warehouseId: w.id, name: w.name, code: w.code, units: Math.max(0, units) };
  });
}

export function buildInventory(products: Product[] = PRODUCTS): InventoryItem[] {
  return products
    .filter((p) => p.status !== "archived")
    .map((p) => {
      const onHand = p.stock;
      // Reserved tracks demand, so scale it off velocity rather than stock —
      // a slow-moving SKU with deep stock should not look heavily allocated.
      const velocity = +(p.units30d / 30).toFixed(2);
      const reserved = Math.min(
        onHand,
        Math.round(velocity * (0.6 + hash01(p.id, 23) * 2.4))
      );
      const available = Math.max(0, onHand - reserved);
      const incoming =
        hash01(p.id, 31) < 0.28 ? Math.round(40 + hash01(p.id, 37) * 460) : 0;
      const daysOfCover =
        velocity > 0 ? Math.min(999, +(available / velocity).toFixed(1)) : 999;

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        brand: p.brand,
        image: p.image,
        onHand,
        reserved,
        available,
        incoming,
        reorderPoint: p.reorderPoint,
        cost: p.cost,
        price: p.price,
        value: +(onHand * p.cost).toFixed(2),
        velocity,
        daysOfCover,
        status: statusFor({ onHand, available, reorderPoint: p.reorderPoint, daysOfCover }),
        locations: allocate(p.id, onHand),
        lastCountedAt: hoursAgo(Math.round(hash01(p.id, 41) * 720)),
      };
    });
}

export interface InventorySummary {
  skus: number;
  units: number;
  value: number;
  reserved: number;
  incoming: number;
  lowCount: number;
  outCount: number;
  overstockCount: number;
  /** Stock value sitting in SKUs with >120 days of cover. */
  deadStockValue: number;
  /** Weighted average days of cover across the catalog. */
  avgCover: number;
}

export function inventorySummary(items: InventoryItem[]): InventorySummary {
  const units = items.reduce((s, i) => s + i.onHand, 0);
  const coverWeighted = items.reduce((s, i) => s + Math.min(i.daysOfCover, 365) * i.onHand, 0);
  return {
    skus: items.length,
    units,
    value: +items.reduce((s, i) => s + i.value, 0).toFixed(2),
    reserved: items.reduce((s, i) => s + i.reserved, 0),
    incoming: items.reduce((s, i) => s + i.incoming, 0),
    lowCount: items.filter((i) => i.status === "low" || i.status === "critical").length,
    outCount: items.filter((i) => i.status === "out").length,
    overstockCount: items.filter((i) => i.status === "overstock").length,
    deadStockValue: +items
      .filter((i) => i.daysOfCover > 120)
      .reduce((s, i) => s + i.value, 0)
      .toFixed(2),
    avgCover: units ? +(coverWeighted / units).toFixed(1) : 0,
  };
}

/** Units held per warehouse, for the capacity cards. */
export function warehouseLoad(items: InventoryItem[]) {
  return WAREHOUSES.map((w) => {
    const units = items.reduce(
      (s, i) => s + (i.locations.find((l) => l.warehouseId === w.id)?.units ?? 0),
      0
    );
    const value = items.reduce((s, i) => {
      const loc = i.locations.find((l) => l.warehouseId === w.id);
      return s + (loc ? loc.units * i.cost : 0);
    }, 0);
    return {
      ...w,
      units,
      value: +value.toFixed(2),
      utilization: +Math.min(100, (units / w.capacity) * 100).toFixed(1),
      skus: items.filter((i) => i.locations.some((l) => l.warehouseId === w.id && l.units > 0)).length,
    };
  });
}

// ── Suppliers & purchase orders ─────────────────────────────────────────────

export interface Supplier {
  id: string;
  name: string;
  city: string;
  leadTimeDays: number;
  onTimeRate: number;
  rating: number;
}

export const SUPPLIERS: Supplier[] = [
  { id: "sup_1", name: "Vireo Textiles Pvt Ltd", city: "Tiruppur", leadTimeDays: 12, onTimeRate: 96, rating: 4.7 },
  { id: "sup_2", name: "Nordheim Electronics", city: "Shenzhen", leadTimeDays: 24, onTimeRate: 89, rating: 4.3 },
  { id: "sup_3", name: "Terra Home Goods", city: "Jaipur", leadTimeDays: 9, onTimeRate: 98, rating: 4.9 },
  { id: "sup_4", name: "Lumen Beauty Labs", city: "Ahmedabad", leadTimeDays: 15, onTimeRate: 92, rating: 4.5 },
  { id: "sup_5", name: "Bolt Sports Mfg", city: "Meerut", leadTimeDays: 18, onTimeRate: 85, rating: 4.1 },
];

export type PoStatus = "draft" | "submitted" | "in_transit" | "received" | "cancelled";

export const PO_STATUS_META: Record<
  PoStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "default" }
> = {
  draft: { label: "Draft", variant: "secondary" },
  submitted: { label: "Submitted", variant: "info" },
  in_transit: { label: "In transit", variant: "default" },
  received: { label: "Received", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export interface PurchaseOrderLine {
  sku: string;
  name: string;
  qty: number;
  unitCost: number;
}

export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplier: string;
  warehouseId: string;
  status: PoStatus;
  lines: PurchaseOrderLine[];
  units: number;
  total: number;
  createdAt: string;
  etaAt: string;
  receivedAt?: string;
}

function generatePurchaseOrders(): PurchaseOrder[] {
  const rng = makeRng(64021);
  const statuses: PoStatus[] = [
    "in_transit", "in_transit", "submitted", "submitted", "received",
    "received", "received", "draft", "in_transit", "submitted",
    "received", "draft", "in_transit", "cancelled",
  ];

  return statuses.map((status, i) => {
    const supplier = rng.pick(SUPPLIERS);
    const warehouse = rng.pick(WAREHOUSES);
    const lineCount = rng.int(1, 4);
    const lines: PurchaseOrderLine[] = [];
    for (let j = 0; j < lineCount; j++) {
      const p = rng.pick(PRODUCTS);
      lines.push({
        sku: p.sku,
        name: p.name,
        qty: rng.int(2, 12) * 25,
        unitCost: p.cost,
      });
    }
    const units = lines.reduce((s, l) => s + l.qty, 0);
    const total = +lines.reduce((s, l) => s + l.qty * l.unitCost, 0).toFixed(2);
    const createdH = rng.int(24, 900);

    return {
      id: `po_${700 + i}`,
      number: `PO-${3140 + i}`,
      supplierId: supplier.id,
      supplier: supplier.name,
      warehouseId: warehouse.id,
      status,
      lines,
      units,
      total,
      createdAt: hoursAgo(createdH),
      etaAt: daysAhead(
        status === "received" ? -rng.int(1, 14) : rng.int(2, supplier.leadTimeDays)
      ),
      receivedAt: status === "received" ? hoursAgo(rng.int(4, 300)) : undefined,
    };
  });
}

export const PURCHASE_ORDERS: PurchaseOrder[] = generatePurchaseOrders().sort(
  (a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)
);

// ── Stock movements ─────────────────────────────────────────────────────────

export type MovementType = "inbound" | "outbound" | "adjustment" | "transfer" | "return";

export const MOVEMENT_META: Record<
  MovementType,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "default" }
> = {
  inbound: { label: "Inbound", variant: "success" },
  outbound: { label: "Outbound", variant: "info" },
  adjustment: { label: "Adjustment", variant: "warning" },
  transfer: { label: "Transfer", variant: "default" },
  return: { label: "Return", variant: "secondary" },
};

export interface StockMovement {
  id: string;
  at: string;
  sku: string;
  name: string;
  type: MovementType;
  /** Signed: positive adds stock, negative removes it. */
  qty: number;
  warehouseId: string;
  warehouse: string;
  reference: string;
  actor: string;
}

function generateMovements(): StockMovement[] {
  const rng = makeRng(31877);
  const actors = ["System", "Priya M.", "Rahul S.", "Ananya R.", "Automation"];
  const out: StockMovement[] = [];

  for (let i = 0; i < 48; i++) {
    const p = rng.pick(PRODUCTS);
    const w = rng.pick(WAREHOUSES);
    const type = rng.pick<MovementType>([
      "outbound", "outbound", "outbound", "inbound", "inbound",
      "adjustment", "transfer", "return",
    ]);
    const magnitude =
      type === "inbound" ? rng.int(2, 10) * 25 :
      type === "adjustment" ? rng.int(1, 12) :
      type === "transfer" ? rng.int(10, 120) :
      rng.int(1, 14);
    const qty =
      type === "inbound" || type === "return"
        ? magnitude
        : type === "adjustment"
          ? (rng.bool(0.5) ? magnitude : -magnitude)
          : -magnitude;

    out.push({
      id: `mv_${5000 + i}`,
      at: hoursAgo(rng.int(1, 340)),
      sku: p.sku,
      name: p.name,
      type,
      qty,
      warehouseId: w.id,
      warehouse: w.name,
      reference:
        type === "inbound" ? `PO-${3140 + rng.int(0, 13)}` :
        type === "outbound" ? `#PS-${48210 + rng.int(0, 119)}` :
        type === "return" ? `RMA-${rng.int(1000, 9999)}` :
        type === "transfer" ? `TRF-${rng.int(100, 999)}` :
        `ADJ-${rng.int(100, 999)}`,
      actor: rng.pick(actors),
    });
  }
  return out.sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export const STOCK_MOVEMENTS: StockMovement[] = generateMovements();

/** 14-day inbound vs outbound units, for the movements chart. */
export const MOVEMENT_SERIES = (() => {
  const rng = makeRng(4821);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(REF - (13 - i) * 86400000);
    return {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
      inbound: rng.int(120, 640),
      outbound: rng.int(280, 880),
    };
  });
})();
