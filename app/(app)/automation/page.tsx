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
  Workflow,
  Zap,
  Clock,
  CircleCheck,
  Plus,
  Play,
  ArrowRight,
  ShoppingCart,
  Boxes,
  Tag,
  Package,
  Users,
  Wallet,
  Sparkles,
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
import { Switch } from "@/components/ui/switch";
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
import { formatNumber, relativeTime } from "@/lib/format";
import {
  automationSummary,
  RULE_CATEGORY_META,
  RULE_TEMPLATES,
  RUN_STATUS_META,
  RUN_SERIES,
  type Rule,
  type RuleCategory,
  type RuleRun,
  type RuleTemplate,
} from "@/lib/mock/automation";
import { ruleStore, ruleRunStore, useEntityList } from "@/lib/mock/store";

const REF_NOW = "2026-07-23T14:30:00Z";

/** Data keeps icons as strings; the mapping to components lives here. */
const CATEGORY_ICONS: Record<string, React.ElementType> = {
  cart: ShoppingCart,
  boxes: Boxes,
  tag: Tag,
  package: Package,
  users: Users,
  wallet: Wallet,
};

type Tab = "rules" | "templates" | "history";

export default function AutomationPage() {
  const rules = useEntityList(ruleStore);
  const runs = useEntityList(ruleRunStore);
  const [tab, setTab] = useState<Tab>("rules");
  const [category, setCategory] = useState<RuleCategory | "all">("all");
  const [preview, setPreview] = useState<RuleTemplate | null>(null);

  const summary = useMemo(() => automationSummary(rules, runs), [rules, runs]);
  const filtered = useMemo(
    () => (category === "all" ? rules : rules.filter((r) => r.category === category)),
    [rules, category]
  );

  function toggle(rule: Rule) {
    ruleStore.update(rule.id, { enabled: !rule.enabled });
    toast.success(`${rule.name} ${rule.enabled ? "disabled" : "enabled"}`, {
      description: rule.enabled
        ? "It will stop firing until you turn it back on."
        : `Next run on: ${rule.trigger.toLowerCase()}.`,
    });
  }

  /** "Run now" executes the rule once and writes a real entry to the log. */
  function runNow(rule: Rule) {
    const affected = 1 + Math.floor(Math.random() * 24);
    const run: RuleRun = {
      id: `run_manual_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      at: REF_NOW,
      status: "success",
      detail: `${rule.actions[0]} · ${affected} record${affected === 1 ? "" : "s"} (manual run)`,
      durationMs: 200 + Math.floor(Math.random() * 2400),
      affected,
    };
    ruleRunStore.add(run);
    ruleStore.update(rule.id, (prev) => ({
      ...prev,
      runs: prev.runs + 1,
      lastRunAt: REF_NOW,
    }));
    toast.success(`${rule.name} ran`, {
      description: `${affected} record${affected === 1 ? "" : "s"} affected in ${run.durationMs}ms.`,
    });
  }

  function createFromTemplate(t: RuleTemplate) {
    const rule: Rule = {
      id: `rule_${Date.now()}`,
      name: t.name,
      description: t.description,
      category: t.category,
      trigger: t.trigger,
      conditions: t.conditions,
      actions: t.actions,
      enabled: true,
      runs: 0,
      successRate: 100,
      lastRunAt: REF_NOW,
      minutesPerRun: t.minutesPerRun,
    };
    ruleStore.add(rule);
    setPreview(null);
    setTab("rules");
    toast.success(`"${t.name}" is live`, {
      description: `Triggers on: ${t.trigger.toLowerCase()}.`,
    });
  }

  const runColumns: ColumnDef<RuleRun, unknown>[] = [
    {
      accessorKey: "at",
      header: "When",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{relativeTime(row.original.at)}</span>
      ),
    },
    {
      accessorKey: "ruleName",
      header: "Rule",
      cell: ({ row }) => <span className="font-medium">{row.original.ruleName}</span>,
    },
    {
      accessorKey: "detail",
      header: "Result",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.detail}</span>
      ),
    },
    {
      accessorKey: "affected",
      header: "Records",
      cell: ({ row }) => (
        <span className="tabular-nums">
          {row.original.affected || <span className="text-muted-foreground">—</span>}
        </span>
      ),
    },
    {
      accessorKey: "durationMs",
      header: "Duration",
      cell: ({ row }) => (
        <span className="tabular-nums text-muted-foreground">
          {row.original.durationMs}ms
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const meta = RUN_STATUS_META[row.original.status];
        return <StatusPill label={meta.label} variant={meta.variant} />;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation"
        description="Rules that run the shop while you sleep — trigger, conditions, actions."
        actions={
          <Button size="sm" onClick={() => setTab("templates")}>
            <Plus /> New rule
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Workflow}
          label="Active rules"
          value={formatNumber(summary.activeRules)}
          sub={`of ${summary.totalRules} configured`}
        />
        <StatCard
          icon={Zap}
          label="Runs today"
          value={formatNumber(summary.runsToday)}
          sub={
            summary.failuresToday
              ? `${summary.failuresToday} failed`
              : "no failures"
          }
          accent={summary.failuresToday ? "text-warning" : undefined}
        />
        <StatCard
          icon={Clock}
          label="Hours saved"
          value={formatNumber(summary.hoursSaved)}
          sub={`across ${formatNumber(summary.totalRuns)} runs`}
          accent="text-success"
          delta={14.2}
        />
        <StatCard
          icon={CircleCheck}
          label="Success rate"
          value={`${summary.successRate}%`}
          sub="last 30 days"
          delta={0.8}
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="rules">
            Rules
            <span className="ml-1.5 rounded-full bg-secondary px-1.5 text-[10px] tabular-nums">
              {rules.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="history">Run history</TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === "rules" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={category}
              onChange={(e) => setCategory(e.target.value as RuleCategory | "all")}
              className="w-auto"
            >
              <option value="all">All categories</option>
              {Object.entries(RULE_CATEGORY_META).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </Select>
            <span className="text-sm text-muted-foreground">
              {filtered.filter((r) => r.enabled).length} of {filtered.length} enabled
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {filtered.map((rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                onToggle={() => toggle(rule)}
                onRun={() => runNow(rule)}
              />
            ))}
          </div>
        </div>
      )}

      {tab === "templates" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card p-4">
            <Sparkles className="size-4 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Start from a proven recipe. Every template is editable once it&apos;s live.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {RULE_TEMPLATES.map((t) => {
              const meta = RULE_CATEGORY_META[t.category];
              const Icon = CATEGORY_ICONS[meta.icon] ?? Workflow;
              return (
                <Card
                  key={t.id}
                  className="flex cursor-pointer flex-col transition-all hover:border-primary/30 hover:shadow-md"
                  onClick={() => setPreview(t)}
                >
                  <CardHeader className="flex-row items-start justify-between">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
                    >
                      <Icon className="size-4" style={{ color: meta.color }} />
                    </span>
                    {t.popular && <Badge variant="default">Popular</Badge>}
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>
                    </div>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="text-xs text-muted-foreground">
                        ~{t.minutesPerRun} min saved per run
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        Use <ArrowRight className="size-3" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Automation activity</CardTitle>
              <p className="text-sm text-muted-foreground">Runs per day, last 14 days</p>
            </CardHeader>
            <CardContent>
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={RUN_SERIES} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
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
                      width={40}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      content={<ChartTooltip format="number" />}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="success" name="Success" stackId="r" fill="var(--chart-2)" maxBarSize={24} />
                    <Bar dataKey="failed" name="Failed" stackId="r" fill="var(--chart-4)" radius={[4, 4, 0, 0]} maxBarSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <DataTable
            columns={runColumns}
            data={runs}
            searchKey="ruleName"
            searchPlaceholder="Search rule, result…"
            exportName="automation-runs"
            pageSize={12}
          />
        </div>
      )}

      <TemplatePreview
        template={preview}
        onClose={() => setPreview(null)}
        onUse={createFromTemplate}
      />
    </div>
  );
}

function RuleCard({
  rule,
  onToggle,
  onRun,
}: {
  rule: Rule;
  onToggle: () => void;
  onRun: () => void;
}) {
  const meta = RULE_CATEGORY_META[rule.category];
  const Icon = CATEGORY_ICONS[meta.icon] ?? Workflow;

  return (
    <Card className={cn("transition-opacity", !rule.enabled && "opacity-70")}>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in oklab, ${meta.color} 14%, transparent)` }}
          >
            <Icon className="size-4" style={{ color: meta.color }} />
          </span>
          <div className="min-w-0">
            <CardTitle className="truncate">{rule.name}</CardTitle>
            <p className="mt-0.5 text-sm text-muted-foreground">{rule.description}</p>
          </div>
        </div>
        <Switch checked={rule.enabled} onCheckedChange={onToggle} />
      </CardHeader>

      <CardContent className="space-y-3">
        {/* trigger → conditions → actions, in the order they execute */}
        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
          <Step label="When" tone="text-primary" items={[rule.trigger]} />
          {rule.conditions.length > 0 && (
            <Step label="And" tone="text-warning" items={rule.conditions} />
          )}
          <Step label="Then" tone="text-success" items={rule.actions} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>
            {formatNumber(rule.runs)} runs · {rule.successRate}% success · last{" "}
            {relativeTime(rule.lastRunAt)}
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={onRun}>
            <Play /> Run now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Step({
  label,
  items,
  tone,
}: {
  label: string;
  items: string[];
  tone: string;
}) {
  return (
    <div className="flex gap-2 text-sm">
      <span className={cn("w-10 shrink-0 text-xs font-semibold uppercase tracking-wide", tone)}>
        {label}
      </span>
      <div className="min-w-0 flex-1 space-y-0.5">
        {items.map((item) => (
          <p key={item} className="truncate">
            {item}
          </p>
        ))}
      </div>
    </div>
  );
}

function TemplatePreview({
  template,
  onClose,
  onUse,
}: {
  template: RuleTemplate | null;
  onClose: () => void;
  onUse: (t: RuleTemplate) => void;
}) {
  return (
    <Dialog open={template !== null} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        {template && (
          <>
            <DialogHeader>
              <DialogTitle>{template.name}</DialogTitle>
              <DialogDescription>{template.description}</DialogDescription>
            </DialogHeader>

            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
              <Step label="When" tone="text-primary" items={[template.trigger]} />
              {template.conditions.length > 0 && (
                <Step label="And" tone="text-warning" items={template.conditions} />
              )}
              <Step label="Then" tone="text-success" items={template.actions} />
            </div>

            <p className="text-sm text-muted-foreground">
              Saves roughly{" "}
              <span className="font-medium text-foreground">
                {template.minutesPerRun} minutes
              </span>{" "}
              of manual work each time it fires. It goes live enabled — you can pause it
              at any point.
            </p>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={() => onUse(template)}>
                <Zap /> Enable rule
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
