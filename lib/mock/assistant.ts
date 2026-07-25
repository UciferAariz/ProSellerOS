import type { ClientAction } from "@/lib/agent/actions";
import { PRODUCTS } from "./products";
import { MARKETPLACE_METRICS } from "./metrics";
import { ORDERS, OrderStatus } from "./orders";

export type AssistantWidget =
  | { kind: "falling-products"; items: { name: string; trend: number; revenue: number }[] }
  | {
      kind: "forecast";
      series: { label: string; actual?: number; forecast?: number }[];
      sku: string;
      daysToStockout?: number;
    }
  | { kind: "profit"; total: number; margin: number; breakdown: { name: string; value: number; color: string }[] }
  | { kind: "pricing"; items: { name: string; current: number; suggested: number; uplift: number }[] }
  | { kind: "listing"; title: string; bullets: string[]; keywords: string[] }
  | {
      kind: "orders";
      title: string;
      total: number;
      rows: {
        id: string;
        number: string;
        customer: string;
        city: string;
        marketplace: string;
        status: OrderStatus;
        payment: "prepaid" | "cod";
        total: number;
      }[];
    }
  | {
      kind: "order-stats";
      total: number;
      revenue: number;
      byStatus: { label: string; count: number }[];
      byPayment: { label: string; count: number }[];
    };

export interface AssistantReply {
  text: string;
  widget?: AssistantWidget;
  followups?: string[];
  /** Things the copilot did in the portal, for the browser to apply. */
  actions?: ClientAction[];
}

export const SUGGESTED_PROMPTS = [
  "How many orders are COD?",
  "Accept all pending Amazon orders",
  "Download labels for confirmed orders",
  "Take me to the flagged orders",
  "Find pricing opportunities",
  "Generate a listing for my bestseller",
];

const fallingItems = [...PRODUCTS]
  .filter((p) => p.trend < 0)
  .sort((a, b) => a.trend - b.trend)
  .slice(0, 5)
  .map((p) => ({ name: p.name, trend: p.trend, revenue: p.revenue30d }));

const topSku = [...PRODUCTS].sort((a, b) => b.revenue30d - a.revenue30d)[0];

export function answer(prompt: string): AssistantReply {
  const q = prompt.toLowerCase();

  if (q.includes("fall") || q.includes("declin") || q.includes("drop")) {
    return {
      text: `I found ${fallingItems.length} products with declining sales over the last 30 days. The steepest drop is "${fallingItems[0].name}" at ${fallingItems[0].trend}%. These represent ${Math.abs(fallingItems.reduce((s, i) => s + i.trend, 0)).toFixed(0)}% of combined lost momentum — worth reviewing pricing and ad spend.`,
      widget: { kind: "falling-products", items: fallingItems },
      followups: ["Why are these dropping?", "Suggest a recovery plan"],
    };
  }

  if (q.includes("predict") || q.includes("inventory") || q.includes("forecast") || q.includes("stock")) {
    const series = [
      { label: "W-3", actual: 320 },
      { label: "W-2", actual: 298 },
      { label: "W-1", actual: 265 },
      { label: "Now", actual: 240 },
      { label: "W+1", forecast: 210 },
      { label: "W+2", forecast: 178 },
      { label: "W+3", forecast: 141 },
      { label: "W+4", forecast: 96 },
    ];
    return {
      text: `Based on current velocity, "${topSku.name}" will drop below its safety stock in ~18 days. I recommend a purchase order of 400 units to maintain a 30-day buffer. 5 other SKUs show similar risk.`,
      widget: { kind: "forecast", series, sku: topSku.name },
      followups: ["Create the purchase order", "Show all at-risk SKUs"],
    };
  }

  if (q.includes("profit") || q.includes("summar") || q.includes("margin")) {
    return {
      text: "Your net profit this month is $486,300 at a 31.3% margin — up 15.2% from last month. Amazon and Shopify drove 63% of profit. Return costs fell $6,400 after the sizing-guide update.",
      widget: {
        kind: "profit",
        total: 486300,
        margin: 31.3,
        breakdown: MARKETPLACE_METRICS.slice(0, 5).map((m) => ({
          name: m.name,
          value: Math.round(m.revenue * 0.31),
          color: m.color,
        })),
      },
      followups: ["Compare to last quarter", "Export a P&L report"],
    };
  }

  if (q.includes("pric") || q.includes("opportun")) {
    const items = [...PRODUCTS]
      .filter((p) => p.trend > 10 && p.stock < 120)
      .slice(0, 4)
      .map((p) => ({
        name: p.name,
        current: p.price,
        suggested: +(p.price * 1.06).toFixed(2),
        uplift: +(p.price * 0.06 * p.units30d).toFixed(0),
      }));
    const total = items.reduce((s, i) => s + i.uplift, 0);
    return {
      text: `I identified ${items.length} high-demand products with low price elasticity. A 6% increase across these is projected to add ~$${total.toLocaleString()}/mo with negligible volume impact.`,
      widget: { kind: "pricing", items },
      followups: ["Apply suggested prices", "Show elasticity details"],
    };
  }

  if (q.includes("listing") || q.includes("generat") || q.includes("descript") || q.includes("write")) {
    return {
      text: `Here's an optimized, SEO-ready listing for your bestseller "${topSku.name}". It's tuned for marketplace search with high-intent keywords.`,
      widget: {
        kind: "listing",
        title: `${topSku.name} — Premium Quality, Fast Shipping`,
        bullets: [
          "Crafted with premium materials for lasting durability and everyday comfort",
          "Trusted by 3,800+ verified buyers with a 4.8★ average rating",
          "Ships within 24 hours with tracked, insured delivery",
          "30-day hassle-free returns and dedicated support",
        ],
        keywords: [topSku.category.toLowerCase(), topSku.brand.toLowerCase(), "premium", "bestseller", "gift"],
      },
      followups: ["Publish to Amazon", "Generate 3 more variations"],
    };
  }

  // ── Offline equivalents of the operator tools ─────────────────────────────
  // These run off the same deterministic arrays the live agent's tables were
  // seeded from, so the demo still answers and still navigates with the backend
  // unreachable. Writes are deliberately left to the live path only.

  if (q.includes("cod") || q.includes("cash on delivery") || q.includes("how many order")) {
    const cod = ORDERS.filter((o) => o.payment === "cod");
    const revenue = Math.round(ORDERS.reduce((s, o) => s + o.total, 0));
    const byStatus = Object.entries(
      ORDERS.reduce<Record<string, number>>((acc, o) => {
        acc[o.status] = (acc[o.status] ?? 0) + 1;
        return acc;
      }, {}),
    )
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
    return {
      text: `${cod.length} of your ${ORDERS.length} orders are cash on delivery — ${Math.round((cod.length / ORDERS.length) * 100)}% of the queue, worth $${Math.round(cod.reduce((s, o) => s + o.total, 0)).toLocaleString()}.`,
      widget: {
        kind: "order-stats",
        total: ORDERS.length,
        revenue,
        byStatus,
        byPayment: [
          { label: "cod", count: cod.length },
          { label: "prepaid", count: ORDERS.length - cod.length },
        ],
      },
      followups: ["Show the pending COD orders", "Accept all pending orders"],
    };
  }

  const NAV: { match: string[]; path: string; label: string }[] = [
    { match: ["dashboard", "overview"], path: "/dashboard", label: "the Dashboard" },
    { match: ["product", "catalog"], path: "/products", label: "Products" },
    { match: ["order"], path: "/orders", label: "Orders" },
    { match: ["marketplace", "channel"], path: "/marketplaces", label: "Marketplaces" },
  ];
  if (/\b(go to|open|take me|navigate|show me the)\b/.test(q)) {
    const hit = NAV.find((n) => n.match.some((m) => q.includes(m)));
    if (hit) {
      return {
        text: `Opening ${hit.label}.`,
        actions: [{ kind: "navigate", path: hit.path, label: hit.label }],
      };
    }
  }

  if (q.includes("label")) {
    const ready = ORDERS.filter((o) => o.status === "confirmed" || o.status === "packed").slice(0, 20);
    return {
      text: `Prepared ${ready.length} print-ready shipping labels for your accepted orders. The sheet is downloading now.`,
      actions: [
        {
          kind: "labels",
          orders: ready.map((o) => ({
            id: o.id,
            number: o.number,
            customer: o.customer,
            city: o.city,
            marketplace: o.marketplace,
            courier: o.courier === "—" ? "Shiprocket" : o.courier,
            tracking: o.tracking === "—" ? `TRK${o.number.replace(/\D/g, "").padStart(9, "4")}` : o.tracking,
            itemCount: o.itemCount,
            total: o.total,
          })),
        },
      ],
      followups: ["Mark them shipped", "Export the order list"],
    };
  }

  return {
    text: "I can run your storefront with you — accept and ship orders, print labels, re-price SKUs, export data, pull up any screen, and analyze sales, inventory, and profit. Try one of the suggestions below, or just tell me what to do.",
    followups: SUGGESTED_PROMPTS.slice(0, 3),
  };
}
