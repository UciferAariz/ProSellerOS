import { PRODUCTS } from "./products";
import { MARKETPLACE_METRICS } from "./metrics";

export type AssistantWidget =
  | { kind: "falling-products"; items: { name: string; trend: number; revenue: number }[] }
  | { kind: "forecast"; series: { label: string; actual?: number; forecast?: number }[]; sku: string }
  | { kind: "profit"; total: number; margin: number; breakdown: { name: string; value: number; color: string }[] }
  | { kind: "pricing"; items: { name: string; current: number; suggested: number; uplift: number }[] }
  | { kind: "listing"; title: string; bullets: string[]; keywords: string[] };

export interface AssistantReply {
  text: string;
  widget?: AssistantWidget;
  followups?: string[];
}

export const SUGGESTED_PROMPTS = [
  "Show products with falling sales",
  "Predict inventory for next 30 days",
  "Summarize this month's profit",
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

  return {
    text: "I can help with sales trends, inventory forecasting, profit summaries, pricing optimization, and generating listings. Try one of the suggestions below, or ask me anything about your business.",
    followups: SUGGESTED_PROMPTS.slice(0, 3),
  };
}
