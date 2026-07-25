"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import {
  Area,
  ComposedChart,
  CartesianGrid,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Megaphone,
  Target,
  MousePointerClick,
  DollarSign,
  Play,
  Pause,
  Plus,
  Download,
  Ticket,
  UsersRound,
  Copy,
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
import { formatCurrency, formatNumber, formatDate, exportToCsv } from "@/lib/format";
import {
  campaignMetrics,
  marketingSummary,
  channelPerformance,
  AD_CHANNELS,
  AD_CHANNEL_LIST,
  CAMPAIGN_STATUS_META,
  COUPONS,
  MARKETING_SERIES,
  AUDIENCES,
  type Campaign,
  type CampaignStatus,
  type AdChannelId,
  type CampaignObjective,
} from "@/lib/mock/marketing";
import { campaignStore, useEntityList } from "@/lib/mock/store";

const REF_NOW = "2026-07-23T14:30:00Z";

type Tab = "campaigns" | "promotions" | "audiences";

export default function MarketingPage() {
  const campaigns = useEntityList(campaignStore);
  const [tab, setTab] = useState<Tab>("campaigns");
  const [status, setStatus] = useState<CampaignStatus | "all">("all");
  const [channel, setChannel] = useState<AdChannelId | "all">("all");
  const [createOpen, setCreateOpen] = useState(false);

  const summary = useMemo(() => marketingSummary(campaigns), [campaigns]);
  const byChannel = useMemo(() => channelPerformance(campaigns), [campaigns]);

  const filtered = useMemo(
    () =>
      campaigns.filter(
        (c) =>
          (status === "all" || c.status === status) &&
          (channel === "all" || c.channel === channel)
      ),
    [campaigns, status, channel]
  );

  function toggleStatus(c: Campaign) {
    // Only running campaigns can pause; scheduled/ended ones start fresh.
    const next: CampaignStatus = c.status === "active" ? "paused" : "active";
    campaignStore.update(c.id, { status: next });
    toast.success(`${c.name} ${next === "active" ? "resumed" : "paused"}`, {
      description:
        next === "active"
          ? `Spending resumes against a ${formatCurrency(c.budget)} budget.`
          : `${formatCurrency(c.budget - c.spend)} of budget held back.`,
    });
  }

  function duplicate(c: Campaign) {
    campaignStore.add({
      ...c,
      id: `camp_${Date.now()}`,
      name: `${c.name} (copy)`,
      status: "scheduled",
      spend: 0,
      impressions: 0,
      clicks: 0,
      orders: 0,
      revenue: 0,
      startAt: REF_NOW,
    });
    toast.success(`Duplicated "${c.name}"`, {
      description: "The copy is scheduled and has not spent anything yet.",
    });
  }

  const columns: ColumnDef<Campaign, unknown>[] = [
    {
      accessorKey: "name",
      header: "Campaign",
      cell: ({ row }) => {
        const ch = AD_CHANNELS[row.original.channel];
        return (
          <div className="flex items-center gap-3">
            <span
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[10px] font-bold text-white"
              style={{ background: ch.color }}
            >
              {ch.short}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">{row.original.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {ch.name} · {row.original.audience}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "objective",
      header: "Objective",
      cell: ({ row }) => (
        <Badge variant="outline" className="capitalize">
          {row.original.objective}
        </Badge>
      ),
    },
    {
      accessorKey: "spend",
      header: "Spend",
      cell: ({ row }) => {
        const m = campaignMetrics(row.original);
        return (
          <div className="w-24 space-y-1">
            <p className="font-medium tabular-nums">
              {formatCurrency(row.original.spend)}
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn(
                  "h-full rounded-full",
                  m.pacing > 90 ? "bg-warning" : "bg-primary"
                )}
                style={{ width: `${Math.min(100, m.pacing)}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              of {formatCurrency(row.original.budget, { compact: true })}
            </p>
          </div>
        );
      },
    },
    {
      accessorKey: "impressions",
      header: "Impressions",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {formatNumber(row.original.impressions, true)}
        </span>
      ),
    },
    {
      id: "ctr",
      header: "CTR",
      accessorFn: (row) => campaignMetrics(row).ctr,
      cell: ({ row }) => (
        <span className="tabular-nums">{campaignMetrics(row.original).ctr}%</span>
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
      accessorKey: "revenue",
      header: "Revenue",
      cell: ({ row }) => (
        <span className="font-medium tabular-nums">
          {formatCurrency(row.original.revenue, { compact: true })}
        </span>
      ),
    },
    {
      id: "roas",
      header: "ROAS",
      accessorFn: (row) => campaignMetrics(row).roas,
      cell: ({ row }) => {
        const roas = campaignMetrics(row.original).roas;
        if (!roas) return <span className="text-muted-foreground">—</span>;
        return (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-xs font-semibold tabular-nums",
              roas >= 4
                ? "bg-success/12 text-success"
                : roas >= 2
                  ? "bg-warning/15 text-warning"
                  : "bg-danger/12 text-danger"
            )}
          >
            {roas}×
          </span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = CAMPAIGN_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            variant="ghost"
            title={row.original.status === "active" ? "Pause" : "Resume"}
            onClick={(e) => {
              e.stopPropagation();
              toggleStatus(row.original);
            }}
          >
            {row.original.status === "active" ? <Pause /> : <Play />}
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            title="Duplicate"
            onClick={(e) => {
              e.stopPropagation();
              duplicate(row.original);
            }}
          >
            <Copy />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Marketing"
        description="Campaigns, promotions, and audiences — with the spend that produced them."
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                exportToCsv(
                  "campaigns",
                  filtered.map((c) => {
                    const m = campaignMetrics(c);
                    return {
                      name: c.name,
                      channel: AD_CHANNELS[c.channel].name,
                      status: c.status,
                      budget: c.budget,
                      spend: c.spend,
                      impressions: c.impressions,
                      clicks: c.clicks,
                      ctr_pct: m.ctr,
                      orders: c.orders,
                      revenue: c.revenue,
                      roas: m.roas,
                      cac: m.cac,
                    };
                  })
                );
                toast.success(`Exported ${filtered.length} campaigns`);
              }}
            >
              <Download /> Export
            </Button>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus /> New campaign
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          icon={DollarSign}
          label="Ad spend"
          value={formatCurrency(summary.spend, { compact: true })}
          sub={`${formatCurrency(summary.budget, { compact: true })} budgeted`}
          delta={18.6}
          invertDelta
        />
        <StatCard
          icon={Target}
          label="Attributed revenue"
          value={formatCurrency(summary.revenue, { compact: true })}
          sub={`${formatNumber(summary.orders)} orders`}
          delta={24.1}
        />
        <StatCard
          icon={Megaphone}
          label="Blended ROAS"
          value={`${summary.roas}×`}
          sub={`${summary.active} campaigns live`}
          delta={5.2}
        />
        <StatCard
          icon={UsersRound}
          label="Cost per order"
          value={formatCurrency(summary.cac, { decimals: 2 })}
          sub="acquisition cost"
          delta={-4.8}
          invertDelta
        />
        <StatCard
          icon={MousePointerClick}
          label="Click-through"
          value={`${summary.ctr}%`}
          sub={`${formatNumber(summary.clicks, true)} clicks`}
          delta={1.4}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Spend vs attributed revenue</CardTitle>
            <p className="text-sm text-muted-foreground">Last 12 weeks</p>
          </CardHeader>
          <CardContent>
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={MARKETING_SERIES} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mkt-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
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
                    width={48}
                    tickFormatter={(v) => formatCurrency(v, { compact: true })}
                  />
                  <Tooltip content={<ChartTooltip format="currency" />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Attributed revenue"
                    stroke="var(--chart-2)"
                    strokeWidth={2.5}
                    fill="url(#mkt-rev)"
                  />
                  <Line
                    type="monotone"
                    dataKey="spend"
                    name="Spend"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Return by channel</CardTitle>
            <p className="text-sm text-muted-foreground">Revenue per dollar spent</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {[...byChannel]
              .sort((a, b) => b.roas - a.roas)
              .map((c) => {
                const max = Math.max(...byChannel.map((x) => x.roas)) || 1;
                return (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 font-medium">
                        <span className="size-2.5 rounded-full" style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <span className="font-semibold tabular-nums">{c.roas}×</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(c.roas / max) * 100}%`, background: c.color }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      {formatCurrency(c.spend, { compact: true })} spend →{" "}
                      {formatCurrency(c.revenue, { compact: true })}
                    </p>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="promotions">Promotions</TabsTrigger>
          <TabsTrigger value="audiences">Audiences</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "campaigns" && (
        <DataTable
          columns={columns}
          data={filtered}
          searchKey="name"
          searchPlaceholder="Search campaign, audience…"
          exportName="campaigns"
          pageSize={10}
          enableSelection
          toolbar={
            <>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as CampaignStatus | "all")}
                className="w-auto"
              >
                <option value="all">All statuses</option>
                {Object.entries(CAMPAIGN_STATUS_META).map(([key, meta]) => (
                  <option key={key} value={key}>
                    {meta.label}
                  </option>
                ))}
              </Select>
              <Select
                value={channel}
                onChange={(e) => setChannel(e.target.value as AdChannelId | "all")}
                className="w-auto"
              >
                <option value="all">All channels</option>
                {AD_CHANNEL_LIST.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </>
          }
          bulkActions={(rows) => (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  const live = rows.filter((r) => r.status === "active");
                  live.forEach((r) => campaignStore.update(r.id, { status: "paused" }));
                  toast.success(`${live.length} campaign${live.length === 1 ? "" : "s"} paused`);
                }}
              >
                Pause
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                onClick={() => {
                  rows.forEach((r) => campaignStore.update(r.id, { status: "active" }));
                  toast.success(`${rows.length} campaign${rows.length === 1 ? "" : "s"} resumed`);
                }}
              >
                Resume
              </Button>
            </>
          )}
        />
      )}

      {tab === "promotions" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {COUPONS.map((c) => {
            const usage = c.maxUses ? (c.uses / c.maxUses) * 100 : 0;
            return (
              <Card key={c.id}>
                <CardHeader className="flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Ticket className="size-4 text-primary" />
                      <span className="font-mono">{c.code}</span>
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{c.description}</p>
                  </div>
                  <StatusPill
                    label={c.status}
                    variant={
                      c.status === "active" ? "success" : c.status === "paused" ? "warning" : "secondary"
                    }
                    className="capitalize"
                  />
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-lg font-semibold tabular-nums">
                        {formatCurrency(c.revenue, { compact: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">revenue driven</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold tabular-nums text-danger">
                        −{formatCurrency(c.discountGiven, { compact: true })}
                      </p>
                      <p className="text-xs text-muted-foreground">discount given</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {formatNumber(c.uses)} of {formatNumber(c.maxUses)} redeemed
                      </span>
                      <span className="font-medium tabular-nums">{Math.round(usage)}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary to-chart-6"
                        style={{ width: `${Math.min(100, usage)}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      {c.status === "expired" ? "Expired" : "Expires"} {formatDate(c.expiresAt)}
                    </span>
                    <button
                      className="font-medium text-primary hover:underline"
                      onClick={() => {
                        void navigator.clipboard?.writeText(c.code);
                        toast.success(`Copied ${c.code}`);
                      }}
                    >
                      Copy code
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {tab === "audiences" && (
        <Card>
          <CardHeader>
            <CardTitle>Audiences</CardTitle>
            <p className="text-sm text-muted-foreground">
              Segments synced to your ad platforms
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {AUDIENCES.map((a) => (
              <div
                key={a.id}
                className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.source}</p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">{formatNumber(a.size)}</p>
                    <p className="text-xs text-muted-foreground">people</p>
                  </div>
                  <span
                    className={cn(
                      "w-14 rounded-full px-1.5 py-0.5 text-center text-xs font-medium tabular-nums",
                      a.growth >= 0 ? "bg-success/12 text-success" : "bg-danger/12 text-danger"
                    )}
                  >
                    {a.growth > 0 ? "+" : ""}
                    {a.growth}%
                  </span>
                  <div className="flex items-center gap-1">
                    {a.syncedTo.map((id) => (
                      <span
                        key={id}
                        title={AD_CHANNELS[id].name}
                        className="flex size-6 items-center justify-center rounded-md text-[9px] font-bold text-white"
                        style={{ background: AD_CHANNELS[id].color }}
                      >
                        {AD_CHANNELS[id].short}
                      </span>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toast.success(`"${a.name}" re-synced to ${a.syncedTo.length} platforms`)}
                  >
                    Sync
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <CreateCampaignDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(c) => {
          campaignStore.add(c);
          setCreateOpen(false);
          setTab("campaigns");
          toast.success(`"${c.name}" created`, {
            description: `${formatCurrency(c.budget)} budget on ${AD_CHANNELS[c.channel].name}.`,
          });
        }}
      />
    </div>
  );
}

function CreateCampaignDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreate: (c: Campaign) => void;
}) {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<AdChannelId>("google");
  const [objective, setObjective] = useState<CampaignObjective>("conversion");
  const [budget, setBudget] = useState("");
  const [audience, setAudience] = useState("");
  const [launch, setLaunch] = useState<"active" | "scheduled">("active");

  const valid = name.trim().length > 2 && Number(budget) > 0;

  function reset() {
    setName("");
    setChannel("google");
    setObjective("conversion");
    setBudget("");
    setAudience("");
    setLaunch("active");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New campaign</DialogTitle>
          <DialogDescription>
            A new campaign starts with zero spend — metrics fill in as it runs.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="c-name" className="text-sm font-medium">Campaign name</label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Festive Electronics Push"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="c-chan" className="text-sm font-medium">Channel</label>
              <Select
                id="c-chan"
                value={channel}
                onChange={(e) => setChannel(e.target.value as AdChannelId)}
              >
                {AD_CHANNEL_LIST.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="c-obj" className="text-sm font-medium">Objective</label>
              <Select
                id="c-obj"
                value={objective}
                onChange={(e) => setObjective(e.target.value as CampaignObjective)}
              >
                <option value="conversion">Conversion</option>
                <option value="acquisition">Acquisition</option>
                <option value="retention">Retention</option>
                <option value="awareness">Awareness</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="c-budget" className="text-sm font-medium">Budget (USD)</label>
              <Input
                id="c-budget"
                type="number"
                min={0}
                step="100"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                placeholder="5000"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="c-launch" className="text-sm font-medium">Launch</label>
              <Select
                id="c-launch"
                value={launch}
                onChange={(e) => setLaunch(e.target.value as "active" | "scheduled")}
              >
                <option value="active">Start immediately</option>
                <option value="scheduled">Schedule for later</option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="c-aud" className="text-sm font-medium">Audience</label>
            <Input
              id="c-aud"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Cart abandoners (7d)"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() =>
              onCreate({
                id: `camp_${Date.now()}`,
                name: name.trim(),
                channel,
                objective,
                status: launch,
                budget: Math.round(Number(budget)),
                spend: 0,
                impressions: 0,
                clicks: 0,
                orders: 0,
                revenue: 0,
                startAt: REF_NOW,
                endAt: new Date(+new Date(REF_NOW) + 30 * 86400000).toISOString(),
                audience: audience.trim() || "Broad",
              })
            }
          >
            <Megaphone /> Create campaign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
