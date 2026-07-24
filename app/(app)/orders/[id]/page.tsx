"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  MapPin,
  CreditCard,
  Truck,
  Printer,
  FileText,
  Check,
  Mail,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusPill } from "@/components/app/status-pill";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, initials } from "@/lib/format";
import { getOrder, ORDER_STATUS_META } from "@/lib/mock/orders";

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const order = getOrder(id);
  if (!order) notFound();

  const meta = ORDER_STATUS_META[order.status];
  const subtotal = order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = order.payment === "cod" ? 0 : 5.99;
  const tax = +(subtotal * 0.08).toFixed(2);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/orders" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-4" /> Orders
        </Link>
        <span>/</span>
        <span className="text-foreground">{order.number}</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{order.number}</h1>
          <StatusPill label={meta.label} variant={meta.variant} />
          {order.flagged && <StatusPill label="Flagged" variant="danger" />}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.success("Invoice generated")}>
            <FileText /> Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.success("Packing slip queued")}>
            <Printer /> Packing slip
          </Button>
          <Button size="sm" onClick={() => toast.success("Shipping label created")}>
            <Truck /> Create label
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-4 lg:col-span-2">
          {/* Items */}
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Items ({order.itemCount})</CardTitle>
              <MarketplaceBadge id={order.marketplace} />
            </CardHeader>
            <CardContent className="p-0">
              {order.items.map((it, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-b border-border/60 px-5 py-3 last:border-0"
                >
                  <span className="size-11 shrink-0 rounded-lg" style={{ background: it.image }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{it.name}</p>
                    <p className="text-xs text-muted-foreground">{it.sku}</p>
                  </div>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(it.price, { decimals: 2 })} × {it.qty}
                  </span>
                  <span className="w-20 text-right text-sm font-medium tabular-nums">
                    {formatCurrency(it.price * it.qty, { decimals: 2 })}
                  </span>
                </div>
              ))}
              <div className="space-y-1.5 border-t border-border px-5 py-4 text-sm">
                <Row label="Subtotal" value={formatCurrency(subtotal, { decimals: 2 })} />
                <Row label="Shipping" value={formatCurrency(shipping, { decimals: 2 })} />
                <Row label="Tax (8%)" value={formatCurrency(tax, { decimals: 2 })} />
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">
                    {formatCurrency(subtotal + shipping + tax, { decimals: 2 })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Order timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 pl-6">
                <span className="absolute left-[9px] top-1.5 h-[calc(100%-16px)] w-px bg-border" />
                {order.timeline.map((event, i) => (
                  <li key={i} className="relative">
                    <span
                      className={cn(
                        "absolute -left-6 flex size-[18px] items-center justify-center rounded-full ring-4 ring-card",
                        event.done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                      )}
                    >
                      {event.done && <Check className="size-2.5" />}
                    </span>
                    <div className="flex items-center justify-between">
                      <p className={cn("text-sm", event.done ? "font-medium" : "text-muted-foreground")}>
                        {event.label}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(event.at, "medium")} · {formatDate(event.at, "time")}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-chart-6 text-sm font-semibold text-white">
                  {initials(order.customer)}
                </span>
                <div>
                  <p className="text-sm font-medium">{order.customer}</p>
                  <p className="text-xs text-muted-foreground">3 previous orders</p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="size-4" /> {order.email}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" /> +1 (555) 018-{order.id.slice(-4)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shipping</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 text-muted-foreground" />
                <div>
                  <p className="font-medium">{order.customer}</p>
                  <p className="text-muted-foreground">
                    42 Market Street, {order.city}
                  </p>
                </div>
              </div>
              <Row label="Courier" value={order.courier} />
              <Row label="Tracking" value={order.tracking} mono />
              <Row label="Ship by" value={formatDate(order.sla, "long")} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Payment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <span className="uppercase">{order.payment}</span>
                <StatusPill
                  label={order.payment === "prepaid" ? "Paid" : "Collect on delivery"}
                  variant={order.payment === "prepaid" ? "success" : "warning"}
                  className="ml-auto"
                />
              </div>
              <Row label="Placed" value={formatDate(order.placedAt, "long")} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-medium", mono && "font-mono text-xs")}>{value}</span>
    </div>
  );
}
