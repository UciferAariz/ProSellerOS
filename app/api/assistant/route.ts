/**
 * POST /api/assistant — the real ProSellerOS copilot (streaming).
 *
 * Streams newline-delimited JSON (NDJSON) events so the UI can render tokens
 * as they arrive:
 *   {"type":"text","delta":"..."}   incremental answer text
 *   {"type":"reset"}                 discard streamed pre-tool preamble
 *   {"type":"widget","widget":{...}} a tool produced a UI widget
 *   {"type":"done","followups":[...],"source":"live"|"mock"}
 *
 * Runs the CockroachDB-backed agent (on whichever LLM provider `AI_PROVIDER`
 * selects) when configured; falls back to the deterministic mock answer()
 * otherwise, so the demo never breaks.
 */
import { isDbConfigured, isLlmConfigured } from "@/lib/config";
import { SELLER_ID, DEFAULT_SESSION_ID } from "@/lib/constants";
import { answer } from "@/lib/mock/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

export async function POST(req: Request) {
  let prompt = "";
  let sessionId = DEFAULT_SESSION_ID;
  try {
    const body = (await req.json()) as { prompt?: string; sessionId?: string };
    prompt = (body.prompt ?? "").trim();
    sessionId = body.sessionId || DEFAULT_SESSION_ID;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!prompt) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  const live = isDbConfigured() && isLlmConfigured();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (live) {
          try {
            const { streamCopilot } = await import("@/lib/agent/loop");
            for await (const ev of streamCopilot({ sellerId: SELLER_ID, sessionId, prompt })) {
              if (ev.type === "done") {
                controller.enqueue(line({ ...ev, source: "live" }));
              } else {
                controller.enqueue(line(ev));
              }
            }
            controller.close();
            return;
          } catch (err) {
            // Never break the demo — log and fall through to the mock stream.
            console.error("[assistant] live agent failed, using mock:", err);
            controller.enqueue(line({ type: "reset" }));
          }
        }
        await streamMock(prompt, controller);
        controller.close();
      } catch (err) {
        console.error("[assistant] stream error:", err);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/** Chunk the deterministic mock reply into word-level deltas so it streams too. */
async function streamMock(
  prompt: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
) {
  const reply = answer(prompt);
  const words = reply.text.split(/(\s+)/); // keep whitespace as its own tokens
  for (const w of words) {
    if (!w) continue;
    controller.enqueue(line({ type: "text", delta: w }));
    await new Promise((r) => setTimeout(r, 14));
  }
  if (reply.widget) {
    controller.enqueue(line({ type: "widget", widget: reply.widget }));
  }
  controller.enqueue(line({ type: "done", followups: reply.followups, source: "mock" }));
}
