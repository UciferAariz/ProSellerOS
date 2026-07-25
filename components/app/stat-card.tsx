import Link from "next/link";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Compact metric tile used across the module pages. Lighter than `KpiCard`
 * (no sparkline, no `Kpi` shape) so pages can show a derived figure without
 * inventing a fake time series for it.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
  delta,
  href,
  /** Set when a falling number is the good outcome (returns, spend, CAC). */
  invertDelta = false,
}: {
  icon?: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  delta?: number;
  href?: string;
  invertDelta?: boolean;
}) {
  const positive = (delta ?? 0) >= 0;
  const isGood = invertDelta ? !positive : positive;

  const body = (
    <Card
      className={cn(
        "p-4",
        href && "transition-all hover:border-primary/30 hover:shadow-md"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {Icon && <Icon className="size-4" />}
          <span className="text-sm">{label}</span>
        </div>
        {delta !== undefined && (
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
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-semibold tracking-tight tabular-nums",
          accent
        )}
      >
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );

  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}
