"use client";

/**
 * The copilot's shell: a launcher, a side dock, and a floating window.
 *
 * Mounted once by the app layout, so the copilot is reachable from every screen
 * and the conversation survives navigation. Two presentations, because the two
 * jobs are different: docked (a flex sibling, so it *reflows* the page instead of
 * covering the data being discussed) and floating (draggable and resizable, for
 * keeping it beside one specific table). On small screens both collapse to a
 * full-screen sheet.
 *
 * Suppressed on /assistant, which already renders the same thread full-width.
 */
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  GripVertical,
  Maximize2,
  PanelRight,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { CopilotConversation } from "@/components/copilot/conversation";
import { useCopilot } from "@/components/copilot/copilot-provider";
import { cn } from "@/lib/utils";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const MIN_W = 340;
const MIN_H = 360;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Floating mode needs real pixels to drag around; mobile never gets there. */
function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

export function CopilotDock() {
  const { open, setOpen, mode, setMode, reset, toggle } = useCopilot();
  const pathname = usePathname();
  const desktop = useIsDesktop();
  const [rect, setRect] = useState<Rect | null>(null);

  // Cmd/Ctrl+J anywhere in the OS.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        toggle();
      }
      if (e.key === "Escape" && mode === "float") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [toggle, setOpen, mode]);

  const floating = open && mode === "float" && desktop;

  // Place the floating window bottom-right on first use, then keep it wherever
  // the operator left it (including across dock/float toggles).
  useEffect(() => {
    if (!floating || rect) return;
    const w = 420;
    const h = Math.min(620, window.innerHeight - 96);
    setRect({ x: window.innerWidth - w - 24, y: window.innerHeight - h - 24, w, h });
  }, [floating, rect]);

  // Keep it on screen when the viewport shrinks.
  useEffect(() => {
    if (!floating) return;
    const onResize = () =>
      setRect((r) =>
        r
          ? {
              ...r,
              w: Math.min(r.w, window.innerWidth - 32),
              h: Math.min(r.h, window.innerHeight - 32),
              x: clamp(r.x, 0, Math.max(0, window.innerWidth - MIN_W)),
              y: clamp(r.y, 0, Math.max(0, window.innerHeight - 80)),
            }
          : r,
      );
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [floating]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      if (!rect || e.button !== 0) return;
      const offsetX = e.clientX - rect.x;
      const offsetY = e.clientY - rect.y;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) =>
        setRect((r) =>
          r
            ? {
                ...r,
                x: clamp(ev.clientX - offsetX, 0, Math.max(0, window.innerWidth - r.w)),
                y: clamp(ev.clientY - offsetY, 0, Math.max(0, window.innerHeight - 56)),
              }
            : r,
        );
      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    },
    [rect],
  );

  const startResize = useCallback(
    (e: React.PointerEvent) => {
      if (!rect || e.button !== 0) return;
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const startW = rect.w;
      const startH = rect.h;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const move = (ev: PointerEvent) =>
        setRect((r) =>
          r
            ? {
                ...r,
                w: clamp(startW + (ev.clientX - startX), MIN_W, window.innerWidth - r.x - 8),
                h: clamp(startH + (ev.clientY - startY), MIN_H, window.innerHeight - r.y - 8),
              }
            : r,
        );
      const up = () => {
        target.removeEventListener("pointermove", move);
        target.removeEventListener("pointerup", up);
      };
      target.addEventListener("pointermove", move);
      target.addEventListener("pointerup", up);
    },
    [rect],
  );

  if (pathname === "/assistant") return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ask the copilot (Ctrl+J)"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-gradient-to-br from-primary to-chart-6 py-3 pl-3.5 pr-4 text-sm font-medium text-white shadow-lg shadow-primary/25 transition-transform hover:scale-105 active:scale-95"
      >
        <Sparkles className="size-4" />
        Copilot
        <kbd className="hidden rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-normal text-white/80 sm:inline">
          ⌘J
        </kbd>
      </button>
    );
  }

  const header = (
    <div
      onPointerDown={floating ? startDrag : undefined}
      className={cn(
        "flex h-14 shrink-0 items-center gap-2 border-b border-border px-3",
        floating && "cursor-grab touch-none active:cursor-grabbing",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-6">
        <Sparkles className="size-4 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight">Copilot</p>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="size-1.5 rounded-full bg-success pulse-dot" />
          Remembers this window
        </p>
      </div>
      <IconButton onClick={reset} label="New chat">
        <RotateCcw className="size-4" />
      </IconButton>
      <IconButton
        onClick={() => setMode(mode === "dock" ? "float" : "dock")}
        label={mode === "dock" ? "Pop out into a window" : "Dock to the side"}
      >
        {mode === "dock" ? <Maximize2 className="size-4" /> : <PanelRight className="size-4" />}
      </IconButton>
      <IconButton onClick={() => setOpen(false)} label="Close">
        <X className="size-4" />
      </IconButton>
    </div>
  );

  if (floating) {
    return (
      <div
        style={rect ? { left: rect.x, top: rect.y, width: rect.w, height: rect.h } : undefined}
        className="fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
      >
        {header}
        <CopilotConversation variant="panel" />
        <span
          onPointerDown={startResize}
          title="Resize"
          className="absolute bottom-0 right-0 flex size-4 cursor-nwse-resize touch-none items-end justify-end p-0.5 text-muted-foreground/50"
        >
          <GripVertical className="size-3 rotate-45" />
        </span>
      </div>
    );
  }

  return (
    <aside className="fixed inset-0 z-50 flex flex-col bg-background md:static md:z-auto md:w-[400px] md:shrink-0 md:border-l md:border-border lg:w-[440px]">
      {header}
      <CopilotConversation variant="panel" />
    </aside>
  );
}

function IconButton({
  onClick,
  label,
  children,
}: {
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
    >
      {children}
    </button>
  );
}
