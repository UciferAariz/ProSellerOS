"use client";

import { formatCurrency, formatNumber } from "@/lib/format";

interface TooltipEntry {
  name: string;
  value: number;
  color: string;
  dataKey: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  format = "currency",
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string;
  format?: "currency" | "number";
}) {
  if (!active || !payload?.length) return null;
  const fmt = (v: number) =>
    format === "currency" ? formatCurrency(v) : formatNumber(v);
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-xl">
      {label && (
        <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      )}
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="capitalize text-muted-foreground">
              {entry.name}
            </span>
            <span className="ml-auto font-semibold tabular-nums">
              {fmt(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
