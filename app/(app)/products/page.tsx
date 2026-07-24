"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { Plus, Upload, Sparkles, Package, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { DataTable } from "@/components/app/data-table";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import { PRODUCTS, Product } from "@/lib/mock/products";

const CATEGORIES = [...new Set(PRODUCTS.map((p) => p.category))].sort();

export default function ProductsPage() {
  const router = useRouter();
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");

  const filtered = useMemo(
    () =>
      PRODUCTS.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          (status === "all" || p.status === status)
      ),
    [category, status]
  );

  const totalValue = PRODUCTS.reduce((s, p) => s + p.price * p.stock, 0);
  const activeCount = PRODUCTS.filter((p) => p.status === "active").length;
  const lowCount = PRODUCTS.filter((p) => p.stock <= p.reorderPoint && p.status === "active").length;

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
            <Button variant="outline" size="sm">
              <Upload /> Import
            </Button>
            <Button variant="secondary" size="sm">
              <Sparkles /> AI descriptions
            </Button>
            <Button size="sm" onClick={() => toast.success("New product draft created")}>
              <Plus /> Add product
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total SKUs" value={formatNumber(PRODUCTS.length)} sub="across catalog" />
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
              {CATEGORIES.map((c) => (
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
          </div>
        }
        bulkActions={(rows) => (
          <>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => toast.success(`Publishing ${rows.length} products…`)}
            >
              Publish
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7"
              onClick={() => toast.success(`Repriced ${rows.length} products`)}
            >
              Reprice
            </Button>
          </>
        )}
      />
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
