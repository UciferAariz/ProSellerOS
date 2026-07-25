"use client";

import { useEffect, useRef, useState } from "react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Sparkles,
  ArrowUp,
  ArrowDownRight,
  TrendingDown,
  Package,
  DollarSign,
  Tag,
  FileText,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChartTooltip } from "@/components/app/chart-tooltip";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import {
  answer,
  AssistantWidget,
  SUGGESTED_PROMPTS,
} from "@/lib/mock/assistant";

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  widget?: AssistantWidget;
  followups?: string[];
}

// Mirrors the NDJSON events emitted by /api/assistant.
type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "reset" }
  | { type: "widget"; widget: AssistantWidget }
  | { type: "done"; followups?: string[]; source?: string };

let idc = 1;

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      text: "Hi Alex 👋 I'm your ProSellerOS copilot. I can analyze sales, forecast inventory, find pricing opportunities, and generate listings across all your channels. What would you like to know?",
      followups: SUGGESTED_PROMPTS.slice(0, 3),
    },
  ]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [sessionId, setSessionId] = useState("web-demo");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, thinking]);

  // Stable per-browser session id so the copilot's CockroachDB memory persists
  // across reloads (falls back to a shared id if storage is unavailable).
  useEffect(() => {
    try {
      let sid = localStorage.getItem("pso_session");
      if (!sid) {
        sid = `web-${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem("pso_session", sid);
      }
      setSessionId(sid);
    } catch {
      /* keep default */
    }
  }, []);

  async function send(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: idc++, role: "user", text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, sessionId }),
      });
      if (!res.ok || !res.body) throw new Error(`assistant ${res.status}`);
      await consumeStream(res.body);
    } catch {
      // Backend unreachable — fall back to the local mock (demo-safe).
      const reply = answer(text);
      setThinking(false);
      setMessages((m) => [
        ...m,
        { id: idc++, role: "assistant", text: reply.text, widget: reply.widget, followups: reply.followups },
      ]);
    }
  }

  // Read the NDJSON event stream and progressively build one assistant message.
  async function consumeStream(body: ReadableStream<Uint8Array>) {
    const assistantId = idc++;
    let started = false;
    // Append the (empty) assistant bubble exactly once, on the first event.
    const ensureStarted = () => {
      if (started) return;
      started = true;
      setThinking(false);
      setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
    };
    const patch = (fn: (m: Message) => Message) => {
      ensureStarted();
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
    };

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const handle = (line: string) => {
      if (!line.trim()) return;
      let ev: StreamEvent;
      try {
        ev = JSON.parse(line) as StreamEvent;
      } catch {
        return;
      }
      switch (ev.type) {
        case "text":
          patch((m) => ({ ...m, text: m.text + ev.delta }));
          break;
        case "reset":
          patch((m) => ({ ...m, text: "" }));
          break;
        case "widget":
          patch((m) => ({ ...m, widget: ev.widget }));
          break;
        case "done":
          patch((m) => ({ ...m, followups: ev.followups }));
          break;
      }
    };

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf("\n")) >= 0) {
        handle(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    }
    if (buf) handle(buf);
    if (!started) setThinking(false); // empty stream — clear the indicator
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4">
        <span className="flex size-9 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-6">
          <Sparkles className="size-5 text-white" />
        </span>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">
            Powered by your live commerce data · Beta
          </p>
        </div>
        <Badge variant="success" className="ml-auto">
          <span className="size-1.5 rounded-full bg-success pulse-dot" /> Online
        </Badge>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto pb-4 pr-1">
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} onFollowup={send} />
        ))}
        {thinking && <Thinking />}
      </div>

      {/* Composer */}
      <div className="pt-2">
        {messages.length <= 1 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => send(p)}
                className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex items-center gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about sales, inventory, pricing…"
            className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon-sm" disabled={!input.trim()}>
            <ArrowUp />
          </Button>
        </form>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          ProSellerOS AI can make mistakes. Verify important actions.
        </p>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onFollowup,
}: {
  message: Message;
  onFollowup: (t: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <BrandMark className="size-7" />
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed">
          {message.text}
        </div>
        {message.widget && <WidgetRenderer widget={message.widget} />}
        {message.followups && (
          <div className="flex flex-wrap gap-2">
            {message.followups.map((f) => (
              <button
                key={f}
                onClick={() => onFollowup(f)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                {f}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <BrandMark className="size-7" />
      </span>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}

function WidgetRenderer({ widget }: { widget: AssistantWidget }) {
  if (widget.kind === "falling-products") {
    return (
      <Panel icon={TrendingDown} title="Declining products" accent="text-danger">
        <div className="space-y-2">
          {widget.items.map((p) => (
            <div key={p.name} className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-sm">{p.name}</span>
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCurrency(p.revenue, { compact: true })}
              </span>
              <span className="flex w-16 items-center justify-end gap-0.5 text-xs font-medium text-danger tabular-nums">
                <ArrowDownRight className="size-3" />
                {Math.abs(p.trend)}%
              </span>
            </div>
          ))}
        </div>
      </Panel>
    );
  }

  if (widget.kind === "forecast") {
    return (
      <Panel icon={Package} title={`Inventory forecast · ${widget.sku}`} accent="text-info">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={widget.series} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={30} />
              <Tooltip content={<ChartTooltip format="number" />} />
              <Bar dataKey="actual" name="Actual" fill="var(--chart-5)" radius={[3, 3, 0, 0]} maxBarSize={26} />
              <Line dataKey="forecast" name="Forecast" stroke="var(--warning)" strokeWidth={2} strokeDasharray="4 4" dot={{ r: 3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 flex items-center justify-between rounded-lg bg-warning/10 px-3 py-2 text-xs">
          <span className="font-medium text-warning">⚠ Safety stock breach in ~18 days</span>
          <Button size="sm" className="h-6 text-xs" onClick={() => toast.success("Purchase order drafted")}>
            Create PO
          </Button>
        </div>
      </Panel>
    );
  }

  if (widget.kind === "profit") {
    return (
      <Panel icon={DollarSign} title="Profit breakdown" accent="text-success">
        <div className="mb-3 flex items-end gap-3">
          <span className="text-2xl font-semibold tabular-nums">
            {formatCurrency(widget.total, { compact: true })}
          </span>
          <span className="mb-1 text-xs text-muted-foreground">{widget.margin}% margin</span>
        </div>
        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={widget.breakdown} layout="vertical" margin={{ left: 0, right: 12 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickLine={false} axisLine={false} width={72} />
              <Tooltip content={<ChartTooltip format="currency" />} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
                {widget.breakdown.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    );
  }

  if (widget.kind === "pricing") {
    return (
      <Panel icon={Tag} title="Pricing opportunities" accent="text-primary">
        <div className="space-y-2">
          {widget.items.map((p) => (
            <div key={p.name} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              <span className="text-muted-foreground tabular-nums line-through">
                {formatCurrency(p.current, { decimals: 2 })}
              </span>
              <span className="font-medium tabular-nums">→ {formatCurrency(p.suggested, { decimals: 2 })}</span>
              <span className="w-16 text-right text-xs font-medium text-success tabular-nums">
                +{formatCurrency(p.uplift, { compact: true })}
              </span>
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-3 w-full" onClick={() => toast.success("Applied suggested prices to all channels")}>
          <Check /> Apply all
        </Button>
      </Panel>
    );
  }

  if (widget.kind === "listing") {
    return (
      <Panel icon={FileText} title="Generated listing" accent="text-chart-6">
        <p className="text-sm font-semibold">{widget.title}</p>
        <ul className="mt-2 space-y-1.5">
          {widget.bullets.map((b) => (
            <li key={b} className="flex gap-2 text-xs text-muted-foreground">
              <Check className="mt-0.5 size-3 shrink-0 text-success" />
              {b}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {widget.keywords.map((k) => (
            <Badge key={k} variant="secondary" className="capitalize">
              {k}
            </Badge>
          ))}
        </div>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3 w-full"
          onClick={() => toast.success("Listing copied to clipboard")}
        >
          <Copy /> Copy listing
        </Button>
      </Panel>
    );
  }

  return null;
}

function Panel({
  icon: Icon,
  title,
  accent,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Icon className={cn("size-4", accent)} />
        <span className="text-sm font-medium">{title}</span>
      </div>
      {children}
    </div>
  );
}
