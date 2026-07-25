/**
 * The ProSellerOS copilot agent loop.
 *
 * Flow per turn:
 *   1. Embed the user prompt and persist it to agent_memory.
 *   2. Recall semantically-similar past turns + recent session turns (CockroachDB).
 *   3. Run a tool-use loop over real SQL analytics tools, on whichever LLM
 *      provider `lib/ai/provider.ts` selects (Bedrock or Gemini).
 *   4. Capture any UI widget a tool produced.
 *   5. Persist the assistant answer to agent_memory (embedded), and return.
 *
 * Returns the exact AssistantReply shape the existing UI already renders.
 */
import {
  converse,
  converseStream,
  embed,
  type Message,
  type Tool,
} from "@/lib/ai/provider";
import { query } from "@/lib/db/client";
import { saveTurn, recallMemory, getRecentTurns } from "@/lib/agent/memory";
import {
  decliningProducts,
  inventoryForecast,
  profitSummary,
  pricingOpportunities,
  semanticSearch,
  generateListing,
  type ToolResult,
} from "@/lib/agent/tools";
import type { AssistantReply, AssistantWidget } from "@/lib/mock/assistant";

const TOOLS: Tool[] = [
  {
    toolSpec: {
      name: "declining_products",
      description: "List products whose 30-day sales are trending down. Use for sales-drop / declining / falling questions.",
      inputSchema: { json: { type: "object", properties: {} } },
    },
  },
  {
    toolSpec: {
      name: "inventory_forecast",
      description: "Forecast inventory / stock-out risk for a product. Use for inventory, stock, restock, forecast questions.",
      inputSchema: {
        json: {
          type: "object",
          properties: { sku: { type: "string", description: "Optional product SKU; defaults to the top seller." } },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "profit_summary",
      description: "Summarize profit, margin, and per-marketplace profit breakdown. Use for profit / margin / P&L questions.",
      inputSchema: { json: { type: "object", properties: {} } },
    },
  },
  {
    toolSpec: {
      name: "pricing_opportunities",
      description: "Find high-demand, low-elasticity SKUs where a small price increase adds revenue. Use for pricing questions.",
      inputSchema: { json: { type: "object", properties: {} } },
    },
  },
  {
    toolSpec: {
      name: "semantic_search",
      description: "Semantic search across the product catalog and insights. Use for open-ended 'find / which products / tell me about' questions.",
      inputSchema: {
        json: {
          type: "object",
          properties: { query: { type: "string", description: "What to search for." } },
          required: ["query"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "generate_listing",
      description: "Generate an SEO-optimized marketplace listing/description for a product (uses Gemini). Use for listing / description / write copy questions.",
      inputSchema: {
        json: {
          type: "object",
          properties: { sku: { type: "string", description: "Optional product SKU; defaults to the top seller." } },
        },
      },
    },
  },
];

const FOLLOWUPS: Record<AssistantWidget["kind"], string[]> = {
  "falling-products": ["Why are these dropping?", "Suggest a recovery plan"],
  forecast: ["Create the purchase order", "Show all at-risk SKUs"],
  profit: ["Compare to last quarter", "Export a P&L report"],
  pricing: ["Apply suggested prices", "Show elasticity details"],
  listing: ["Publish to Amazon", "Generate 3 more variations"],
};

async function runTool(
  name: string,
  input: Record<string, unknown>,
  sellerId: string,
): Promise<ToolResult> {
  switch (name) {
    case "declining_products":
      return decliningProducts(sellerId);
    case "inventory_forecast":
      return inventoryForecast(sellerId, input.sku as string | undefined);
    case "profit_summary":
      return profitSummary(sellerId);
    case "pricing_opportunities":
      return pricingOpportunities(sellerId);
    case "semantic_search":
      return semanticSearch(sellerId, String(input.query ?? ""));
    case "generate_listing":
      return generateListing(sellerId, input.sku as string | undefined);
    default:
      return { summary: `Unknown tool: ${name}` };
  }
}

/**
 * Shared per-turn setup: embed + persist the user prompt, recall long-term
 * and short-term memory, and assemble the grounded system prompt.
 */
async function buildTurnContext(
  sellerId: string,
  sessionId: string,
  prompt: string,
): Promise<{ system: string; promptEmbedding: number[] }> {
  // 1. Embed + persist the user turn.
  const promptEmbedding = await embed(prompt);
  await saveTurn(sellerId, sessionId, "user", prompt, promptEmbedding);

  // 2. Recall memory (long-term semantic + short-term session).
  const [seller] = await query<{ name: string; org: string }>(
    `SELECT name, org FROM sellers WHERE id = $1`,
    [sellerId],
  );
  const [recalled, recent] = await Promise.all([
    recallMemory(sellerId, promptEmbedding, 4),
    getRecentTurns(sellerId, sessionId, 6),
  ]);

  const memoryContext = [
    recalled.length
      ? "Relevant past context:\n" + recalled.map((m) => `- (${m.role}) ${m.content}`).join("\n")
      : "",
    recent.length
      ? "Recent conversation:\n" + recent.map((m) => `${m.role}: ${m.content}`).join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const system =
    `You are the ProSellerOS copilot for ${seller?.name ?? "the seller"}` +
    `${seller?.org ? ` at ${seller.org}` : ""}, a multi-marketplace commerce operator. ` +
    `Answer using the analytics tools — never invent numbers. Call the most relevant tool, ` +
    `then give a concise, confident answer (2-4 sentences) grounded in the tool results. ` +
    `Use plain text, no markdown headers.` +
    (memoryContext ? `\n\n${memoryContext}` : "");

  return { system, promptEmbedding };
}

export async function runCopilot(args: {
  sellerId: string;
  sessionId: string;
  prompt: string;
}): Promise<AssistantReply> {
  const { sellerId, sessionId, prompt } = args;

  const { system } = await buildTurnContext(sellerId, sessionId, prompt);

  // 3. Tool-use loop.
  const messages: Message[] = [{ role: "user", content: [{ text: prompt }] }];
  let widget: AssistantWidget | undefined;
  let finalText = "";

  for (let i = 0; i < 4; i++) {
    const res = await converse({ system, messages, tools: TOOLS, maxTokens: 700 });
    messages.push(res.message);

    if (res.stopReason !== "tool_use") {
      finalText = res.content
        .map((b) => b.text ?? "")
        .join(" ")
        .trim();
      break;
    }

    const toolResultBlocks = [];
    for (const block of res.content) {
      if (block.toolUse?.toolUseId) {
        const result = await runTool(
          block.toolUse.name ?? "",
          (block.toolUse.input as Record<string, unknown>) ?? {},
          sellerId,
        );
        if (result.widget && !widget) widget = result.widget;
        toolResultBlocks.push({
          toolResult: {
            toolUseId: block.toolUse.toolUseId,
            content: [{ text: result.summary }],
          },
        });
      }
    }
    messages.push({ role: "user", content: toolResultBlocks });
  }

  if (!finalText) {
    finalText = "I've pulled the latest figures from your live data — see the details below.";
  }

  // 5. Persist the assistant answer (embedded) to long-term memory.
  const answerEmbedding = await embed(finalText);
  await saveTurn(sellerId, sessionId, "assistant", finalText, answerEmbedding);

  return {
    text: finalText,
    widget,
    followups: widget ? FOLLOWUPS[widget.kind] : undefined,
  };
}

/** An incremental event emitted by {@link streamCopilot}. */
export type CopilotStreamEvent =
  | { type: "text"; delta: string }
  | { type: "reset" } // discard any streamed pre-tool preamble text
  | { type: "widget"; widget: AssistantWidget }
  | { type: "done"; followups?: string[] };

/**
 * Streaming variant of {@link runCopilot}. Same memory + tool-use flow, but
 * emits `text` deltas as tokens arrive and a `widget` event the moment a tool
 * produces one, so the UI can render progressively. Ends with a `done` event.
 */
export async function* streamCopilot(args: {
  sellerId: string;
  sessionId: string;
  prompt: string;
}): AsyncGenerator<CopilotStreamEvent> {
  const { sellerId, sessionId, prompt } = args;

  const { system } = await buildTurnContext(sellerId, sessionId, prompt);

  const messages: Message[] = [{ role: "user", content: [{ text: prompt }] }];
  let widget: AssistantWidget | undefined;
  let finalText = "";

  for (let i = 0; i < 4; i++) {
    let stopReason = "end_turn";
    let turnMessage: Message = { role: "assistant", content: [] };
    let turnText = "";

    for await (const ev of converseStream({ system, messages, tools: TOOLS, maxTokens: 700 })) {
      if (ev.type === "text") {
        turnText += ev.text;
        finalText += ev.text;
        yield { type: "text", delta: ev.text };
      } else {
        turnMessage = ev.message;
        stopReason = ev.stopReason;
      }
    }

    messages.push(turnMessage);

    if (stopReason !== "tool_use") break;

    // A tool-use turn: run the requested tools and feed results back.
    if (turnText) yield { type: "reset" }; // clear any streamed pre-tool preamble
    finalText = ""; // the grounded answer follows on the next turn
    const toolResultBlocks = [];
    for (const block of turnMessage.content ?? []) {
      if (block.toolUse?.toolUseId) {
        const result = await runTool(
          block.toolUse.name ?? "",
          (block.toolUse.input as Record<string, unknown>) ?? {},
          sellerId,
        );
        if (result.widget && !widget) {
          widget = result.widget;
          yield { type: "widget", widget };
        }
        toolResultBlocks.push({
          toolResult: {
            toolUseId: block.toolUse.toolUseId,
            content: [{ text: result.summary }],
          },
        });
      }
    }
    messages.push({ role: "user", content: toolResultBlocks });
  }

  if (!finalText) {
    finalText = "I've pulled the latest figures from your live data — see the details below.";
    yield { type: "text", delta: finalText };
  }

  // Persist the assistant answer (embedded) to long-term memory.
  const answerEmbedding = await embed(finalText);
  await saveTurn(sellerId, sessionId, "assistant", finalText, answerEmbedding);

  yield { type: "done", followups: widget ? FOLLOWUPS[widget.kind] : undefined };
}
