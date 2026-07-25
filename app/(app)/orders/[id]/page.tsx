"use client";

import { use, useState } from "react";
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
  RotateCcw,
  PackageCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusPill } from "@/components/app/status-pill";
import { MarketplaceBadge } from "@/components/app/marketplace-badge";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, initials, exportToCsv } from "@/lib/format";
import { OrderStatus, ORDER_STATUS_META } from "@/lib/mock/orders";
import { orderStore, useEntity } from "@/lib/mock/store";

const REF_NOW = "2026-07-23T14:30:00Z";

// The next forward step in the fulfillment lifecycle, and its CTA label.
const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  pending: { to: "confirmed", label: "Confirm payment" },
  confirmed: { to: "packed", label: "Mark packed" },
  packed: { to: "shipped", label: "Mark shipped" },
  shipped: { to: "delivered", label: "Mark delivered" },
};

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const order = useEntity(orderStore, id);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("Customer request");

  if (!order) notFound();

  const meta = ORDER_STATUS_META[order.status];
  const subtotal = order.items.reduce((s, it) => s + it.price * it.qty, 0);
  const shipping = order.payment === "cod" ? 0 : 5.99;
  const tax = +(subtotal * 0.08).toFixed(2);
  const grand = subtotal + shipping + tax;
  const next = NEXT_STEP[order.status];

  function advanceStatus() {
    if (!next) return;
    orderStore.update(order!.id, (prev) => ({
      ...prev,
      status: next.to,
      courier: prev.courier === "—" && next.to === "shipped" ? "Shiprocket" : prev.courier,
      tracking:
        prev.tracking === "—" && next.to === "shipped"
          ? `TRK${String(Date.now()).slice(-9)}`
          : prev.tracking,
      timeline: [
        ...prev.timeline,
        { label: ORDER_STATUS_META[next.to].label, at: REF_NOW, done: true },
      ],
    }));
    toast.success(`Order marked ${ORDER_STATUS_META[next.to].label.toLowerCase()}`);
  }

  function issueRefund() {
    const amt = Number(refundAmount) || grand;
    orderStore.update(order!.id, (prev) => ({
      ...prev,
      status: "returned",
      timeline: [
        ...prev.timeline,
        { label: `Refund issued · ${formatCurrency(amt, { decimals: 2 })}`, at: REF_NOW, done: true },
      ],
    }));
    setRefundOpen(false);
    setRefundAmount("");
    toast.success(`Refund of ${formatCurrency(amt, { decimals: 2 })} issued`);
  }

  function exportDoc(kind: "invoice" | "packing-slip") {
    exportToCsv(
      `${kind}-${order!.number.replace("#", "")}`,
      order!.items.map((it) => ({
        order: order!.number,
        sku: it.sku,
        item: it.name,
        qty: it.qty,
        price: it.price,
        lineTotal: +(it.price * it.qty).toFixed(2),
      }))
    );
    toast.success(kind === "invoice" ? "Invoice downloaded" : "Packing slip downloaded");
  }

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
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportDoc("invoice")}>
            <FileText /> Invoice
          </Button>
          <Button variant="outline" size="sm" onClick={() => exportDoc("packing-slip")}>
            <Printer /> Packing slip
          </Button>
          {order.status !== "returned" && order.status !== "cancelled" && (
            <Button
              variant="outline"
              size="sm"
              className="text-danger hover:text-danger"
              onClick={() => setRefundOpen(true)}
            >
              <RotateCcw /> Refund
            </Button>
          )}
          {next ? (
            <Button size="sm" onClick={advanceStatus}>
              {next.to === "shipped" ? <Truck /> : <PackageCheck />} {next.label}
            </Button>
          ) : (
            <Button size="sm" disabled>
              <Check /> {meta.label}
            </Button>
          )}
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
                    {formatCurrency(grand, { decimals: 2 })}
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

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue refund</DialogTitle>
            <DialogDescription>
              Refund {order.number}. Leave the amount blank to refund the full{" "}
              {formatCurrency(grand, { decimals: 2 })}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="r-amt" className="text-sm font-medium">Refund amount (USD)</label>
              <Input
                id="r-amt"
                type="number"
                min={0}
                step="0.01"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={grand.toFixed(2)}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="r-reason" className="text-sm font-medium">Reason</label>
              <Select
                id="r-reason"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
              >
                <option>Customer request</option>
                <option>Damaged in transit</option>
                <option>Wrong item shipped</option>
                <option>Item not as described</option>
                <option>Late delivery</option>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
            <Button className="bg-danger text-white hover:bg-danger/90" onClick={issueRefund}>
              Issue refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
