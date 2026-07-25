"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  CircleCheck,
  Package,
  Sparkles,
  Plus,
  Download,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { KpiCard } from "@/components/app/kpi-card";
import { RevenueChart } from "@/components/app/revenue-chart";
import {
  MarketplaceComparisonChart,
  ChannelDonut,
  CategoryChart,
} from "@/components/app/dashboard-charts";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { ProductFormDialog } from "@/components/app/product-form-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatNumber,
  relativeTime,
  exportToCsv,
} from "@/lib/format";
import {
  getDashboardData,
  MetricRange,
  METRIC_RANGES,
} from "@/lib/mock/metrics";
import { CONNECTIONS, MARKETPLACES } from "@/lib/mock/marketplaces";
import { TOP_PRODUCTS, LOW_STOCK } from "@/lib/mock/products";
import { INSIGHTS, ACTIVITY, TASKS } from "@/lib/mock/insights";

const KPI_ACCENTS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-5)",
  "var(--chart-4)", "var(--chart-6)", "var(--chart-1)", "var(--chart-2)",
];

const INSIGHT_META = {
  opportunity: { icon: Lightbulb, color: "text-primary", bg: "bg-primary/10" },
  warning: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/12" },
  trend: { icon: TrendingUp, color: "text-info", bg: "bg-info/12" },
  success: { icon: CircleCheck, color: "text-success", bg: "bg-success/12" },
};

// Map an insight's call-to-action to an existing destination, or null to toast.
function insightHref(action?: string): string | null {
  if (!action) return null;
  const a = action.toLowerCase();
  if (a.includes("reconnect") || a.includes("channel")) return "/marketplaces";
  if (a.includes("pric")) return "/products";
  return null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = useState<MetricRange>("30d");
  const [refreshing, setRefreshing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const data = useMemo(() => getDashboardData(range), [range]);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function changeRange(next: MetricRange) {
    if (next === range) return;
    setRange(next);
    setRefreshing(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setRefreshing(false), 380);
  }

  function exportDashboard() {
    const rows = data.kpis.map((k) => ({
      metric: k.label,
      value: k.value,
      delta_pct: k.delta,
      note: k.sub ?? "",
    }));
    exportToCsv(`dashboard-${range}`, rows);
    toast.success("Dashboard exported", {
      description: `${rows.length} metrics · last ${data.rangeLabel}`,
    });
  }

  function handleInsight(action?: string) {
    const dest = insightHref(action);
    if (dest) router.push(dest);
    else if (action) toast(action, { description: "Opening workflow…" });
  }

  const activeConnections = CONNECTIONS.filter((c) => c.status !== "disconnected");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your unified commerce cockpit across every connected channel."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={exportDashboard}>
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add product
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={range} onValueChange={(v) => changeRange(v as MetricRange)}>
            <TabsList>
              {METRIC_RANGES.map((r) => (
                <TabsTrigger key={r.key} value={r.key}>
                  {r.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <StatusPill
            label={refreshing ? "Updating…" : "Live · syncing"}
            variant={refreshing ? "info" : "success"}
            pulse
          />
        </div>
      </PageHeader>

      {/* Range-dependent analytics (KPIs + charts) */}
      {refreshing ? (
        <DashboardMetricsSkeleton />
      ) : (
        <>
          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {data.kpis.map((kpi, i) => (
              <KpiCard
                key={kpi.key}
                kpi={kpi}
                accent={KPI_ACCENTS[i]}
                href={kpi.key === "orders" ? "/orders" : undefined}
              />
            ))}
          </div>

          {/* Revenue + channel mix */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <RevenueChart series={data.series} rangeLabel={data.rangeLabel} />
            </div>
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Channel mix</CardTitle>
                <Link
                  href="/marketplaces"
                  className="text-xs text-primary hover:underline"
                >
                  View all
                </Link>
              </CardHeader>
              <CardContent>
                <ChannelDonut metrics={data.marketplaces} />
              </CardContent>
            </Card>
          </div>

          {/* Comparison + categories */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle>Marketplace comparison</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Revenue by channel · last {data.rangeLabel}
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <MarketplaceComparisonChart metrics={data.marketplaces} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top categories</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryChart categories={data.categories} />
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Smart insights */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle>Smart insights</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/assistant">
              Ask AI <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {INSIGHTS.map((ins) => {
            const meta = INSIGHT_META[ins.type];
            const Icon = meta.icon;
            return (
              <div
                key={ins.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4 transition-colors hover:border-primary/30"
              >
                <div className="flex items-start gap-3">
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.bg, meta.color)}>
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium leading-snug">{ins.title}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{ins.detail}</p>
                <div className="mt-auto flex items-center justify-between pt-1">
                  {ins.impact && (
                    <span className={cn("text-xs font-semibold", meta.color)}>
                      {ins.impact}
                    </span>
                  )}
                  {ins.action && (
                    <button
                      onClick={() => handleInsight(ins.action)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {ins.action} →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Bottom grid: health / top products / tasks+activity */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Marketplace health */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Marketplace health</CardTitle>
            <Link href="/marketplaces" className="text-xs text-primary hover:underline">
              Manage
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {activeConnections.slice(0, 6).map((c) => {
              const m = MARKETPLACES[c.id];
              const variant =
                c.status === "connected"
                  ? "success"
                  : c.status === "syncing"
                  ? "info"
                  : "danger";
              return (
                <div key={c.id} className="flex items-center gap-3">
                  <MarketplaceLogo id={c.id} size={30} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{m.name}</span>
                      <span className="text-xs font-medium tabular-nums">{c.health}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                      <div
                        className={cn(
                          "h-full rounded-full",
                          c.health > 90 ? "bg-success" : c.health > 60 ? "bg-warning" : "bg-danger"
                        )}
                        style={{ width: `${c.health}%` }}
                      />
                    </div>
                  </div>
                  <StatusPill
                    label={c.status}
                    variant={variant}
                    pulse={c.status === "syncing"}
                    className="capitalize"
                  />
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Top products */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Top products</CardTitle>
            <Link href="/products" className="text-xs text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {TOP_PRODUCTS.map((p, i) => (
              <Link
                key={p.id}
                href={`/products/${p.id}`}
                className="flex items-center gap-3 rounded-lg p-1.5 transition-colors hover:bg-secondary/60"
              >
                <span className="w-4 text-center text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="size-9 shrink-0 rounded-lg" style={{ background: p.image }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(p.units30d)} sold
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums">
                    {formatCurrency(p.revenue30d, { compact: true })}
                  </p>
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-success">
                    <ArrowUpRight className="size-3" />
                    {Math.abs(p.trend)}%
                  </span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        {/* Tasks + Low stock */}
        <div className="space-y-4">
          <DashboardTasks />

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="size-4 text-warning" />
                <CardTitle>Low stock</CardTitle>
              </div>
              <Link href="/products" className="text-xs text-primary hover:underline">
                Reorder
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {LOW_STOCK.slice(0, 4).map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <span className="size-8 shrink-0 rounded-lg" style={{ background: p.image }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.sku}</p>
                  </div>
                  <span className="rounded-full bg-danger/12 px-2 py-0.5 text-xs font-medium text-danger">
                    {p.stock} left
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Activity feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ACTIVITY.map((a) => (
            <div key={a.id} className="flex items-center gap-3 text-sm">
              {a.marketplace ? (
                <MarketplaceLogo id={a.marketplace} size={26} />
              ) : (
                <span className="flex size-[26px] items-center justify-center rounded-md bg-secondary text-xs font-medium text-muted-foreground">
                  {a.actor === "System" ? "PS" : a.actor.slice(0, 2)}
                </span>
              )}
              <p className="flex-1 text-muted-foreground">
                <span className="font-medium text-foreground">{a.actor}</span> {a.action}{" "}
                <span className="font-medium text-foreground">{a.target}</span>
              </p>
              <span className="text-xs text-muted-foreground">{relativeTime(a.at)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <ProductFormDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

/** Interactive tasks card — checkbox state persists to localStorage. */
function DashboardTasks() {
  const [done, setDone] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(TASKS.map((t) => [t.id, t.done]))
  );

  // Hydrate saved state after mount so SSR and first client render still match.
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pso_tasks");
      if (raw) setDone((prev) => ({ ...prev, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
  }, []);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("pso_tasks", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const openCount = TASKS.filter((t) => !done[t.id]).length;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Tasks</CardTitle>
        <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          {openCount} open
        </span>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {TASKS.map((t) => (
          <label
            key={t.id}
            className="flex cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-secondary/50"
          >
            <input
              type="checkbox"
              checked={!!done[t.id]}
              onChange={() => toggle(t.id)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className={cn("flex-1 text-sm", done[t.id] && "text-muted-foreground line-through")}>
              {t.title}
            </span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                t.priority === "high"
                  ? "bg-danger/12 text-danger"
                  : t.priority === "medium"
                  ? "bg-warning/12 text-warning"
                  : "bg-secondary text-muted-foreground"
              )}
            >
              {t.due}
            </span>
          </label>
        ))}
      </CardContent>
    </Card>
  );
}

/** Skeleton shown briefly while the date-range metrics recompute. */
function DashboardMetricsSkeleton() {
  return (
    <>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[380px] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[380px] w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Skeleton className="h-[320px] w-full rounded-xl lg:col-span-2" />
        <Skeleton className="h-[320px] w-full rounded-xl" />
      </div>
    </>
  );
}
