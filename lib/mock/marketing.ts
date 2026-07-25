/**
 * Marketing — campaigns, promotions, and attribution.
 *
 * Total campaign spend is tuned to the $62,400 advertising line in the Finance
 * P&L, so the two modules agree when a demo jumps between them. Derived rates
 * (CTR, ROAS, CAC) are computed rather than stored, so editing a campaign in
 * the UI keeps its metrics honest.
 */
import { makeRng } from "./rng";

const REF = new Date("2026-07-23T14:30:00Z").getTime();
const daysAgo = (d: number) => new Date(REF - d * 86400000).toISOString();
const daysAhead = (d: number) => new Date(REF + d * 86400000).toISOString();

// ── Channels ────────────────────────────────────────────────────────────────

export type AdChannelId =
  | "google"
  | "meta"
  | "amazon_ads"
  | "flipkart_ads"
  | "email"
  | "influencer"
  | "tiktok";

export interface AdChannel {
  id: AdChannelId;
  name: string;
  color: string;
  short: string;
}

export const AD_CHANNELS: Record<AdChannelId, AdChannel> = {
  google: { id: "google", name: "Google Ads", color: "#4285F4", short: "GA" },
  meta: { id: "meta", name: "Meta Ads", color: "#0866FF", short: "MT" },
  amazon_ads: { id: "amazon_ads", name: "Amazon Ads", color: "#FF9900", short: "AZ" },
  flipkart_ads: { id: "flipkart_ads", name: "Flipkart Ads", color: "#2874F0", short: "FK" },
  email: { id: "email", name: "Email", color: "#10b981", short: "EM" },
  influencer: { id: "influencer", name: "Influencer", color: "#ec4899", short: "IN" },
  tiktok: { id: "tiktok", name: "TikTok", color: "#25F4EE", short: "TT" },
};

export const AD_CHANNEL_LIST = Object.values(AD_CHANNELS);

// ── Campaigns ───────────────────────────────────────────────────────────────

export type CampaignStatus = "active" | "paused" | "scheduled" | "ended";

export const CAMPAIGN_STATUS_META: Record<
  CampaignStatus,
  { label: string; variant: "success" | "warning" | "danger" | "info" | "secondary" | "default" }
> = {
  active: { label: "Active", variant: "success" },
  paused: { label: "Paused", variant: "warning" },
  scheduled: { label: "Scheduled", variant: "info" },
  ended: { label: "Ended", variant: "secondary" },
};

export type CampaignObjective = "awareness" | "conversion" | "retention" | "acquisition";

export interface Campaign {
  id: string;
  name: string;
  channel: AdChannelId;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: number;
  spend: number;
  impressions: number;
  clicks: number;
  orders: number;
  revenue: number;
  startAt: string;
  endAt: string;
  audience: string;
}

interface CampaignSeed {
  name: string;
  channel: AdChannelId;
  objective: CampaignObjective;
  status: CampaignStatus;
  budget: number;
  spend: number;
  roas: number;
  ctr: number;
  cpc: number;
  audience: string;
}

/**
 * Spend across every campaign sums to exactly $62,400 — the advertising line in
 * the Finance P&L. Change a `spend` here and that tie breaks, so adjust the
 * P&L's `ads` line by the same amount (and its `net_profit`) if you do.
 */
const CAMPAIGN_SEEDS: CampaignSeed[] = [
  { name: "Summer Electronics Push", channel: "google", objective: "conversion", status: "active", budget: 12000, spend: 11200, roas: 6.2, ctr: 3.8, cpc: 0.62, audience: "High-intent search" },
  { name: "Prime Day Sponsored Products", channel: "amazon_ads", objective: "conversion", status: "active", budget: 10000, spend: 9400, roas: 5.4, ctr: 0.9, cpc: 0.48, audience: "Category shoppers" },
  { name: "Meta Retargeting — Cart Abandon", channel: "meta", objective: "retention", status: "active", budget: 7000, spend: 6600, roas: 8.9, ctr: 2.1, cpc: 0.34, audience: "Cart abandoners (7d)" },
  { name: "Apparel Lookalike Prospecting", channel: "meta", objective: "acquisition", status: "active", budget: 8000, spend: 7200, roas: 2.8, ctr: 1.4, cpc: 0.41, audience: "1% lookalike, IN" },
  { name: "Flipkart Big Billion Boost", channel: "flipkart_ads", objective: "conversion", status: "active", budget: 6500, spend: 5900, roas: 4.7, ctr: 1.1, cpc: 0.29, audience: "Flipkart browse" },
  { name: "Win-back — Dormant 180d", channel: "email", objective: "retention", status: "active", budget: 1200, spend: 780, roas: 14.2, ctr: 6.4, cpc: 0.04, audience: "Dormant segment" },
  { name: "VIP Early Access Drop", channel: "email", objective: "retention", status: "active", budget: 900, spend: 620, roas: 22.6, ctr: 11.2, cpc: 0.03, audience: "VIP segment" },
  { name: "Creator Collab — Footwear", channel: "influencer", objective: "awareness", status: "active", budget: 9000, spend: 8100, roas: 3.1, ctr: 2.9, cpc: 0.55, audience: "Fitness creators" },
  { name: "TikTok Shop Launch", channel: "tiktok", objective: "awareness", status: "paused", budget: 5000, spend: 3120, roas: 1.9, ctr: 1.8, cpc: 0.22, audience: "18–24, urban" },
  { name: "Brand Search Defence", channel: "google", objective: "conversion", status: "active", budget: 4000, spend: 3700, roas: 11.4, ctr: 8.9, cpc: 0.18, audience: "Brand keywords" },
  { name: "Beauty Category Ramp", channel: "amazon_ads", objective: "acquisition", status: "paused", budget: 4500, spend: 2970, roas: 2.2, ctr: 0.7, cpc: 0.51, audience: "Beauty browse" },
  { name: "Home & Kitchen Display", channel: "google", objective: "awareness", status: "ended", budget: 3500, spend: 2810, roas: 1.6, ctr: 0.5, cpc: 0.36, audience: "In-market home" },
  { name: "Diwali Teaser", channel: "meta", objective: "awareness", status: "scheduled", budget: 15000, spend: 0, roas: 0, ctr: 0, cpc: 0, audience: "Broad, IN metros" },
  { name: "New Year Clearance", channel: "flipkart_ads", objective: "conversion", status: "scheduled", budget: 6000, spend: 0, roas: 0, ctr: 0, cpc: 0, audience: "Deal seekers" },
];

function generateCampaigns(): Campaign[] {
  const rng = makeRng(88431);
  return CAMPAIGN_SEEDS.map((s, i) => {
    const clicks = s.cpc > 0 ? Math.round(s.spend / s.cpc) : 0;
    const impressions = s.ctr > 0 ? Math.round((clicks / s.ctr) * 100) : 0;
    const revenue = Math.round(s.spend * s.roas);
    // Back out orders from revenue at a plausible AOV for the channel.
    const aov = rng.float(96, 168);
    const orders = revenue > 0 ? Math.max(1, Math.round(revenue / aov)) : 0;

    return {
      id: `camp_${300 + i}`,
      name: s.name,
      channel: s.channel,
      objective: s.objective,
      status: s.status,
      budget: s.budget,
      spend: s.spend,
      impressions,
      clicks,
      orders,
      revenue,
      startAt: s.status === "scheduled" ? daysAhead(rng.int(3, 40)) : daysAgo(rng.int(14, 90)),
      endAt: s.status === "ended" ? daysAgo(rng.int(2, 20)) : daysAhead(rng.int(5, 70)),
      audience: s.audience,
    };
  });
}

export const CAMPAIGNS: Campaign[] = generateCampaigns();

/** Rates are always derived, never stored — edits stay self-consistent. */
export function campaignMetrics(c: Campaign) {
  return {
    ctr: c.impressions ? +((c.clicks / c.impressions) * 100).toFixed(2) : 0,
    cpc: c.clicks ? +(c.spend / c.clicks).toFixed(2) : 0,
    roas: c.spend ? +(c.revenue / c.spend).toFixed(2) : 0,
    cac: c.orders ? +(c.spend / c.orders).toFixed(2) : 0,
    conversion: c.clicks ? +((c.orders / c.clicks) * 100).toFixed(2) : 0,
    pacing: c.budget ? +((c.spend / c.budget) * 100).toFixed(1) : 0,
    profit: Math.round(c.revenue - c.spend),
  };
}

export function marketingSummary(campaigns: Campaign[]) {
  const spend = campaigns.reduce((s, c) => s + c.spend, 0);
  const revenue = campaigns.reduce((s, c) => s + c.revenue, 0);
  const orders = campaigns.reduce((s, c) => s + c.orders, 0);
  const clicks = campaigns.reduce((s, c) => s + c.clicks, 0);
  const impressions = campaigns.reduce((s, c) => s + c.impressions, 0);
  return {
    spend,
    revenue,
    orders,
    clicks,
    impressions,
    roas: spend ? +(revenue / spend).toFixed(2) : 0,
    cac: orders ? +(spend / orders).toFixed(2) : 0,
    ctr: impressions ? +((clicks / impressions) * 100).toFixed(2) : 0,
    active: campaigns.filter((c) => c.status === "active").length,
    budget: campaigns.reduce((s, c) => s + c.budget, 0),
  };
}

/** Spend and attributed revenue by channel, for the comparison chart. */
export function channelPerformance(campaigns: Campaign[]) {
  return AD_CHANNEL_LIST.map((ch) => {
    const members = campaigns.filter((c) => c.channel === ch.id);
    const spend = members.reduce((s, c) => s + c.spend, 0);
    const revenue = members.reduce((s, c) => s + c.revenue, 0);
    return {
      ...ch,
      spend,
      revenue,
      campaigns: members.length,
      roas: spend ? +(revenue / spend).toFixed(2) : 0,
    };
  }).filter((c) => c.campaigns > 0);
}

// ── Promotions ──────────────────────────────────────────────────────────────

export type CouponType = "percent" | "fixed" | "shipping" | "bogo";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  description: string;
  uses: number;
  maxUses: number;
  revenue: number;
  discountGiven: number;
  status: "active" | "paused" | "expired";
  expiresAt: string;
}

export const COUPONS: Coupon[] = [
  { id: "cpn_1", code: "SUMMER20", type: "percent", value: 20, description: "20% off sitewide", uses: 1842, maxUses: 5000, revenue: 214600, discountGiven: 42920, status: "active", expiresAt: daysAhead(12) },
  { id: "cpn_2", code: "FREESHIP", type: "shipping", value: 0, description: "Free shipping over $50", uses: 3610, maxUses: 10000, revenue: 386400, discountGiven: 18050, status: "active", expiresAt: daysAhead(38) },
  { id: "cpn_3", code: "WELCOME10", type: "fixed", value: 10, description: "$10 off first order", uses: 928, maxUses: 2000, revenue: 84200, discountGiven: 9280, status: "active", expiresAt: daysAhead(64) },
  { id: "cpn_4", code: "VIP30", type: "percent", value: 30, description: "VIP early access", uses: 214, maxUses: 400, revenue: 61800, discountGiven: 18540, status: "active", expiresAt: daysAhead(6) },
  { id: "cpn_5", code: "BOGOTEE", type: "bogo", value: 1, description: "Buy one tee, get one", uses: 486, maxUses: 1000, revenue: 32400, discountGiven: 14200, status: "paused", expiresAt: daysAhead(20) },
  { id: "cpn_6", code: "FLASH15", type: "percent", value: 15, description: "48-hour flash sale", uses: 2104, maxUses: 2104, revenue: 168200, discountGiven: 25230, status: "expired", expiresAt: daysAgo(9) },
];

// ── Attribution & audiences ─────────────────────────────────────────────────

export interface AttributionPoint {
  label: string;
  spend: number;
  revenue: number;
  orders: number;
}

/** 12 weeks of spend vs attributed revenue. */
export const MARKETING_SERIES: AttributionPoint[] = (() => {
  const rng = makeRng(3391);
  let spend = 11200;
  return Array.from({ length: 12 }, (_, i) => {
    spend *= 1 + rng.float(-0.12, 0.16);
    const roas = rng.float(3.6, 6.4);
    const revenue = Math.round(spend * roas);
    return {
      label: `W${i + 1}`,
      spend: Math.round(spend),
      revenue,
      orders: Math.round(revenue / rng.float(104, 148)),
    };
  });
})();

export interface Audience {
  id: string;
  name: string;
  size: number;
  source: string;
  growth: number;
  syncedTo: AdChannelId[];
}

export const AUDIENCES: Audience[] = [
  { id: "aud_1", name: "VIP buyers (LTV > $2.4K)", size: 4820, source: "Customers · VIP segment", growth: 8.4, syncedTo: ["meta", "email"] },
  { id: "aud_2", name: "Cart abandoners — 7 days", size: 18640, source: "Storefront events", growth: 12.1, syncedTo: ["meta", "google"] },
  { id: "aud_3", name: "Dormant 180+ days", size: 9310, source: "Customers · Dormant", growth: -3.2, syncedTo: ["email"] },
  { id: "aud_4", name: "Electronics category browsers", size: 42800, source: "Marketplace pixel", growth: 19.6, syncedTo: ["amazon_ads", "google"] },
  { id: "aud_5", name: "1% lookalike — top spenders", size: 128000, source: "Modelled", growth: 4.8, syncedTo: ["meta", "tiktok"] },
];
