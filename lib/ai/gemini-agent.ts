/**
 * Google Gemini as a drop-in replacement for Bedrock in the agent loop.
 *
 *   embed()          → gemini-embedding-001 (vectors stored in CockroachDB)
 *   converse()       → generateContent + function calling (tool-use loop)
 *   converseStream() → generateContentStream + function calling
 *
 * Exposes exactly the surface described in `lib/ai/contract.ts`, translating the
 * Bedrock Converse wire format to Gemini's `contents`/`parts` shape and back, so
 * `lib/agent/loop.ts` runs unchanged on either provider.
 *
 * Auth is shared with `lib/ai/gemini.ts`: Vertex AI via ADC, or an API key.
 */
import { Type, type Content, type Part, type FunctionDeclaration, type Schema } from "@google/genai";
import { config } from "@/lib/config";
import { getClient } from "@/lib/ai/gemini";
import {
  l2normalize,
  type ContentBlock,
  type ConverseArgs,
  type ConverseResult,
  type ConverseStreamEvent,
  type Message,
  type Tool,
} from "@/lib/ai/contract";

/** Embed a single string with gemini-embedding-001. */
export async function embed(text: string): Promise<number[]> {
  const res = await getClient().models.embedContent({
    model: config.geminiEmbedModelId,
    contents: text.slice(0, 8000),
    config: { outputDimensionality: config.embedDims },
  });

  const values = res.embeddings?.[0]?.values;
  if (!values?.length) {
    throw new Error("Gemini embedContent returned no embedding");
  }
  // Gemini only auto-normalizes its full 3072-dim output; truncated dimensions
  // (we ask for config.embedDims) must be normalized for L2 search to be valid.
  return l2normalize(values);
}

// ── Bedrock wire format → Gemini ────────────────────────────────────────────

/** Uppercase a JSON-Schema `type` into Gemini's OpenAPI `Type` enum. */
const TYPES: Record<string, Type> = {
  object: Type.OBJECT,
  string: Type.STRING,
  number: Type.NUMBER,
  integer: Type.INTEGER,
  boolean: Type.BOOLEAN,
  array: Type.ARRAY,
};

/** Convert a JSON Schema (as used in the Bedrock toolSpec) to a Gemini Schema. */
function toGeminiSchema(node: Record<string, unknown>): Schema {
  const schema: Schema = {};
  const type = typeof node.type === "string" ? TYPES[node.type.toLowerCase()] : undefined;
  if (type) schema.type = type;
  if (typeof node.description === "string") schema.description = node.description;
  if (Array.isArray(node.enum)) schema.enum = node.enum.map(String);

  const properties = node.properties as Record<string, Record<string, unknown>> | undefined;
  if (properties && Object.keys(properties).length > 0) {
    schema.properties = Object.fromEntries(
      Object.entries(properties).map(([key, value]) => [key, toGeminiSchema(value)]),
    );
  }
  if (Array.isArray(node.required) && node.required.length > 0) {
    schema.required = node.required.map(String);
  }
  const items = node.items as Record<string, unknown> | undefined;
  if (items) schema.items = toGeminiSchema(items);

  return schema;
}

function toFunctionDeclarations(tools?: Tool[]): FunctionDeclaration[] {
  return (tools ?? []).flatMap((tool) => {
    const spec = tool.toolSpec;
    if (!spec?.name) return [];

    const declaration: FunctionDeclaration = {
      name: spec.name,
      description: spec.description ?? "",
    };

    // Gemini rejects an OBJECT schema with an empty `properties` map, so a
    // no-argument tool must omit `parameters` entirely rather than send `{}`.
    const json = spec.inputSchema?.json as Record<string, unknown> | undefined;
    const properties = json?.properties as Record<string, unknown> | undefined;
    if (json && properties && Object.keys(properties).length > 0) {
      declaration.parameters = toGeminiSchema(json);
    }
    return [declaration];
  });
}

/**
 * Translate the Bedrock-shaped transcript into Gemini `contents`.
 *
 * Bedrock addresses a tool result by `toolUseId`; Gemini addresses it by
 * function *name*. We index every toolUse block in the transcript first so each
 * toolResult can be resolved back to the name that produced it.
 */
function toGeminiContents(messages: Message[]): Content[] {
  const nameById = new Map<string, string>();
  for (const message of messages) {
    for (const block of message.content ?? []) {
      if (block.toolUse?.toolUseId) {
        nameById.set(block.toolUse.toolUseId, block.toolUse.name ?? "");
      }
    }
  }

  const contents: Content[] = [];
  for (const message of messages) {
    const parts: Part[] = [];
    for (const block of message.content ?? []) {
      if (block.text) {
        parts.push({ text: block.text });
      } else if (block.toolUse) {
        parts.push({
          functionCall: {
            name: block.toolUse.name ?? "",
            args: (block.toolUse.input ?? {}) as Record<string, unknown>,
          },
        });
      } else if (block.toolResult?.toolUseId) {
        const text = (block.toolResult.content ?? [])
          .map((c) => c.text ?? "")
          .join("\n");
        parts.push({
          functionResponse: {
            name: nameById.get(block.toolResult.toolUseId) ?? "tool",
            response: { result: text },
          },
        });
      }
    }
    if (!parts.length) continue;
    // Bedrock returns tool results in a "user" message; Gemini likewise expects
    // functionResponse parts under the user role.
    contents.push({ role: message.role === "assistant" ? "model" : "user", parts });
  }
  return contents;
}

// ── Gemini → Bedrock wire format ────────────────────────────────────────────

/** Monotonic counter so synthesized toolUseIds stay unique across turns. */
let toolUseSeq = 0;

/**
 * Fold Gemini parts into Bedrock content blocks, merging consecutive text into a
 * single block. The merge matters: `runCopilot` joins text blocks with a space,
 * so one block per streamed chunk would space out every token.
 */
function foldParts(parts: Part[], into: ContentBlock[]): { sawCall: boolean; text: string } {
  let sawCall = false;
  let text = "";

  for (const part of parts) {
    // Thought summaries are not answer text — never surface or replay them.
    if (part.thought) continue;

    if (part.text) {
      text += part.text;
      const last = into[into.length - 1];
      if (last && last.text !== undefined) last.text += part.text;
      else into.push({ text: part.text } as ContentBlock);
    } else if (part.functionCall) {
      sawCall = true;
      into.push({
        toolUse: {
          toolUseId: `gemini-${++toolUseSeq}`,
          name: part.functionCall.name ?? "",
          input: (part.functionCall.args ?? {}) as Record<string, unknown>,
        },
      } as ContentBlock);
    }
  }
  return { sawCall, text };
}

/** Shared request config for both the buffered and streaming calls. */
function requestConfig(args: ConverseArgs) {
  const declarations = toFunctionDeclarations(args.tools);
  return {
    systemInstruction: args.system,
    maxOutputTokens: args.maxTokens ?? 1024,
    temperature: args.temperature ?? 0.3,
    // Gemini 2.5 thinks by default, which would consume the (small) output
    // budget before any answer text is produced. The agent prompt is explicit
    // enough not to need it, so disable it for predictable tool-use turns.
    thinkingConfig: { thinkingBudget: 0 },
    ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
  };
}

/** One buffered Gemini turn, shaped like a Bedrock Converse response. */
export async function converse(args: ConverseArgs): Promise<ConverseResult> {
  const res = await getClient().models.generateContent({
    model: config.geminiModelId,
    contents: toGeminiContents(args.messages),
    config: requestConfig(args),
  });

  const content: ContentBlock[] = [];
  const { sawCall } = foldParts(res.candidates?.[0]?.content?.parts ?? [], content);

  return {
    message: { role: "assistant", content },
    stopReason: sawCall ? "tool_use" : "end_turn",
    content,
  };
}

/**
 * Streaming variant of {@link converse}. Yields incremental `text` events, then
 * a `done` event with the reconstructed assistant message and stop reason, so
 * the agent loop can continue a tool-use turn identically to the Bedrock path.
 */
export async function* converseStream(
  args: ConverseArgs,
): AsyncGenerator<ConverseStreamEvent> {
  const stream = await getClient().models.generateContentStream({
    model: config.geminiModelId,
    contents: toGeminiContents(args.messages),
    config: requestConfig(args),
  });

  const content: ContentBlock[] = [];
  let sawCall = false;

  for await (const chunk of stream) {
    const { sawCall: chunkSawCall, text } = foldParts(
      chunk.candidates?.[0]?.content?.parts ?? [],
      content,
    );
    sawCall = sawCall || chunkSawCall;
    if (text) yield { type: "text", text };
  }

  yield {
    type: "done",
    message: { role: "assistant", content },
    stopReason: sawCall ? "tool_use" : "end_turn",
  };
}
