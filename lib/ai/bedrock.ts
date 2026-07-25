/**
 * Amazon Bedrock client — the agent's LLM + embedding engine.
 *
 *   embed()  → Amazon Titan Text Embeddings v2 (vectors stored in CockroachDB)
 *   converse() → Anthropic Claude via the Bedrock Converse API (tool-use loop)
 *
 * Credentials come from the default AWS chain: env vars locally, the execution
 * role on Lambda/Amplify.
 */
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  ConverseCommand,
  ConverseStreamCommand,
  type ContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import { config } from "@/lib/config";
import type {
  ConverseArgs,
  ConverseResult,
  ConverseStreamEvent,
} from "@/lib/ai/contract";

export type { ConverseResult, ConverseStreamEvent };

let client: BedrockRuntimeClient | null = null;
function getClient(): BedrockRuntimeClient {
  if (!client) client = new BedrockRuntimeClient({ region: config.awsRegion });
  return client;
}

/** Embed a single string with Titan Text Embeddings v2. */
export async function embed(text: string): Promise<number[]> {
  const res = await getClient().send(
    new InvokeModelCommand({
      modelId: config.bedrockEmbedModelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify({
        inputText: text.slice(0, 8000),
        dimensions: config.embedDims,
        normalize: true,
      }),
    }),
  );
  const body = JSON.parse(new TextDecoder().decode(res.body)) as {
    embedding: number[];
  };
  return body.embedding;
}

/** One turn of the Bedrock Converse API with optional tool config. */
export async function converse(args: ConverseArgs): Promise<ConverseResult> {
  const res = await getClient().send(
    new ConverseCommand({
      modelId: config.bedrockChatModelId,
      system: [{ text: args.system }],
      messages: args.messages,
      toolConfig: args.tools?.length ? { tools: args.tools } : undefined,
      inferenceConfig: {
        maxTokens: args.maxTokens ?? 1024,
        temperature: args.temperature ?? 0.3,
      },
    }),
  );
  const message = res.output?.message ?? { role: "assistant", content: [] };
  return {
    message,
    stopReason: res.stopReason ?? "end_turn",
    content: message.content ?? [],
  };
}

/**
 * Streaming variant of {@link converse}. Yields incremental `text` events as
 * tokens arrive, then a final `done` event carrying the fully reconstructed
 * assistant message (with parsed toolUse blocks) and the stop reason — so the
 * agent loop can continue a tool-use turn exactly as the non-streaming path.
 */
export async function* converseStream(
  args: ConverseArgs,
): AsyncGenerator<ConverseStreamEvent> {
  const res = await getClient().send(
    new ConverseStreamCommand({
      modelId: config.bedrockChatModelId,
      system: [{ text: args.system }],
      messages: args.messages,
      toolConfig: args.tools?.length ? { tools: args.tools } : undefined,
      inferenceConfig: {
        maxTokens: args.maxTokens ?? 1024,
        temperature: args.temperature ?? 0.3,
      },
    }),
  );

  // Reconstruct content blocks by index so the assistant message can be replayed.
  const blocks: Record<
    number,
    { text: string; toolUseId?: string; name?: string; inputJson: string }
  > = {};
  let stopReason = "end_turn";

  for await (const event of res.stream ?? []) {
    if (event.contentBlockStart) {
      const i = event.contentBlockStart.contentBlockIndex ?? 0;
      const tu = event.contentBlockStart.start?.toolUse;
      blocks[i] = {
        text: "",
        inputJson: "",
        toolUseId: tu?.toolUseId,
        name: tu?.name,
      };
    } else if (event.contentBlockDelta) {
      const i = event.contentBlockDelta.contentBlockIndex ?? 0;
      const b = (blocks[i] ??= { text: "", inputJson: "" });
      const delta = event.contentBlockDelta.delta;
      if (delta?.text) {
        b.text += delta.text;
        yield { type: "text", text: delta.text };
      } else if (delta?.toolUse?.input) {
        b.inputJson += delta.toolUse.input;
      }
    } else if (event.messageStop) {
      stopReason = event.messageStop.stopReason ?? stopReason;
    }
  }

  const content: ContentBlock[] = Object.keys(blocks)
    .map(Number)
    .sort((a, b) => a - b)
    .map((i) => {
      const b = blocks[i];
      if (b.toolUseId) {
        let input: unknown = {};
        try {
          input = b.inputJson ? JSON.parse(b.inputJson) : {};
        } catch {
          input = {};
        }
        return {
          toolUse: { toolUseId: b.toolUseId, name: b.name, input },
        } as ContentBlock;
      }
      return { text: b.text } as ContentBlock;
    });

  yield {
    type: "done",
    message: { role: "assistant", content },
    stopReason,
  };
}
