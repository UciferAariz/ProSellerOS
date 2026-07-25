"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Boxes,
  Warehouse as WarehouseIcon,
  AlertTriangle,
  TruckIcon,
  Download,
  Plus,
  SlidersHorizontal,
  PackageCheck,
  ArrowDownToLine,
  ArrowUpFromLine,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { DataTable } from "@/components/app/data-table";
import { StatusPill } from "@/components/app/status-pill";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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
import { formatCurrency, formatNumber, relativeTime, formatDate, exportToCsv } from "@/lib/format";
import {
  buildInventory,
  inventorySummary,
  warehouseLoad,
  WAREHOUSES,
  SUPPLIERS,
  STOCK_STATUS_META,
  PO_STATUS_META,
  MOVEMENT_META,
  MOVEMENT_SERIES,
  type InventoryItem,
  type StockStatus,
  type PurchaseOrder,
  type StockMovement,
} from "@/lib/mock/inventory";
import { CATEGORIES, type Product } from "@/lib/mock/products";
import {
  productStore,
  purchaseOrderStore,
  movementStore,
  useEntityList,
} from "@/lib/mock/store";

const REF_NOW = "2026-07-23T14:30:00Z";

type Tab = "stock" | "orders" | "movements" | "warehouses";

export default function InventoryPage() {
  const products = useEntityList(productStore);
  const purchaseOrders = useEntityList(purchaseOrderStore);
  const movements = useEntityList(movementStore);

  const [tab, setTab] = useState<Tab>("stock");
  const [status, setStatus] = useState<StockStatus | "all">("all");
  const [warehouse, setWarehouse] = useState("all");
  const [category, setCategory] = useState("all");

  const [adjusting, setAdjusting] = useState<InventoryItem | null>(null);
  const [poOpen, setPoOpen] = useState(false);
  const [poSeed, setPoSeed] = useState<InventoryItem[]>([]);

  const items = useMemo(() => buildInventory(products), [products]);
  const summary = useMemo(() => inventorySummary(items), [items]);
  const loads = useMemo(() => warehouseLoad(items), [items]);

  const filtered = useMemo(
    () =>
      items.filter(
        (i) =>
          (status === "all" || i.status === status) &&
          (category === "all" || i.category === category) &&
          (warehouse === "all" ||
            i.locations.some((l) => l.warehouseId === warehouse && l.units > 0))
      ),
    [items, status, category, warehouse]
  );

  /** Receiving a PO is what actually moves stock — write it to the catalog. */
  function receivePo(po: PurchaseOrder) {
    if (po.status === "received" || po.status === "cancelled") return;

    const bySku = new Map(po.lines.map((l) => [l.sku, l.qty]));
    products.forEach((p) => {
      const qty = bySku.get(p.sku);
      if (qty) productStore.update(p.id, (prev) => ({ ...prev, stock: prev.stock + qty }));
    });

    purchaseOrderStore.update(po.id, (prev) => ({
      ...prev,
      status: "received",
      receivedAt: REF_NOW,
    }));

    po.lines.forEach((line, i) =>
      movementStore.add({
        id: `mv_recv_${po.id}_${i}_${Date.now()}`,
        at: REF_NOW,
        sku: line.sku,
        name: line.name,
        type: "inbound",
        qty: line.qty,
        warehouseId: po.warehouseId,
        warehouse: WAREHOUSES.find((w) => w.id === po.warehouseId)?.name ?? "—",
        reference: po.number,
        actor: "You",
      })
    );

    toast.success(`${po.number} received`, {
      description: `${formatNumber(po.units)} units added across ${po.lines.length} SKU${po.lines.length === 1 ? "" : "s"}.`,
    });
  }

  function openPoFor(rows: InventoryItem[]) {
    setPoSeed(rows);
    setPoOpen(true);
  }

  const stockColumns: ColumnDef<InventoryItem, unknown>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span className="size-9 shrink-0 rounded-lg" style={{ background: row.original.image }} />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.sku}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.category}</span>
      ),
    },
    {
      accessorKey: "onHand",
      header: "On hand",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatNumber(row.original.onHand)}</span>
      ),
    },
    {
      accessorKey: "reserved",
      header: "Reserved",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatNumber(row.original.reserved)}
        </span>
      ),
    },
    {
      accessorKey: "available",
      header: "Available",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">{formatNumber(row.original.available)}</span>
      ),
    },
    {
      accessorKey: "incoming",
      header: "Incoming",
      cell: ({ row }) =>
        row.original.incoming > 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-info">
            <ArrowDownToLine className="size-3" />
            {formatNumber(row.original.incoming)}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      accessorKey: "daysOfCover",
      header: "Cover",
      cell: ({ row }) => <CoverBar item={row.original} />,
    },
    {
      accessorKey: "value",
      header: "Stock value",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {formatCurrency(row.original.value, { compact: row.original.value >= 10000 })}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = STOCK_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
  ];

  const poColumns: ColumnDef<PurchaseOrder, unknown>[] = [
    {
      accessorKey: "number",
      header: "PO",
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.number}</p>
          <p className="text-xs text-muted-foreground">
            {relativeTime(row.original.createdAt)}
          </p>
        </div>
      ),
    },
    { accessorKey: "supplier", header: "Supplier" },
    {
      accessorKey: "warehouseId",
      header: "Destination",
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {WAREHOUSES.find((w) => w.id === row.original.warehouseId)?.code ?? "—"}
        </span>
      ),
    },
    {
      accessorKey: "lines",
      header: "Lines",
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.lines.length}</span>
      ),
    },
    {
      accessorKey: "units",
      header: "Units",
      cell: ({ row }) => (
        <span className="tabular-nums">{formatNumber(row.original.units)}</span>
      ),
    },
    {
      accessorKey: "total",
      header: "Value",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.total, { compact: true })}
        </span>
      ),
    },
    {
      accessorKey: "etaAt",
      header: "ETA",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.etaAt)}</span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = PO_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
    {
      id: "receive",
      header: "",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "received" || row.original.status === "cancelled" ? null : (
          <Button
            size="sm"
            variant="outline"
            className="h-7"
            onClick={(e) => {
              e.stopPropagation();
              receivePo(row.original);
            }}
          >
            <PackageCheck /> Receive
          </Button>
        ),
    },
  ];

  const movementColumns: ColumnDef<StockMovement, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{relativeTime(row.original.at)}</span>
      ),
    },
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.sku}</p>
        </div>
      ),
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => {
        const meta = MOVEMENT_META[row.original.type];
        return <Badge variant={meta.variant}>{meta.label}</Badge>;
      },
    },
    {
      accessorKey: "qty",
      header: "Qty",
      cell: ({ row }) => (
        <span
          className={cn(
            "inline-flex items-center gap-1 font-medium tabular-nums",
            row.original.qty >= 0 ? "text-success" : "text-danger"
          )}
        >
          {row.original.qty >= 0 ? (
            <ArrowDownToLine className="size-3" />
          ) : (
            <ArrowUpFromLine className="size-3" />
          )}
          {row.original.qty > 0 ? "+" : ""}
          {formatNumber(row.original.qty)}
        </span>
      ),
    },
    {
      accessorKey: "warehouse",
      header: "Location",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.warehouse}</span>
      ),
    },
    { accessorKey: "reference", header: "Reference" },
    {
      accessorKey: "actor",
      header: "By",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.actor}</span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Stock positions, purchase orders, and movement history across every location."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv(
                  "inventory",
                  filtered.map((i) => ({
                    sku: i.sku,
                    name: i.name,
                    category: i.category,
                    on_hand: i.onHand,
                    reserved: i.reserved,
                    available: i.available,
                    incoming: i.incoming,
                    reorder_point: i.reorderPoint,
                    days_of_cover: i.daysOfCover,
                    stock_value: i.value,
                    status: i.status,
                  }))
                );
                toast.success(`Exported ${filtered.length} SKUs`);
              }}
            >
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => openPoFor([])}>
              <Plus /> Create PO
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={Boxes}
          label="Stock value"
          value={formatCurrency(summary.value, { compact: true })}
          sub={`${formatNumber(summary.units)} units on hand`}
          delta={6.2}
        />
        <StatCard
          icon={PackageCheck}
          label="SKUs tracked"
          value={formatNumber(summary.skus)}
          sub={`${formatNumber(summary.reserved)} units reserved`}
        />
        <StatCard
          icon={AlertTriangle}
          label="Needs reorder"
          value={formatNumber(summary.lowCount)}
          sub={`${summary.outCount} out of stock`}
          accent="text-warning"
        />
        <StatCard
          icon={TruckIcon}
          label="Incoming"
          value={formatNumber(summary.incoming)}
          sub="units on open POs"
          accent="text-info"
        />
        <StatCard
          icon={WarehouseIcon}
          label="Dead stock"
          value={formatCurrency(summary.deadStockValue, { compact: true })}
          sub={`${summary.overstockCount} SKUs over 120d cover`}
          delta={-4.1}
          invertDelta
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="stock">Stock on hand</TabsTrigger>
          <TabsTrigger value="orders">
            Purchase orders
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">
              {purchaseOrders.filter((p) => p.status !== "received" && p.status !== "cancelled").length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="movements">Movements</TabsTrigger>
          <TabsTrigger value="warehouses">Warehouses</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "stock" && (
        <DataTable
          columns={stockColumns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search SKU, product…"
          exportName="inventory"
          pageSize={12}
          enableSelection
          onRowClick={(item) => setAdjusting(item)}
          toolbar={
            <>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as StockStatus | "all")}
                className="w-auto"
              >
                <option value="all">All statuses</option>
                {Object.entries(STOCK_STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
              <Select
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value)}
                className="w-auto"
              >
                <option value="all">All locations</option>
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code}
                  </option>
                ))}
              </Select>
              <Select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-auto"
              >
                <option value="all">All categories</option>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
            </>
          }
          bulkActions={(rows) => (
            <>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => openPoFor(rows)}>
                Create PO
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  rows.forEach((r) =>
                    productStore.update(r.id, (prev) => ({
                      ...prev,
                      stock: prev.stock + Math.max(50, prev.reorderPoint * 3),
                    }))
                  );
                  toast.success(`Restocked ${rows.length} SKU${rows.length === 1 ? "" : "s"}`);
                }}
              >
                Quick restock
              </Button>
            </>
          )}
        />
      )}

      {tab === "orders" && (
        <DataTable
          columns={poColumns}
          data={purchaseOrders}
          searchKey="number"
          searchPlaceholder="Search PO, supplier…"
          exportName="purchase-orders"
          pageSize={10}
        />
      )}

      {tab === "movements" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inbound vs outbound units</CardTitle>
              <p className="text-sm text-muted-foreground">Last 14 days</p>
            </CardHeader>
            <CardContent>
              <div className="h-[240px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={MOVEMENT_SERIES} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={16}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={44}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={<ChartTooltip format="number" />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="inbound" name="Inbound" fill="var(--chart-2)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                    <Bar dataKey="outbound" name="Outbound" fill="var(--chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={movementColumns}
            data={movements}
            searchKey="sku"
            searchPlaceholder="Search SKU, reference…"
            exportName="stock-movements"
            pageSize={12}
          />
        </div>
      )}

      {tab === "warehouses" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loads.map((w) => (
            <Card key={w.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{w.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {w.code} · {w.city}
                  </p>
                </div>
                <Badge variant={w.kind === "owned" ? "default" : w.kind === "3pl" ? "info" : "secondary"}>
                  {w.kind === "3pl" ? "3PL" : w.kind === "owned" ? "Owned" : "Marketplace"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold tabular-nums">{formatNumber(w.units)}</p>
                    <p className="text-xs text-muted-foreground">units</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums">{formatNumber(w.skus)}</p>
                    <p className="text-xs text-muted-foreground">SKUs</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold tabular-nums">
                      {formatCurrency(w.value, { compact: true })}
                    </p>
                    <p className="text-xs text-muted-foreground">value</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Capacity used</span>
                    <span className="font-medium tabular-nums">{w.utilization}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        w.utilization > 85
                          ? "bg-danger"
                          : w.utilization > 65
                            ? "bg-warning"
                            : "bg-success"
                      )}
                      style={{ width: `${w.utilization}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(w.capacity - w.units)} units of headroom
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdjustStockDialog
        item={adjusting}
        onClose={() => setAdjusting(null)}
        onApply={(item, next, reason) => {
          const delta = next - item.onHand;
          productStore.update(item.id, (prev: Product) => ({ ...prev, stock: next }));
          movementStore.add({
            id: `mv_adj_${item.id}_${Date.now()}`,
            at: REF_NOW,
            sku: item.sku,
            name: item.name,
            type: "adjustment",
            qty: delta,
            warehouseId: item.locations[0]?.warehouseId ?? WAREHOUSES[0].id,
            warehouse: item.locations[0]?.name ?? WAREHOUSES[0].name,
            reference: reason,
            actor: "You",
          });
          setAdjusting(null);
          toast.success(`${item.sku} adjusted`, {
            description: `${formatNumber(item.onHand)} → ${formatNumber(next)} units (${delta > 0 ? "+" : ""}${formatNumber(delta)}).`,
          });
        }}
      />

      <CreatePoDialog
        open={poOpen}
        seed={poSeed}
        onOpenChange={(v) => {
          setPoOpen(v);
          if (!v) setPoSeed([]);
        }}
        onCreate={(po) => {
          purchaseOrderStore.add(po);
          setPoOpen(false);
          setPoSeed([]);
          setTab("orders");
          toast.success(`${po.number} created`, {
            description: `${formatNumber(po.units)} units · ${formatCurrency(po.total)}`,
          });
        }}
      />
    </div>
  );
}

/** Days-of-cover bar — the fastest read on "will this run out?". */
function CoverBar({ item }: { item: InventoryItem }) {
  if (item.daysOfCover >= 999) {
    return <span className="text-xs text-muted-foreground">No velocity</span>;
  }
  const pct = Math.min(100, (item.daysOfCover / 90) * 100);
  const tone =
    item.daysOfCover < 14 ? "bg-danger" : item.daysOfCover < 30 ? "bg-warning" : "bg-success";
  return (
    <div className="w-24 space-y-1">
      <span className="text-xs font-medium tabular-nums">{Math.round(item.daysOfCover)}d</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const ADJUST_REASONS = [
  "Cycle count",
  "Damaged goods",
  "Found stock",
  "Shrinkage",
  "Manual correction",
];

function AdjustStockDialog({
  item,
  onClose,
  onApply,
}: {
  item: InventoryItem | null;
  onClose: () => void;
  onApply: (item: InventoryItem, next: number, reason: string) => void;
}) {
  const [mode, setMode] = useState<"set" | "add">("add");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState(ADJUST_REASONS[0]);

  // Remount per item so the form never carries another SKU's input over.
  const key = item?.id ?? "none";
  const parsed = Number(amount);
  const valid = amount !== "" && Number.isFinite(parsed);
  const next = item
    ? mode === "set"
      ? Math.max(0, Math.round(parsed))
      : Math.max(0, item.onHand + Math.round(parsed))
    : 0;

  return (
    <Dialog
      open={item !== null}
      onOpenChange={(v) => {
        if (!v) {
          onClose();
          setAmount("");
          setMode("add");
          setReason(ADJUST_REASONS[0]);
        }
      }}
    >
      <DialogContent key={key}>
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {item ? `${item.name} · ${item.sku}` : ""}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2 rounded-lg border border-border bg-muted/30 p-3 text-center">
              <Figure label="On hand" value={formatNumber(item.onHand)} />
              <Figure label="Reserved" value={formatNumber(item.reserved)} />
              <Figure label="Available" value={formatNumber(item.available)} />
              <Figure label="Reorder at" value={formatNumber(item.reorderPoint)} />
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={mode === "add" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("add")}
              >
                Add / remove
              </Button>
              <Button
                type="button"
                variant={mode === "set" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("set")}
              >
                Set exact
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="adj-qty" className="text-sm font-medium">
                  {mode === "add" ? "Change in units" : "New quantity"}
                </label>
                <Input
                  id="adj-qty"
                  type="number"
                  step="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={mode === "add" ? "e.g. 120 or -12" : "e.g. 400"}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="adj-reason" className="text-sm font-medium">Reason</label>
                <Select id="adj-reason" value={reason} onChange={(e) => setReason(e.target.value)}>
                  {ADJUST_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </Select>
              </div>
            </div>

            {valid && (
              <p className="text-sm text-muted-foreground">
                New stock on hand:{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {formatNumber(next)}
                </span>{" "}
                units
                {next <= item.reorderPoint && (
                  <span className="ml-2 text-warning">· still at or below reorder point</span>
                )}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid || !item} onClick={() => item && onApply(item, next, reason)}>
            <SlidersHorizontal /> Apply adjustment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CreatePoDialog({
  open,
  seed,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  seed: InventoryItem[];
  onOpenChange: (v: boolean) => void;
  onCreate: (po: PurchaseOrder) => void;
}) {
  const [supplierId, setSupplierId] = useState(SUPPLIERS[0].id);
  const [warehouseId, setWarehouseId] = useState(WAREHOUSES[0].id);
  const [multiplier, setMultiplier] = useState("3");

  const supplier = SUPPLIERS.find((s) => s.id === supplierId)!;
  const factor = Math.max(1, Number(multiplier) || 3);

  // Order enough to clear the reorder point with a cushion — the quantity an
  // operator would otherwise work out by hand for every line.
  const lines = seed.map((item) => ({
    sku: item.sku,
    name: item.name,
    qty: Math.max(25, Math.ceil((item.reorderPoint * factor - item.available) / 25) * 25),
    unitCost: item.cost,
  }));
  const units = lines.reduce((s, l) => s + l.qty, 0);
  const total = +lines.reduce((s, l) => s + l.qty * l.unitCost, 0).toFixed(2);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create purchase order</DialogTitle>
          <DialogDescription>
            {seed.length
              ? `Drafting a PO for ${seed.length} selected SKU${seed.length === 1 ? "" : "s"}.`
              : "Select SKUs from the stock table to add lines to a purchase order."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="po-sup" className="text-sm font-medium">Supplier</label>
              <Select id="po-sup" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
                {SUPPLIERS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                {supplier.leadTimeDays}-day lead time · {supplier.onTimeRate}% on time
              </p>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="po-wh" className="text-sm font-medium">Deliver to</label>
              <Select id="po-wh" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
                {WAREHOUSES.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="po-mult" className="text-sm font-medium">
              Target cover (× reorder point)
            </label>
            <Input
              id="po-mult"
              type="number"
              min={1}
              max={12}
              step="1"
              value={multiplier}
              onChange={(e) => setMultiplier(e.target.value)}
            />
          </div>

          {lines.length > 0 && (
            <div className="max-h-52 overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/60">
                  <tr className="text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">SKU</th>
                    <th className="px-3 py-2 text-right font-medium">Qty</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.sku} className="border-t border-border/60">
                      <td className="px-3 py-2">
                        <p className="truncate font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNumber(l.qty)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatCurrency(l.qty * l.unitCost)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {lines.length > 0 && (
            <div className="flex items-center justify-between rounded-lg bg-secondary/50 px-3 py-2 text-sm">
              <span className="text-muted-foreground">
                {formatNumber(units)} units · {lines.length} line{lines.length === 1 ? "" : "s"}
              </span>
              <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!lines.length}
            onClick={() =>
              onCreate({
                id: `po_${Date.now()}`,
                number: `PO-${3200 + Math.floor(Math.random() * 800)}`,
                supplierId: supplier.id,
                supplier: supplier.name,
                warehouseId,
                status: "submitted",
                lines,
                units,
                total,
                createdAt: REF_NOW,
                etaAt: new Date(
                  +new Date(REF_NOW) + supplier.leadTimeDays * 86400000
                ).toISOString(),
              })
            }
          >
            <Plus /> Create PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
