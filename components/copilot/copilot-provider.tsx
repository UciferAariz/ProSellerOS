"use client";

/**
 * The copilot's home in the browser: one conversation, shared by the docked
 * panel, the floating window, and the full-page /assistant view.
 *
 * Two responsibilities:
 *
 *   Working memory. The transcript lives in this provider's React state and is
 *   replayed to the model on every turn. Because the provider is mounted by the
 *   app layout, the conversation follows the operator across routes and survives
 *   closing the panel — and because it is only ever in memory, closing the
 *   window (or hitting New chat) resets the copilot completely. Nothing to
 *   clean up, which is what the demo wants.
 *
 *   Hands. Tools that change something stream back a `ClientAction`; `apply()`
 *   is the single place those touch the real OS surface — the router, the order
 *   and product stores, downloads, the theme. Actions run the moment they
 *   arrive, so navigation and downloads happen while the answer is still
 *   streaming.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import type { ClientAction, TouchedOrder } from "@/lib/agent/actions";
import { actionLabel } from "@/lib/agent/actions";
import { downloadLabelSheet } from "@/lib/copilot/labels";
import { exportToCsv } from "@/lib/format";
import {
  answer,
  SUGGESTED_PROMPTS,
  type AssistantWidget,
} from "@/lib/mock/assistant";
import { ORDER_STATUS_META, type Order, type OrderStatus } from "@/lib/mock/orders";
import { orderStore, productStore } from "@/lib/mock/store";

export interface CopilotMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
  widget?: AssistantWidget;
  actions?: ClientAction[];
  followups?: string[];
}

/** How the panel is presented. Minimized keeps the conversation, just hidden. */
export type CopilotMode = "dock" | "float";

interface CopilotContextValue {
  messages: CopilotMessage[];
  thinking: boolean;
  open: boolean;
  mode: CopilotMode;
  setOpen: (open: boolean) => void;
  setMode: (mode: CopilotMode) => void;
  toggle: () => void;
  send: (text: string) => void;
  reset: () => void;
  /** Roll an `order_status` action back, in the UI and in the database. */
  undoOrderStatus: (orders: TouchedOrder[]) => void;
}

const CopilotContext = createContext<CopilotContextValue | null>(null);

const GREETING: CopilotMessage = {
  id: 0,
  role: "assistant",
  text:
    "Hi Alex 👋 I'm your ProSellerOS copilot — I work the portal with you. Ask me " +
    "anything about your business, or just tell me what to do: accept orders, print " +
    "labels, re-price a SKU, export a report, or pull up any screen.",
  followups: SUGGESTED_PROMPTS.slice(0, 3),
};

// Mirrors the NDJSON events emitted by /api/assistant.
type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "reset" }
  | { type: "widget"; widget: AssistantWidget }
  | { type: "action"; action: ClientAction }
  | { type: "done"; followups?: string[]; source?: string };

let nextId = 1;

export function CopilotProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { setTheme } = useTheme();

  // `messagesRef` shadows the state so `send` can read the transcript it needs
  // to replay without waiting for a re-render.
  const [messages, setMessagesState] = useState<CopilotMessage[]>([GREETING]);
  const messagesRef = useRef(messages);
  const setMessages = useCallback(
    (update: (prev: CopilotMessage[]) => CopilotMessage[]) => {
      messagesRef.current = update(messagesRef.current);
      setMessagesState(messagesRef.current);
    },
    [],
  );

  const [thinking, setThinking] = useState(false);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<CopilotMode>("dock");
  const busy = useRef(false);
  const sessionId = useRef("");

  /** One session id per window, minted lazily and rotated by `reset`. */
  const ensureSession = () => {
    if (!sessionId.current) {
      sessionId.current = `win-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    }
    return sessionId.current;
  };

  // ── Actions ───────────────────────────────────────────────────────────────

  const applyOrderStatus = useCallback(
    (orders: TouchedOrder[], status: OrderStatus, courier?: string) => {
      const at = new Date().toISOString();
      const assigned =
        courier ?? (status === "packed" || status === "shipped" ? "Shiprocket" : undefined);
      for (const touched of orders) {
        orderStore.update(touched.id, (prev) => ({
          ...prev,
          status,
          courier: prev.courier === "—" && assigned ? assigned : prev.courier,
          timeline: [
            ...prev.timeline,
            { label: ORDER_STATUS_META[status].label, at, done: true },
          ],
        }));
      }
    },
    [],
  );

  const apply = useCallback(
    (action: ClientAction) => {
      switch (action.kind) {
        case "navigate":
          router.push(action.path);
          break;

        case "order_status":
          applyOrderStatus(action.orders, action.status, action.courier);
          break;

        case "labels": {
          // A printed label is what assigns courier and tracking.
          const at = new Date().toISOString();
          for (const label of action.orders) {
            orderStore.update(label.id, (prev) => ({
              ...prev,
              courier: label.courier,
              tracking: label.tracking,
              timeline:
                prev.timeline.some((e) => e.label === "Label printed")
                  ? prev.timeline
                  : [...prev.timeline, { label: "Label printed", at, done: true }],
            }));
          }
          downloadLabelSheet(action.orders);
          break;
        }

        case "export":
          exportToCsv(action.filename, action.rows);
          break;

        case "create_order": {
          const { order } = action;
          const at = new Date().toISOString();
          const record: Order = {
            ...order,
            email: `${order.customer.split(" ")[0].toLowerCase()}@example.com`,
            status: "pending",
            courier: "—",
            tracking: "—",
            items: [
              {
                productId: "manual",
                name: "Manual order line",
                sku: "MANUAL",
                qty: 1,
                price: order.total,
                image: "linear-gradient(135deg,#6366f1,#a855f7)",
              },
            ],
            itemCount: 1,
            placedAt: at,
            sla: at,
            flagged: false,
            timeline: [{ label: "Order placed", at, done: true }],
          };
          orderStore.add(record);
          break;
        }

        case "price_change":
          for (const update of action.updates) {
            productStore.update(update.id, (prev) => ({
              ...prev,
              price: update.to,
              margin: +(((update.to - prev.cost) / update.to) * 100).toFixed(1),
              listings: prev.listings.map((l) => ({ ...l, price: update.to })),
            }));
          }
          break;

        case "restock":
          productStore.update(action.id, (prev) => ({
            ...prev,
            stock: action.to,
            status: action.to > 0 && prev.status === "draft" ? "active" : prev.status,
          }));
          break;

        case "theme":
          setTheme(action.mode);
          break;
      }
      toast.success(actionLabel(action));
    },
    [applyOrderStatus, router, setTheme],
  );

  const undoOrderStatus = useCallback(
    (orders: TouchedOrder[]) => {
      // Each order goes back to its own prior state, so a mixed batch unwinds
      // correctly rather than collapsing onto one status.
      const at = new Date().toISOString();
      for (const touched of orders) {
        orderStore.update(touched.id, (prev) => ({
          ...prev,
          status: touched.from,
          timeline: [
            ...prev.timeline,
            { label: `Reverted to ${ORDER_STATUS_META[touched.from].label}`, at, done: true },
          ],
        }));
      }
      void fetch("/api/orders/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: orders.map((o) => ({ number: o.number, status: o.from })),
        }),
      }).catch(() => {
        /* the UI is already reverted; the DB write is best-effort */
      });
      toast.success(`Reverted ${orders.length} order${orders.length === 1 ? "" : "s"}`);
    },
    [],
  );

  // ── Turn handling ─────────────────────────────────────────────────────────

  const consumeStream = useCallback(
    async (body: ReadableStream<Uint8Array>) => {
      const assistantId = nextId++;
      let started = false;
      const ensureStarted = () => {
        if (started) return;
        started = true;
        setThinking(false);
        setMessages((prev) => [...prev, { id: assistantId, role: "assistant", text: "" }]);
      };
      const patch = (fn: (m: CopilotMessage) => CopilotMessage) => {
        ensureStarted();
        setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));
      };

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handle = (raw: string) => {
        if (!raw.trim()) return;
        let ev: StreamEvent;
        try {
          ev = JSON.parse(raw) as StreamEvent;
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
          case "action":
            patch((m) => ({ ...m, actions: [...(m.actions ?? []), ev.action] }));
            apply(ev.action);
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
    },
    [apply, setMessages],
  );

  const send = useCallback(
    async (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy.current) return;
      busy.current = true;

      // Snapshot the transcript before this turn joins it — that is the memory
      // the model replays. The greeting is dropped; it carries no information.
      const history = messagesRef.current
        .filter((m) => m.id !== 0 && m.text.trim())
        .map((m) => ({ role: m.role, text: m.text }));

      setMessages((prev) => [...prev, { id: nextId++, role: "user", text: prompt }]);
      setThinking(true);

      try {
        const res = await fetch("/api/assistant", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            sessionId: ensureSession(),
            history,
            path: pathname,
          }),
        });
        if (!res.ok || !res.body) throw new Error(`assistant ${res.status}`);
        await consumeStream(res.body);
      } catch {
        // Backend unreachable — fall back to the local mock (demo-safe).
        const reply = answer(prompt);
        setThinking(false);
        setMessages((prev) => [
          ...prev,
          {
            id: nextId++,
            role: "assistant",
            text: reply.text,
            widget: reply.widget,
            actions: reply.actions,
            followups: reply.followups,
          },
        ]);
        reply.actions?.forEach(apply);
      } finally {
        busy.current = false;
      }
    },
    [apply, consumeStream, pathname, setMessages],
  );

  const reset = useCallback(() => {
    sessionId.current = "";
    setThinking(false);
    setMessages(() => [GREETING]);
  }, [setMessages]);

  const value = useMemo<CopilotContextValue>(
    () => ({
      messages,
      thinking,
      open,
      mode,
      setOpen,
      setMode,
      toggle: () => setOpen((o) => !o),
      send,
      reset,
      undoOrderStatus,
    }),
    [messages, thinking, open, mode, send, reset, undoOrderStatus],
  );

  return <CopilotContext.Provider value={value}>{children}</CopilotContext.Provider>;
}

export function useCopilot(): CopilotContextValue {
  const ctx = useContext(CopilotContext);
  if (!ctx) {
    throw new Error("useCopilot must be used inside <CopilotProvider>");
  }
  return ctx;
}
