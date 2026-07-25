/**
 * Deployment diagnostics: which backing services actually work from here.
 *
 * The assistant route deliberately swallows backend failures and serves mock
 * data so a demo never breaks (see app/api/assistant/route.ts). That is the
 * right behaviour there and the wrong one when you are trying to find out why
 * `source` came back "mock" — especially on Amplify, whose compute did not
 * surface our console output to CloudWatch. This route exercises each subsystem
 * independently and reports the real error for each.
 *
 * GET /api/health
 *
 * Secrets never appear in the response: only booleans, the provider name, and
 * error messages with any credential-bearing URL redacted.
 */
import { NextResponse } from "next/server";
import { config, activeProvider, isDbConfigured, isS3Configured } from "@/lib/config";

export const dynamic = "force-dynamic";

/** Strip user:pass@host out of anything a driver puts in its message. */
function redact(msg: string): string {
  return msg.replace(/[a-z+]+:\/\/[^\s@]*@/gi, "<redacted>@");
}

async function check(fn: () => Promise<unknown>) {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false,
      ms: Date.now() - started,
      error: redact(err instanceof Error ? err.message : String(err)),
    };
  }
}

export async function GET() {
  const provider = activeProvider();

  const db = isDbConfigured()
    ? await check(async () => {
        const { query } = await import("@/lib/db/client");
        await query("SELECT 1");
      })
    : { ok: false, skipped: "COCKROACH_DSN not set" };

  // A one-token embed is the cheapest call that still proves auth end to end:
  // on Vertex it exercises the full federation -> token -> API path.
  const llm = provider
    ? await check(async () => {
        const { embed } = await import("@/lib/ai/provider");
        await embed("ping");
      })
    : { ok: false, skipped: "no LLM provider resolved from AI_PROVIDER" };

  return NextResponse.json({
    provider,
    vertex: config.geminiUseVertex,
    // Confirms whether the runtime exposes the AWS credentials that Workload
    // Identity Federation needs; absent means WIF cannot work on this host.
    awsCredsInEnv: Boolean(
      process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SESSION_TOKEN,
    ),
    region: config.awsRegion,
    gcpKeySet: config.gcpServiceAccountKey.length > 0,
    db,
    llm,
    s3: isS3Configured() ? { ok: true, bucket: config.s3Bucket } : { ok: false },
  });
}
