"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  ComposedChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Wallet,
  TrendingUp,
  Receipt,
  Landmark,
  Download,
  CheckCircle2,
  Percent,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, exportToCsv } from "@/lib/format";
import { METRIC_RANGES, type MetricRange } from "@/lib/mock/metrics";
import {
  getPnl,
  pnlSummary,
  payoutSummary,
  CHANNEL_ECONOMICS,
  CASHFLOW,
  EXPENSES,
  TAX_LINES,
  PAYOUT_STATUS_META,
  type Payout,
  type PnlLine,
} from "@/lib/mock/finance";
import { payoutStore, useEntityList } from "@/lib/mock/store";

type Tab = "statement" | "payouts" | "channels" | "tax";

export default function FinancePage() {
  const payouts = useEntityList(payoutStore);
  const [tab, setTab] = useState<Tab>("statement");
  const [range, setRange] = useState<MetricRange>("30d");

  const pnl = useMemo(() => getPnl(range), [range]);
  const summary = useMemo(() => pnlSummary(pnl), [pnl]);
  const settlements = useMemo(() => payoutSummary(payouts), [payouts]);
  const rangeLabel = METRIC_RANGES.find((r) => r.key === range)?.label ?? "30 days";

  function reconcile(rows: Payout[]) {
    const target = rows.filter((p) => p.status === "paid" && !p.reconciled);
    if (!target.length) {
      toast("Nothing to reconcile", {
        description: "Only settled payouts that are still unmatched can be reconciled.",
      });
      return;
    }
    target.forEach((p) => payoutStore.update(p.id, { reconciled: true }));
    toast.success(
      `${target.length} payout${target.length === 1 ? "" : "s"} reconciled`,
      {
        description: `${formatCurrency(target.reduce((s, p) => s + p.net, 0))} matched to the ledger.`,
      }
    );
  }

  const payoutColumns: ColumnDef<Payout, unknown>[] = [
    {
      accessorKey: "reference",
      header: "Settlement",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.reference}</p>
          <p className="text-xs text-muted-foreground">{row.original.period}</p>
        </div>
      ),
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ row }) => <MarketplaceBadge id={row.original.channel} />,
    },
    {
      accessorKey: "gross",
      header: "Gross",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatCurrency(row.original.gross)}</span>
      ),
    },
    {
      accessorKey: "fees",
      header: "Fees",
      cell: ({ row }) => (
        <span className="tabular-nums text-danger">
          −{formatCurrency(row.original.fees)}
        </span>
      ),
    },
    {
      accessorKey: "refunds",
      header: "Refunds",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          −{formatCurrency(row.original.refunds)}
        </span>
      ),
    },
    {
      accessorKey: "net",
      header: "Net payout",
      cell: ({ row }) => (
        <span className="font-semibold tabular-nums">
          {formatCurrency(row.original.net)}
        </span>
      ),
    },
    {
      accessorKey: "expectedAt",
      header: "Date",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {formatDate(row.original.paidAt ?? row.original.expectedAt)}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = PAYOUT_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
    {
      accessorKey: "reconciled",
      header: "Ledger",
      cell: ({ row }) =>
        row.original.reconciled ? (
          <Badge variant="success">
            <CheckCircle2 className="size-3" /> Matched
          </Badge>
        ) : row.original.status === "paid" ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              reconcile([row.original]);
            }}
          >
            Reconcile
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">Awaiting funds</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finance"
        description="Profit and loss, channel economics, settlements, and tax — reconciled in one place."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv(
                  `pnl-${range}`,
                  pnl.map((l) => ({ line: l.label, amount: l.amount, type: l.kind }))
                );
                toast.success("P&L exported", { description: `Last ${rangeLabel}` });
              }}
            >
              <Download /> Export P&amp;L
            </Button>
            <Button
              size="sm"
              onClick={() => reconcile(payouts)}
            >
              <CheckCircle2 /> Reconcile all
            </Button>
          </>
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
          icon={TrendingUp}
          label="Gross sales"
          value={formatCurrency(summary.gross, { compact: true })}
          sub={`last ${rangeLabel}`}
          delta={12.4}
        />
        <StatCard
          icon={Wallet}
          label="Net profit"
          value={formatCurrency(summary.netProfit, { compact: true })}
          sub={`${summary.netMargin}% net margin`}
          delta={15.2}
        />
        <StatCard
          icon={Percent}
          label="Gross margin"
          value={`${summary.grossMargin}%`}
          sub={`${formatCurrency(summary.cogs, { compact: true })} COGS`}
          delta={1.8}
        />
        <StatCard
          icon={Receipt}
          label="Fees & shipping"
          value={formatCurrency(summary.fees, { compact: true })}
          sub={`${summary.takeRate}% blended take rate`}
          delta={3.4}
          invertDelta
        />
        <StatCard
          icon={Landmark}
          label="Awaiting payout"
          value={formatCurrency(settlements.pending, { compact: true })}
          sub={`${settlements.unreconciled} settlements unmatched`}
          accent="text-info"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="statement">P&amp;L statement</TabsTrigger>
          <TabsTrigger value="payouts">
            Payouts
            {settlements.unreconciled > 0 && (
              <span className="ml-1.5 rounded-full bg-warning/20 px-1.5 text-[10px] font-medium text-warning tabular-nums">
                {settlements.unreconciled}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="channels">Channel economics</TabsTrigger>
          <TabsTrigger value="tax">Tax</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "statement" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle>Profit &amp; loss</CardTitle>
                <p className="text-sm text-muted-foreground">Last {rangeLabel}</p>
              </div>
              <FileText className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <PnlStatement lines={pnl} gross={summary.gross} />
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Where the money goes</CardTitle>
                <p className="text-sm text-muted-foreground">Cost breakdown, last 30 days</p>
              </CardHeader>
              <CardContent>
                <ExpenseDonut />
              </CardContent>
            </Card>
          </div>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Cash flow</CardTitle>
              <p className="text-sm text-muted-foreground">
                Money in vs money out, last 12 months
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={CASHFLOW} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={48}
                      tickFormatter={(v) => formatCurrency(v, { compact: true })}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={<ChartTooltip format="currency" />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inflow" name="Inflow" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Bar dataKey="outflow" name="Outflow" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={26} />
                    <Line
                      type="monotone"
                      dataKey="net"
                      name="Net"
                      stroke="var(--chart-1)"
                      strokeWidth={2.5}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "payouts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={CheckCircle2}
              label="Settled"
              value={formatCurrency(settlements.settled, { compact: true })}
              sub="deposited to bank"
              accent="text-success"
            />
            <StatCard
              icon={Landmark}
              label="In flight"
              value={formatCurrency(settlements.pending, { compact: true })}
              sub="processing or scheduled"
              accent="text-info"
            />
            <StatCard
              icon={Receipt}
              label="On hold"
              value={formatCurrency(settlements.onHold, { compact: true })}
              sub="needs channel action"
              accent="text-danger"
            />
            <StatCard
              icon={Percent}
              label="Fees withheld"
              value={formatCurrency(settlements.feesWithheld, { compact: true })}
              sub="across all settlements"
            />
          </div>

          <DataTable
            columns={payoutColumns}
            data={payouts}
            searchKey="reference"
            searchPlaceholder="Search settlement, channel…"
            exportName="payouts"
            pageSize={12}
            enableSelection
            bulkActions={(rows) => (
              <Button size="sm" variant="ghost" className="h-7" onClick={() => reconcile(rows)}>
                Reconcile
              </Button>
            )}
          />
        </div>
      )}

      {tab === "channels" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>What each channel actually costs</CardTitle>
              <p className="text-sm text-muted-foreground">
                Revenue vs total deductions, last 30 days
              </p>
            </CardHeader>
            <CardContent>
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={CHANNEL_ECONOMICS}
                    margin={{ top: 8, right: 8, left: 8, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
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
                      width={48}
                      tickFormatter={(v) => formatCurrency(v, { compact: true })}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={<ChartTooltip format="currency" />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="net" name="Kept" stackId="a" fill="var(--chart-2)" maxBarSize={44} />
                    <Bar dataKey="fees" name="Deductions" stackId="a" fill="var(--chart-4)" radius={[6, 6, 0, 0]} maxBarSize={44} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Fee composition</CardTitle>
              <p className="text-sm text-muted-foreground">
                Every deduction, by channel and type
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                      <th className="px-4 py-2.5 text-left font-medium">Channel</th>
                      <th className="px-4 py-2.5 text-right font-medium">Revenue</th>
                      <th className="px-4 py-2.5 text-right font-medium">Commission</th>
                      <th className="px-4 py-2.5 text-right font-medium">Shipping</th>
                      <th className="px-4 py-2.5 text-right font-medium">Payment</th>
                      <th className="px-4 py-2.5 text-right font-medium">Storage</th>
                      <th className="px-4 py-2.5 text-right font-medium">Take rate</th>
                      <th className="px-4 py-2.5 text-right font-medium">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CHANNEL_ECONOMICS.map((c) => (
                      <tr key={c.id} className="border-b border-border/60 last:border-0">
                        <td className="px-4 py-3">
                          <MarketplaceBadge id={c.id} />
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatCurrency(c.revenue, { compact: true })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(c.commission, { compact: true })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(c.shipping, { compact: true })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(c.payment, { compact: true })}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          {formatCurrency(c.storage, { compact: true })}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-xs font-medium tabular-nums",
                              c.takeRate > 20
                                ? "bg-danger/12 text-danger"
                                : c.takeRate > 12
                                  ? "bg-warning/15 text-warning"
                                  : "bg-success/12 text-success"
                            )}
                          >
                            {c.takeRate}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">
                          {formatCurrency(c.net, { compact: true })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "tax" && (
        <Card>
          <CardHeader>
            <CardTitle>Tax &amp; compliance</CardTitle>
            <p className="text-sm text-muted-foreground">
              Collected vs remitted by jurisdiction
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {TAX_LINES.map((t) => {
              const outstanding = t.collected - t.remitted;
              return (
                <div
                  key={t.label}
                  className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{t.label}</p>
                      <Badge variant="outline">{t.jurisdiction}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Due {formatDate(t.dueAt, "long")}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatCurrency(t.collected)}
                      </p>
                      <p className="text-xs text-muted-foreground">collected</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatCurrency(t.remitted)}
                      </p>
                      <p className="text-xs text-muted-foreground">remitted</p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cn(
                          "font-semibold tabular-nums",
                          outstanding > 0 ? "text-warning" : "text-success"
                        )}
                      >
                        {outstanding > 0 ? formatCurrency(outstanding) : "Settled"}
                      </p>
                      <p className="text-xs text-muted-foreground">outstanding</p>
                    </div>
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-muted-foreground">
              Figures are indicative and not a substitute for a filed return.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/** The statement itself — indentation and rules carry the hierarchy. */
function PnlStatement({ lines, gross }: { lines: PnlLine[]; gross: number }) {
  return (
    <div className="space-y-0.5">
      {lines.map((line) => {
        const pct = gross ? (Math.abs(line.amount) / gross) * 100 : 0;
        const isTotal = line.kind === "total";
        const isSubtotal = line.kind === "subtotal";
        const isCost = line.kind === "cost";

        return (
          <div
            key={line.key}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 transition-colors",
              isTotal && "mt-2 border-t-2 border-border bg-primary/5 py-3",
              isSubtotal && "border-t border-border bg-muted/40",
              !isTotal && !isSubtotal && "hover:bg-muted/40"
            )}
          >
            <div className={cn("min-w-0 flex-1", isCost && "pl-4")}>
              <p
                className={cn(
                  "truncate text-sm",
                  (isTotal || isSubtotal) && "font-semibold",
                  isCost && "text-muted-foreground"
                )}
              >
                {line.label}
              </p>
              {line.hint && (
                <p className="truncate text-xs text-muted-foreground">{line.hint}</p>
              )}
            </div>

            {/* Share-of-revenue bar makes the big costs findable at a glance. */}
            <div className="hidden w-24 sm:block">
              {!isTotal && !isSubtotal && (
                <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className={cn("h-full rounded-full", isCost ? "bg-danger/60" : "bg-success/60")}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
              )}
            </div>

            <span
              className={cn(
                "w-28 shrink-0 text-right tabular-nums",
                isTotal ? "text-lg font-bold" : isSubtotal ? "font-semibold" : "text-sm",
                isCost && "text-danger"
              )}
            >
              {line.amount < 0 ? "−" : ""}
              {formatCurrency(Math.abs(line.amount))}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ExpenseDonut() {
  const total = EXPENSES.reduce((s, e) => s + e.amount, 0);
  return (
    <div className="space-y-4">
      <div className="relative mx-auto h-[168px] w-[168px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={EXPENSES}
              dataKey="amount"
              nameKey="category"
              innerRadius={54}
              outerRadius={78}
              paddingAngle={2}
              strokeWidth={0}
            >
              {EXPENSES.map((e) => (
                <Cell key={e.category} fill={e.color} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip format="currency" />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold tabular-nums">
            {formatCurrency(total, { compact: true })}
          </span>
          <span className="text-[10px] text-muted-foreground">total cost</span>
        </div>
      </div>
      <div className="space-y-1.5">
        {EXPENSES.map((e) => (
          <div key={e.category} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: e.color }} />
            <span className="flex-1 truncate text-muted-foreground">{e.category}</span>
            <span className="font-medium tabular-nums">
              {formatCurrency(e.amount, { compact: true })}
            </span>
            <span
              className={cn(
                "w-11 text-right tabular-nums",
                e.delta > 0 ? "text-danger" : "text-success"
              )}
            >
              {e.delta > 0 ? "+" : ""}
              {e.delta}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
