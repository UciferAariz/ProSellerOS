import { MarketplaceId } from "./marketplaces";

export interface Insight {
  id: string;
  type: "opportunity" | "warning" | "trend" | "success";
  title: string;
  detail: string;
  impact?: string;
  action?: string;
}

export const INSIGHTS: Insight[] = [
  {
    id: "ins_1",
    type: "opportunity",
    title: "Raise price on 8 high-demand SKUs",
    detail: "8 products are selling out within 3 days of restock with low price elasticity. A 6% price increase is projected to add revenue with no volume loss.",
    impact: "+$14,200/mo est.",
    action: "Review pricing",
  },
  {
    id: "ins_2",
    type: "warning",
    title: "eBay channel health degraded",
    detail: "SP token expired and 5 listings were auto-deactivated. Reconnect to restore ~$41K/mo in sales.",
    impact: "$41,200 at risk",
    action: "Reconnect eBay",
  },
  {
    id: "ins_3",
    type: "trend",
    title: "Shopify is your fastest-growing channel",
    detail: "Direct storefront revenue grew 22.1% this month, outpacing marketplace average of 9.4%. Consider shifting ad budget here.",
    impact: "+22.1% MoM",
    action: "View channel",
  },
  {
    id: "ins_4",
    type: "warning",
    title: "6 SKUs will stock out in 5 days",
    detail: "At current velocity, 6 bestsellers fall below safety stock this week. Suggested reorder quantity prepared.",
    impact: "512 units short",
    action: "Create PO",
  },
  {
    id: "ins_5",
    type: "success",
    title: "Return rate down 0.8pts",
    detail: "Improved sizing guides on Apparel reduced returns from 5.0% to 4.2% over 30 days.",
    impact: "-$6,400 in return costs",
  },
];

export interface Activity {
  id: string;
  actor: string;
  action: string;
  target: string;
  marketplace?: MarketplaceId;
  at: string;
  type: "order" | "product" | "sync" | "inventory" | "payout" | "team";
}

function minsAgo(m: number) {
  const REF = new Date("2026-07-23T14:30:00Z").getTime();
  return new Date(REF - m * 60000).toISOString();
}

export const ACTIVITY: Activity[] = [
  { id: "a1", actor: "System", action: "synced 42 orders from", target: "Amazon", marketplace: "amazon", at: minsAgo(4), type: "sync" },
  { id: "a2", actor: "Priya M.", action: "fulfilled order", target: "#PS-48231", marketplace: "flipkart", at: minsAgo(12), type: "order" },
  { id: "a3", actor: "System", action: "flagged low stock on", target: "Nova Ultra Wireless Earbuds", at: minsAgo(21), type: "inventory" },
  { id: "a4", actor: "Rahul S.", action: "published listing to", target: "Shopify", marketplace: "shopify", at: minsAgo(38), type: "product" },
  { id: "a5", actor: "System", action: "received settlement from", target: "Amazon ($48,210)", marketplace: "amazon", at: minsAgo(64), type: "payout" },
  { id: "a6", actor: "Ananya R.", action: "invited", target: "ops@brand.com to the team", at: minsAgo(120), type: "team" },
  { id: "a7", actor: "System", action: "auto-repriced 14 SKUs on", target: "Flipkart", marketplace: "flipkart", at: minsAgo(180), type: "sync" },
];

export interface Notification {
  id: string;
  title: string;
  detail: string;
  at: string;
  read: boolean;
  type: "info" | "warning" | "success";
}

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", title: "eBay connection error", detail: "Reauthorize to resume syncing.", at: minsAgo(30), read: false, type: "warning" },
  { id: "n2", title: "Payout received", detail: "$48,210 settled from Amazon.", at: minsAgo(64), read: false, type: "success" },
  { id: "n3", title: "6 SKUs low on stock", detail: "Reorder suggested for bestsellers.", at: minsAgo(140), read: false, type: "warning" },
  { id: "n4", title: "Weekly report ready", detail: "Your performance summary is available.", at: minsAgo(300), read: true, type: "info" },
];

export interface Task {
  id: string;
  title: string;
  due: string;
  priority: "high" | "medium" | "low";
  done: boolean;
}
export const TASKS: Task[] = [
  { id: "t1", title: "Reconnect eBay integration", due: "Today", priority: "high", done: false },
  { id: "t2", title: "Approve 12 pending listings", due: "Today", priority: "medium", done: false },
  { id: "t3", title: "Create PO for low-stock SKUs", due: "Tomorrow", priority: "high", done: false },
  { id: "t4", title: "Review July settlement report", due: "Jul 25", priority: "low", done: false },
  { id: "t5", title: "Respond to 3 customer returns", due: "Jul 24", priority: "medium", done: true },
];
