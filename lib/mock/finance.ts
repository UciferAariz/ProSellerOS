/**
 * Finance — P&L, channel economics, and settlement tracking.
 *
 * The statement is built to reconcile with the dashboard hero numbers: gross
 * sales tie to Total Revenue ($1.55M) and the bottom line to Net Profit
 * ($486.3K / 31.3% margin) on the canonical 30-day window. Everything scales
 * off that one window so switching range never contradicts the cockpit.
 */
import { makeRng } from "./rng";
import { MarketplaceId, MARKETPLACES } from "./marketplaces";

const REF = new Date("2026-07-23T14:30:00Z").getTime();
const daysAgo = (d: number) => new Date(REF - d * 86400000).toISOString();
const daysAhead = (d: number) => new Date(REF + d * 86400000).toISOString();

// ── Profit & loss ───────────────────────────────────────────────────────────

export type PnlKind = "income" | "cost" | "subtotal" | "total";

export interface PnlLine {
  key: string;
  label: string;
  /** Signed: costs are negative so the statement sums straight down. */
  amount: number;
  kind: PnlKind;
  hint?: string;
}

/** Canonical 30-day statement. Every figure below is in USD. */
const PNL_BASE: PnlLine[] = [
  { key: "gross", label: "Gross sales", amount: 1554700, kind: "income", hint: "All channels, before deductions" },
  { key: "discounts", label: "Discounts & promotions", amount: -46600, kind: "cost", hint: "Coupons, campaign offers" },
  { key: "returns", label: "Returns & refunds", amount: -71300, kind: "cost", hint: "4.2% return rate" },
  { key: "net_revenue", label: "Net revenue", amount: 1436800, kind: "subtotal" },
  { key: "cogs", label: "Cost of goods sold", amount: -742500, kind: "cost", hint: "Landed unit cost" },
  { key: "gross_profit", label: "Gross profit", amount: 694300, kind: "subtotal", hint: "48.3% gross margin" },
  { key: "commission", label: "Marketplace commissions", amount: -78200, kind: "cost", hint: "Referral & closing fees" },
  { key: "payment", label: "Payment processing", amount: -22400, kind: "cost", hint: "Gateway + COD handling" },
  { key: "shipping", label: "Shipping & fulfilment", amount: -33100, kind: "cost", hint: "Courier, packaging, labour" },
  { key: "ads", label: "Advertising & marketing", amount: -62400, kind: "cost", hint: "Ties to the Marketing module" },
  { key: "storage", label: "Warehousing & storage", amount: -6800, kind: "cost" },
  { key: "software", label: "Software & tooling", amount: -5100, kind: "cost" },
  { key: "net_profit", label: "Net profit", amount: 486300, kind: "total", hint: "31.3% net margin" },
];

/** Volume multiplier vs the canonical 30-day window (mirrors metrics.ts). */
export const FINANCE_RANGE_FACTOR: Record<string, number> = {
  "7d": 0.235,
  "30d": 1,
  "90d": 3.02,
  ytd: 6.78,
};

export function getPnl(range: string = "30d"): PnlLine[] {
  const factor = FINANCE_RANGE_FACTOR[range] ?? 1;
  if (factor === 1) return PNL_BASE;
  return PNL_BASE.map((l) => ({ ...l, amount: Math.round(l.amount * factor) }));
}

/** Headline ratios derived from whichever statement is on screen. */
export function pnlSummary(lines: PnlLine[]) {
  const get = (key: string) => lines.find((l) => l.key === key)?.amount ?? 0;
  const gross = get("gross");
  const netRevenue = get("net_revenue");
  const grossProfit = get("gross_profit");
  const netProfit = get("net_profit");
  const fees = -(get("commission") + get("payment") + get("shipping") + get("storage"));
  return {
    gross,
    netRevenue,
    grossProfit,
    netProfit,
    fees,
    cogs: -get("cogs"),
    adSpend: -get("ads"),
    refunds: -get("returns"),
    grossMargin: gross ? +((grossProfit / netRevenue) * 100).toFixed(1) : 0,
    netMargin: gross ? +((netProfit / gross) * 100).toFixed(1) : 0,
    takeRate: gross ? +((fees / gross) * 100).toFixed(1) : 0,
  };
}

// ── Channel economics ───────────────────────────────────────────────────────

export interface ChannelEconomics {
  id: MarketplaceId;
  name: string;
  color: string;
  revenue: number;
  commission: number;
  shipping: number;
  payment: number;
  storage: number;
  /** Total deductions taken by (or spent on) the channel. */
  fees: number;
  /** Fees as a share of channel revenue. */
  takeRate: number;
  net: number;
}

const RAW_ECONOMICS: {
  id: MarketplaceId;
  revenue: number;
  commissionPct: number;
  shippingPct: number;
  paymentPct: number;
  storagePct: number;
}[] = [
  { id: "amazon", revenue: 486200, commissionPct: 0.152, shippingPct: 0.062, paymentPct: 0.019, storagePct: 0.011 },
  { id: "flipkart", revenue: 312800, commissionPct: 0.141, shippingPct: 0.058, paymentPct: 0.018, storagePct: 0.008 },
  { id: "shopify", revenue: 298400, commissionPct: 0.021, shippingPct: 0.071, paymentPct: 0.026, storagePct: 0.004 },
  { id: "myntra", revenue: 204500, commissionPct: 0.178, shippingPct: 0.049, paymentPct: 0.016, storagePct: 0.006 },
  { id: "meesho", revenue: 112600, commissionPct: 0.089, shippingPct: 0.081, paymentPct: 0.014, storagePct: 0.003 },
  { id: "woocommerce", revenue: 98700, commissionPct: 0.008, shippingPct: 0.068, paymentPct: 0.028, storagePct: 0.002 },
  { id: "ebay", revenue: 41200, commissionPct: 0.129, shippingPct: 0.055, paymentPct: 0.023, storagePct: 0.005 },
];

export const CHANNEL_ECONOMICS: ChannelEconomics[] = RAW_ECONOMICS.map((r) => {
  const commission = Math.round(r.revenue * r.commissionPct);
  const shipping = Math.round(r.revenue * r.shippingPct);
  const payment = Math.round(r.revenue * r.paymentPct);
  const storage = Math.round(r.revenue * r.storagePct);
  const fees = commission + shipping + payment + storage;
  return {
    id: r.id,
    name: MARKETPLACES[r.id].name,
    color: MARKETPLACES[r.id].color,
    revenue: r.revenue,
    commission,
    shipping,
    payment,
    storage,
    fees,
    takeRate: +((fees / r.revenue) * 100).toFixed(1),
    net: r.revenue - fees,
  };
});

// ── Payouts / settlements ───────────────────────────────────────────────────

export type PayoutStatus = "paid" | "processing" | "scheduled" | "on_hold";

export const PAYOUT_STATUS_META: Record<
  PayoutStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "default" }
> = {
  paid: { label: "Paid", variant: "success" },
  processing: { label: "Processing", variant: "info" },
  scheduled: { label: "Scheduled", variant: "secondary" },
  on_hold: { label: "On hold", variant: "danger" },
};

export interface Payout {
  id: string;
  reference: string;
  channel: MarketplaceId;
  channelName: string;
  period: string;
  gross: number;
  fees: number;
  refunds: number;
  /** gross − fees − refunds, i.e. what actually lands in the bank. */
  net: number;
  status: PayoutStatus;
  expectedAt: string;
  paidAt?: string;
  /** Operator has matched this settlement against the ledger. */
  reconciled: boolean;
  account: string;
}

function generatePayouts(): Payout[] {
  const rng = makeRng(20714);
  const channels: MarketplaceId[] = [
    "amazon", "flipkart", "shopify", "myntra", "meesho", "woocommerce", "ebay",
  ];
  const out: Payout[] = [];
  let n = 0;

  // Three settlement cycles back, newest first.
  for (let cycle = 0; cycle < 3; cycle++) {
    for (const channel of channels) {
      const eco = CHANNEL_ECONOMICS.find((e) => e.id === channel)!;
      // Each cycle settles roughly a third of the month, with variance.
      const gross = Math.round((eco.revenue / 3) * rng.float(0.82, 1.18));
      const fees = Math.round(gross * (eco.takeRate / 100));
      const refunds = Math.round(gross * rng.float(0.015, 0.055));
      const status: PayoutStatus =
        cycle === 0
          ? channel === "ebay"
            ? "on_hold"
            : rng.bool(0.5)
              ? "processing"
              : "scheduled"
          : "paid";
      const periodEnd = cycle * 10 + 3;

      out.push({
        id: `payout_${400 + n}`,
        reference: `STL-${MARKETPLACES[channel].short}-${9120 + n}`,
        channel,
        channelName: MARKETPLACES[channel].name,
        period: `${fmtDay(periodEnd + 9)} – ${fmtDay(periodEnd)}`,
        gross,
        fees,
        refunds,
        net: gross - fees - refunds,
        status,
        expectedAt: status === "paid" ? daysAgo(periodEnd - 2) : daysAhead(rng.int(1, 6)),
        paidAt: status === "paid" ? daysAgo(periodEnd - 2) : undefined,
        reconciled: status === "paid" && rng.bool(0.7),
        account: rng.bool(0.5) ? "HDFC ••4471" : "Chase ••8820",
      });
      n++;
    }
  }
  return out;
}

function fmtDay(offset: number) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
    new Date(REF - offset * 86400000)
  );
}

export const PAYOUTS: Payout[] = generatePayouts();

export function payoutSummary(payouts: Payout[]) {
  const paid = payouts.filter((p) => p.status === "paid");
  const upcoming = payouts.filter((p) => p.status !== "paid");
  return {
    settled: paid.reduce((s, p) => s + p.net, 0),
    pending: upcoming.reduce((s, p) => s + p.net, 0),
    onHold: payouts.filter((p) => p.status === "on_hold").reduce((s, p) => s + p.net, 0),
    unreconciled: paid.filter((p) => !p.reconciled).length,
    feesWithheld: payouts.reduce((s, p) => s + p.fees, 0),
  };
}

// ── Cash flow ───────────────────────────────────────────────────────────────

export interface CashflowPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export const CASHFLOW: CashflowPoint[] = (() => {
  const rng = makeRng(5512);
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  let base = 980000;
  return months.map((label) => {
    base *= 1 + rng.float(-0.06, 0.14);
    const inflow = Math.round(base);
    const outflow = Math.round(inflow * rng.float(0.62, 0.78));
    return { label, inflow, outflow, net: inflow - outflow };
  });
})();

// ── Expenses ────────────────────────────────────────────────────────────────

export interface ExpenseLine {
  category: string;
  amount: number;
  color: string;
  /** % change vs the previous period. */
  delta: number;
}

export const EXPENSES: ExpenseLine[] = [
  { category: "Cost of goods", amount: 742500, color: "var(--chart-1)", delta: 9.2 },
  { category: "Marketplace fees", amount: 78200, color: "var(--chart-2)", delta: 11.4 },
  { category: "Advertising", amount: 62400, color: "var(--chart-3)", delta: 18.6 },
  { category: "Shipping", amount: 33100, color: "var(--chart-4)", delta: 4.1 },
  { category: "Payment processing", amount: 22400, color: "var(--chart-5)", delta: 7.8 },
  { category: "Warehousing", amount: 6800, color: "var(--chart-6)", delta: -2.4 },
  { category: "Software", amount: 5100, color: "var(--muted-foreground)", delta: 0.9 },
];

// ── Tax & compliance ────────────────────────────────────────────────────────

export interface TaxLine {
  label: string;
  collected: number;
  remitted: number;
  dueAt: string;
  jurisdiction: string;
}

export const TAX_LINES: TaxLine[] = [
  { label: "GST — India", collected: 184600, remitted: 152400, dueAt: daysAhead(9), jurisdiction: "IN" },
  { label: "Sales tax — US (nexus states)", collected: 41200, remitted: 41200, dueAt: daysAhead(24), jurisdiction: "US" },
  { label: "VAT — United Kingdom", collected: 18700, remitted: 0, dueAt: daysAhead(4), jurisdiction: "UK" },
  { label: "VAT — EU (OSS)", collected: 12300, remitted: 12300, dueAt: daysAhead(38), jurisdiction: "EU" },
];
