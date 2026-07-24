"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDownRight,
  Edit,
  Star,
  Package,
  TrendingUp,
  DollarSign,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { Sparkline } from "@/components/app/sparkline";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, formatDate } from "@/lib/format";
import { getProduct } from "@/lib/mock/products";
import { makeRng } from "@/lib/mock/rng";

export default function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const product = getProduct(id);
  if (!product) notFound();

  const rng = makeRng(id.length * 137 + product.units30d);
  const salesSeries = Array.from({ length: 20 }, () => rng.int(20, 90));
  const profit = product.price - product.cost;

  const stats = [
    { icon: DollarSign, label: "Revenue (30d)", value: formatCurrency(product.revenue30d, { compact: true }) },
    { icon: Package, label: "Units sold (30d)", value: formatNumber(product.units30d) },
    { icon: TrendingUp, label: "Profit / unit", value: formatCurrency(profit, { decimals: 2 }) },
    { icon: Boxes, label: "In stock", value: `${product.stock}` },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/products" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" /> Products
        </Link>
        <span>/</span>
        <span className="text-foreground">{product.name}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-4">
          <span
            className="size-20 shrink-0 rounded-xl shadow-sm"
            style={{ background: product.image }}
          />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{product.name}</h1>
              <Badge
                variant={product.status === "active" ? "success" : "secondary"}
                className="capitalize"
              >
                {product.status}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              SKU {product.sku} · {product.brand} · {product.category}
            </p>
            <div className="mt-2 flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-warning">
                <Star className="size-4 fill-current" />
                <span className="font-medium text-foreground">{product.rating}</span>
                <span className="text-muted-foreground">({formatNumber(product.reviews)})</span>
              </span>
              {product.tags.map((t) => (
                <Badge key={t} variant="outline" className="capitalize">
                  {t}
                </Badge>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Opened in editor")}>
            <Edit /> Edit
          </Button>
          <Button size="sm" onClick={() => toast.success("Synced to all channels")}>
            Sync everywhere
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <s.icon className="size-4" />
              <span className="text-sm">{s.label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tabs defaultValue="listings">
            <TabsList>
              <TabsTrigger value="listings">Marketplace listings</TabsTrigger>
              <TabsTrigger value="pricing">Pricing</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="listings">
              <Card>
                <CardContent className="p-0">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40 text-xs text-muted-foreground">
                        <th className="px-4 py-2.5 text-left font-medium">Channel</th>
                        <th className="px-4 py-2.5 text-left font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">Price</th>
                        <th className="px-4 py-2.5 text-right font-medium">vs base</th>
                      </tr>
                    </thead>
                    <tbody>
                      {product.listings.map((l) => {
                        const diff = ((l.price - product.price) / product.price) * 100;
                        return (
                          <tr key={l.marketplace} className="border-b border-border/60 last:border-0">
                            <td className="px-4 py-3">
                              <MarketplaceBadge id={l.marketplace} />
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant={
                                  l.status === "live"
                                    ? "success"
                                    : l.status === "pending"
                                    ? "warning"
                                    : "secondary"
                                }
                                className="capitalize"
                              >
                                {l.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 text-right font-medium tabular-nums">
                              {formatCurrency(l.price, { decimals: 2 })}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <span
                                className={cn(
                                  "inline-flex items-center gap-0.5 text-xs font-medium tabular-nums",
                                  diff >= 0 ? "text-success" : "text-danger"
                                )}
                              >
                                {diff >= 0 ? (
                                  <ArrowUpRight className="size-3" />
                                ) : (
                                  <ArrowDownRight className="size-3" />
                                )}
                                {Math.abs(diff).toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="pricing">
              <Card>
                <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-3">
                  <PriceStat label="Selling price" value={formatCurrency(product.price, { decimals: 2 })} />
                  <PriceStat label="Cost of goods" value={formatCurrency(product.cost, { decimals: 2 })} />
                  <PriceStat label="Profit / unit" value={formatCurrency(profit, { decimals: 2 })} accent="text-success" />
                  <PriceStat label="Margin" value={`${product.margin}%`} />
                  <PriceStat label="Reorder point" value={`${product.reorderPoint} units`} />
                  <PriceStat label="Created" value={formatDate(product.createdAt, "long")} />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Sales trend</CardTitle>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      product.trend >= 0 ? "text-success" : "text-danger"
                    )}
                  >
                    {product.trend >= 0 ? "+" : ""}
                    {product.trend}% vs last month
                  </span>
                </CardHeader>
                <CardContent>
                  <div className="h-24">
                    <Sparkline data={salesSeries} height={96} />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Inventory</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Available</span>
                <span className="font-medium tabular-nums">{product.stock} units</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className={cn(
                    "h-full rounded-full",
                    product.stock <= product.reorderPoint ? "bg-warning" : "bg-success"
                  )}
                  style={{ width: `${Math.min(100, (product.stock / 300) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Reorder point at {product.reorderPoint} units.
                {product.stock <= product.reorderPoint && " Below threshold — reorder soon."}
              </p>
              <Button variant="secondary" size="sm" className="w-full" onClick={() => toast.success("Purchase order drafted")}>
                Create purchase order
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick facts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Row label="Brand" value={product.brand} />
              <Row label="Category" value={product.category} />
              <Row label="Channels live" value={`${product.listings.filter((l) => l.status === "live").length}`} />
              <Row label="Rating" value={`${product.rating} ★`} />
              <Row label="Reviews" value={formatNumber(product.reviews)} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function PriceStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-lg font-semibold tabular-nums", accent)}>{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
