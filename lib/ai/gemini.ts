/**
 * Google Gemini provider.
 *
 * This is the deployed app's Gemini API call required by Hackathon B. The
 * copilot's "generate a listing / marketing copy" feature always routes through
 * Gemini (Vertex AI / Google AI), regardless of `AI_PROVIDER`.
 *
 * Gemini can also run the core analytics agent — see `lib/ai/gemini-agent.ts`,
 * which reuses the client exported here.
 */
import { GoogleGenAI } from "@google/genai";
import { config, isGeminiConfigured } from "@/lib/config";

export interface ListingCopy {
  title: string;
  bullets: string[];
  keywords: string[];
}

/**
 * Inline Vertex credentials, for compute with no ADC file on disk.
 *
 * Locally this returns undefined and the SDK falls back to Application Default
 * Credentials from `gcloud auth application-default login`. On Amplify/Lambda
 * there is no such file and no gcloud, so `GCP_SA_KEY` carries the service
 * account key instead — accepted as raw JSON, or base64 of it (base64 has no
 * quotes, newlines or commas, so it survives console env-var fields intact).
 */
function vertexCredentials() {
  const raw = config.gcpServiceAccountKey.trim();
  if (!raw) return undefined;
  const json = raw.startsWith("{")
    ? raw
    : Buffer.from(raw, "base64").toString("utf8");
  try {
    return { credentials: JSON.parse(json) };
  } catch {
    // Don't fall back to ADC that isn't there — a malformed key would surface
    // much later as a generic auth failure, and the API route swallows those
    // into a mock answer. Fail here, where the message names the cause.
    throw new Error(
      "GCP_SA_KEY is set but is not valid JSON or base64-encoded JSON.",
    );
  }
}

let genai: GoogleGenAI | null = null;
/** Shared client, reused by the agent adapter in `lib/ai/gemini-agent.ts`. */
export function getClient(): GoogleGenAI {
  if (!genai) {
    // Vertex AI mode bills to the Google Cloud project and authenticates with
    // ADC, or the inline service-account key above when ADC is unavailable;
    // API-key mode uses the Gemini Developer API. Same SDK either way.
    genai = config.geminiUseVertex
      ? new GoogleGenAI({
          vertexai: true,
          project: config.googleCloudProject,
          location: config.googleCloudLocation,
          googleAuthOptions: vertexCredentials(),
        })
      : new GoogleGenAI({ apiKey: config.geminiApiKey });
  }
  return genai;
}

/** Generate an SEO-optimized marketplace listing with Gemini. */
export async function generateListingCopy(product: {
  name: string;
  category: string;
  brand: string;
}): Promise<ListingCopy> {
  if (!isGeminiConfigured()) return templateListing(product);

  const prompt =
    `You are an e-commerce copywriter. Write an SEO-optimized marketplace listing for this product ` +
    `and respond with ONLY minified JSON (no markdown), matching exactly:\n` +
    `{"title": string, "bullets": string[4], "keywords": string[5]}\n\n` +
    `Product name: ${product.name}\nCategory: ${product.category}\nBrand: ${product.brand}\n` +
    `Title must be under 80 chars. Bullets are benefit-led. Keywords are lowercase search terms.`;

  const res = await getClient().models.generateContent({
    model: config.geminiModelId,
    contents: prompt,
  });
  const raw = (res.text ?? "").trim();
  return parseListing(raw, product);
}

function parseListing(raw: string, product: { name: string; category: string; brand: string }): ListingCopy {
  // Strip accidental code fences, then parse.
  const json = raw.replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  try {
    const obj = JSON.parse(json) as Partial<ListingCopy>;
    if (obj.title && Array.isArray(obj.bullets) && Array.isArray(obj.keywords)) {
      return {
        title: obj.title,
        bullets: obj.bullets.slice(0, 4),
        keywords: obj.keywords.slice(0, 6).map((k) => String(k).toLowerCase()),
      };
    }
  } catch {
    /* fall through to template */
  }
  return templateListing(product);
}

function templateListing(product: { name: string; category: string; brand: string }): ListingCopy {
  return {
    title: `${product.name} — Premium Quality, Fast Shipping`,
    bullets: [
      "Crafted with premium materials for lasting durability and everyday comfort",
      "Trusted by thousands of verified buyers with top ratings",
      "Ships within 24 hours with tracked, insured delivery",
      "30-day hassle-free returns and dedicated support",
    ],
    keywords: [product.category.toLowerCase(), product.brand.toLowerCase(), "premium", "bestseller", "gift"],
  };
}
