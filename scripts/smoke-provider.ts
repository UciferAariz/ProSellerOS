/**
 * Live smoke test for the LLM provider abstraction (`lib/ai/provider.ts`).
 *
 * Exercises the whole contract against whichever backend `AI_PROVIDER` selects,
 * so a provider swap can be verified without touching the database or the UI:
 *
 *   1. embed()          — correct dimensionality and unit length (L2 search needs it)
 *   2. converse()       — a no-argument tool round-trips (empty-properties schema)
 *   3. converse()       — a tool WITH arguments parses those arguments
 *   4. converse()       — feeding a tool result back yields grounded final text
 *   5. converseStream() — emits text deltas and reconstructs a tool-use turn
 *
 * Run: npx tsx scripts/smoke-provider.ts
 */
import { config as loadEnv } from "dotenv";
import type { Message } from "@/lib/ai/contract";

loadEnv({ path: ".env.local" });

// Same shapes as the real tool specs in lib/agent/loop.ts.
const NO_ARG_TOOL = {
  toolSpec: {
    name: "declining_products",
    description:
      "List products whose 30-day sales are trending down. Use for sales-drop / declining / falling questions.",
    inputSchema: { json: { type: "object", properties: {} } },
  },
};

const ARG_TOOL = {
  toolSpec: {
    name: "semantic_search",
    description:
      "Semantic search across the product catalog and insights. Use for open-ended 'find / which products' questions.",
    inputSchema: {
      json: {
        type: "object",
        properties: { query: { type: "string", description: "What to search for." } },
        required: ["query"],
      },
    },
  },
};

const SYSTEM =
  "You are the ProSellerOS copilot. Answer using the analytics tools — never invent " +
  "numbers. Call the most relevant tool, then give a concise answer (2-4 sentences) " +
  "grounded in the tool results. Use plain text, no markdown headers.";

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "  ✅" : "  ❌"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function main() {
  const { config, activeProvider } = await import("@/lib/config");
  const { embed, converse, converseStream } = await import("@/lib/ai/provider");

  const provider = activeProvider();
  console.log("Provider:", provider ?? "(none configured)");
  console.log("Chat model:", provider === "gemini" ? config.geminiModelId : config.bedrockChatModelId);
  console.log(
    "Embed model:",
    provider === "gemini" ? config.geminiEmbedModelId : config.bedrockEmbedModelId,
  );
  console.log("Embed dims:", config.embedDims);
  if (!provider) {
    console.error("\n❌ No provider configured. Set AI_PROVIDER + credentials.");
    process.exit(1);
  }

  // ── 1. Embeddings ─────────────────────────────────────────────────────────
  console.log("\n[1] embed()");
  const vector = await embed("wireless noise-cancelling headphones");
  check(`returns ${config.embedDims} dims`, vector.length === config.embedDims, `got ${vector.length}`);
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  check("is unit-length (L2 search validity)", Math.abs(norm - 1) < 1e-6, `norm=${norm.toFixed(8)}`);
  check("contains finite numbers", vector.every((v) => Number.isFinite(v)));

  // ── 2. No-argument tool ───────────────────────────────────────────────────
  console.log("\n[2] converse() — no-argument tool");
  const askDeclining: Message[] = [
    { role: "user", content: [{ text: "Which products are declining and why?" }] },
  ];
  const first = await converse({
    system: SYSTEM,
    messages: askDeclining,
    tools: [NO_ARG_TOOL, ARG_TOOL],
    maxTokens: 700,
  });
  const call = first.content.find((b) => b.toolUse)?.toolUse;
  check("stopReason is tool_use", first.stopReason === "tool_use", `got "${first.stopReason}"`);
  check("called declining_products", call?.name === "declining_products", `got "${call?.name}"`);
  check("toolUseId present", Boolean(call?.toolUseId), call?.toolUseId ?? "missing");

  // ── 3. Tool WITH arguments ────────────────────────────────────────────────
  console.log("\n[3] converse() — tool with arguments");
  const argRes = await converse({
    system: SYSTEM,
    messages: [
      { role: "user", content: [{ text: "Find me products related to winter camping gear." }] },
    ],
    tools: [NO_ARG_TOOL, ARG_TOOL],
    maxTokens: 700,
  });
  const argCall = argRes.content.find((b) => b.toolUse)?.toolUse;
  const argInput = (argCall?.input ?? {}) as Record<string, unknown>;
  check("called semantic_search", argCall?.name === "semantic_search", `got "${argCall?.name}"`);
  check(
    "parsed the 'query' argument",
    typeof argInput.query === "string" && argInput.query.length > 0,
    JSON.stringify(argInput),
  );

  // ── 4. Tool result round-trip ─────────────────────────────────────────────
  console.log("\n[4] converse() — tool result round-trip");
  if (!call?.toolUseId) {
    check("skipped: no toolUseId from step 2", false);
  } else {
    const messages: Message[] = [
      ...askDeclining,
      first.message,
      {
        role: "user",
        content: [
          {
            toolResult: {
              toolUseId: call.toolUseId,
              content: [
                {
                  text:
                    "3 declining products: SKU-1042 Trail Runner Pro (-18%, 30d), " +
                    "SKU-2210 Alpine Down Jacket (-12%), SKU-3187 Summit Backpack (-9%). " +
                    "Main driver: two competitors undercut price by 15% in the same period.",
                },
              ],
            },
          },
        ],
      },
    ];
    const second = await converse({
      system: SYSTEM,
      messages,
      tools: [NO_ARG_TOOL, ARG_TOOL],
      maxTokens: 700,
    });
    const text = second.content.map((b) => b.text ?? "").join(" ").trim();
    check("produced final text", text.length > 0, `${text.length} chars`);
    check("stopReason ended the turn", second.stopReason !== "tool_use", `got "${second.stopReason}"`);
    check(
      "grounded in the tool result (mentions a real SKU)",
      /SKU-(1042|2210|3187)|Trail Runner|Alpine|Summit/i.test(text),
    );
    console.log(`  ↳ "${text.slice(0, 160)}${text.length > 160 ? "…" : ""}"`);
  }

  // ── 5. Streaming ──────────────────────────────────────────────────────────
  console.log("\n[5] converseStream()");
  let deltas = 0;
  let streamed = "";
  let doneEvents = 0;
  let streamStop = "";
  let streamToolName: string | undefined;
  for await (const ev of converseStream({
    system: SYSTEM,
    messages: askDeclining,
    tools: [NO_ARG_TOOL, ARG_TOOL],
    maxTokens: 700,
  })) {
    if (ev.type === "text") {
      deltas++;
      streamed += ev.text;
    } else {
      doneEvents++;
      streamStop = ev.stopReason;
      streamToolName = ev.message.content?.find((b) => b.toolUse)?.toolUse?.name;
    }
  }
  check("emitted exactly one done event", doneEvents === 1, `got ${doneEvents}`);
  check("reconstructed the tool-use turn", streamStop === "tool_use", `stopReason="${streamStop}"`);
  check("named the tool in the done message", streamToolName === "declining_products", `got "${streamToolName}"`);

  // A tool-use turn legitimately streams no prose, so only assert coherence
  // when text did arrive: it must not be split into character-level fragments.
  if (deltas > 0) {
    check("text deltas reassemble cleanly", !/\s{3,}/.test(streamed), `${deltas} deltas`);
    console.log(`  ↳ streamed preamble: "${streamed.slice(0, 120)}"`);
  } else {
    console.log("  ℹ️  no prose before the tool call (expected for a tool-use turn)");
  }

  // ── Result ────────────────────────────────────────────────────────────────
  if (failures > 0) {
    console.error(`\n❌ ${failures} check(s) failed on provider "${provider}".`);
    process.exit(1);
  }
  console.log(`\n✅ All checks passed — "${provider}" satisfies the agent contract.`);
}

main().catch((err) => {
  console.error("\n❌ Provider smoke test threw:");
  console.error(err);
  process.exit(1);
});
