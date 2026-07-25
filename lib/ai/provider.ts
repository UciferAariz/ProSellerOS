/**
 * Provider-agnostic entry point for the agent's LLM calls.
 *
 * The agent imports `embed` / `converse` / `converseStream` from here and never
 * names a vendor. `activeProvider()` decides which adapter answers, so switching
 * backends is an `AI_PROVIDER` env change with no code edits:
 *
 *   AI_PROVIDER=bedrock  → lib/ai/bedrock.ts      (Claude + Titan)
 *   AI_PROVIDER=gemini   → lib/ai/gemini-agent.ts (Gemini + gemini-embedding-001)
 *
 * Adapters load lazily so a Gemini-only deployment never pulls the AWS Bedrock
 * client into the bundle, and vice versa.
 */
import { activeProvider } from "@/lib/config";
import type {
  ConverseArgs,
  ConverseResult,
  ConverseStreamEvent,
  LlmProvider,
} from "@/lib/ai/contract";

export type {
  ConverseArgs,
  ConverseResult,
  ConverseStreamEvent,
  Message,
  Tool,
  ContentBlock,
} from "@/lib/ai/contract";

async function impl(): Promise<LlmProvider> {
  const provider = activeProvider();
  if (!provider) {
    throw new Error(
      "No LLM provider configured. Set AI_PROVIDER=gemini with GEMINI_API_KEY " +
        "(or Vertex AI), or AI_PROVIDER=bedrock with AWS credentials.",
    );
  }
  return provider === "gemini"
    ? import("@/lib/ai/gemini-agent")
    : import("@/lib/ai/bedrock");
}

/** Embed one string into a unit-length vector of `config.embedDims` dims. */
export async function embed(text: string): Promise<number[]> {
  return (await impl()).embed(text);
}

/** One buffered chat turn with optional tool config. */
export async function converse(args: ConverseArgs): Promise<ConverseResult> {
  return (await impl()).converse(args);
}

/** Streaming chat turn: incremental `text` events, then a final `done` event. */
export async function* converseStream(
  args: ConverseArgs,
): AsyncGenerator<ConverseStreamEvent> {
  yield* (await impl()).converseStream(args);
}
