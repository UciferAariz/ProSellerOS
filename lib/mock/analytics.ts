/**
 * Analytics — the deep-dive surface behind the dashboard tiles.
 *
 * The funnel is anchored to the cockpit's own numbers: 12,191 purchases at a
 * 3.8% conversion rate implies ~320.8K sessions, so the stages resolve to
 * exactly the Orders and Conversion KPIs rather than inventing a second truth.
 */
import { makeRng } from "./rng";
import { MetricRange } from "./metrics";

// ── Funnel ──────────────────────────────────────────────────────────────────

export interface FunnelStage {
  key: string;
  label: string;
  value: number;
  /** Conversion from the immediately preceding stage, in %. */
  stepRate: number;
  /** Conversion from the top of the funnel, in %. */
  totalRate: number;
  color: string;
}

const FUNNEL_BASE = [
  { key: "sessions", label: "Sessions", value: 320800, color: "var(--chart-1)" },
  { key: "views", label: "Product views", value: 214900, color: "var(--chart-5)" },
  { key: "cart", label: "Added to cart", value: 68300, color: "var(--chart-6)" },
  { key: "checkout", label: "Reached checkout", value: 24600, color: "var(--chart-3)" },
  { key: "purchase", label: "Purchased", value: 12191, color: "var(--chart-2)" },
];

function buildFunnel(factor: number): FunnelStage[] {
  const top = FUNNEL_BASE[0].value * factor;
  return FUNNEL_BASE.map((s, i) => {
    const value = Math.round(s.value * factor);
    const prev = i === 0 ? value : Math.round(FUNNEL_BASE[i - 1].value * factor);
    return {
      ...s,
      value,
      stepRate: i === 0 ? 100 : +((value / prev) * 100).toFixed(1),
      totalRate: +((value / top) * 100).toFixed(2),
    };
  });
}

// ── Cohort retention ────────────────────────────────────────────────────────

export interface Cohort {
  label: string;
  size: number;
  /** Retention % for months 0..5; shorter for recent cohorts. */
  retention: number[];
}

export const COHORTS: Cohort[] = (() => {
  const rng = makeRng(6612);
  const months = ["Feb", "Mar", "Apr", "May", "Jun", "Jul"];
  return months.map((label, i) => {
    const size = rng.int(820, 1640);
    const depth = months.length - i; // recent cohorts have fewer observed months
    const retention: number[] = [100];
    let v = 100;
    for (let m = 1; m < depth; m++) {
      // Steep first drop, then a flattening tail — classic ecommerce shape.
      v *= m === 1 ? rng.float(0.34, 0.44) : rng.float(0.76, 0.9);
      retention.push(+v.toFixed(1));
    }
    return { label, size, retention };
  });
})();

// ── Traffic ─────────────────────────────────────────────────────────────────

export interface TrafficSource {
  source: string;
  sessions: number;
  share: number;
  conversion: number;
  revenue: number;
  color: string;
  /** % change vs previous period. */
  delta: number;
}

const TRAFFIC_RAW = [
  { source: "Marketplace search", sessions: 118600, conversion: 5.2, color: "var(--chart-1)", delta: 9.4 },
  { source: "Organic search", sessions: 74200, conversion: 3.1, color: "var(--chart-2)", delta: 14.2 },
  { source: "Direct", sessions: 48300, conversion: 4.6, color: "var(--chart-5)", delta: 2.8 },
  { source: "Paid search", sessions: 31900, conversion: 4.1, color: "var(--chart-3)", delta: 22.6 },
  { source: "Social", sessions: 26400, conversion: 1.8, color: "var(--chart-4)", delta: -6.1 },
  { source: "Email", sessions: 14200, conversion: 7.4, color: "var(--chart-6)", delta: 18.9 },
  { source: "Referral", sessions: 7200, conversion: 2.9, color: "var(--muted-foreground)", delta: 1.2 },
];

function buildTraffic(factor: number): TrafficSource[] {
  const total = TRAFFIC_RAW.reduce((s, t) => s + t.sessions, 0);
  return TRAFFIC_RAW.map((t) => ({
    ...t,
    sessions: Math.round(t.sessions * factor),
    share: +((t.sessions / total) * 100).toFixed(1),
    // Revenue implied by sessions × conversion × a source-typical AOV.
    revenue: Math.round(t.sessions * factor * (t.conversion / 100) * (96 + t.conversion * 6)),
  }));
}

// ── Geography ───────────────────────────────────────────────────────────────

export interface GeoRegion {
  region: string;
  code: string;
  revenue: number;
  orders: number;
  share: number;
  delta: number;
}

const GEO_RAW = [
  { region: "India", code: "IN", revenue: 742800, orders: 6820, delta: 11.2 },
  { region: "United States", code: "US", revenue: 386400, orders: 2410, delta: 16.8 },
  { region: "United Kingdom", code: "UK", revenue: 148200, orders: 1180, delta: 6.4 },
  { region: "United Arab Emirates", code: "AE", revenue: 96400, orders: 742, delta: 21.4 },
  { region: "Canada", code: "CA", revenue: 78600, orders: 588, delta: 3.1 },
  { region: "Australia", code: "AU", revenue: 54200, orders: 342, delta: -2.8 },
  { region: "Singapore", code: "SG", revenue: 48100, orders: 309, delta: 9.6 },
];

function buildGeo(factor: number): GeoRegion[] {
  const total = GEO_RAW.reduce((s, g) => s + g.revenue, 0);
  return GEO_RAW.map((g) => ({
    ...g,
    revenue: Math.round(g.revenue * factor),
    orders: Math.round(g.orders * factor),
    share: +((g.revenue / total) * 100).toFixed(1),
  }));
}

// ── Order heatmap ───────────────────────────────────────────────────────────

export const HEATMAP_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
/** Three-hour buckets — 24 columns is unreadable on a laptop. */
export const HEATMAP_HOURS = ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"];

/** orders[day][hourBucket] — evening and weekend peaks baked in. */
export const ORDER_HEATMAP: number[][] = (() => {
  const rng = makeRng(1204);
  // Shape of a retail day: dead overnight, builds to an evening peak.
  const hourWeight = [0.18, 0.08, 0.12, 0.62, 1.0, 0.94, 1.35, 0.78];
  const dayWeight = [0.92, 0.88, 0.94, 1.0, 1.12, 1.34, 1.22];
  return HEATMAP_DAYS.map((_, d) =>
    HEATMAP_HOURS.map((_, h) =>
      Math.round(88 * hourWeight[h] * dayWeight[d] * rng.float(0.82, 1.18))
    )
  );
})();

// ── Devices ─────────────────────────────────────────────────────────────────

export interface DeviceSlice {
  device: string;
  sessions: number;
  share: number;
  conversion: number;
  color: string;
}

export const DEVICE_MIX: DeviceSlice[] = [
  { device: "Mobile", sessions: 218400, share: 68.1, conversion: 3.4, color: "var(--chart-1)" },
  { device: "Desktop", sessions: 76900, share: 24.0, conversion: 5.1, color: "var(--chart-2)" },
  { device: "Tablet", sessions: 25500, share: 7.9, conversion: 2.8, color: "var(--chart-3)" },
];

// ── Product performance quadrant ────────────────────────────────────────────

export interface ProductPoint {
  name: string;
  units: number;
  margin: number;
  revenue: number;
  category: string;
}

/** Volume vs margin — the scatter that finds "sell more of this" SKUs. */
export function productQuadrant(
  products: { name: string; units30d: number; margin: number; revenue30d: number; category: string }[]
): ProductPoint[] {
  return products
    .slice()
    .sort((a, b) => b.revenue30d - a.revenue30d)
    .slice(0, 40)
    .map((p) => ({
      name: p.name,
      units: p.units30d,
      margin: p.margin,
      revenue: p.revenue30d,
      category: p.category,
    }));
}

// ── Range-aware bundle ──────────────────────────────────────────────────────

const RANGE_FACTOR: Record<MetricRange, number> = {
  "7d": 0.235,
  "30d": 1,
  "90d": 3.02,
  ytd: 6.78,
};

export interface AnalyticsData {
  funnel: FunnelStage[];
  traffic: TrafficSource[];
  geo: GeoRegion[];
  sessions: number;
  conversion: number;
  bounceRate: number;
  avgSessionSec: number;
  pagesPerSession: number;
  newVisitorShare: number;
}

export function getAnalyticsData(range: MetricRange): AnalyticsData {
  const factor = RANGE_FACTOR[range] ?? 1;
  const funnel = buildFunnel(factor);
  const sessions = funnel[0].value;
  const purchases = funnel[funnel.length - 1].value;

  return {
    funnel,
    traffic: buildTraffic(factor),
    geo: buildGeo(factor),
    sessions,
    conversion: sessions ? +((purchases / sessions) * 100).toFixed(2) : 0,
    // Engagement quality is a rate, so it holds steady across window sizes.
    bounceRate: 38.4,
    avgSessionSec: 214,
    pagesPerSession: 4.6,
    newVisitorShare: 61.8,
  };
}
