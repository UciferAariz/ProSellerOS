# Submission Guide — Two Hackathons, One Codebase

This project targets two hackathons from a single codebase. Everything technical
is in this repo; the items marked **YOU** are real-world evidence only you can
supply (don't fabricate — both events require verifiable proof).

---

## Hackathon A — CockroachDB + AWS (agentic app on AWS)

**What to say it is:** an agentic multi-marketplace seller copilot whose persistent
memory + semantic search run on CockroachDB, executed on AWS.

Checklist:
- [x] Agentic app with CockroachDB as the persistent memory layer — `agent_memory`
      + `catalog_embeddings` (`VECTOR`, C-SPANN). See [ARCHITECTURE.md](./ARCHITECTURE.md).
- [x] ≥2 CockroachDB tools: **Vector Indexing + Managed MCP Server + ccloud CLI** (3).
- [x] ≥1 AWS service: **Lambda + Bedrock + S3 + Amplify Hosting** (4).
- [x] Runs on AWS (Amplify Hosting, Next.js SSR).
- [x] Public repo + MIT `LICENSE` + README + run instructions.
- [ ] **YOU:** deploy (`ccloud` cluster + Amplify), record the <3-min video showing
      the **CockroachDB memory layer at work** (see shot list below), publish repo/demo URLs.

## Hackathon B — hacker.fund / Google Cloud (AI business)

**What to say it is:** an AI business (Small Business Services / Entrepreneurship)
whose copilot uses Gemini; report the real revenue/users of the ProSellerOS business.
Full assets — Gemini architecture diagram + revenue/user evidence template — are in
[HACKATHON-B.md](./HACKATHON-B.md).

Checklist:
- [x] ≥1 Google Cloud product + **Gemini for ≥1 LLM call in the deployed app**
      ([lib/ai/gemini.ts](../lib/ai/gemini.ts), `POST /api/listing`).
- [ ] **YOU:** category selection + text description of how AI transforms the workflow.
- [ ] **YOU — revenue evidence** (required, USD): Total revenue from arms-length
      third-party customers; **revenue by month for May, June, July, August 2026**;
      total expenses (hosting, AI API usage, contractor fees); marketing/CAC spend
      (disclose even if zero); related-party revenue reported separately.
- [ ] **YOU — user evidence:** number of users + who they are; testimonials/feedback
      (with users aware their info is shared).
- [ ] **YOU — product-running evidence:** agent execution logs / API usage /
      dashboards. CloudWatch logs for `/api/assistant` + Bedrock/Gemini usage records
      double as this.
- [ ] **YOU:** corporate ID if submitting as an organization.

> Note: reusing one project across two hackathons can touch each event's
> "newly created during the submission period" rule. Frame each submission on its
> own merits and disclose shared/pre-existing work as each event requires.

---

## Video shot list (<3 min, both events)

1. Landing + dashboard (5s) — the polished product.
2. Assistant: ask *"Which products are declining and why?"* → real answer + chart.
   Say: numbers come from **live CockroachDB**, not mock.
3. **Memory layer at work:** in a terminal, via the **CockroachDB MCP server** or
   `ccloud`/SQL, run `SELECT role, left(content,60), created_at FROM agent_memory
   ORDER BY created_at DESC LIMIT 5;` right after the chat → show the turn was
   persisted. Reload the page, ask a follow-up → show it recalls context.
4. Vector search: `EXPLAIN` a semantic query to show the C-SPANN index in use.
5. Gemini: ask *"Generate a listing for my bestseller"* → listing widget; show the
   Gemini call in logs + the artifact object in S3.
6. AWS: Bedrock/CloudWatch usage; the live Amplify URL.

## Deploy runbook (summary — full steps in [DEPLOY.md](./DEPLOY.md))

1. `ccloud cluster create` → put the connection string in `.env.local` as `COCKROACH_DSN`.
2. Pick the LLM backend with `AI_PROVIDER` — `bedrock` (enable model access for
   Claude + Titan v2) or `gemini` (no AWS model access needed). Set AWS creds +
   `S3_BUCKET` either way.
3. Get a `GEMINI_API_KEY` (required for the listing feature on both paths).
4. `npm run db:bootstrap` (setup → seed → ingest embeddings). Re-run
   `npm run db:ingest` if you later change `AI_PROVIDER`.
5. `npm run build && npm start` locally to verify, then push to **Amplify Hosting**
   and set the same env vars there. Grant the compute role Bedrock + S3 via
   [infra/amplify-compute-policy.yaml](../infra/amplify-compute-policy.yaml).
