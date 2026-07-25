/**
 * The ProSellerOS copilot agent loop.
 *
 * The copilot is an operator, not a chat box: alongside the read-only analytics
 * tools it can move orders through fulfillment, print labels, re-price SKUs,
 * export data, and navigate the OS. Tools that change something write to
 * CockroachDB and return a {@link ClientAction} the browser applies to the live
 * UI, so one turn can both decide and do.
 *
 * Flow per turn:
 *   1. Take the caller's window transcript as the conversation (session memory),
 *      and persist the new user turn to agent_memory.
 *   2. Recall semantically-similar turns from *this session* (CockroachDB).
 *   3. Run a tool-use loop on whichever LLM provider `lib/ai/provider.ts` picks.
 *   4. Emit any widget or client action a tool produced.
 *   5. Persist the assistant answer, and return.
 */
import {
  converse,
  converseStream,
  embed,
  type Message,
  type Tool,
} from "@/lib/ai/provider";
import { query } from "@/lib/db/client";
import { saveTurn, recallMemory } from "@/lib/agent/memory";
import {
  decliningProducts,
  inventoryForecast,
  profitSummary,
  pricingOpportunities,
  semanticSearch,
  generateListing,
  type ToolResult,
} from "@/lib/agent/tools";
import {
  orderSearch,
  orderStats,
  setOrderStatus,
  printLabels,
  exportData,
  createOrder,
  updatePrice,
  restockProduct,
  navigateTo,
  setTheme,
} from "@/lib/agent/ops";
import type { ClientAction } from "@/lib/agent/actions";
import type { AssistantReply, AssistantWidget } from "@/lib/mock/assistant";

/** How many transcript turns of window memory to replay to the model. */
const HISTORY_TURNS = 16;

/**
 * Reusable schema fragments for the order-selector tools.
 *
 * Left to inference on purpose: the Bedrock `DocumentType` these specs are typed
 * against accepts the inferred literal shape, but rejects both the readonly
 * arrays an `as const` would produce and the optional properties an explicit
 * schema interface would introduce.
 */
const ORDER_SELECTOR = {
  order_numbers: {
    type: "array",
    description: 'Specific order numbers, e.g. ["#PS-48210"]. Digits alone are accepted.',
    items: { type: "string" },
  },
  from_status: {
    type: "string",
    description: "Only orders currently in this state.",
    enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"],
  },
  payment: { type: "string", description: "Payment method filter.", enum: ["prepaid", "cod"] },
  marketplace: {
    type: "string",
    description: "Channel id: amazon, flipkart, shopify, meesho, myntra, woocommerce, ebay.",
  },
  city: { type: "string", description: "Destination city (partial match)." },
  customer: { type: "string", description: "Customer name (partial match)." },
  flagged: { type: "boolean", description: "Only orders flagged for review." },
  limit: { type: "integer", description: "Cap how many orders are affected. Default 25." },
};

const TOOLS: Tool[] = [
  // ── Analytics ─────────────────────────────────────────────────────────────
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
      description: "Generate an SEO-optimized marketplace listing/description for a product. Use for listing / description / write copy questions.",
      inputSchema: {
        json: {
          type: "object",
          properties: { sku: { type: "string", description: "Optional product SKU; defaults to the top seller." } },
        },
      },
    },
  },

  // ── Order desk (read) ─────────────────────────────────────────────────────
  {
    toolSpec: {
      name: "order_search",
      description:
        "Find orders and count them, filtered by status, payment (COD/prepaid), channel, city, customer, or flag. " +
        "Use for any 'how many / which / list / show me orders' question. Call this before acting on a group of orders.",
      inputSchema: { json: { type: "object", properties: ORDER_SELECTOR } },
    },
  },
  {
    toolSpec: {
      name: "order_stats",
      description:
        "Whole-queue breakdown: order counts by fulfillment status and by payment method, plus total revenue. " +
        "Use for 'how is the queue looking / how many orders total / COD vs prepaid split'.",
      inputSchema: { json: { type: "object", properties: {} } },
    },
  },

  // ── Order desk (write) ────────────────────────────────────────────────────
  {
    toolSpec: {
      name: "set_order_status",
      description:
        "Move orders through fulfillment: accept/confirm, pack, ship, deliver, cancel, or return them. " +
        "This is the tool for 'accept these orders', 'mark them shipped', 'cancel the flagged ones'. " +
        "Must be scoped by at least one filter — it refuses to rewrite the whole queue.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            to_status: {
              type: "string",
              description: "The state to move the orders into. 'confirmed' is what accepting an order means.",
              enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"],
            },
            courier: { type: "string", description: "Courier to assign when shipping." },
            ...ORDER_SELECTOR,
          },
          required: ["to_status"],
        },
      },
    },
  },
  {
    toolSpec: {
      name: "print_labels",
      description:
        "Generate and download a print-ready shipping-label sheet, assigning courier and tracking numbers. " +
        "Use for 'print/download/get labels'. Defaults to confirmed orders when no filter is given.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            courier: { type: "string", description: "Courier to print on the labels. Default Shiprocket." },
            ...ORDER_SELECTOR,
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "export_data",
      description:
        "Download a CSV of orders (optionally filtered) or of the product catalog. " +
        "Use for 'export / download / send me a spreadsheet / give me a report'.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            entity: { type: "string", description: "What to export.", enum: ["orders", "products"] },
            ...ORDER_SELECTOR,
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "create_order",
      description: "Log a new manual order into the queue as pending fulfillment.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            customer: { type: "string", description: "Customer's full name." },
            total: { type: "number", description: "Order total in USD." },
            marketplace: { type: "string", description: "Channel id or name. Default amazon." },
            city: { type: "string", description: "Destination city. Default Mumbai." },
            payment: { type: "string", description: "Payment method.", enum: ["prepaid", "cod"] },
          },
          required: ["customer", "total"],
        },
      },
    },
  },

  // ── Catalog (write) ───────────────────────────────────────────────────────
  {
    toolSpec: {
      name: "update_price",
      description:
        "Change a product's price across every connected channel. Give either an absolute new_price or a percent_change. " +
        "Use for 'raise/drop the price of X', 'apply the suggested price'.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Product SKU." },
            product_name: { type: "string", description: "Product name, if the SKU is unknown." },
            new_price: { type: "number", description: "Absolute new price in USD." },
            percent_change: { type: "number", description: "Relative change, e.g. 6 for +6%, -10 for a 10% cut." },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "restock_product",
      description: "Raise stock on hand for a SKU, either by add_units or to an absolute set_to level.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            sku: { type: "string", description: "Product SKU." },
            product_name: { type: "string", description: "Product name, if the SKU is unknown." },
            add_units: { type: "integer", description: "Units to add to current stock." },
            set_to: { type: "integer", description: "Absolute stock level to set." },
          },
        },
      },
    },
  },

  // ── Getting around ────────────────────────────────────────────────────────
  {
    toolSpec: {
      name: "navigate",
      description:
        "Open a screen in ProSellerOS for the operator — a section, a filtered order list, or one order/product's detail page. " +
        "Use whenever they ask to be taken/redirected somewhere, or when showing them the screen is the answer.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            destination: {
              type: "string",
              description: "Which section to open.",
              enum: ["dashboard", "products", "orders", "marketplaces", "assistant"],
            },
            order_number: { type: "string", description: "Open this order's detail page instead." },
            sku: { type: "string", description: "Open this product's detail page instead." },
            order_status: {
              type: "string",
              description: "With destination=orders, pre-filter the queue to this status.",
              enum: ["pending", "confirmed", "packed", "shipped", "delivered", "cancelled", "returned"],
            },
            flagged: {
              type: "boolean",
              description:
                "With destination=orders, show only orders flagged for review. " +
                "Flagged is a review flag, not a fulfillment status — use this, not order_status.",
            },
          },
        },
      },
    },
  },
  {
    toolSpec: {
      name: "set_theme",
      description: "Switch the interface between light and dark mode.",
      inputSchema: {
        json: {
          type: "object",
          properties: { mode: { type: "string", enum: ["light", "dark"] } },
          required: ["mode"],
        },
      },
    },
  },
];

const FOLLOWUPS: Record<AssistantWidget["kind"], string[]> = {
  "falling-products": ["Why are these dropping?", "Suggest a recovery plan"],
  forecast: ["Restock it by 400 units", "Show all at-risk SKUs"],
  profit: ["Compare to last quarter", "Export a P&L report"],
  pricing: ["Apply the suggested prices", "Show elasticity details"],
  listing: ["Publish to Amazon", "Generate 3 more variations"],
  orders: ["Accept these orders", "Download their labels"],
  "order-stats": ["Show the pending orders", "Accept all pending orders"],
};

/** Followups offered after an action, when no widget suggested any. */
const ACTION_FOLLOWUPS: Record<ClientAction["kind"], string[]> = {
  navigate: ["What needs my attention here?"],
  order_status: ["Download their labels", "Export the order list"],
  labels: ["Mark them shipped", "What's left to fulfill?"],
  export: ["Show the queue breakdown"],
  create_order: ["Accept it", "Print its label"],
  price_change: ["Show the profit impact", "Find more pricing opportunities"],
  restock: ["Forecast it again", "Show other at-risk SKUs"],
  theme: [],
};

async function runTool(
  name: string,
  input: Record<string, unknown>,
  sellerId: string,
): Promise<ToolResult> {
  switch (name) {
    // Analytics
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

    // Order desk
    case "order_search":
      return orderSearch(sellerId, input);
    case "order_stats":
      return orderStats(sellerId);
    case "set_order_status":
      return setOrderStatus(sellerId, input);
    case "print_labels":
      return printLabels(sellerId, input);
    case "export_data":
      return exportData(sellerId, input);
    case "create_order":
      return createOrder(sellerId, input);

    // Catalog
    case "update_price":
      return updatePrice(sellerId, input);
    case "restock_product":
      return restockProduct(sellerId, input);

    // Navigation
    case "navigate":
      return navigateTo(sellerId, input);
    case "set_theme":
      return setTheme(input);

    default:
      return { summary: `Unknown tool: ${name}` };
  }
}

/** One prior turn of the operator's open window. */
export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface CopilotArgs {
  sellerId: string;
  sessionId: string;
  prompt: string;
  /** Window-scoped transcript from the client, oldest first. */
  history?: HistoryTurn[];
  /** Route the operator is looking at right now, e.g. "/orders". */
  path?: string;
}

/**
 * Replay the window transcript as real conversation turns.
 *
 * The transcript is the copilot's working memory, so it goes in as `messages`
 * rather than being flattened into the system prompt — that is what lets
 * "accept them" resolve against the orders listed two turns ago. A transcript
 * must open on a user turn (the greeting is assistant-authored), and consecutive
 * same-role turns are merged, since providers reject both.
 */
function buildMessages(prompt: string, history: HistoryTurn[] = []): Message[] {
  const turns = history
    .filter((t) => t.text.trim().length > 0)
    .slice(-HISTORY_TURNS);
  while (turns.length && turns[0].role !== "user") turns.shift();

  const messages: Message[] = [];
  for (const turn of turns) {
    const last = messages[messages.length - 1];
    if (last?.role === turn.role) {
      last.content = [{ text: `${last.content?.[0]?.text ?? ""}\n\n${turn.text}` }];
    } else {
      messages.push({ role: turn.role, content: [{ text: turn.text }] });
    }
  }

  const last = messages[messages.length - 1];
  if (last?.role === "user") {
    last.content = [{ text: `${last.content?.[0]?.text ?? ""}\n\n${prompt}` }];
  } else {
    messages.push({ role: "user", content: [{ text: prompt }] });
  }
  return messages;
}

/**
 * Shared per-turn setup: persist the user prompt, recall this session's memory,
 * and assemble the operator system prompt.
 */
async function buildTurnContext(args: CopilotArgs): Promise<{ system: string; messages: Message[] }> {
  const { sellerId, sessionId, prompt, history, path } = args;

  const promptEmbedding = await embed(prompt);
  // Persisted for recall and audit; the answer never blocks on the write.
  void saveTurn(sellerId, sessionId, "user", prompt, promptEmbedding);

  const [seller] = await query<{ name: string; org: string }>(
    `SELECT name, org FROM sellers WHERE id = $1`,
    [sellerId],
  );

  // Session-scoped recall: memory lasts as long as the operator's window, so a
  // fresh window starts clean instead of dredging up yesterday's conversation.
  const recalled = await recallMemory(sellerId, sessionId, promptEmbedding, 4);
  const recentText = new Set(history?.slice(-HISTORY_TURNS).map((t) => t.text));
  const earlier = recalled.filter((m) => !recentText.has(m.content));

  const system =
    `You are the ProSellerOS copilot, working alongside ${seller?.name ?? "the seller"}` +
    `${seller?.org ? ` at ${seller.org}` : ""} — a multi-marketplace commerce operator.\n\n` +
    `You are a coworker with real access to this portal, not an advisor. When they ask for ` +
    `something doable, do it with a tool and report what you did in past tense. Never reply ` +
    `that you lack the ability or the data without having tried the relevant tool first.\n\n` +
    `Rules:\n` +
    `- Look before you write: use order_search or order_stats to see what matches, then act on it.\n` +
    `- "Accept" / "approve" an order means set_order_status to confirmed.\n` +
    `- Chain tools freely to finish a request in one turn (e.g. accept orders, then print their labels).\n` +
    `- Never invent numbers, order numbers, or SKUs. Every figure comes from a tool result.\n` +
    `- If a tool refuses or matches nothing, say so plainly and ask for the missing detail.\n` +
    `- Destructive scope (cancelling many orders, whole-queue rewrites) needs an explicit filter; ` +
    `ask which orders they mean rather than guessing.\n` +
    `- Answer in 1-4 sentences of plain text. No markdown headers or bullet lists.\n` +
    (path ? `\nThe operator is currently on the ${path} screen.` : "") +
    (earlier.length
      ? `\n\nEarlier in this session:\n${earlier.map((m) => `- (${m.role}) ${m.content}`).join("\n")}`
      : "");

  return { system, messages: buildMessages(prompt, history) };
}

/** Fire-and-forget persistence of the assistant answer. */
async function persistAnswer(sellerId: string, sessionId: string, text: string) {
  try {
    await saveTurn(sellerId, sessionId, "assistant", text, await embed(text));
  } catch (err) {
    console.error("[copilot] failed to persist answer:", err);
  }
}

function followupsFor(
  widget: AssistantWidget | undefined,
  actions: ClientAction[],
): string[] | undefined {
  if (widget) return FOLLOWUPS[widget.kind];
  // Walk backwards: after "accept these, then label them" the useful next step
  // follows the labels, not the acceptance.
  for (let i = actions.length - 1; i >= 0; i--) {
    const suggestions = ACTION_FOLLOWUPS[actions[i].kind];
    if (suggestions?.length) return suggestions;
  }
  return undefined;
}

export async function runCopilot(args: CopilotArgs): Promise<AssistantReply> {
  const { system, messages } = await buildTurnContext(args);

  let widget: AssistantWidget | undefined;
  const actions: ClientAction[] = [];
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    const res = await converse({ system, messages, tools: TOOLS, maxTokens: 900 });
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
          args.sellerId,
        );
        if (result.widget && !widget) widget = result.widget;
        if (result.action) actions.push(result.action);
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
    finalText = actions.length
      ? "Done — the details are below."
      : "I've pulled the latest figures from your live data — see the details below.";
  }

  void persistAnswer(args.sellerId, args.sessionId, finalText);

  return { text: finalText, widget, actions, followups: followupsFor(widget, actions) };
}

/** An incremental event emitted by {@link streamCopilot}. */
export type CopilotStreamEvent =
  | { type: "text"; delta: string }
  | { type: "reset" } // discard any streamed pre-tool preamble text
  | { type: "widget"; widget: AssistantWidget }
  | { type: "action"; action: ClientAction }
  | { type: "done"; followups?: string[] };

/**
 * Streaming variant of {@link runCopilot}. Same memory + tool-use flow, but
 * emits `text` deltas as tokens arrive, and a `widget`/`action` event the moment
 * a tool produces one, so the UI renders and *acts* progressively.
 */
export async function* streamCopilot(args: CopilotArgs): AsyncGenerator<CopilotStreamEvent> {
  const { system, messages } = await buildTurnContext(args);

  let widget: AssistantWidget | undefined;
  const actions: ClientAction[] = [];
  let finalText = "";

  for (let i = 0; i < 6; i++) {
    let stopReason = "end_turn";
    let turnMessage: Message = { role: "assistant", content: [] };
    let turnText = "";

    for await (const ev of converseStream({ system, messages, tools: TOOLS, maxTokens: 900 })) {
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
          args.sellerId,
        );
        if (result.widget && !widget) {
          widget = result.widget;
          yield { type: "widget", widget };
        }
        if (result.action) {
          actions.push(result.action);
          yield { type: "action", action: result.action };
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
    finalText = actions.length
      ? "Done — the details are below."
      : "I've pulled the latest figures from your live data — see the details below.";
    yield { type: "text", delta: finalText };
  }

  void persistAnswer(args.sellerId, args.sessionId, finalText);

  yield { type: "done", followups: followupsFor(widget, actions) };
}
