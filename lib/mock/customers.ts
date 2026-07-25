/**
 * Customers — a lifetime view of the buyer base.
 *
 * The order queue only holds the last ~20 days, so lifetime history is
 * generated as a stable base of 240 buyers. The first names in that base are
 * the ones the order generator uses, so `buildCustomers(orders)` can fold the
 * *live* queue on top: create an order in Orders (or via the copilot) and that
 * buyer's order count, spend, and segment move with it.
 */
import { makeRng } from "./rng";
import { MarketplaceId } from "./marketplaces";
import { ORDERS, type Order } from "./orders";

const REF = new Date("2026-07-23T14:30:00Z").getTime();
const daysAgo = (d: number) => new Date(REF - d * 86400000).toISOString();
const daysBetween = (iso: string) => Math.max(0, Math.round((REF - +new Date(iso)) / 86400000));

// ── Segments ────────────────────────────────────────────────────────────────

export type CustomerSegment = "vip" | "loyal" | "promising" | "new" | "at_risk" | "dormant";

export const SEGMENT_META: Record<
  CustomerSegment,
  {
    label: string;
    variant: "success" | "warning" | "danger" | "info" | "secondary" | "default";
    color: string;
    description: string;
  }
> = {
  vip: { label: "VIP", variant: "default", color: "var(--chart-6)", description: "Top spenders — high LTV, frequent repeat purchases." },
  loyal: { label: "Loyal", variant: "success", color: "var(--chart-2)", description: "Repeat buyers with healthy, consistent order cadence." },
  promising: { label: "Promising", variant: "info", color: "var(--chart-5)", description: "Bought more than once and trending upward." },
  new: { label: "New", variant: "secondary", color: "var(--chart-1)", description: "First order placed in the last 60 days." },
  at_risk: { label: "At risk", variant: "warning", color: "var(--chart-3)", description: "Previously active, but quiet for 90+ days." },
  dormant: { label: "Dormant", variant: "danger", color: "var(--chart-4)", description: "No purchase in over 180 days." },
};

export const SEGMENT_LIST = Object.keys(SEGMENT_META) as CustomerSegment[];

/** Segment assignment from RFM-ish inputs — the single source of truth. */
export function segmentFor(orders: number, spend: number, daysSinceLast: number): CustomerSegment {
  if (daysSinceLast > 180) return "dormant";
  if (daysSinceLast > 90) return "at_risk";
  if (spend >= 2400 || orders >= 8) return "vip";
  if (orders >= 4) return "loyal";
  if (orders >= 2) return "promising";
  return "new";
}

// ── Base population ─────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  email: string;
  city: string;
  segment: CustomerSegment;
  orders: number;
  spend: number;
  aov: number;
  firstOrderAt: string;
  lastOrderAt: string;
  daysSinceLastOrder: number;
  tenureDays: number;
  channels: MarketplaceId[];
  primaryChannel: MarketplaceId;
  returns: number;
  /** Marketing consent — drives the "email this segment" flow. */
  optIn: boolean;
  avatar: string;
  tags: string[];
}

/** Names the order generator draws from; kept first so live orders link up. */
const ORDER_NAMES = [
  "Aarav Sharma", "Priya Patel", "Emma Johnson", "Liam Brown", "Ananya Rao",
  "Noah Davis", "Isabella Garcia", "Vihaan Mehta", "Sophia Martinez", "Rohan Gupta",
  "Olivia Wilson", "Kabir Singh", "Mia Anderson", "Diya Nair", "Ethan Thomas",
  "Zara Khan", "Lucas Lee", "Ishaan Verma", "Ava Taylor", "Aditi Joshi",
];

const FIRST = [
  "Arjun", "Meera", "Daniel", "Chloe", "Karan", "Riya", "James", "Sara", "Nikhil", "Grace",
  "Tanvi", "Oscar", "Neha", "Felix", "Aisha", "Ruben", "Lakshmi", "Marco", "Hannah", "Dev",
  "Elena", "Yusuf", "Ira", "Theo", "Nadia", "Owen", "Kiara", "Samir", "Leah", "Vikram",
  "Amara", "Jonas", "Pooja", "Nina", "Raj", "Clara", "Ayaan", "Maya", "Hugo", "Simran",
];
const LAST = [
  "Kapoor", "Fernandez", "O'Brien", "Iyer", "Novak", "Reddy", "Kim", "Silva", "Bose", "Ahmed",
  "Chopra", "Muller", "Desai", "Rossi", "Bhatt", "Larsen", "Menon", "Dubois", "Shetty", "Walsh",
];
const CITIES = [
  "Mumbai", "Bengaluru", "Delhi", "New York", "London", "Pune", "Hyderabad",
  "Chennai", "Toronto", "Dubai", "Austin", "Kolkata", "Jaipur", "Seattle",
  "Singapore", "Berlin", "Sydney", "Chicago",
];
const CHANNELS: MarketplaceId[] = [
  "amazon", "flipkart", "shopify", "meesho", "myntra", "woocommerce", "ebay",
];
const AVATARS = [
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#10b981,#22d3ee)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
  "linear-gradient(135deg,#14b8a6,#84cc16)",
];

/** Suffix for duplicate names — "Priya Kapoor II" rather than a collision. */
function roman(n: number): string {
  const table: [number, string][] = [
    [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "";
  let left = n;
  for (const [value, sym] of table) {
    while (left >= value) {
      out += sym;
      left -= value;
    }
  }
  return out;
}

function generateCustomers(): Customer[] {
  const rng = makeRng(90218);
  const used = new Set<string>();
  const out: Customer[] = [];

  for (let i = 0; i < 4800; i++) {
    let name: string;
    if (i < ORDER_NAMES.length) {
      name = ORDER_NAMES[i];
    } else {
      // Names repeat well before 4,800, so disambiguate rather than retry
      // forever — the pool is ~800 unique combinations.
      let candidate = `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
      if (used.has(candidate)) {
        let suffix = 2;
        while (used.has(`${candidate} ${roman(suffix)}`)) suffix++;
        candidate = `${candidate} ${roman(suffix)}`;
      }
      name = candidate;
    }
    used.add(name);

    // Real ecommerce order counts are a power law: most buyers never come
    // back, a thin tail carries the revenue. A uniform draw would put repeat
    // rate near 90% and make every cohort look impossibly loyal.
    const roll = rng.next();
    const orders =
      roll < 0.62
        ? 1
        : roll < 0.82
          ? 2
          : roll < 0.93
            ? rng.int(3, 5)
            : roll < 0.985
              ? rng.int(6, 12)
              : rng.int(13, 28);

    // Tenure has to cover the order count — nobody places 20 orders in a week.
    const tenureDays = Math.min(1000, Math.max(rng.int(8, 900), orders * rng.int(14, 45)));
    const aov = +rng.float(38, 260).toFixed(2);
    const spend = +(orders * aov).toFixed(2);
    const daysSinceLast =
      orders === 1
        ? Math.min(tenureDays, rng.int(1, 120))
        : rng.int(1, Math.max(2, Math.round(tenureDays / 3)));

    const channelCount = rng.int(1, 3);
    const channels = rng.shuffle([...CHANNELS]).slice(0, channelCount);

    out.push({
      id: `cust_${2000 + i}`,
      name,
      email: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}${rng.int(1, 99)}@example.com`,
      city: rng.pick(CITIES),
      segment: segmentFor(orders, spend, daysSinceLast),
      orders,
      spend,
      aov,
      firstOrderAt: daysAgo(tenureDays),
      lastOrderAt: daysAgo(daysSinceLast),
      daysSinceLastOrder: daysSinceLast,
      tenureDays,
      channels,
      primaryChannel: channels[0],
      returns: rng.bool(0.22) ? rng.int(1, 3) : 0,
      optIn: rng.bool(0.68),
      avatar: AVATARS[i % AVATARS.length],
      tags: rng.shuffle(["repeat", "high-value", "discount-led", "cross-channel", "reviewer"]).slice(
        0,
        rng.int(0, 2)
      ),
    });
  }
  return out;
}

/** Historical base — lifetime stats before the live order queue is folded in. */
export const CUSTOMERS: Customer[] = generateCustomers();

// ── Live overlay ────────────────────────────────────────────────────────────

/**
 * Fold the live order queue onto the historical base. Anyone in the queue who
 * is not in the base (a manually created order, say) joins as a new customer,
 * so nothing the operator does goes missing from this view.
 */
export function buildCustomers(orders: Order[] = ORDERS): Customer[] {
  const live = new Map<string, { count: number; spend: number; last: string; channels: Set<MarketplaceId> }>();

  for (const o of orders) {
    if (o.status === "cancelled") continue;
    const entry = live.get(o.customer);
    if (entry) {
      entry.count += 1;
      entry.spend += o.total;
      entry.channels.add(o.marketplace);
      if (+new Date(o.placedAt) > +new Date(entry.last)) entry.last = o.placedAt;
    } else {
      live.set(o.customer, {
        count: 1,
        spend: o.total,
        last: o.placedAt,
        channels: new Set([o.marketplace]),
      });
    }
  }

  const merged = CUSTOMERS.map((c) => {
    const l = live.get(c.name);
    if (!l) return c;

    const totalOrders = c.orders + l.count;
    const spend = +(c.spend + l.spend).toFixed(2);
    const lastOrderAt =
      +new Date(l.last) > +new Date(c.lastOrderAt) ? l.last : c.lastOrderAt;
    const daysSinceLastOrder = daysBetween(lastOrderAt);
    const channels = Array.from(new Set([...c.channels, ...l.channels]));

    return {
      ...c,
      orders: totalOrders,
      spend,
      aov: +(spend / totalOrders).toFixed(2),
      lastOrderAt,
      daysSinceLastOrder,
      channels,
      segment: segmentFor(totalOrders, spend, daysSinceLastOrder),
    };
  });

  // Buyers who exist only in the live queue.
  const known = new Set(CUSTOMERS.map((c) => c.name));
  let extra = 0;
  for (const [name, l] of live) {
    if (known.has(name)) continue;
    const daysSinceLastOrder = daysBetween(l.last);
    const aov = +(l.spend / l.count).toFixed(2);
    merged.push({
      id: `cust_live_${extra++}`,
      name,
      email: `${name.split(" ")[0].toLowerCase().replace(/[^a-z]/g, "")}@example.com`,
      city: "—",
      segment: segmentFor(l.count, l.spend, daysSinceLastOrder),
      orders: l.count,
      spend: +l.spend.toFixed(2),
      aov,
      firstOrderAt: l.last,
      lastOrderAt: l.last,
      daysSinceLastOrder,
      tenureDays: daysSinceLastOrder,
      channels: Array.from(l.channels),
      primaryChannel: Array.from(l.channels)[0],
      returns: 0,
      optIn: true,
      avatar: AVATARS[extra % AVATARS.length],
      tags: ["new"],
    });
  }

  return merged.sort((a, b) => b.spend - a.spend);
}

export interface CustomerSummary {
  total: number;
  repeatRate: number;
  avgLtv: number;
  avgOrders: number;
  newThisMonth: number;
  atRisk: number;
  optInRate: number;
  revenue: number;
}

export function customerSummary(customers: Customer[]): CustomerSummary {
  const total = customers.length || 1;
  const repeat = customers.filter((c) => c.orders > 1).length;
  const revenue = customers.reduce((s, c) => s + c.spend, 0);
  return {
    total: customers.length,
    repeatRate: +((repeat / total) * 100).toFixed(1),
    avgLtv: +(revenue / total).toFixed(2),
    avgOrders: +(customers.reduce((s, c) => s + c.orders, 0) / total).toFixed(1),
    newThisMonth: customers.filter((c) => c.tenureDays <= 30).length,
    atRisk: customers.filter((c) => c.segment === "at_risk" || c.segment === "dormant").length,
    optInRate: +((customers.filter((c) => c.optIn).length / total) * 100).toFixed(1),
    revenue: +revenue.toFixed(2),
  };
}

export function segmentBreakdown(customers: Customer[]) {
  return SEGMENT_LIST.map((key) => {
    const members = customers.filter((c) => c.segment === key);
    const revenue = members.reduce((s, c) => s + c.spend, 0);
    return {
      key,
      ...SEGMENT_META[key],
      count: members.length,
      revenue: +revenue.toFixed(2),
      share: customers.length ? +((members.length / customers.length) * 100).toFixed(1) : 0,
    };
  });
}

/** Top destination cities by customer count and spend. */
export function topCities(customers: Customer[], limit = 6) {
  const map = new Map<string, { city: string; customers: number; revenue: number }>();
  for (const c of customers) {
    const e = map.get(c.city) ?? { city: c.city, customers: 0, revenue: 0 };
    e.customers += 1;
    e.revenue += c.spend;
    map.set(c.city, e);
  }
  return [...map.values()]
    .map((e) => ({ ...e, revenue: +e.revenue.toFixed(2) }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/** New vs returning customers per month, for the growth chart. */
export const CUSTOMER_GROWTH = (() => {
  const rng = makeRng(7731);
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  let base = 210;
  return months.map((label) => {
    base *= 1 + rng.float(-0.05, 0.16);
    const fresh = Math.round(base);
    return {
      label,
      new: fresh,
      returning: Math.round(fresh * rng.float(1.1, 2.1)),
    };
  });
})();
