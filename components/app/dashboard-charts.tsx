"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "./chart-tooltip";
import { MARKETPLACE_METRICS, CATEGORY_METRICS } from "@/lib/mock/metrics";
import { formatCurrency } from "@/lib/format";

export function MarketplaceComparisonChart() {
  const data = MARKETPLACE_METRICS.map((m) => ({
    name: m.name,
    revenue: m.revenue,
    color: m.color,
  }));
  return (
    <div className="h-[260px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <XAxis
            dataKey="name"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            interval={0}
            angle={-20}
            textAnchor="end"
            height={50}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v) => formatCurrency(v, { compact: true })}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            content={<ChartTooltip format="currency" />}
          />
          <Bar dataKey="revenue" name="Revenue" radius={[6, 6, 0, 0]} maxBarSize={44}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChannelDonut() {
  const data = MARKETPLACE_METRICS.map((m) => ({
    name: m.name,
    value: m.revenue,
    color: m.color,
  }));
  return (
    <div className="flex items-center gap-4">
      <div className="relative h-[150px] w-[150px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={48}
              outerRadius={70}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format="currency" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">7</span>
          <span className="text-[10px] text-muted-foreground">channels</span>
        </div>
      </div>
      <div className="flex-1 space-y-1.5">
        {data.slice(0, 6).map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full" style={{ background: d.color }} />
            <span className="flex-1 truncate text-muted-foreground">{d.name}</span>
            <span className="font-medium tabular-nums">
              {formatCurrency(d.value, { compact: true })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CategoryChart() {
  const data = [...CATEGORY_METRICS].reverse();
  const max = Math.max(...data.map((d) => d.revenue));
  return (
    <div className="space-y-3">
      {data
        .slice()
        .reverse()
        .map((c) => (
          <div key={c.category} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{c.category}</span>
              <span className="text-muted-foreground tabular-nums">
                {formatCurrency(c.revenue, { compact: true })}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-chart-6"
                style={{ width: `${(c.revenue / max) * 100}%` }}
              />
            </div>
          </div>
        ))}
    </div>
  );
}
