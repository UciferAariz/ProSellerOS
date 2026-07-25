/**
 * Live smoke test for the Gemini listing generator (Hackathon B eligibility).
 *
 * Verifies the deployed app's real Gemini LLM call works end-to-end via
 * Vertex AI + Application Default Credentials, billing to Google Cloud credits.
 *
 * Run: npx tsx scripts/smoke-gemini.ts
 */
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local" });

async function main() {
  const { config, isGeminiConfigured } = await import("@/lib/config");
  const { generateListingCopy } = await import("@/lib/ai/gemini");

  console.log("Mode:", config.geminiUseVertex ? "Vertex AI (ADC)" : "Developer API (key)");
  console.log("Project:", config.googleCloudProject || "(none)");
  console.log("Location:", config.googleCloudLocation);
  console.log("Model:", config.geminiModelId);
  console.log("Configured:", isGeminiConfigured());
  console.log("---");

  const result = await generateListingCopy({
    name: "Wireless Noise-Cancelling Headphones",
    category: "Electronics",
    brand: "ProAudio",
  });

  console.log(JSON.stringify(result, null, 2));

  // Template fallback returns a fixed title with an em dash; a real Gemini call
  // produces something different. This lets us assert the call actually hit Vertex.
  const looksLikeTemplate = result.title.includes("— Premium Quality, Fast Shipping");
  if (looksLikeTemplate) {
    console.log("\n⚠️  Got the TEMPLATE fallback — Gemini did not run. Check ADC / project / API enablement.");
    process.exit(1);
  }
  console.log("\n✅ Live Gemini (Vertex AI) call succeeded.");
}

main().catch((err) => {
  console.error("\n❌ Gemini smoke test failed:");
  console.error(err);
  process.exit(1);
});
