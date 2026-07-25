"use client";

import { useMemo, useState } from "react";
import {
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import {
  Activity,
  Users,
  Timer,
  MousePointerClick,
  Download,
  Globe,
  Filter,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, exportToCsv } from "@/lib/format";
import { METRIC_RANGES, type MetricRange } from "@/lib/mock/metrics";
import {
  getAnalyticsData,
  productQuadrant,
  COHORTS,
  DEVICE_MIX,
  HEATMAP_DAYS,
  HEATMAP_HOURS,
  ORDER_HEATMAP,
} from "@/lib/mock/analytics";
import { productStore, useEntityList } from "@/lib/mock/store";

export default function AnalyticsPage() {
  const products = useEntityList(productStore);
  const [range, setRange] = useState<MetricRange>("30d");

  const data = useMemo(() => getAnalyticsData(range), [range]);
  const quadrant = useMemo(() => productQuadrant(products), [products]);
  const rangeLabel = METRIC_RANGES.find((r) => r.key === range)?.label ?? "30 days";

  const avgSession = `${Math.floor(data.avgSessionSec / 60)}m ${data.avgSessionSec % 60}s`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Analytics"
        description="Traffic, conversion, retention, and product performance — the why behind the numbers."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              exportToCsv(
                `analytics-${range}`,
                data.funnel.map((f) => ({
                  stage: f.label,
                  value: f.value,
                  step_conversion_pct: f.stepRate,
                  total_conversion_pct: f.totalRate,
                }))
              );
              toast.success("Funnel exported", { description: `Last ${rangeLabel}` });
            }}
          >
            <Download /> Export
          </Button>
        }
      >
        <Tabs value={range} onValueChange={(v) => setRange(v as MetricRange)}>
          <TabsList>
            {METRIC_RANGES.map((r) => (
              <TabsTrigger key={r.key} value={r.key}>
                {r.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="Sessions"
          value={formatNumber(data.sessions, true)}
          sub={`last ${rangeLabel}`}
          delta={11.8}
        />
        <StatCard
          icon={Activity}
          label="Conversion"
          value={`${data.conversion}%`}
          sub={`${formatNumber(data.funnel[data.funnel.length - 1].value)} purchases`}
          delta={0.5}
        />
        <StatCard
          icon={MousePointerClick}
          label="Bounce rate"
          value={`${data.bounceRate}%`}
          sub={`${data.pagesPerSession} pages per session`}
          delta={-2.1}
          invertDelta
        />
        <StatCard
          icon={Timer}
          label="Avg session"
          value={avgSession}
          sub="time on site"
          delta={6.4}
        />
        <StatCard
          icon={Sparkles}
          label="New visitors"
          value={`${data.newVisitorShare}%`}
          sub="first-time traffic share"
          delta={3.2}
        />
      </div>

      {/* Funnel + traffic */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Conversion funnel</CardTitle>
              <p className="text-sm text-muted-foreground">
                Where visitors drop out, last {rangeLabel}
              </p>
            </div>
            <Filter className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {data.funnel.map((stage, i) => {
              const width = (stage.value / data.funnel[0].value) * 100;
              const lost = i > 0 ? data.funnel[i - 1].value - stage.value : 0;
              return (
                <div key={stage.key} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{stage.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">{formatNumber(stage.value)}</span>
                      {i > 0 && (
                        <span
                          className={cn(
                            "w-16 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums",
                            stage.stepRate >= 60
                              ? "bg-success/12 text-success"
                              : stage.stepRate >= 35
                                ? "bg-warning/15 text-warning"
                                : "bg-danger/12 text-danger"
                          )}
                        >
                          {stage.stepRate}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-8 overflow-hidden rounded-lg bg-secondary/60">
                    <div
                      className="flex h-full items-center rounded-lg px-3 transition-all"
                      style={{ width: `${width}%`, background: stage.color }}
                    >
                      <span className="text-xs font-semibold text-white drop-shadow">
                        {stage.totalRate}%
                      </span>
                    </div>
                  </div>
                  {i > 0 && lost > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {formatNumber(lost)} dropped off here
                    </p>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Devices</CardTitle>
            <p className="text-sm text-muted-foreground">Sessions and conversion</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative mx-auto h-[150px] w-[150px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={DEVICE_MIX}
                    dataKey="sessions"
                    nameKey="device"
                    innerRadius={48}
                    outerRadius={70}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {DEVICE_MIX.map((d) => (
                      <Cell key={d.device} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip format="number" />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-semibold tabular-nums">
                  {DEVICE_MIX[0].share}%
                </span>
                <span className="text-[10px] text-muted-foreground">mobile</span>
              </div>
            </div>
            <div className="space-y-2">
              {DEVICE_MIX.map((d) => (
                <div key={d.device} className="flex items-center gap-2 text-xs">
                  <span className="size-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="flex-1 text-muted-foreground">{d.device}</span>
                  <span className="font-medium tabular-nums">{d.share}%</span>
                  <span className="w-12 text-right tabular-nums text-muted-foreground">
                    {d.conversion}% cvr
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Traffic sources + geography */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Traffic sources</CardTitle>
            <p className="text-sm text-muted-foreground">
              Sessions, conversion, and revenue by source
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                    <th className="px-4 py-2.5 text-left font-medium">Source</th>
                    <th className="px-4 py-2.5 text-right font-medium">Sessions</th>
                    <th className="px-4 py-2.5 text-right font-medium">Cvr</th>
                    <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                    <th className="px-4 py-2.5 text-right font-medium">Δ</th>
                  </tr>
                </thead>
                <tbody>
                  {data.traffic.map((t) => (
                    <tr key={t.source} className="border-b border-border/60 last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full"
                            style={{ background: t.color }}
                          />
                          <span className="font-medium">{t.source}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-32 overflow-hidden rounded-full bg-secondary">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${t.share}%`, background: t.color }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {formatNumber(t.sessions, true)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{t.conversion}%</td>
                      <td className="px-4 py-3 text-right font-medium tabular-nums">
                        {formatCurrency(t.revenue, { compact: true })}
                      </td>
                      <td
                        className={cn(
                          "px-4 py-3 text-right tabular-nums",
                          t.delta >= 0 ? "text-success" : "text-danger"
                        )}
                      >
                        {t.delta > 0 ? "+" : ""}
                        {t.delta}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <div>
              <CardTitle>Where orders come from</CardTitle>
              <p className="text-sm text-muted-foreground">Revenue by region</p>
            </div>
            <Globe className="size-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-3">
            {data.geo.map((g) => {
              const max = data.geo[0].revenue || 1;
              return (
                <div key={g.code} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <span className="rounded border border-border px-1 text-[10px] font-semibold text-muted-foreground">
                        {g.code}
                      </span>
                      <span className="font-medium">{g.region}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums">
                        {formatCurrency(g.revenue, { compact: true })}
                      </span>
                      <span
                        className={cn(
                          "w-14 text-right text-xs tabular-nums",
                          g.delta >= 0 ? "text-success" : "text-danger"
                        )}
                      >
                        {g.delta > 0 ? "+" : ""}
                        {g.delta}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-chart-6"
                      style={{ width: `${(g.revenue / max) * 100}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNumber(g.orders)} orders · {g.share}% of revenue
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Cohorts + heatmap */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cohort retention</CardTitle>
            <p className="text-sm text-muted-foreground">
              % of each month&apos;s new customers who bought again
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground">
                    <th className="py-2 text-left font-medium">Cohort</th>
                    <th className="py-2 text-right font-medium">Size</th>
                    {["M0", "M1", "M2", "M3", "M4", "M5"].map((m) => (
                      <th key={m} className="px-1 py-2 text-center font-medium">
                        {m}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COHORTS.map((c) => (
                    <tr key={c.label}>
                      <td className="py-1 font-medium">{c.label}</td>
                      <td className="py-1 text-right tabular-nums text-muted-foreground">
                        {formatNumber(c.size)}
                      </td>
                      {Array.from({ length: 6 }).map((_, i) => {
                        const v = c.retention[i];
                        return (
                          <td key={i} className="p-0.5">
                            {v === undefined ? (
                              <div className="h-8 rounded bg-muted/30" />
                            ) : (
                              <div
                                className="flex h-8 items-center justify-center rounded text-[11px] font-medium tabular-nums"
                                style={{
                                  // Opacity encodes retention — full at 100%, faint at 0.
                                  background: `color-mix(in oklab, var(--chart-1) ${Math.max(8, v)}%, transparent)`,
                                  color: v > 55 ? "white" : "var(--foreground)",
                                }}
                              >
                                {v}%
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>When customers buy</CardTitle>
            <p className="text-sm text-muted-foreground">
              Orders by day and hour — schedule campaigns around the peaks
            </p>
          </CardHeader>
          <CardContent>
            <OrderHeatmap />
          </CardContent>
        </Card>
      </div>

      {/* Product quadrant */}
      <Card>
        <CardHeader>
          <CardTitle>Volume vs margin</CardTitle>
          <p className="text-sm text-muted-foreground">
            Top 40 products — the upper right is where you want to be
          </p>
        </CardHeader>
        <CardContent>
          <div className="h-[340px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 12, right: 16, left: 8, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  type="number"
                  dataKey="units"
                  name="Units sold"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "Units sold (30d)",
                    position: "insideBottom",
                    offset: -6,
                    fontSize: 11,
                    fill: "var(--muted-foreground)",
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="margin"
                  name="Margin"
                  unit="%"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                />
                <ZAxis type="number" dataKey="revenue" range={[40, 420]} name="Revenue" />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<QuadrantTooltip />}
                />
                <Scatter data={quadrant} fill="var(--chart-1)" fillOpacity={0.6} />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface QuadrantPayload {
  name: string;
  category: string;
  units: number;
  margin: number;
  revenue: number;
}

function QuadrantTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: QuadrantPayload }[];
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      <p className="text-sm font-medium">{p.name}</p>
      <p className="mb-1 text-xs text-muted-foreground">{p.category}</p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="text-muted-foreground">Units: </span>
          <span className="font-medium tabular-nums">{formatNumber(p.units)}</span>
        </p>
        <p>
          <span className="text-muted-foreground">Margin: </span>
          <span className="font-medium tabular-nums">{p.margin}%</span>
        </p>
        <p>
          <span className="text-muted-foreground">Revenue: </span>
          <span className="font-medium tabular-nums">{formatCurrency(p.revenue)}</span>
        </p>
      </div>
    </div>
  );
}

function OrderHeatmap() {
  const flat = ORDER_HEATMAP.flat();
  const max = Math.max(...flat);
  const peak = Math.max(...flat);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-[11px]">
          <thead>
            <tr className="text-muted-foreground">
              <th className="w-9" />
              {HEATMAP_HOURS.map((h) => (
                <th key={h} className="pb-1 text-center font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ORDER_HEATMAP.map((row, d) => (
              <tr key={HEATMAP_DAYS[d]}>
                <td className="pr-1 text-right font-medium text-muted-foreground">
                  {HEATMAP_DAYS[d]}
                </td>
                {row.map((v, h) => (
                  <td key={h}>
                    <div
                      title={`${HEATMAP_DAYS[d]} ${HEATMAP_HOURS[h]} · ${v} orders`}
                      className={cn(
                        "flex h-8 items-center justify-center rounded transition-transform hover:scale-105",
                        v === peak && "ring-1 ring-primary"
                      )}
                      style={{
                        background: `color-mix(in oklab, var(--chart-1) ${Math.round((v / max) * 88) + 6}%, transparent)`,
                        color: v / max > 0.6 ? "white" : "var(--muted-foreground)",
                      }}
                    >
                      {v}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
        <span>Fewer</span>
        {[10, 30, 55, 80, 100].map((p) => (
          <span
            key={p}
            className="size-3 rounded-sm"
            style={{ background: `color-mix(in oklab, var(--chart-1) ${p}%, transparent)` }}
          />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
