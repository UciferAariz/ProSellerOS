import { makeRng } from "./rng";
import { MarketplaceId, MARKETPLACES } from "./marketplaces";

export interface Kpi {
  key: string;
  label: string;
  value: number;
  format: "currency" | "number" | "percent";
  delta: number; // % vs prev period
  spark: number[];
  sub?: string;
}

export const KPIS: Kpi[] = [
  { key: "revenue", label: "Total Revenue", value: 1554700, format: "currency", delta: 12.4, spark: spark(38, 0.9), sub: "across 7 channels" },
  { key: "orders", label: "Orders", value: 12191, format: "number", delta: 8.1, spark: spark(52, 0.8), sub: "1,204 pending" },
  { key: "profit", label: "Net Profit", value: 486300, format: "currency", delta: 15.2, spark: spark(41, 1.1), sub: "31.3% margin" },
  { key: "aov", label: "Avg Order Value", value: 127.5, format: "currency", delta: 3.6, spark: spark(33, 0.4) },
  { key: "returns", label: "Return Rate", value: 4.2, format: "percent", delta: -0.8, spark: spark(29, -0.5), sub: "512 returns" },
  { key: "conversion", label: "Conversion", value: 3.8, format: "percent", delta: 0.5, spark: spark(31, 0.6) },
  { key: "refund", label: "Refund Rate", value: 2.1, format: "percent", delta: -0.3, spark: spark(24, -0.4) },
  { key: "score", label: "Health Score", value: 92, format: "number", delta: 2.0, spark: spark(20, 0.3), sub: "Excellent" },
];

function spark(base: number, dir: number): number[] {
  const rng = makeRng(Math.round(base * 131 + dir * 1000));
  const out: number[] = [];
  let v = base;
  for (let i = 0; i < 24; i++) {
    v += rng.float(-4, 4) + dir * 1.4;
    out.push(Math.max(4, +v.toFixed(1)));
  }
  return out;
}

export type Granularity = "daily" | "weekly" | "monthly";

export interface SeriesPoint {
  label: string;
  revenue: number;
  prev: number;
  orders: number;
  profit: number;
}

function buildSeries(granularity: Granularity): SeriesPoint[] {
  const rng = makeRng(granularity === "daily" ? 11 : granularity === "weekly" ? 22 : 33);
  const config = {
    daily: { count: 30, base: 42000, labelFn: dayLabel },
    weekly: { count: 12, base: 280000, labelFn: (i: number) => `W${i + 1}` },
    monthly: { count: 12, base: 1150000, labelFn: monthLabel },
  }[granularity];

  const out: SeriesPoint[] = [];
  let v = config.base;
  let pv = config.base * 0.86;
  for (let i = 0; i < config.count; i++) {
    const growth = 1 + rng.float(-0.08, 0.13);
    v = v * growth;
    pv = pv * (1 + rng.float(-0.09, 0.1));
    const weekendBoost = granularity === "daily" && (i % 7 === 5 || i % 7 === 6) ? 1.18 : 1;
    const revenue = Math.round(v * weekendBoost);
    out.push({
      label: config.labelFn(i),
      revenue,
      prev: Math.round(pv),
      orders: Math.round(revenue / rng.float(115, 140)),
      profit: Math.round(revenue * rng.float(0.28, 0.34)),
    });
  }
  return out;
}

function dayLabel(i: number) {
  const REF = new Date("2026-07-23T00:00:00Z").getTime();
  const d = new Date(REF - (29 - i) * 86400000);
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
}
function monthLabel(i: number) {
  const months = ["Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  return months[i];
}

export const SERIES: Record<Granularity, SeriesPoint[]> = {
  daily: buildSeries("daily"),
  weekly: buildSeries("weekly"),
  monthly: buildSeries("monthly"),
};

export interface MarketplaceMetric {
  id: MarketplaceId;
  name: string;
  color: string;
  revenue: number;
  orders: number;
  share: number;
  delta: number;
}

const rawMarket: { id: MarketplaceId; revenue: number; orders: number; delta: number }[] = [
  { id: "amazon", revenue: 486200, orders: 3821, delta: 14.2 },
  { id: "flipkart", revenue: 312800, orders: 2640, delta: 9.6 },
  { id: "shopify", revenue: 298400, orders: 1910, delta: 22.1 },
  { id: "myntra", revenue: 204500, orders: 1188, delta: 6.4 },
  { id: "meesho", revenue: 112600, orders: 1502, delta: 18.3 },
  { id: "woocommerce", revenue: 98700, orders: 742, delta: 4.1 },
  { id: "ebay", revenue: 41200, orders: 388, delta: -7.2 },
];

const totalMarketRev = rawMarket.reduce((s, m) => s + m.revenue, 0);

export const MARKETPLACE_METRICS: MarketplaceMetric[] = rawMarket.map((m) => ({
  ...m,
  name: MARKETPLACES[m.id].name,
  color: MARKETPLACES[m.id].color,
  share: +((m.revenue / totalMarketRev) * 100).toFixed(1),
}));

export interface CategoryMetric {
  category: string;
  revenue: number;
  units: number;
}
export const CATEGORY_METRICS: CategoryMetric[] = [
  { category: "Electronics", revenue: 402000, units: 3120 },
  { category: "Apparel", revenue: 356000, units: 5240 },
  { category: "Footwear", revenue: 244000, units: 2810 },
  { category: "Beauty", revenue: 198000, units: 4600 },
  { category: "Home & Kitchen", revenue: 176000, units: 2190 },
  { category: "Accessories", revenue: 121000, units: 3380 },
];

// ---- Date-range–aware dashboard data ---------------------------------------

export type MetricRange = "7d" | "30d" | "90d" | "ytd";

export const METRIC_RANGES: { key: MetricRange; label: string }[] = [
  { key: "7d", label: "7 days" },
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "ytd", label: "YTD" },
];

export interface DashboardData {
  kpis: Kpi[];
  series: SeriesPoint[];
  marketplaces: MarketplaceMetric[];
  categories: CategoryMetric[];
  rangeLabel: string;
}

// Volume multiplier vs the canonical 30-day window.
const RANGE_FACTOR: Record<MetricRange, number> = {
  "7d": 0.235,
  "30d": 1,
  "90d": 3.02,
  "ytd": 6.78,
};

const RANGE_SEED: Record<MetricRange, number> = {
  "7d": 700,
  "30d": 3000,
  "90d": 900,
  "ytd": 3650,
};

// KPIs whose value is a running total (scale with the window). The rest are
// rates / averages / indices and stay flat across ranges.
const CUMULATIVE_KPIS = new Set(["revenue", "orders", "profit"]);

// Numeric counts embedded in the canonical 30-day sub-labels, scaled per range.
const SUB_BASE: Record<string, { count: number; suffix: string }> = {
  orders: { count: 1204, suffix: "pending" },
  returns: { count: 512, suffix: "returns" },
};

function scaleKpi(
  kpi: Kpi,
  factor: number,
  rng: ReturnType<typeof makeRng>
): Kpi {
  const cumulative = CUMULATIVE_KPIS.has(kpi.key);
  const value = cumulative ? Math.round(kpi.value * factor) : kpi.value;
  const delta = +(kpi.delta + rng.float(-1.8, 1.8)).toFixed(1);
  const spark = kpi.spark.map((v) =>
    Math.max(4, +(v * (0.85 + rng.float(0, 0.3))).toFixed(1))
  );
  let sub = kpi.sub;
  const base = SUB_BASE[kpi.key];
  if (base) {
    sub = `${Math.round(base.count * factor).toLocaleString("en-US")} ${base.suffix}`;
  }
  return { ...kpi, value, delta, spark, sub };
}

/**
 * Returns dashboard metrics scaled to the selected date range. The 30-day
 * window returns the canonical figures verbatim so the hero numbers used in
 * the pitch never change; every other range is deterministic (seeded RNG) so
 * SSR and CSR stay in sync (no hydration mismatch).
 */
export function getDashboardData(range: MetricRange): DashboardData {
  const rangeLabel = METRIC_RANGES.find((r) => r.key === range)?.label ?? "30 days";

  if (range === "30d") {
    return {
      kpis: KPIS,
      series: SERIES.daily,
      marketplaces: MARKETPLACE_METRICS,
      categories: CATEGORY_METRICS,
      rangeLabel,
    };
  }

  const factor = RANGE_FACTOR[range];
  const rng = makeRng(RANGE_SEED[range]);

  const kpis = KPIS.map((k) => scaleKpi(k, factor, rng));

  const series =
    range === "7d"
      ? SERIES.daily.slice(-7)
      : range === "90d"
      ? SERIES.weekly
      : SERIES.monthly;

  const scaled = MARKETPLACE_METRICS.map((m) => ({
    ...m,
    revenue: Math.round(m.revenue * factor),
    orders: Math.round(m.orders * factor),
  }));
  const totalRev = scaled.reduce((s, m) => s + m.revenue, 0);
  const marketplaces = scaled.map((m) => ({
    ...m,
    share: +((m.revenue / totalRev) * 100).toFixed(1),
  }));

  const categories = CATEGORY_METRICS.map((c) => ({
    ...c,
    revenue: Math.round(c.revenue * factor),
    units: Math.round(c.units * factor),
  }));

  return { kpis, series, marketplaces, categories, rangeLabel };
}
