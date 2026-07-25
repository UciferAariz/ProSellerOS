"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Upload, Sparkles, Package, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { ProductFormDialog, ProductFormValues } from "@/components/app/product-form-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { Product, ProductListing } from "@/lib/mock/products";
import { MARKETPLACE_LIST } from "@/lib/mock/marketplaces";
import { productStore, useEntityList } from "@/lib/mock/store";

const GRADIENTS = [
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#10b981,#22d3ee)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#ec4899,#8b5cf6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
];

/** Build a full Product record from the create dialog's minimal form values. */
function productFromForm(v: ProductFormValues, index: number): Product {
  const price = +v.price.toFixed(2);
  const cost = +(price * 0.55).toFixed(2);
  const listings: ProductListing[] = [
    { marketplace: "amazon", status: "pending", price },
  ];
  return {
    id: `prod_${Date.now()}`,
    sku: v.sku.trim() || `NEW-${2300 + index}`,
    name: v.name.trim(),
    category: v.category,
    brand: "House",
    image: GRADIENTS[index % GRADIENTS.length],
    price,
    cost,
    stock: v.stock,
    reorderPoint: 20,
    status: "draft",
    rating: 0,
    reviews: 0,
    units30d: 0,
    revenue30d: 0,
    trend: 0,
    margin: +(((price - cost) / price) * 100).toFixed(1),
    listings,
    createdAt: new Date("2026-07-23").toISOString(),
    tags: ["new"],
  };
}

export default function ProductsPage() {
  const router = useRouter();
  const products = useEntityList(productStore);

  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [channel, setChannel] = useState("all");
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Product[] | null>(null);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products]
  );

  const filtered = useMemo(
    () =>
      products.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (status === "all" || p.status === status) &&
          (channel === "all" || p.listings.some((l) => l.marketplace === channel))
      ),
    [products, category, status, channel]
  );

  const totalValue = products.reduce((s, p) => s + p.price * p.stock, 0);
  const activeCount = products.filter((p) => p.status === "active").length;
  const lowCount = products.filter(
    (p) => p.stock <= p.reorderPoint && p.status === "active"
  ).length;

  function handleCreate(values: ProductFormValues) {
    productStore.add(productFromForm(values, products.length));
  }

  function setStatusFor(rows: Product[], next: Product["status"]) {
    rows.forEach((r) => productStore.update(r.id, { status: next }));
    toast.success(
      `${rows.length} product${rows.length > 1 ? "s" : ""} ${
        next === "active" ? "activated" : "archived"
      }`
    );
  }

  function confirmDelete() {
    if (!pendingDelete) return;
    const n = pendingDelete.length;
    productStore.remove(pendingDelete.map((p) => p.id));
    setPendingDelete(null);
    toast.success(`Deleted ${n} product${n > 1 ? "s" : ""}`);
  }

  const columns: ColumnDef<Product, unknown>[] = [
    {
      accessorKey: "name",
      header: "Product",
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            <span className="size-10 shrink-0 rounded-lg" style={{ background: p.image }} />
            <div className="min-w-0">
              <p className="truncate font-medium">{p.name}</p>
              <p className="text-xs text-muted-foreground">
                {p.sku} · {p.brand}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.category}</Badge>
      ),
    },
    {
      id: "channels",
      header: "Channels",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex -space-x-1">
          {row.original.listings.slice(0, 5).map((l) => (
            <span key={l.marketplace} className="ring-2 ring-card rounded-md">
              <MarketplaceLogo id={l.marketplace} size={20} />
            </span>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "price",
      header: "Price",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.price, { decimals: 2 })}
        </span>
      ),
    },
    {
      accessorKey: "margin",
      header: "Margin",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">{row.original.margin}%</span>
      ),
    },
    {
      accessorKey: "stock",
      header: "Stock",
      cell: ({ row }) => {
        const p = row.original;
        const low = p.stock <= p.reorderPoint;
        return (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums",
              p.stock === 0
                ? "bg-danger/12 text-danger"
                : low
                ? "bg-warning/15 text-warning"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {p.stock === 0 ? "Out of stock" : `${p.stock} units`}
          </span>
        );
      },
    },
    {
      accessorKey: "units30d",
      header: "Sold (30d)",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <span className="tabular-nums">{formatNumber(row.original.units30d)}</span>
          <span
            className={cn(
              "inline-flex items-center text-[11px] font-medium",
              row.original.trend >= 0 ? "text-success" : "text-danger"
            )}
          >
            {row.original.trend >= 0 ? (
              <ArrowUpRight className="size-3" />
            ) : (
              <ArrowDownRight className="size-3" />
            )}
            {Math.abs(row.original.trend)}%
          </span>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const s = row.original.status;
        return (
          <Badge
            variant={s === "active" ? "success" : s === "draft" ? "warning" : "secondary"}
            className="capitalize"
          >
            {s}
          </Badge>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Your master catalog synced across every marketplace."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Drop a CSV to import — coming to your workspace soon")}
            >
              <Upload /> Import
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toast.success("Queued AI descriptions for review")}
            >
              <Sparkles /> AI descriptions
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus /> Add product
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={formatNumber(products.length)} sub="across catalog" />
        <StatCard label="Active listings" value={formatNumber(activeCount)} sub="published & live" />
        <StatCard label="Inventory value" value={formatCurrency(totalValue, { compact: true })} sub="at retail price" />
        <StatCard
          label="Low stock"
          value={formatNumber(lowCount)}
          sub="need reordering"
          accent="text-warning"
        />
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        searchKey="name"
        searchPlaceholder="Search products, SKUs, brands…"
        exportName="products"
        pageSize={10}
        enableSelection
        onRowClick={(p) => router.push(`/products/${p.id}`)}
        toolbar={
          <div className="flex items-center gap-2">
            <Select value={category} onChange={(e) => setCategory(e.target.value)} className="w-auto">
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-auto">
              <option value="all">All status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </Select>
            <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="w-auto">
              <option value="all">All channels</option>
              {MARKETPLACE_LIST.filter((m) =>
                products.some((p) => p.listings.some((l) => l.marketplace === m.id))
              ).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </Select>
          </div>
        }
        bulkActions={(rows) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setStatusFor(rows, "active")}
            >
              Activate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => setStatusFor(rows, "archived")}
            >
              Archive
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-danger hover:text-danger"
              onClick={() => setPendingDelete(rows)}
            >
              Delete
            </Button>
          </>
        )}
      />

      <ProductFormDialog open={addOpen} onOpenChange={setAddOpen} onSubmit={handleCreate} />

      <Dialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {pendingDelete?.length} product{(pendingDelete?.length ?? 0) > 1 ? "s" : ""}?</DialogTitle>
            <DialogDescription>
              This removes the selected {(pendingDelete?.length ?? 0) > 1 ? "products" : "product"} from your
              catalog and unpublishes every channel listing. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Cancel
            </Button>
            <Button
              className="bg-danger text-white hover:bg-danger/90"
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub: string;
  accent?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Package className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-semibold tracking-tight tabular-nums", accent)}>
        {value}
      </p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </Card>
  );
}
