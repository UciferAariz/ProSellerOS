/**
 * POST /api/assistant — the real ProSellerOS copilot (streaming).
 *
 * Streams newline-delimited JSON (NDJSON) events so the UI can render tokens
 * as they arrive, and apply the copilot's portal actions the moment they happen:
 *   {"type":"text","delta":"..."}    incremental answer text
 *   {"type":"reset"}                  discard streamed pre-tool preamble
 *   {"type":"widget","widget":{...}}  a tool produced a UI widget
 *   {"type":"action","action":{...}}  a tool changed something — see lib/agent/actions.ts
 *   {"type":"done","followups":[...],"source":"live"|"mock"}
 *
 * The request carries the caller's window transcript (`history`) — that is the
 * copilot's working memory, so it lives and dies with the operator's window —
 * plus the route they're on, which grounds "take me there" style requests.
 *
 * Runs the CockroachDB-backed agent (on whichever LLM provider `AI_PROVIDER`
 * selects) when configured; falls back to the deterministic mock answer()
 * otherwise, so the demo never breaks.
 */
import { isDbConfigured, isLlmConfigured } from "@/lib/config";
import { SELLER_ID, DEFAULT_SESSION_ID } from "@/lib/constants";
import type { HistoryTurn } from "@/lib/agent/loop";
import { answer } from "@/lib/mock/assistant";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const line = (obj: unknown) => encoder.encode(JSON.stringify(obj) + "\n");

/** Keep the replayed transcript bounded and well-shaped, whatever the client sends. */
function parseHistory(raw: unknown): HistoryTurn[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(-24)
    .filter(
      (t): t is HistoryTurn =>
        !!t &&
        typeof t === "object" &&
        typeof (t as HistoryTurn).text === "string" &&
        ((t as HistoryTurn).role === "user" || (t as HistoryTurn).role === "assistant"),
    )
    .map((t) => ({ role: t.role, text: t.text.slice(0, 4000) }));
}

export async function POST(req: Request) {
  let prompt = "";
  let sessionId = DEFAULT_SESSION_ID;
  let history: HistoryTurn[] = [];
  let path: string | undefined;
  try {
    const body = (await req.json()) as {
      prompt?: string;
      sessionId?: string;
      history?: unknown;
      path?: string;
    };
    prompt = (body.prompt ?? "").trim();
    sessionId = body.sessionId || DEFAULT_SESSION_ID;
    history = parseHistory(body.history);
    path = typeof body.path === "string" ? body.path.slice(0, 200) : undefined;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!prompt) {
    return Response.json({ error: "Missing prompt" }, { status: 400 });
  }

  const live = isDbConfigured() && isLlmConfigured();

  // The operator can close the copilot or navigate away mid-answer, which tears
  // the response stream down under us. `gone` distinguishes that from a genuine
  // agent failure: a dead transport must abort the turn quietly, never trigger
  // the mock fallback (which would answer into a socket nobody is reading).
  let gone = false;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      /** Enqueue one event; false means the client is no longer listening. */
      const send = (event: unknown): boolean => {
        if (gone) return false;
        try {
          controller.enqueue(line(event));
          return true;
        } catch {
          gone = true;
          return false;
        }
      };
      const finish = () => {
        if (gone) return;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        if (live) {
          try {
            const { streamCopilot } = await import("@/lib/agent/loop");
            for await (const ev of streamCopilot({
              sellerId: SELLER_ID,
              sessionId,
              prompt,
              history,
              path,
            })) {
              // Breaking here calls the generator's `return`, which closes the
              // upstream LLM stream instead of leaving it running.
              if (!send(ev.type === "done" ? { ...ev, source: "live" } : ev)) break;
            }
            finish();
            return;
          } catch (err) {
            if (gone) return;
            // Never break the demo — log and fall through to the mock stream.
            console.error("[assistant] live agent failed, using mock:", err);
            send({ type: "reset" });
          }
        }
        await streamMock(prompt, send);
        finish();
      } catch (err) {
        console.error("[assistant] stream error:", err);
        finish();
      }
    },
    cancel() {
      gone = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

/**
 * Chunk the deterministic mock reply into word-level deltas so it streams too.
 * `send` returns false once the client has gone, which ends the drip early.
 */
async function streamMock(prompt: string, send: (event: unknown) => boolean) {
  const reply = answer(prompt);
  const words = reply.text.split(/(\s+)/); // keep whitespace as its own tokens
  for (const w of words) {
    if (!w) continue;
    if (!send({ type: "text", delta: w })) return;
    await new Promise((r) => setTimeout(r, 14));
  }
  if (reply.widget && !send({ type: "widget", widget: reply.widget })) return;
  for (const action of reply.actions ?? []) {
    if (!send({ type: "action", action })) return;
  }
  send({ type: "done", followups: reply.followups, source: "mock" });
}
