/**
 * Central runtime configuration for the ProSellerOS Copilot backend.
 *
 * Design goal: the app must run with ZERO configuration (mock-only, demo-safe).
 * Each subsystem exposes an `isX()` guard so callers can gracefully fall back
 * to the seeded mock data in `lib/mock/` when a service isn't wired up yet.
 */

export const config = {
  cockroachDsn: process.env.COCKROACH_DSN ?? "",

  // Which backend runs the agent's chat + embeddings: "bedrock" | "gemini".
  // Unset = auto-detect (Bedrock first, then Gemini). See activeProvider().
  aiProvider: (process.env.AI_PROVIDER ?? "").trim().toLowerCase(),

  awsRegion: process.env.AWS_REGION ?? "us-east-1",
  bedrockChatModelId:
    process.env.BEDROCK_CHAT_MODEL_ID ??
    "anthropic.claude-3-5-sonnet-20241022-v2:0",
  bedrockEmbedModelId:
    process.env.BEDROCK_EMBED_MODEL_ID ?? "amazon.titan-embed-text-v2:0",
  embedDims: Number(process.env.EMBED_DIMS ?? "1024"),
  s3Bucket: process.env.S3_BUCKET ?? "",

  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModelId: process.env.GEMINI_MODEL_ID ?? "gemini-2.5-flash",
  // Embedding model used when AI_PROVIDER=gemini. gemini-embedding-001 supports
  // flexible output dimensions (128-3072), so it matches EMBED_DIMS and the
  // existing VECTOR(1024) columns without a schema change.
  geminiEmbedModelId: process.env.GEMINI_EMBED_MODEL_ID ?? "gemini-embedding-001",
  // Vertex AI mode (Hackathon B: real Google Cloud product, bills to GCP
  // credits). When true, auth comes from Application Default Credentials (ADC)
  // instead of an API key, and calls route through the project below.
  geminiUseVertex: (process.env.GEMINI_USE_VERTEX ?? "").toLowerCase() === "true",
  googleCloudProject: process.env.GOOGLE_CLOUD_PROJECT ?? "",
  googleCloudLocation: process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1",
  // Service-account key for Vertex AI on serverless compute (Amplify/Lambda),
  // which has no ADC file on disk for the SDK to find. Raw JSON or base64 of it.
  // Leave unset locally, where `gcloud auth application-default login` supplies
  // ADC and the SDK's default credential lookup already works.
  gcpServiceAccountKey: process.env.GCP_SA_KEY ?? "",
};

/** CockroachDB memory layer is available. */
export const isDbConfigured = () => config.cockroachDsn.length > 0;

/** Amazon Bedrock (chat + embeddings) is available. */
export const isBedrockConfigured = () =>
  Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE) ||
  // On Lambda/Amplify credentials come from the execution role, not env vars.
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV);

/** Google Gemini is available (Hackathon B LLM call). */
export const isGeminiConfigured = () =>
  config.geminiUseVertex
    ? config.googleCloudProject.length > 0
    : config.geminiApiKey.length > 0;

/** Amazon S3 artifact storage is available. */
export const isS3Configured = () => config.s3Bucket.length > 0;

/** Backends that can run the agent's chat + embedding calls. */
export type AiProvider = "bedrock" | "gemini";

/**
 * Which provider the agent will actually use, or null if none is usable.
 *
 * `AI_PROVIDER` pins the choice explicitly — set it, because auto-detect prefers
 * Bedrock whenever AWS credentials exist, and on Amplify the execution role
 * always supplies them. Pinning `gemini` is what lets a Bedrock-blocked account
 * (e.g. zero on-demand model quota) run the full live agent, and switching back
 * later is a one-variable change.
 */
export function activeProvider(): AiProvider | null {
  if (config.aiProvider === "gemini") return isGeminiConfigured() ? "gemini" : null;
  if (config.aiProvider === "bedrock") return isBedrockConfigured() ? "bedrock" : null;
  if (isBedrockConfigured()) return "bedrock";
  if (isGeminiConfigured()) return "gemini";
  return null;
}

/** Some LLM backend is available, so the live agent can run. */
export const isLlmConfigured = () => activeProvider() !== null;
