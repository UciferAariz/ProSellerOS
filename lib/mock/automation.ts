/**
 * Automation — the rules engine that runs the shop while nobody is watching.
 *
 * A rule is trigger → conditions → actions. Icons are stored as string keys
 * rather than components so this stays a plain data module (no React import in
 * the mock layer); the page maps keys to lucide icons.
 */
import { makeRng } from "./rng";

const REF = new Date("2026-07-23T14:30:00Z").getTime();
const minsAgo = (m: number) => new Date(REF - m * 60000).toISOString();

export type RuleCategory = "orders" | "inventory" | "pricing" | "listings" | "customers" | "finance";

export const RULE_CATEGORY_META: Record<
  RuleCategory,
  { label: string; icon: string; color: string }
> = {
  orders: { label: "Orders", icon: "cart", color: "var(--chart-1)" },
  inventory: { label: "Inventory", icon: "boxes", color: "var(--chart-2)" },
  pricing: { label: "Pricing", icon: "tag", color: "var(--chart-3)" },
  listings: { label: "Listings", icon: "package", color: "var(--chart-4)" },
  customers: { label: "Customers", icon: "users", color: "var(--chart-5)" },
  finance: { label: "Finance", icon: "wallet", color: "var(--chart-6)" },
};

export interface Rule {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  /** Human-readable event that fires the rule. */
  trigger: string;
  conditions: string[];
  actions: string[];
  enabled: boolean;
  runs: number;
  successRate: number;
  lastRunAt: string;
  /** Operator minutes saved per run — drives the "time saved" tile. */
  minutesPerRun: number;
}

export const RULES: Rule[] = [
  {
    id: "rule_1",
    name: "Auto-accept prepaid orders",
    description: "Confirms prepaid orders instantly so packing never waits on a human.",
    category: "orders",
    trigger: "Order created",
    conditions: ["Payment is prepaid", "Order total under $800", "Customer not flagged"],
    actions: ["Set status to confirmed", "Notify warehouse channel"],
    enabled: true,
    runs: 4820,
    successRate: 99.6,
    lastRunAt: minsAgo(3),
    minutesPerRun: 1.5,
  },
  {
    id: "rule_2",
    name: "Low stock reorder alert",
    description: "Raises a draft purchase order the moment cover drops below a week.",
    category: "inventory",
    trigger: "Stock level changed",
    conditions: ["Available ≤ reorder point", "Product status is active", "No open PO for SKU"],
    actions: ["Create draft purchase order", "Email the buying team", "Add dashboard task"],
    enabled: true,
    runs: 312,
    successRate: 97.1,
    lastRunAt: minsAgo(24),
    minutesPerRun: 12,
  },
  {
    id: "rule_3",
    name: "Competitive repricing",
    description: "Nudges price to stay within 2% of the buy-box winner, never below floor.",
    category: "pricing",
    trigger: "Competitor price changed",
    conditions: ["Buy box lost", "Margin stays above 22%", "Channel is Amazon or Flipkart"],
    actions: ["Adjust price to match −1%", "Log the change", "Sync to channel"],
    enabled: true,
    runs: 1946,
    successRate: 94.8,
    lastRunAt: minsAgo(11),
    minutesPerRun: 2,
  },
  {
    id: "rule_4",
    name: "Out-of-stock delisting",
    description: "Pauses listings that would otherwise take orders you cannot ship.",
    category: "listings",
    trigger: "Stock hits zero",
    conditions: ["On hand = 0", "No inbound PO within 7 days"],
    actions: ["Pause listing on all channels", "Notify ops"],
    enabled: true,
    runs: 148,
    successRate: 100,
    lastRunAt: minsAgo(96),
    minutesPerRun: 6,
  },
  {
    id: "rule_5",
    name: "Flag high-risk COD orders",
    description: "Holds suspicious cash-on-delivery orders for review before packing.",
    category: "orders",
    trigger: "Order created",
    conditions: ["Payment is COD", "Order total above $400", "First-time customer"],
    actions: ["Flag for review", "Hold fulfilment", "Request phone verification"],
    enabled: true,
    runs: 604,
    successRate: 91.2,
    lastRunAt: minsAgo(42),
    minutesPerRun: 8,
  },
  {
    id: "rule_6",
    name: "Win-back dormant buyers",
    description: "Emails a 15% offer to customers who have gone quiet for six months.",
    category: "customers",
    trigger: "Daily at 09:00",
    conditions: ["Segment is dormant", "Marketing opt-in is true", "Lifetime spend above $200"],
    actions: ["Send win-back email", "Issue single-use coupon", "Add to Meta audience"],
    enabled: true,
    runs: 186,
    successRate: 98.4,
    lastRunAt: minsAgo(330),
    minutesPerRun: 20,
  },
  {
    id: "rule_7",
    name: "Settlement reconciliation",
    description: "Matches each marketplace payout against the order ledger and flags gaps.",
    category: "finance",
    trigger: "Payout received",
    conditions: ["Settlement file available"],
    actions: ["Match orders to payout", "Flag variance above $50", "Post to ledger"],
    enabled: true,
    runs: 96,
    successRate: 96.9,
    lastRunAt: minsAgo(184),
    minutesPerRun: 35,
  },
  {
    id: "rule_8",
    name: "Auto-print labels at 4pm",
    description: "Batches the day's confirmed orders into one label run before courier pickup.",
    category: "orders",
    trigger: "Daily at 16:00",
    conditions: ["Status is confirmed", "Label not yet printed"],
    actions: ["Generate label sheet", "Mark orders packed", "Notify courier"],
    enabled: false,
    runs: 74,
    successRate: 100,
    lastRunAt: minsAgo(1440),
    minutesPerRun: 25,
  },
  {
    id: "rule_9",
    name: "Overstock clearance tagging",
    description: "Tags slow movers for the clearance campaign once cover passes 120 days.",
    category: "pricing",
    trigger: "Weekly on Monday",
    conditions: ["Days of cover above 120", "No active promotion"],
    actions: ["Apply clearance tag", "Reduce price by 12%", "Add to clearance campaign"],
    enabled: false,
    runs: 32,
    successRate: 93.8,
    lastRunAt: minsAgo(2880),
    minutesPerRun: 18,
  },
  {
    id: "rule_10",
    name: "Review request after delivery",
    description: "Asks for a review three days after delivery, once per customer per month.",
    category: "customers",
    trigger: "Order delivered",
    conditions: ["Delivered 3 days ago", "No review request in 30 days"],
    actions: ["Send review request", "Track response"],
    enabled: true,
    runs: 2418,
    successRate: 99.1,
    lastRunAt: minsAgo(17),
    minutesPerRun: 0.5,
  },
];

// ── Templates ───────────────────────────────────────────────────────────────

export interface RuleTemplate {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;
  trigger: string;
  conditions: string[];
  actions: string[];
  /** Typical operator minutes reclaimed per run. */
  minutesPerRun: number;
  popular?: boolean;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    id: "tpl_1",
    name: "Cancel unpaid orders after 48h",
    description: "Frees reserved stock when payment never lands.",
    category: "orders",
    trigger: "Order pending for 48 hours",
    conditions: ["Status is pending", "Payment not captured"],
    actions: ["Cancel order", "Release reserved stock", "Email customer"],
    minutesPerRun: 4,
    popular: true,
  },
  {
    id: "tpl_2",
    name: "Split shipment across warehouses",
    description: "Routes each line to the nearest location with stock.",
    category: "inventory",
    trigger: "Order confirmed",
    conditions: ["Order has 2+ lines", "No single warehouse can fill it"],
    actions: ["Split into sub-shipments", "Assign nearest warehouse"],
    minutesPerRun: 9,
  },
  {
    id: "tpl_3",
    name: "Match lowest competitor price",
    description: "Aggressive repricing with a hard margin floor.",
    category: "pricing",
    trigger: "Competitor price changed",
    conditions: ["Margin stays above floor"],
    actions: ["Match price", "Sync to all channels"],
    minutesPerRun: 2,
    popular: true,
  },
  {
    id: "tpl_4",
    name: "Publish new SKUs everywhere",
    description: "Pushes an approved product to every connected channel.",
    category: "listings",
    trigger: "Product status set to active",
    conditions: ["Has images", "Has description", "Price above cost"],
    actions: ["Generate listing copy", "Publish to all channels"],
    minutesPerRun: 22,
    popular: true,
  },
  {
    id: "tpl_5",
    name: "VIP upgrade notification",
    description: "Celebrates customers crossing into the VIP segment.",
    category: "customers",
    trigger: "Customer segment changed",
    conditions: ["New segment is VIP"],
    actions: ["Send VIP welcome", "Grant early access", "Notify account manager"],
    minutesPerRun: 6,
  },
  {
    id: "tpl_6",
    name: "Daily revenue digest",
    description: "Posts yesterday's numbers to Slack every morning.",
    category: "finance",
    trigger: "Daily at 08:00",
    conditions: [],
    actions: ["Compile revenue summary", "Post to Slack", "Attach CSV"],
    minutesPerRun: 10,
  },
  {
    id: "tpl_7",
    name: "Refund high-value returns fast",
    description: "Auto-refunds trusted customers the moment a return scans in.",
    category: "finance",
    trigger: "Return scanned by courier",
    conditions: ["Customer segment is VIP or Loyal", "Return value under $300"],
    actions: ["Issue refund", "Restock item", "Notify customer"],
    minutesPerRun: 7,
  },
  {
    id: "tpl_8",
    name: "Pause overspending campaigns",
    description: "Stops any campaign whose ROAS falls under target for 3 days.",
    category: "pricing",
    trigger: "Daily at 07:00",
    conditions: ["ROAS below 2.0 for 3 days", "Spend above $500"],
    actions: ["Pause campaign", "Notify marketing"],
    minutesPerRun: 15,
  },
];

// ── Run history ─────────────────────────────────────────────────────────────

export type RunStatus = "success" | "failed" | "skipped";

export const RUN_STATUS_META: Record<
  RunStatus,
  { label: string; variant: "success" | "warning" | "danger" }
> = {
  success: { label: "Success", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
  skipped: { label: "Skipped", variant: "warning" },
};

export interface RuleRun {
  id: string;
  ruleId: string;
  ruleName: string;
  at: string;
  status: RunStatus;
  detail: string;
  durationMs: number;
  /** Records the rule touched on this run. */
  affected: number;
}

function generateRuns(): RuleRun[] {
  const rng = makeRng(45120);
  const enabled = RULES.filter((r) => r.enabled);
  const detailFor = (rule: Rule, status: RunStatus, affected: number): string => {
    if (status === "failed") return `${rule.actions[0]} failed — channel API returned 503`;
    if (status === "skipped") return `Conditions not met — ${rule.conditions[0]?.toLowerCase() ?? "no match"}`;
    return `${rule.actions[0]} · ${affected} record${affected === 1 ? "" : "s"}`;
  };

  return Array.from({ length: 42 }, (_, i) => {
    const rule = rng.pick(enabled);
    const roll = rng.next();
    const status: RunStatus = roll < 0.84 ? "success" : roll < 0.94 ? "skipped" : "failed";
    const affected = status === "success" ? rng.int(1, 48) : 0;
    return {
      id: `run_${8000 + i}`,
      ruleId: rule.id,
      ruleName: rule.name,
      at: minsAgo(rng.int(1, 2880)),
      status,
      detail: detailFor(rule, status, affected),
      durationMs: rng.int(120, 4200),
      affected,
    };
  }).sort((a, b) => +new Date(b.at) - +new Date(a.at));
}

export const RULE_RUNS: RuleRun[] = generateRuns();

export function automationSummary(rules: Rule[], runs: RuleRun[]) {
  const active = rules.filter((r) => r.enabled);
  const dayAgo = REF - 86400000;
  const recent = runs.filter((r) => +new Date(r.at) >= dayAgo);
  const succeeded = runs.filter((r) => r.status === "success").length;

  return {
    activeRules: active.length,
    totalRules: rules.length,
    runsToday: recent.length,
    failuresToday: recent.filter((r) => r.status === "failed").length,
    successRate: runs.length ? +((succeeded / runs.length) * 100).toFixed(1) : 0,
    // Lifetime hours reclaimed across every enabled rule.
    hoursSaved: Math.round(active.reduce((s, r) => s + (r.runs * r.minutesPerRun) / 60, 0)),
    totalRuns: active.reduce((s, r) => s + r.runs, 0),
  };
}

/** Runs per day for the last 14 days, for the activity chart. */
export const RUN_SERIES = (() => {
  const rng = makeRng(9182);
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(REF - (13 - i) * 86400000);
    const total = rng.int(180, 420);
    const failed = rng.int(0, 12);
    return {
      label: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d),
      success: total - failed,
      failed,
    };
  });
})();
