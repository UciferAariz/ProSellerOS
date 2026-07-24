import { ArrowUpRight, TrendingUp } from "lucide-react";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import type { MarketplaceId } from "@/lib/mock/marketplaces";

const MINI_KPIS = [
  { label: "Revenue", value: "$1.55M", delta: "+12.4%" },
  { label: "Orders", value: "12,191", delta: "+8.1%" },
  { label: "Net Profit", value: "$486K", delta: "+15.2%" },
];

const CHANNELS: { id: MarketplaceId; name: string; pct: number }[] = [
  { id: "amazon", name: "Amazon", pct: 31 },
  { id: "flipkart", name: "Flipkart", pct: 20 },
  { id: "shopify", name: "Shopify", pct: 19 },
  { id: "myntra", name: "Myntra", pct: 13 },
  { id: "meesho", name: "Meesho", pct: 9 },
];

const AREA_POINTS = [28, 34, 30, 42, 38, 52, 48, 63, 58, 72, 68, 84];

export function HeroPreview() {
  const w = 520;
  const h = 150;
  const max = Math.max(...AREA_POINTS);
  const step = w / (AREA_POINTS.length - 1);
  const line = AREA_POINTS.map(
    (p, i) => `${i * step},${h - (p / max) * (h - 20) - 10}`
  ).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      {/* top bar */}
      <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
        <div className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-danger/70" />
          <span className="size-2.5 rounded-full bg-warning/70" />
          <span className="size-2.5 rounded-full bg-success/70" />
        </div>
        <div className="ml-2 flex-1 truncate rounded-md bg-background px-3 py-1 text-xs text-muted-foreground">
          app.proselleros.com/dashboard
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-3">
        {MINI_KPIS.map((k) => (
          <div key={k.label} className="rounded-lg border border-border bg-background p-3">
            <p className="text-[11px] text-muted-foreground">{k.label}</p>
            <div className="mt-1 flex items-end justify-between">
              <p className="text-lg font-semibold tabular-nums">{k.value}</p>
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-success">
                <ArrowUpRight className="size-3" />
                {k.delta}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 px-4 pb-4 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-background p-3 lg:col-span-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium">Revenue trend</p>
            <span className="flex items-center gap-1 text-[10px] text-success">
              <TrendingUp className="size-3" /> +12.4%
            </span>
          </div>
          <svg viewBox={`0 0 ${w} ${h}`} className="h-[120px] w-full" preserveAspectRatio="none">
            <defs>
              <linearGradient id="heroArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.35" />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <polygon points={area} fill="url(#heroArea)" />
            <polyline
              points={line}
              fill="none"
              stroke="var(--chart-1)"
              strokeWidth="2.5"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>

        <div className="rounded-lg border border-border bg-background p-3 lg:col-span-2">
          <p className="mb-2 text-xs font-medium">Channel mix</p>
          <div className="space-y-2">
            {CHANNELS.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <MarketplaceLogo id={c.id} size={18} />
                <span className="text-[11px] text-muted-foreground">{c.name}</span>
                <div className="ml-auto flex w-24 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${c.pct * 3}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-[10px] tabular-nums text-muted-foreground">
                    {c.pct}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
