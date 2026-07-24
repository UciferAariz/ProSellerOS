"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Download, ShoppingCart, Clock, Truck, RotateCcw, Flag } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, relativeTime } from "@/lib/format";
import { ORDERS, Order, ORDER_STATUS_META } from "@/lib/mock/orders";
import { MARKETPLACE_LIST } from "@/lib/mock/marketplaces";

export default function OrdersPage() {
  const router = useRouter();
  const [marketplace, setMarketplace] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(
    () =>
      ORDERS.filter(
        (o) =>
          (marketplace === "all" || o.marketplace === marketplace) &&
          (status === "all" || o.status === status)
      ),
    [marketplace, status]
  );

  const pending = ORDERS.filter((o) => ["pending", "confirmed"].includes(o.status)).length;
  const shipped = ORDERS.filter((o) => o.status === "shipped").length;
  const returns = ORDERS.filter((o) => o.status === "returned").length;
  const revenue = ORDERS.reduce((s, o) => s + o.total, 0);

  const columns: ColumnDef<Order, unknown>[] = [
    {
      accessorKey: "number",
      header: "Order",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.number}</p>
          <p className="text-xs text-muted-foreground">{relativeTime(row.original.placedAt)}</p>
        </div>
      ),
    },
    {
      accessorKey: "marketplace",
      header: "Channel",
      cell: ({ row }) => <MarketplaceBadge id={row.original.marketplace} />,
    },
    {
      accessorKey: "customer",
      header: "Customer",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span>{row.original.customer}</span>
          {row.original.flagged && (
            <Flag className="size-3.5 text-danger" aria-label="Flagged for review" />
          )}
        </div>
      ),
    },
    {
      accessorKey: "city",
      header: "Destination",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.city}</span>
      ),
    },
    {
      accessorKey: "itemCount",
      header: "Items",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.itemCount}</span>
      ),
    },
    {
      accessorKey: "payment",
      header: "Payment",
      cell: ({ row }) => (
        <Badge variant={row.original.payment === "prepaid" ? "info" : "secondary"} className="uppercase">
          {row.original.payment}
        </Badge>
      ),
    },
    {
      accessorKey: "total",
      header: "Total",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.total, { decimals: 2 })}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = ORDER_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Every order from every channel, in one unified inbox."
        actions={
          <Button variant="outline" size="sm">
            <Download /> Export
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total orders" value={formatNumber(ORDERS.length)} sub={formatCurrency(revenue, { compact: true }) + " revenue"} />
        <StatCard icon={Clock} label="Awaiting fulfillment" value={formatNumber(pending)} sub="need action" accent="text-warning" />
        <StatCard icon={Truck} label="In transit" value={formatNumber(shipped)} sub="shipped" accent="text-info" />
        <StatCard icon={RotateCcw} label="Returns" value={formatNumber(returns)} sub="this period" accent="text-danger" />
      </div>

      <Tabs
        value={status}
        onValueChange={setStatus}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
          <TabsTrigger value="shipped">Shipped</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="returned">Returned</TabsTrigger>
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="number"
        searchPlaceholder="Search order #, customer…"
        exportName="orders"
        pageSize={12}
        enableSelection
        onRowClick={(o) => router.push(`/orders/${o.id}`)}
        toolbar={
          <Select
            value={marketplace}
            onChange={(e) => setMarketplace(e.target.value)}
            className="w-auto"
          >
            <option value="all">All channels</option>
            {MARKETPLACE_LIST.filter((m) =>
              ORDERS.some((o) => o.marketplace === m.id)
            ).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        }
        bulkActions={(rows) => (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.success(`Printing ${rows.length} labels…`)}>
              Print labels
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.success(`Marked ${rows.length} as packed`)}>
              Mark packed
            </Button>
          </>
        )}
      />
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", accent)}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
