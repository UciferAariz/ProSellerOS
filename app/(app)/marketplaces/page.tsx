"use client";

import { useState } from "react";
import {
  RefreshCw,
  Settings2,
  Plug,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Webhook,
  Boxes,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/page-header";
import { MarketplaceLogo } from "@/components/app/marketplace-badge";
import { StatusPill } from "@/components/app/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber, relativeTime } from "@/lib/format";
import {
  CONNECTIONS,
  MARKETPLACES,
  MarketplaceConnection,
  MarketplaceId,
} from "@/lib/mock/marketplaces";

export default function MarketplacesPage() {
  const [connectId, setConnectId] = useState<MarketplaceId | null>(null);
  const [connected, setConnected] = useState<Set<MarketplaceId>>(new Set());

  const connections = CONNECTIONS.map((c) =>
    connected.has(c.id)
      ? { ...c, status: "connected" as const, health: 95, lastSync: new Date().toISOString() }
      : c
  );

  const active = connections.filter((c) => c.status !== "disconnected");
  const available = connections.filter((c) => c.status === "disconnected");

  const totalRevenue = active.reduce((s, c) => s + c.revenue30d, 0);
  const totalOrders = active.reduce((s, c) => s + c.orders30d, 0);
  const issues = active.reduce((s, c) => s + c.issues, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketplace connections"
        description="Connect and monitor every channel you sell on from one control center."
        actions={
          <Button size="sm" onClick={() => toast.success("Syncing all channels…")}>
            <RefreshCw /> Sync all
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SummaryCard icon={Plug} label="Connected" value={`${active.length} / ${connections.length}`} />
        <SummaryCard icon={Boxes} label="Orders (30d)" value={formatNumber(totalOrders)} />
        <SummaryCard icon={CheckCircle2} label="Revenue (30d)" value={formatCurrency(totalRevenue, { compact: true })} />
        <SummaryCard
          icon={AlertCircle}
          label="Open issues"
          value={`${issues}`}
          accent={issues > 0 ? "text-warning" : "text-success"}
        />
      </div>

      {/* Connected */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Connected channels
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((c) => (
            <ConnectionCard key={c.id} connection={c} />
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Available integrations
        </h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {available.map((c) => {
            const m = MARKETPLACES[c.id];
            return (
              <button
                key={c.id}
                onClick={() => setConnectId(c.id)}
                className="group flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
              >
                <MarketplaceLogo id={c.id} size={40} />
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <p className="text-xs text-muted-foreground">{m.region}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                  Connect <ArrowRight className="size-3" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ConnectDialog
        marketplaceId={connectId}
        onClose={() => setConnectId(null)}
        onConnected={(id) => {
          setConnected((prev) => new Set(prev).add(id));
          toast.success(`${MARKETPLACES[id].name} connected successfully`);
        }}
      />
    </div>
  );
}

function ConnectionCard({ connection: c }: { connection: MarketplaceConnection }) {
  const m = MARKETPLACES[c.id];
  const variant =
    c.status === "connected" ? "success" : c.status === "syncing" ? "info" : "danger";

  return (
    <Card className="overflow-hidden">
      <div className="h-1" style={{ background: m.color }} />
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <MarketplaceLogo id={c.id} size={38} />
            <div>
              <p className="font-medium">{m.name}</p>
              <p className="text-xs text-muted-foreground">{c.apiVersion}</p>
            </div>
          </div>
          <StatusPill
            label={c.status}
            variant={variant}
            pulse={c.status === "syncing"}
            className="capitalize"
          />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Metric label="Orders" value={formatNumber(c.orders30d, true)} />
          <Metric label="Revenue" value={formatCurrency(c.revenue30d, { compact: true })} />
          <Metric label="SKUs" value={formatNumber(c.skus, true)} />
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Health</span>
            <span className="font-medium tabular-nums">{c.health}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full",
                c.health > 90 ? "bg-success" : c.health > 60 ? "bg-warning" : "bg-danger"
              )}
              style={{ width: `${c.health}%` }}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <RefreshCw className="size-3" /> Synced {relativeTime(c.lastSync)}
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className={cn("size-3.5", c.webhooks ? "text-success" : "text-muted-foreground/50")} />
            <Webhook className={cn("size-3.5", c.webhooks ? "text-success" : "text-muted-foreground/50")} />
          </span>
        </div>

        <div className="mt-4 flex gap-2">
          {c.status === "error" ? (
            <Button
              size="sm"
              className="flex-1"
              onClick={() => toast.success(`Reconnecting ${m.name}…`)}
            >
              Reconnect
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1"
              onClick={() => toast.success(`Syncing ${m.name}…`)}
            >
              <RefreshCw /> Sync now
            </Button>
          )}
          <Button size="icon-sm" variant="outline" onClick={() => toast("Settings coming soon")}>
            <Settings2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

const STEPS = ["Authorize access", "Configure sync", "Import catalog"];

function ConnectDialog({
  marketplaceId,
  onClose,
  onConnected,
}: {
  marketplaceId: MarketplaceId | null;
  onClose: () => void;
  onConnected: (id: MarketplaceId) => void;
}) {
  const [step, setStep] = useState(0);
  const [working, setWorking] = useState(false);
  const m = marketplaceId ? MARKETPLACES[marketplaceId] : null;

  function next() {
    if (!marketplaceId) return;
    setWorking(true);
    setTimeout(() => {
      setWorking(false);
      if (step < STEPS.length - 1) {
        setStep((s) => s + 1);
      } else {
        onConnected(marketplaceId);
        handleClose();
      }
    }, 900);
  }

  function handleClose() {
    onClose();
    setTimeout(() => setStep(0), 200);
  }

  return (
    <Dialog open={!!marketplaceId} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent>
        {m && (
          <>
            <DialogHeader>
              <div className="mb-2 flex items-center gap-3">
                <MarketplaceLogo id={m.id} size={40} />
                <div>
                  <DialogTitle>Connect {m.name}</DialogTitle>
                  <DialogDescription>{m.region} · {m.category}</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            {/* Steps */}
            <div className="flex items-center gap-2">
              {STEPS.map((s, i) => (
                <div key={s} className="flex flex-1 items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                      i < step
                        ? "bg-success text-success-foreground"
                        : i === step
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground"
                    )}
                  >
                    {i < step ? <Check className="size-3.5" /> : i + 1}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className={cn("h-px flex-1", i < step ? "bg-success" : "bg-border")} />
                  )}
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium">{STEPS[step]}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {step === 0 &&
                  `You'll be redirected to ${m.name} to authorize ProSellerOS to read and manage your listings, orders, and inventory.`}
                {step === 1 &&
                  "Choose what to sync: orders, inventory levels, pricing, and product listings. You can change this anytime."}
                {step === 2 &&
                  `Importing your existing catalog from ${m.name}. This usually takes a few minutes in the background.`}
              </p>
              {step === 1 && (
                <div className="mt-3 space-y-2">
                  {["Orders", "Inventory", "Pricing", "Listings"].map((opt) => (
                    <label key={opt} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" defaultChecked className="size-4 accent-[var(--primary)]" />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={next} disabled={working}>
                {working ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Working…
                  </>
                ) : step === STEPS.length - 1 ? (
                  "Finish & connect"
                ) : (
                  <>
                    Continue <ArrowRight className="size-4" />
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/50 py-2">
      <p className="text-sm font-semibold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
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
    </Card>
  );
}
