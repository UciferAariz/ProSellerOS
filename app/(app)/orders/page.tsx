"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Download, ShoppingCart, Clock, Truck, RotateCcw, Flag, Plus } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, relativeTime, exportToCsv } from "@/lib/format";
import { Order, OrderStatus, ORDER_STATUS_META } from "@/lib/mock/orders";
import { MARKETPLACE_LIST, MarketplaceId } from "@/lib/mock/marketplaces";
import { orderStore, useEntityList } from "@/lib/mock/store";

const REF_NOW = "2026-07-23T14:30:00Z";

export default function OrdersPage() {
  const router = useRouter();
  const orders = useEntityList(orderStore);

  const [marketplace, setMarketplace] = useState("all");
  const [status, setStatus] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [draft, setDraft] = useState({
    customer: "",
    marketplace: "amazon" as MarketplaceId,
    city: "Mumbai",
    total: "",
    payment: "prepaid" as "prepaid" | "cod",
  });

  const filtered = useMemo(
    () =>
      orders.filter(
        (o) =>
          (marketplace === "all" || o.marketplace === marketplace) &&
          (status === "all" || o.status === status)
      ),
    [orders, marketplace, status]
  );

  const pending = orders.filter((o) => ["pending", "confirmed"].includes(o.status)).length;
  const shipped = orders.filter((o) => o.status === "shipped").length;
  const returns = orders.filter((o) => o.status === "returned").length;
  const revenue = orders.reduce((s, o) => s + o.total, 0);

  const draftValid = draft.customer.trim().length > 1 && Number(draft.total) > 0;

  function createOrder() {
    if (!draftValid) return;
    const total = +Number(draft.total).toFixed(2);
    const maxNum = orders.reduce((m, o) => {
      const n = parseInt(o.number.replace(/\D/g, ""), 10);
      return Number.isNaN(n) ? m : Math.max(m, n);
    }, 48210);
    const order: Order = {
      id: `order_${Date.now()}`,
      number: `#PS-${maxNum + 1}`,
      marketplace: draft.marketplace,
      customer: draft.customer.trim(),
      email: `${draft.customer.trim().split(" ")[0].toLowerCase()}@example.com`,
      city: draft.city,
      status: "pending",
      payment: draft.payment,
      courier: "—",
      tracking: "—",
      items: [
        {
          productId: "manual",
          name: "Manual order line",
          sku: "MANUAL",
          qty: 1,
          price: total,
          image: "linear-gradient(135deg,#6366f1,#a855f7)",
        },
      ],
      itemCount: 1,
      total,
      placedAt: REF_NOW,
      sla: REF_NOW,
      flagged: false,
      timeline: [{ label: "Order placed", at: REF_NOW, done: true }],
    };
    orderStore.add(order);
    setCreateOpen(false);
    setDraft({ customer: "", marketplace: "amazon", city: "Mumbai", total: "", payment: "prepaid" });
    toast.success(`Order ${order.number} created`);
  }

  function advance(rows: Order[], next: OrderStatus) {
    rows.forEach((r) =>
      orderStore.update(r.id, (prev) => ({
        ...prev,
        status: next,
        courier: prev.courier === "—" && next === "shipped" ? "Shiprocket" : prev.courier,
        timeline: [
          ...prev.timeline,
          { label: ORDER_STATUS_META[next].label, at: REF_NOW, done: true },
        ],
      }))
    );
    toast.success(
      `${rows.length} order${rows.length > 1 ? "s" : ""} marked ${ORDER_STATUS_META[next].label.toLowerCase()}`
    );
  }

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
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv("orders", filtered as unknown as Record<string, unknown>[]);
                toast.success(`Exported ${filtered.length} orders`);
              }}
            >
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> Create order
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={ShoppingCart} label="Total orders" value={formatNumber(orders.length)} sub={formatCurrency(revenue, { compact: true }) + " revenue"} />
        <StatCard icon={Clock} label="Awaiting fulfillment" value={formatNumber(pending)} sub="need action" accent="text-warning" />
        <StatCard icon={Truck} label="In transit" value={formatNumber(shipped)} sub="shipped" accent="text-info" />
        <StatCard icon={RotateCcw} label="Returns" value={formatNumber(returns)} sub="this period" accent="text-danger" />
      </div>

      <Tabs value={status} onValueChange={setStatus}>
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
              orders.some((o) => o.marketplace === m.id)
            ).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        }
        bulkActions={(rows) => (
          <>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => advance(rows, "packed")}>
              Mark packed
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => advance(rows, "shipped")}>
              Mark shipped
            </Button>
            <Button size="sm" variant="ghost" className="h-7" onClick={() => toast.success(`Printing ${rows.length} labels…`)}>
              Print labels
            </Button>
          </>
        )}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create order</DialogTitle>
            <DialogDescription>
              Log a manual order. It lands in your queue as pending fulfillment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="o-cust" className="text-sm font-medium">Customer name</label>
              <Input
                id="o-cust"
                value={draft.customer}
                onChange={(e) => setDraft({ ...draft, customer: e.target.value })}
                placeholder="e.g. Priya Patel"
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="o-chan" className="text-sm font-medium">Channel</label>
                <Select
                  id="o-chan"
                  value={draft.marketplace}
                  onChange={(e) => setDraft({ ...draft, marketplace: e.target.value as MarketplaceId })}
                >
                  {MARKETPLACE_LIST.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="o-city" className="text-sm font-medium">Destination city</label>
                <Input
                  id="o-city"
                  value={draft.city}
                  onChange={(e) => setDraft({ ...draft, city: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="o-total" className="text-sm font-medium">Order total (USD)</label>
                <Input
                  id="o-total"
                  type="number"
                  min={0}
                  step="0.01"
                  value={draft.total}
                  onChange={(e) => setDraft({ ...draft, total: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="o-pay" className="text-sm font-medium">Payment</label>
                <Select
                  id="o-pay"
                  value={draft.payment}
                  onChange={(e) => setDraft({ ...draft, payment: e.target.value as "prepaid" | "cod" })}
                >
                  <option value="prepaid">Prepaid</option>
                  <option value="cod">Cash on delivery</option>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button disabled={!draftValid} onClick={createOrder}>Create order</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
