"use client";

import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChartTooltip } from "./chart-tooltip";
import { SERIES, Granularity } from "@/lib/mock/metrics";
import { formatCurrency } from "@/lib/format";
import { exportToCsv } from "@/lib/format";
import { cn } from "@/lib/utils";

const RANGES: { key: Granularity; label: string }[] = [
  { key: "daily", label: "Daily" },
  { key: "weekly", label: "Weekly" },
  { key: "monthly", label: "Monthly" },
];

export function RevenueChart() {
  const [granularity, setGranularity] = useState<Granularity>("daily");
  const [compare, setCompare] = useState(false);
  const data = SERIES[granularity];

  const total = data.reduce((s, d) => s + d.revenue, 0);
  const prevTotal = data.reduce((s, d) => s + d.prev, 0);
  const growth = (((total - prevTotal) / prevTotal) * 100).toFixed(1);

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">Revenue</h3>
            <span className="rounded-full bg-success/12 px-1.5 py-0.5 text-xs font-medium text-success">
              +{growth}%
            </span>
          </div>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatCurrency(total, { compact: true })}
          </p>
          <p className="text-xs text-muted-foreground">
            vs {formatCurrency(prevTotal, { compact: true })} previous period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Switch checked={compare} onCheckedChange={setCompare} />
            Compare
          </label>
          <div className="inline-flex rounded-lg border border-border bg-secondary/60 p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setGranularity(r.key)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer",
                  granularity === r.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="icon-sm"
            title="Download CSV"
            onClick={() =>
              exportToCsv(`revenue-${granularity}`, data as unknown as Record<string, unknown>[])
            }
          >
            <Download />
          </Button>
        </div>
      </div>

      <div className="mt-5 h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.32} />
                <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              minTickGap={20}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(v) => formatCurrency(v, { compact: true })}
            />
            <Tooltip content={<ChartTooltip format="currency" />} />
            <Area
              type="monotone"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--chart-1)"
              strokeWidth={2.5}
              fill="url(#rev)"
              isAnimationActive={true}
              animationDuration={700}
            />
            {compare && (
              <Line
                type="monotone"
                dataKey="prev"
                name="Previous"
                stroke="var(--muted-foreground)"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                isAnimationActive={true}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
