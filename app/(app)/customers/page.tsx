"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ColumnDef } from "@tanstack/react-table";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Users,
  Repeat,
  Crown,
  HeartCrack,
  Download,
  Mail,
  MapPin,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceBadge, MarketplaceLogo } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatDate, relativeTime, exportToCsv, initials } from "@/lib/format";
import {
  buildCustomers,
  customerSummary,
  segmentBreakdown,
  topCities,
  SEGMENT_META,
  SEGMENT_LIST,
  CUSTOMER_GROWTH,
  type Customer,
  type CustomerSegment,
} from "@/lib/mock/customers";
import { ORDER_STATUS_META, type Order } from "@/lib/mock/orders";
import { orderStore, useEntityList } from "@/lib/mock/store";

export default function CustomersPage() {
  const orders = useEntityList(orderStore);
  const [segment, setSegment] = useState<CustomerSegment | "all">("all");
  const [channel, setChannel] = useState("all");
  const [selected, setSelected] = useState<Customer | null>(null);

  const customers = useMemo(() => buildCustomers(orders), [orders]);
  const summary = useMemo(() => customerSummary(customers), [customers]);
  const segments = useMemo(() => segmentBreakdown(customers), [customers]);
  const cities = useMemo(() => topCities(customers), [customers]);

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          (segment === "all" || c.segment === segment) &&
          (channel === "all" || c.channels.includes(channel as Customer["primaryChannel"]))
      ),
    [customers, segment, channel]
  );

  /** Orders in the live queue belonging to this customer. */
  const selectedOrders = useMemo(
    () =>
      selected
        ? orders
            .filter((o) => o.customer === selected.name)
            .sort((a, b) => +new Date(b.placedAt) - +new Date(a.placedAt))
        : [],
    [orders, selected]
  );

  const columns: ColumnDef<Customer, unknown>[] = [
    {
      accessorKey: "name",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ background: row.original.avatar }}
          >
            {initials(row.original.name)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "segment",
      header: "Segment",
      cell: ({ row }) => {
        const meta = SEGMENT_META[row.original.segment];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
    {
      accessorKey: "city",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.city}</span>
      ),
    },
    {
      accessorKey: "orders",
      header: "Orders",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.orders)}</span>
      ),
    },
    {
      accessorKey: "spend",
      header: "Lifetime value",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.spend, { compact: row.original.spend >= 10000 })}
        </span>
      ),
    },
    {
      accessorKey: "aov",
      header: "AOV",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatCurrency(row.original.aov, { decimals: 2 })}
        </span>
      ),
    },
    {
      accessorKey: "primaryChannel",
      header: "Channel",
      cell: ({ row }) => <MarketplaceBadge id={row.original.primaryChannel} />,
    },
    {
      accessorKey: "daysSinceLastOrder",
      header: "Last order",
      cell: ({ row }) => (
        <span
          className={cn(
            "text-sm",
            row.original.daysSinceLastOrder > 90 ? "text-warning" : "text-muted-foreground"
          )}
        >
          {row.original.daysSinceLastOrder}d ago
        </span>
      ),
    },
  ];

  function emailSegment(rows: Customer[]) {
    const reachable = rows.filter((c) => c.optIn);
    toast.success(`Campaign queued for ${formatNumber(reachable.length)} customers`, {
      description:
        rows.length - reachable.length > 0
          ? `${rows.length - reachable.length} skipped — no marketing consent.`
          : "All selected customers have marketing consent.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="One buyer record across every channel — lifetime value, segments, and history."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv(
                  "customers",
                  filtered.map((c) => ({
                    name: c.name,
                    email: c.email,
                    city: c.city,
                    segment: c.segment,
                    orders: c.orders,
                    lifetime_value: c.spend,
                    aov: c.aov,
                    primary_channel: c.primaryChannel,
                    last_order_days: c.daysSinceLastOrder,
                    marketing_opt_in: c.optIn,
                  }))
                );
                toast.success(`Exported ${filtered.length} customers`);
              }}
            >
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => emailSegment(filtered)}>
              <Mail /> Email segment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={Users}
          label="Customers"
          value={formatNumber(summary.total)}
          sub={`${summary.newThisMonth} new this month`}
          delta={9.1}
        />
        <StatCard
          icon={Repeat}
          label="Repeat rate"
          value={`${summary.repeatRate}%`}
          sub={`${summary.avgOrders} orders on average`}
          delta={2.4}
        />
        <StatCard
          icon={Crown}
          label="Avg lifetime value"
          value={formatCurrency(summary.avgLtv)}
          sub={`${formatCurrency(summary.revenue, { compact: true })} lifetime revenue`}
          delta={5.8}
        />
        <StatCard
          icon={HeartCrack}
          label="At risk"
          value={formatNumber(summary.atRisk)}
          sub="quiet for 90+ days"
          accent="text-warning"
          delta={-3.2}
          invertDelta
        />
        <StatCard
          icon={Mail}
          label="Marketing consent"
          value={`${summary.optInRate}%`}
          sub="reachable by email"
        />
      </div>

      {/* Segment strip — doubles as the primary filter. */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <button
          onClick={() => setSegment("all")}
          className={cn(
            "rounded-xl border bg-card p-3 text-left transition-colors",
            segment === "all" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
          )}
        >
          <p className="text-xs text-muted-foreground">All customers</p>
          <p className="mt-1 text-xl font-semibold tabular-nums">
            {formatNumber(customers.length)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {formatCurrency(summary.revenue, { compact: true })}
          </p>
        </button>
        {segments.map((s) => (
          <button
            key={s.key}
            onClick={() => setSegment(s.key === segment ? "all" : s.key)}
            title={s.description}
            className={cn(
              "rounded-xl border bg-card p-3 text-left transition-colors",
              segment === s.key ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
            )}
          >
            <div className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: s.color }} />
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(s.count)}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatCurrency(s.revenue, { compact: true })} · {s.share}%
            </p>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Customer growth</CardTitle>
            <p className="text-sm text-muted-foreground">
              New vs returning buyers, last 12 months
            </p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={CUSTOMER_GROWTH} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cust-new" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="cust-ret" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.34} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
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
                    width={44}
                  />
                  <Tooltip content={<ChartTooltip format="number" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="returning"
                    name="Returning"
                    stroke="var(--chart-2)"
                    strokeWidth={2}
                    fill="url(#cust-ret)"
                  />
                  <Area
                    type="monotone"
                    dataKey="new"
                    name="New"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    fill="url(#cust-new)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top locations</CardTitle>
            <p className="text-sm text-muted-foreground">By lifetime revenue</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {cities.map((c) => {
              const max = cities[0].revenue || 1;
              return (
                <div key={c.city} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MapPin className="size-3 text-muted-foreground" />
                      {c.city}
                    </span>
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
                  <p className="text-[11px] text-muted-foreground">
                    {formatNumber(c.customers)} customers
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="name"
        searchPlaceholder="Search name, email…"
        exportName="customers"
        pageSize={12}
        enableSelection
        onRowClick={(c) => setSelected(c)}
        toolbar={
          <>
            <Select
              value={segment}
              onChange={(e) => setSegment(e.target.value as CustomerSegment | "all")}
              className="w-auto"
            >
              <option value="all">All segments</option>
              {SEGMENT_LIST.map((s) => (
                <option key={s} value={s}>
                  {SEGMENT_META[s].label}
                </option>
              ))}
            </Select>
            <Select
              value={channel}
              onChange={(e) => setChannel(e.target.value)}
              className="w-auto"
            >
              <option value="all">All channels</option>
              {["amazon", "flipkart", "shopify", "meesho", "myntra", "woocommerce", "ebay"].map((m) => (
                <option key={m} value={m}>
                  {m.charAt(0).toUpperCase() + m.slice(1)}
                </option>
              ))}
            </Select>
          </>
        }
        bulkActions={(rows) => (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => emailSegment(rows)}>
              Email
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() =>
                toast.success(`${rows.length} customers added to a Meta audience`)
              }
            >
              Add to audience
            </Button>
          </>
        )}
      />

      <CustomerSheet
        customer={selected}
        orders={selectedOrders}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function CustomerSheet({
  customer,
  orders,
  onClose,
}: {
  customer: Customer | null;
  orders: Order[];
  onClose: () => void;
}) {
  if (!customer) return null;
  const meta = SEGMENT_META[customer.segment];
  const liveSpend = orders.reduce((s, o) => s + o.total, 0);

  return (
    <Sheet open onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="space-y-0 p-5 pb-0">
          <div className="flex items-center gap-3">
            <span
              className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ background: customer.avatar }}
            >
              {initials(customer.name)}
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate">{customer.name}</SheetTitle>
              <SheetDescription className="truncate">{customer.email}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill label={meta.label} variant={meta.variant} />
            {customer.optIn ? (
              <Badge variant="success">Marketing opt-in</Badge>
            ) : (
              <Badge variant="secondary">No consent</Badge>
            )}
            {customer.tags.map((t) => (
              <Badge key={t} variant="outline">{t}</Badge>
            ))}
          </div>

          <p className="text-sm text-muted-foreground">{meta.description}</p>

          <div className="grid grid-cols-2 gap-3">
            <Metric label="Lifetime value" value={formatCurrency(customer.spend)} />
            <Metric label="Orders" value={formatNumber(customer.orders)} />
            <Metric label="Average order" value={formatCurrency(customer.aov, { decimals: 2 })} />
            <Metric label="Returns" value={formatNumber(customer.returns)} />
            <Metric label="Customer since" value={formatDate(customer.firstOrderAt, "long")} />
            <Metric label="Last order" value={`${customer.daysSinceLastOrder} days ago`} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Channels used</p>
            <div className="flex flex-wrap items-center gap-2">
              {customer.channels.map((ch) => (
                <div
                  key={ch}
                  className="flex items-center gap-2 rounded-lg border border-border px-2 py-1.5"
                >
                  <MarketplaceLogo id={ch} size={20} />
                  <span className="text-xs capitalize">{ch}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Recent orders</p>
              {orders.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {formatCurrency(liveSpend)} in the live queue
                </span>
              )}
            </div>
            {orders.length ? (
              <div className="space-y-1.5">
                {orders.slice(0, 8).map((o) => {
                  const status = ORDER_STATUS_META[o.status];
                  return (
                    <Link
                      key={o.id}
                      href={`/orders/${o.id}`}
                      className="flex items-center gap-3 rounded-lg border border-border p-2.5 transition-colors hover:border-primary/30 hover:bg-secondary/40"
                    >
                      <MarketplaceLogo id={o.marketplace} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{o.number}</p>
                        <p className="text-xs text-muted-foreground">
                          {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · {relativeTime(o.placedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">
                          {formatCurrency(o.total, { decimals: 2 })}
                        </p>
                        <StatusPill label={status.label} variant={status.variant} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                No orders in the current queue — this buyer&apos;s history predates it.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={() =>
                toast.success(`Email drafted to ${customer.name.split(" ")[0]}`)
              }
            >
              <Mail /> Email customer
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href={`/orders?customer=${encodeURIComponent(customer.name)}`}>
                <ShoppingBag /> All orders
              </Link>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
    </div>
  );
}
