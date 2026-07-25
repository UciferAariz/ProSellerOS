"use client";

/**
 * Rich panels the copilot renders beneath an answer.
 *
 * Every call to action here goes back through the agent (`send`) rather than
 * firing a local toast: the copilot has tools for all of it, so "Apply all"
 * should really re-price the SKUs and "Restock" should really move stock. The
 * widget stays a view; the agent stays the one thing that changes state.
 */
import {
  ArrowDownRight,
  ArrowRight,
  Check,
  Copy,
  DollarSign,
  FileText,
  Package,
  ShoppingCart,
  Tag,
  TrendingDown,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { StatusPill } from "@/components/app/status-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCopilot } from "@/components/copilot/copilot-provider";
import { formatCurrency, formatNumber } from "@/lib/format";
import { ORDER_STATUS_META } from "@/lib/mock/orders";
import type { AssistantWidget } from "@/lib/mock/assistant";
import { cn } from "@/lib/utils";

export function WidgetRenderer({ widget }: { widget: AssistantWidget }) {
  const { send } = useCopilot();

  if (widget.kind === "falling-products") {
    return (
      <Panel icon={TrendingDown} title="Declining products" accent="text-danger">
        <div className="space-y-2">
          {widget.items.map((p) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(p.revenue, { compact: true })}
              </span>
              <span className="flex w-16 items-center justify-end gap-0.5 text-xs font-medium text-danger tabular-nums">
                <ArrowDownRight className="size-3" />
                {Math.abs(p.trend)}%
              </span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (widget.kind === "forecast") {
    const days = widget.daysToStockout;
    return (
      <Panel icon={Package} title={`Inventory forecast · ${widget.sku}`} accent="text-info">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={widget.series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<ChartTooltip format="number" />} />
              <Bar dataKey="actual" name="Actual" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line dataKey="forecast" name="Forecast" stroke="var(--warning)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-warning/10 px-3 py-2 text-xs">
          <span className="font-medium text-warning">
            ⚠ Safety stock breach{days ? ` in ~${days} days` : " ahead"}
          </span>
          <Button
            size="sm"
            className="h-6 shrink-0 text-xs"
            onClick={() => send(`Restock ${widget.sku} by 400 units`)}
          >
            Restock 400
          </Button>
        </div>
      </Panel>
    );
  }

  if (widget.kind === "profit") {
    return (
      <Panel icon={DollarSign} title="Profit breakdown" accent="text-success">
        <div className="mb-3 flex items-end gap-3">
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(widget.total, { compact: true })}
          </span>
          <span className="mb-1 text-xs text-muted-foreground">{widget.margin}% margin</span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={widget.breakdown} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={72} />
              <Tooltip content={<ChartTooltip format="currency" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {widget.breakdown.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    );
  }

  if (widget.kind === "pricing") {
    return (
      <Panel icon={Tag} title="Pricing opportunities" accent="text-primary">
        <div className="space-y-2">
          {widget.items.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-muted-foreground tabular-nums line-through">
                {formatCurrency(p.current, { decimals: 2 })}
              </span>
              <span className="font-medium tabular-nums">→ {formatCurrency(p.suggested, { decimals: 2 })}</span>
              <span className="w-16 text-right text-xs font-medium text-success tabular-nums">
                +{formatCurrency(p.uplift, { compact: true })}
              </span>
            </div>
          ))}
        </div>
        <Button
          size="sm"
          className="mt-3 w-full"
          onClick={() =>
            send(
              `Apply the suggested prices: ${widget.items
                .map((p) => `set ${p.name} to ${p.suggested}`)
                .join("; ")}`,
            )
          }
        >
          <Check /> Apply all
        </Button>
      </Panel>
    );
  }

  if (widget.kind === "listing") {
    return (
      <Panel icon={FileText} title="Generated listing" accent="text-chart-6">
        <p className="text-sm font-semibold">{widget.title}</p>
        <ul className="mt-2 space-y-1.5">
          {widget.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-success" />
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {widget.keywords.map((k) => (
            <Badge key={k} variant="secondary" className="capitalize">
              {k}
            </Badge>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => {
            void navigator.clipboard?.writeText(
              [widget.title, "", ...widget.bullets.map((b) => `• ${b}`)].join("\n"),
            );
          }}
        >
          <Copy /> Copy listing
        </Button>
      </Panel>
    );
  }

  if (widget.kind === "orders") {
    const shown = widget.rows.slice(0, 8);
    const hidden = widget.total - shown.length;
    return (
      <Panel icon={ShoppingCart} title={widget.title} accent="text-primary">
        <div className="space-y-1.5">
          {shown.map((o) => {
            const meta = ORDER_STATUS_META[o.status];
            return (
              <div key={o.id} className="flex items-center gap-2 text-sm">
                <span className="font-medium tabular-nums">{o.number}</span>
                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {o.customer} · {o.city}
                </span>
                <span className="text-xs uppercase text-muted-foreground">{o.payment}</span>
                <span className="w-20 text-right font-medium tabular-nums">
                  {formatCurrency(o.total, { decimals: 2 })}
                </span>
                <StatusPill label={meta.label} variant={meta.variant} />
              </div>
            );
          })}
        </div>
        {hidden > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            +{formatNumber(hidden)} more matching order{hidden === 1 ? "" : "s"}
          </p>
        )}
        <Button
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => send("Open the orders screen")}
        >
          Open in Orders <ArrowRight />
        </Button>
      </Panel>
    );
  }

  if (widget.kind === "order-stats") {
    return (
      <Panel icon={ShoppingCart} title="Order queue" accent="text-primary">
        <div className="mb-3 flex items-end gap-3">
          <span className="text-2xl font-semibold tabular-nums">{formatNumber(widget.total)}</span>
          <span className="mb-1 text-xs text-muted-foreground">
            orders · {formatCurrency(widget.revenue, { compact: true })} booked
          </span>
        </div>
        <Breakdown label="By status" rows={widget.byStatus} total={widget.total} />
        <Breakdown label="By payment" rows={widget.byPayment} total={widget.total} />
      </Panel>
    );
  }

  return null;
}

function Breakdown({
  label,
  rows,
  total,
}: {
  label: string;
  rows: { label: string; count: number }[];
  total: number;
}) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/70">
        {label}
      </p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 capitalize text-muted-foreground">{r.label}</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <span
              className="block h-full rounded-full bg-primary"
              style={{ width: `${total ? (r.count / total) * 100 : 0}%` }}
            />
          </span>
          <span className="w-8 text-right font-medium tabular-nums">{r.count}</span>
        </div>
      ))}
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", accent)} />
        <span className="truncate text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}
