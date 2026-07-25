"use client";

/**
 * Full-page view of the copilot.
 *
 * Deliberately thin: the conversation, its memory, and its actions all live in
 * `CopilotProvider` (mounted by the app layout), so this page and the docked
 * panel are two windows onto one thread — start a request here, dock the panel,
 * and it is the same conversation mid-flight.
 */
import { RotateCcw, Sparkles } from "lucide-react";
import { CopilotConversation } from "@/components/copilot/conversation";
import { useCopilot } from "@/components/copilot/copilot-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AssistantPage() {
  const { reset } = useCopilot();

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <div className="flex items-center gap-3 pb-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-chart-6">
          <Sparkles className="size-5 text-white" />
        </span>
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-xs text-muted-foreground">
            Runs your storefront with you · remembers this window
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw /> New chat
          </Button>
          <Badge variant="success">
            <span className="size-1.5 rounded-full bg-success pulse-dot" /> Online
          </Badge>
        </div>
      </div>

      <CopilotConversation variant="page" />
    </div>
  );
}
