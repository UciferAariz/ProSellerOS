import { makeRng } from "./rng";
import { MarketplaceId } from "./marketplaces";
import { PRODUCTS } from "./products";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export interface OrderItem {
  productId: string;
  name: string;
  sku: string;
  qty: number;
  price: number;
  image: string;
}

export interface OrderEvent {
  label: string;
  at: string;
  done: boolean;
}

export interface Order {
  id: string;
  number: string;
  marketplace: MarketplaceId;
  customer: string;
  email: string;
  city: string;
  status: OrderStatus;
  payment: "prepaid" | "cod";
  courier: string;
  tracking: string;
  items: OrderItem[];
  itemCount: number;
  total: number;
  placedAt: string;
  sla: string; // ship-by
  flagged: boolean;
  timeline: OrderEvent[];
}

const NAMES = [
  "Aarav Sharma", "Priya Patel", "Emma Johnson", "Liam Brown", "Ananya Rao",
  "Noah Davis", "Isabella Garcia", "Vihaan Mehta", "Sophia Martinez", "Rohan Gupta",
  "Olivia Wilson", "Kabir Singh", "Mia Anderson", "Diya Nair", "Ethan Thomas",
  "Zara Khan", "Lucas Lee", "Ishaan Verma", "Ava Taylor", "Aditi Joshi",
];
const CITIES = [
  "Mumbai", "Bengaluru", "Delhi", "New York", "London", "Pune", "Hyderabad",
  "Chennai", "Toronto", "Dubai", "Austin", "Kolkata", "Jaipur", "Seattle",
];
const COURIERS = ["Delhivery", "BlueDart", "FedEx", "DHL", "Shiprocket", "Ekart", "USPS"];
const MARKETS: MarketplaceId[] = ["amazon", "flipkart", "shopify", "meesho", "myntra", "woocommerce", "ebay"];
const STATUS_FLOW: OrderStatus[] = ["pending", "confirmed", "packed", "shipped", "delivered"];

function hoursAgo(h: number) {
  const REF = new Date("2026-07-23T14:30:00Z").getTime();
  return new Date(REF - h * 3600000).toISOString();
}

function generateOrders(): Order[] {
  const rng = makeRng(55231);
  const orders: Order[] = [];
  for (let i = 0; i < 120; i++) {
    const marketplace = rng.pick(MARKETS);
    const numItems = rng.int(1, 3);
    const items: OrderItem[] = [];
    for (let j = 0; j < numItems; j++) {
      const p = rng.pick(PRODUCTS);
      const qty = rng.int(1, 3);
      items.push({ productId: p.id, name: p.name, sku: p.sku, qty, price: p.price, image: p.image });
    }
    const total = +items.reduce((s, it) => s + it.price * it.qty, 0).toFixed(2);
    const roll = rng.next();
    let status: OrderStatus;
    if (roll < 0.16) status = "pending";
    else if (roll < 0.3) status = "confirmed";
    else if (roll < 0.42) status = "packed";
    else if (roll < 0.6) status = "shipped";
    else if (roll < 0.86) status = "delivered";
    else if (roll < 0.94) status = "returned";
    else status = "cancelled";

    const placedH = rng.int(1, 480);
    const stageIdx = Math.max(0, STATUS_FLOW.indexOf(status));
    const timeline: OrderEvent[] = STATUS_FLOW.map((s, idx) => ({
      label: labelFor(s),
      at: hoursAgo(placedH - idx * rng.int(2, 10)),
      done:
        status === "cancelled" || status === "returned"
          ? idx <= 3
          : idx <= stageIdx,
    }));
    if (status === "returned") timeline.push({ label: "Return initiated", at: hoursAgo(placedH - 60), done: true });
    if (status === "cancelled") timeline.push({ label: "Order cancelled", at: hoursAgo(placedH - 20), done: true });

    orders.push({
      id: `order_${9000 + i}`,
      number: `#PS-${48210 + i}`,
      marketplace,
      customer: rng.pick(NAMES),
      email: "",
      city: rng.pick(CITIES),
      status,
      payment: rng.bool(0.55) ? "prepaid" : "cod",
      courier: status === "pending" || status === "confirmed" ? "—" : rng.pick(COURIERS),
      tracking:
        status === "shipped" || status === "delivered"
          ? `TRK${rng.int(100000000, 999999999)}`
          : "—",
      items,
      itemCount: items.reduce((s, it) => s + it.qty, 0),
      total,
      placedAt: hoursAgo(placedH),
      sla: hoursAgo(placedH - 48),
      flagged: rng.bool(0.06),
      timeline,
    });
  }
  const rng2 = makeRng(999);
  orders.forEach((o) => {
    o.email = `${o.customer.split(" ")[0].toLowerCase()}${rng2.int(1, 99)}@example.com`;
  });
  return orders.sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt));
}

function labelFor(s: OrderStatus) {
  return {
    pending: "Order placed",
    confirmed: "Payment confirmed",
    packed: "Packed",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
  }[s];
}

export const ORDERS: Order[] = generateOrders();

export function getOrder(id: string) {
  return ORDERS.find((o) => o.id === id);
}

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info" | "secondary" }
> = {
  pending: { label: "Pending", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "info" },
  packed: { label: "Packed", variant: "info" },
  shipped: { label: "Shipped", variant: "default" },
  delivered: { label: "Delivered", variant: "success" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  returned: { label: "Returned", variant: "danger" },
};
