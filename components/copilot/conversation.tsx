"use client";

/**
 * The conversation itself — transcript, action receipts, and composer.
 *
 * Rendered identically by the docked panel, the floating window, and the
 * full-page /assistant view; only `variant` differs, which tunes spacing rather
 * than behaviour. All three read the same provider state, so a thread started in
 * the floating window is the same thread the page shows.
 */
import { useEffect, useRef } from "react";
import {
  ArrowUp,
  Check,
  Compass,
  Download,
  Package,
  Palette,
  Plus,
  Printer,
  ShoppingCart,
  Tag,
  Undo2,
} from "lucide-react";
import { BrandMark } from "@/components/brand";
import { Button } from "@/components/ui/button";
import {
  useCopilot,
  type CopilotMessage,
} from "@/components/copilot/copilot-provider";
import { WidgetRenderer } from "@/components/copilot/widget-renderer";
import { actionLabel, type ClientAction } from "@/lib/agent/actions";
import { SUGGESTED_PROMPTS } from "@/lib/mock/assistant";
import { cn } from "@/lib/utils";

type Variant = "panel" | "page";

const ACTION_ICONS: Record<ClientAction["kind"], React.ElementType> = {
  navigate: Compass,
  order_status: ShoppingCart,
  labels: Printer,
  export: Download,
  create_order: Plus,
  price_change: Tag,
  restock: Package,
  theme: Palette,
};

export function CopilotConversation({ variant = "page" }: { variant?: Variant }) {
  const { messages, thinking, send } = useCopilot();
  const scrollRef = useRef<HTMLDivElement>(null);
  const panel = variant === "panel";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  return (
    <>
      <div
        ref={scrollRef}
        className={cn(
          "flex-1 overflow-y-auto",
          panel ? "space-y-4 px-3 py-4" : "space-y-5 pb-4 pr-1",
        )}
      >
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} variant={variant} onFollowup={send} />
        ))}
        {thinking && <Thinking />}
      </div>
      <Composer variant={variant} />
    </>
  );
}

function MessageBubble({
  message,
  variant,
  onFollowup,
}: {
  message: CopilotMessage;
  variant: Variant;
  onFollowup: (text: string) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center">
        <BrandMark className="size-7" />
      </span>
      <div className="min-w-0 flex-1 space-y-2.5">
        {message.text && (
          <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-3.5 py-2.5 text-sm leading-relaxed">
            {message.text}
          </div>
        )}
        {message.actions?.map((action, i) => (
          <ActionReceipt key={i} action={action} />
        ))}
        {message.widget && <WidgetRenderer widget={message.widget} />}
        {message.followups && (
          <div className="flex flex-wrap gap-1.5">
            {message.followups.map((f) => (
              <button
                key={f}
                onClick={() => onFollowup(f)}
                className={cn(
                  "rounded-full border border-border bg-background px-3 py-1 text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                  variant === "panel" ? "text-[11px]" : "text-xs",
                )}
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

/**
 * Proof of work: what the copilot actually changed, with a way back out of it.
 * Undo is offered where a clean inverse exists — right now that's order state,
 * which is the action most likely to be fired at the wrong batch.
 */
function ActionReceipt({ action }: { action: ClientAction }) {
  const { undoOrderStatus } = useCopilot();
  const Icon = ACTION_ICONS[action.kind];

  return (
    <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs">
      <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-success/15">
        <Check className="size-2.5 text-success" />
      </span>
      <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate font-medium">{actionLabel(action)}</span>
      {action.kind === "order_status" && (
        <button
          onClick={() => undoOrderStatus(action.orders)}
          className="flex shrink-0 items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Undo2 className="size-3" /> Undo
        </button>
      )}
    </div>
  );
}

function Thinking() {
  return (
    <div className="flex gap-2.5">
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

function Composer({ variant }: { variant: Variant }) {
  const { messages, send, thinking } = useCopilot();
  const ref = useRef<HTMLTextAreaElement>(null);
  const panel = variant === "panel";

  const submit = () => {
    const el = ref.current;
    if (!el?.value.trim()) return;
    send(el.value);
    el.value = "";
    el.style.height = "auto";
  };

  return (
    <div className={cn(panel ? "border-t border-border p-3" : "pt-2")}>
      {messages.length <= 1 && (
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {SUGGESTED_PROMPTS.slice(0, panel ? 4 : 6).map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              className={cn(
                "rounded-full border border-border bg-card px-3 py-1.5 font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground",
                panel ? "text-[11px]" : "text-xs",
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2 rounded-xl border border-border bg-card p-2 shadow-sm focus-within:border-ring focus-within:ring-2 focus-within:ring-ring"
      >
        <textarea
          ref={ref}
          rows={1}
          placeholder="Tell me what to do…"
          className="max-h-32 flex-1 resize-none bg-transparent px-1.5 py-1 text-sm outline-none placeholder:text-muted-foreground"
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
          }}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a newline, so multi-step instructions
            // can be written out in full.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button type="submit" size="icon-sm" disabled={thinking}>
          <ArrowUp />
        </Button>
      </form>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        The copilot can change your data. Actions show a receipt you can undo.
      </p>
    </div>
  );
}
