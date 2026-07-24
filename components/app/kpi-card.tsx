"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Kpi } from "@/lib/mock/metrics";

function formatValue(kpi: Kpi) {
  if (kpi.format === "currency") return formatCurrency(kpi.value, { compact: kpi.value >= 100000 });
  if (kpi.format === "percent") return `${kpi.value}%`;
  return formatNumber(kpi.value);
}

export function KpiCard({
  kpi,
  href,
  accent = "var(--primary)",
}: {
  kpi: Kpi;
  href?: string;
  accent?: string;
}) {
  const positive = kpi.delta >= 0;
  // For return/refund rate, down is good — invert color meaning
  const goodDown = kpi.key === "returns" || kpi.key === "refund";
  const isGood = goodDown ? !positive : positive;

  const body = (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:shadow-md hover:border-primary/30">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">{kpi.label}</p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {formatValue(kpi)}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
            isGood ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
          )}
        >
          {positive ? (
            <ArrowUpRight className="size-3" />
          ) : (
            <ArrowDownRight className="size-3" />
          )}
          {Math.abs(kpi.delta)}%
        </span>
      </div>
      <div className="h-10">
        <Sparkline data={kpi.spark} color={accent} height={40} />
      </div>
      {kpi.sub && (
        <p className="text-xs text-muted-foreground -mt-1">{kpi.sub}</p>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
