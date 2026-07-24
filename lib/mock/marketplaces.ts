export type MarketplaceId =
  | "amazon"
  | "flipkart"
  | "meesho"
  | "myntra"
  | "ajio"
  | "shopify"
  | "woocommerce"
  | "ebay"
  | "etsy"
  | "tiktok"
  | "noon"
  | "walmart";

export interface Marketplace {
  id: MarketplaceId;
  name: string;
  color: string;
  short: string;
  region: string;
  category: "Marketplace" | "Own Store" | "Social";
}

export const MARKETPLACES: Record<MarketplaceId, Marketplace> = {
  amazon: { id: "amazon", name: "Amazon", color: "#FF9900", short: "AZ", region: "Global", category: "Marketplace" },
  flipkart: { id: "flipkart", name: "Flipkart", color: "#2874F0", short: "FK", region: "India", category: "Marketplace" },
  meesho: { id: "meesho", name: "Meesho", color: "#F43397", short: "ME", region: "India", category: "Marketplace" },
  myntra: { id: "myntra", name: "Myntra", color: "#FF3F6C", short: "MY", region: "India", category: "Marketplace" },
  ajio: { id: "ajio", name: "Ajio", color: "#2C4152", short: "AJ", region: "India", category: "Marketplace" },
  shopify: { id: "shopify", name: "Shopify", color: "#95BF47", short: "SH", region: "Global", category: "Own Store" },
  woocommerce: { id: "woocommerce", name: "WooCommerce", color: "#96588A", short: "WC", region: "Global", category: "Own Store" },
  ebay: { id: "ebay", name: "eBay", color: "#E53238", short: "EB", region: "Global", category: "Marketplace" },
  etsy: { id: "etsy", name: "Etsy", color: "#F1641E", short: "ET", region: "Global", category: "Marketplace" },
  tiktok: { id: "tiktok", name: "TikTok Shop", color: "#25F4EE", short: "TT", region: "Global", category: "Social" },
  noon: { id: "noon", name: "Noon", color: "#FEEE00", short: "NO", region: "MENA", category: "Marketplace" },
  walmart: { id: "walmart", name: "Walmart", color: "#0071DC", short: "WM", region: "US", category: "Marketplace" },
};

export const MARKETPLACE_LIST = Object.values(MARKETPLACES);

export interface MarketplaceConnection {
  id: MarketplaceId;
  status: "connected" | "syncing" | "error" | "disconnected";
  health: number; // 0-100
  lastSync: string; // ISO
  orders30d: number;
  revenue30d: number;
  skus: number;
  apiVersion: string;
  webhooks: boolean;
  issues: number;
}

export const CONNECTIONS: MarketplaceConnection[] = [
  { id: "amazon", status: "connected", health: 98, lastSync: minsAgo(4), orders30d: 3821, revenue30d: 486200, skus: 1240, apiVersion: "SP-API v1", webhooks: true, issues: 0 },
  { id: "flipkart", status: "connected", health: 94, lastSync: minsAgo(11), orders30d: 2640, revenue30d: 312800, skus: 980, apiVersion: "Seller API v3", webhooks: true, issues: 1 },
  { id: "shopify", status: "connected", health: 99, lastSync: minsAgo(2), orders30d: 1910, revenue30d: 298400, skus: 1430, apiVersion: "Admin 2024-07", webhooks: true, issues: 0 },
  { id: "meesho", status: "syncing", health: 88, lastSync: minsAgo(1), orders30d: 1502, revenue30d: 112600, skus: 610, apiVersion: "Supplier API", webhooks: true, issues: 0 },
  { id: "myntra", status: "connected", health: 91, lastSync: minsAgo(19), orders30d: 1188, revenue30d: 204500, skus: 540, apiVersion: "PPMP v2", webhooks: false, issues: 2 },
  { id: "woocommerce", status: "connected", health: 96, lastSync: minsAgo(7), orders30d: 742, revenue30d: 98700, skus: 820, apiVersion: "REST v3", webhooks: true, issues: 0 },
  { id: "ebay", status: "error", health: 42, lastSync: minsAgo(212), orders30d: 388, revenue30d: 41200, skus: 300, apiVersion: "Sell API", webhooks: false, issues: 5 },
  { id: "ajio", status: "disconnected", health: 0, lastSync: minsAgo(4320), orders30d: 0, revenue30d: 0, skus: 0, apiVersion: "—", webhooks: false, issues: 0 },
  { id: "etsy", status: "disconnected", health: 0, lastSync: minsAgo(0), orders30d: 0, revenue30d: 0, skus: 0, apiVersion: "—", webhooks: false, issues: 0 },
  { id: "tiktok", status: "disconnected", health: 0, lastSync: minsAgo(0), orders30d: 0, revenue30d: 0, skus: 0, apiVersion: "—", webhooks: false, issues: 0 },
  { id: "noon", status: "disconnected", health: 0, lastSync: minsAgo(0), orders30d: 0, revenue30d: 0, skus: 0, apiVersion: "—", webhooks: false, issues: 0 },
  { id: "walmart", status: "disconnected", health: 0, lastSync: minsAgo(0), orders30d: 0, revenue30d: 0, skus: 0, apiVersion: "—", webhooks: false, issues: 0 },
];

function minsAgo(mins: number): string {
  // Use a fixed reference so SSR/CSR match.
  const REF = new Date("2026-07-23T14:30:00Z").getTime();
  return new Date(REF - mins * 60000).toISOString();
}
