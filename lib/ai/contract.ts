/**
 * The provider-agnostic LLM contract shared by every AI backend.
 *
 * The wire format is Bedrock's Converse shape (`Message` / `Tool` /
 * `ContentBlock`): the agent loop was written against it, the tool specs in
 * `lib/agent/loop.ts` already speak it, and it round-trips tool use cleanly.
 * Other providers translate to and from it inside their own adapter, so the
 * agent never learns which backend answered.
 *
 * These are TYPE-ONLY imports from the AWS SDK — they are erased at build time,
 * so a Gemini-only deployment pulls in no AWS runtime code.
 */
import type {
  Message,
  Tool,
  ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";

export type { Message, Tool, ContentBlock };

/** Arguments for one chat turn, with optional tool config. */
export interface ConverseArgs {
  system: string;
  messages: Message[];
  tools?: Tool[];
  maxTokens?: number;
  temperature?: number;
}

export interface ConverseResult {
  message: Message; // the assistant message (may contain toolUse blocks)
  stopReason: string; // "tool_use" when the model wants a tool run
  content: ContentBlock[];
}

/** A single event from a streaming turn. */
export type ConverseStreamEvent =
  | { type: "text"; text: string }
  | { type: "done"; message: Message; stopReason: string };

/**
 * What every provider module must export. `lib/ai/bedrock.ts` and
 * `lib/ai/gemini-agent.ts` both satisfy this; `lib/ai/provider.ts` picks one.
 */
export interface LlmProvider {
  /** Embed one string into a unit-length vector of `config.embedDims` dims. */
  embed(text: string): Promise<number[]>;
  converse(args: ConverseArgs): Promise<ConverseResult>;
  converseStream(args: ConverseArgs): AsyncGenerator<ConverseStreamEvent>;
}

/**
 * L2-normalize a vector in place of the provider doing it.
 *
 * `lib/agent/retrieve.ts` ranks with L2 distance (`<->`) and relies on all
 * stored vectors being unit-length for that to match cosine similarity. Titan
 * normalizes server-side (`normalize: true`); Gemini only auto-normalizes its
 * full 3072-dim output, so truncated dimensions must be normalized here.
 */
export function l2normalize(values: number[]): number[] {
  let sumSquares = 0;
  for (const v of values) sumSquares += v * v;
  const norm = Math.sqrt(sumSquares);
  return norm > 0 ? values.map((v) => v / norm) : values;
}
