# Deploy runbook — ProSellerOS Copilot on AWS Amplify Hosting

Full steps to take the app from a local repo to a live URL on **AWS Amplify
Hosting** (Next.js 15 SSR). The app runs on mock data with zero config, so you
can deploy first and wire the live backend incrementally.

> AWS console labels shift between Amplify versions. Where a menu name might
> differ, the runbook says what to look for, not just where. Verify resource
> names against your account before applying.

---

## 0. Prerequisites

| Need | How |
|---|---|
| CockroachDB Serverless cluster | `ccloud cluster create` -> Connect -> "General connection string" |
| S3 bucket | `aws s3 mb s3://YOUR-BUCKET --region ap-southeast-2` |
| An LLM provider | Either Bedrock **or** Gemini — see [Choosing the LLM provider](#choosing-the-llm-provider) |
| Bedrock model access (if `AI_PROVIDER=bedrock`) | Bedrock console -> Model access -> enable **Claude 3.5 Sonnet** and **Titan Text Embeddings v2** in your region. Verify with `aws bedrock-runtime converse` before deploying. |
| Gemini key | `GEMINI_API_KEY` from aistudio.google.com, or Vertex AI + ADC |
| GitHub repo | `origin` is already set; push `main` |

### Choosing the LLM provider

`AI_PROVIDER` selects which backend runs the agent's chat and embeddings. Both
run the **same** agent loop, tool set, and CockroachDB memory layer — only the
provider differs, so this is a one-variable switch with no code change.

| `AI_PROVIDER` | Chat | Embeddings | Use when |
|---|---|---|---|
| `bedrock` | Claude 3.5 Sonnet (via `apac.` inference profile) | Titan Text Embeddings v2 | Your account has Bedrock on-demand quota |
| `gemini` | `gemini-2.5-flash` | `gemini-embedding-001` @ 1024 dims | Bedrock is unavailable, or you want the Gemini-centric story |

Leave it **blank** and the app auto-detects, preferring Bedrock whenever AWS
credentials are present. On Amplify the execution role always supplies
credentials, so **set `AI_PROVIDER` explicitly** to force Gemini.

Both providers emit unit-length vectors of `EMBED_DIMS` (1024) dims, matching
the `VECTOR(1024)` columns in [db/schema.sql](../db/schema.sql) — so switching
providers needs no schema change. It **does** require re-running
`npm run db:ingest`, because vectors from different models are not comparable.

> Hackathon A requires >=1 AWS service and is unaffected by running on Gemini:
> Amplify Hosting, Lambda (SSR compute), and S3 still apply.

**Region note (ap-southeast-2):** Claude must be invoked through its APAC
**cross-region inference profile** (`apac.anthropic.claude-3-5-sonnet-20241022-v2:0`);
the raw model id returns "Operation not allowed". Titan embeddings are called
directly. This is already the default in [.env.example](../.env.example) and
[lib/config.ts](../lib/config.ts).

---

## 1. Bootstrap the database (local, one time)

```bash
cp .env.example .env.local   # fill in COCKROACH_DSN, AWS creds, S3_BUCKET, GEMINI_*
npm ci
npm run db:bootstrap         # setup schema -> seed -> ingest embeddings
npm run build && npm start   # verify the live backend locally before deploying
```

If any service is unset the app still builds and runs on mock data.

---

## 2. Create the Amplify app

1. Amplify console -> **Create new app** -> **Deploy with Git** -> pick this repo
   and the `main` branch.
2. Amplify auto-detects **Next.js (SSR)** and uses [amplify.yml](../amplify.yml)
   at the repo root. Confirm the platform shows **Web Compute** (SSR), not
   "Static". This works because [next.config.ts](../next.config.ts) does **not**
   set `output: "export"`.
3. Node version is pinned to 20 via [.nvmrc](../.nvmrc).

---

## 3. Environment variables

Amplify console -> **App settings -> Environment variables**. Set the same
values you used in `.env.local`:

> **These do NOT reach the server runtime on their own.** Amplify exposes console
> variables to the *build* only; Next.js server components see none of them, by
> design, so build-time secrets can't leak into a deployment. The symptom is
> nasty: everything deploys green, `activeProvider()` auto-detects Bedrock from
> the Lambda env, and the assistant serves mock data. [amplify.yml](../amplify.yml)
> therefore writes them into `.env.production` during the build — any variable
> added below must also be added to that grep pattern.
> ([AWS docs](https://docs.aws.amazon.com/amplify/latest/userguide/ssr-environment-variables.html))

```
AI_PROVIDER=gemini            # or "bedrock" — see "Choosing the LLM provider"
COCKROACH_DSN=postgresql://...:26257/proselleros?sslmode=verify-full
EMBED_DIMS=1024
S3_BUCKET=YOUR-BUCKET
GEMINI_USE_VERTEX=true        # bills to GCP credits; see "Vertex AI on Amplify"
GOOGLE_CLOUD_PROJECT=your-gcp-project
GOOGLE_CLOUD_LOCATION=us-central1
GCP_SA_KEY=<base64 of wif-config.json (preferred) or a service account key>
GEMINI_MODEL_ID=gemini-2.5-flash
GEMINI_EMBED_MODEL_ID=gemini-embedding-001
# Only needed when AI_PROVIDER=bedrock:
BEDROCK_CHAT_MODEL_ID=apac.anthropic.claude-3-5-sonnet-20241022-v2:0
BEDROCK_EMBED_MODEL_ID=amazon.titan-embed-text-v2:0
```

Do **not** set `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` in Amplify — on the
compute the SDK uses the execution role (next step). `isBedrockConfigured()`
already treats the Amplify/Lambda execution env as "credentials present".

**Amplify rejects any variable name starting with `AWS`** ("Environment
variables cannot start with the reserved prefix AWS"), so `AWS_REGION` cannot be
set here at all. The Lambda runtime supplies it, matching the app's own region.
To pin it anyway, use the non-reserved `APP_AWS_REGION`, which
[lib/config.ts](../lib/config.ts) checks first.

### Vertex AI on Amplify

Locally, Vertex mode authenticates with Application Default Credentials written
by `gcloud auth application-default login`. **Amplify's compute has no gcloud and
no ADC file**, and the SDK's `GOOGLE_APPLICATION_CREDENTIALS` fallback wants a
*file path*, which an env var cannot provide. Left unhandled, every Gemini call
fails and [app/api/assistant/route.ts](../app/api/assistant/route.ts) quietly
serves the mock answer instead — the page still looks fine, so check `source`.

Supply credentials through `GCP_SA_KEY` instead. It accepts either a service
account key **or** a Workload Identity Federation config — both are JSON, and
[lib/ai/gemini.ts](../lib/ai/gemini.ts) passes either to the SDK unchanged.

**Prefer federation.** It issues no long-lived key at all: the Amplify compute
role impersonates the service account directly, so the value you paste into the
console is configuration, not a credential. Many organizations also enforce
`constraints/iam.disableServiceAccountKeyCreation`, which makes
`gcloud iam service-accounts keys create` fail outright with `FAILED_PRECONDITION`
— on such a project federation is the only route.

```bash
PROJECT=your-gcp-project          # e.g. project-bccad6de-f34b-4275-91a
PROJECT_NUMBER=000000000000       # gcloud projects describe "$PROJECT" --format="value(projectNumber)"
AWS_ACCOUNT=000000000000          # aws sts get-caller-identity --query Account --output text
ROLE=AmplifySSRLoggingRole-xxxx   # Amplify console -> App settings -> IAM roles -> compute role

gcloud services enable sts.googleapis.com aiplatform.googleapis.com --project "$PROJECT"

gcloud iam service-accounts create proselleros-vertex \
  --display-name "ProSellerOS Vertex AI" --project "$PROJECT"

gcloud projects add-iam-policy-binding "$PROJECT" \
  --member "serviceAccount:proselleros-vertex@$PROJECT.iam.gserviceaccount.com" \
  --role roles/aiplatform.user

gcloud iam workload-identity-pools create aws-pool --location=global --project "$PROJECT"

gcloud iam workload-identity-pools providers create-aws aws-provider \
  --location=global --workload-identity-pool=aws-pool \
  --account-id="$AWS_ACCOUNT" --project "$PROJECT"

# Amplify role ARNs exceed the 127-byte cap on google.subject, so map the
# subject to just the role name. Without this the token exchange is rejected
# with "The size of mapped attribute google.subject exceeds the 127 bytes limit".
gcloud iam workload-identity-pools providers update-aws aws-provider \
  --location=global --workload-identity-pool=aws-pool --project "$PROJECT" \
  --attribute-mapping="google.subject=assertion.arn.extract('assumed-role/{role_name}/')"

gcloud iam service-accounts add-iam-policy-binding \
  "proselleros-vertex@$PROJECT.iam.gserviceaccount.com" \
  --role=roles/iam.workloadIdentityUser --project "$PROJECT" \
  --member="principal://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/aws-pool/subject/$ROLE"

gcloud iam workload-identity-pools create-cred-config \
  "projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/aws-pool/providers/aws-provider" \
  --service-account="proselleros-vertex@$PROJECT.iam.gserviceaccount.com" \
  --aws --output-file=wif-config.json

# Base64 so the value carries no quotes, newlines or commas.
base64 -w0 wif-config.json      # macOS: base64 -i wif-config.json
```

Federation works on Amplify because its compute exposes `AWS_ACCESS_KEY_ID` and
`AWS_SESSION_TOKEN`, which is where google-auth-library looks before falling
back to IMDS (absent on Lambda). `/api/health` reports this as `awsCredsInEnv`.

The binding is the slowest part to take effect — allow a few minutes before
concluding it failed. Until it propagates the error is
`Permission 'iam.serviceAccounts.getAccessToken' denied`, which reads like a
misconfiguration but usually just means "not yet".

On Windows, `base64` does not exist — use PowerShell instead:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("$PWD\wif-config.json")) | Set-Clipboard
(Get-Clipboard).Length   # sanity check: expect ~900-3000 chars, never 0
```

`$PWD` is required, not decoration: PowerShell's `cd` does not change the .NET
process working directory, so a bare `"wif-config.json"` resolves against the
directory the shell was launched from and throws `FileNotFoundException`.

Paste that string as `GCP_SA_KEY` in the Amplify console. `roles/aiplatform.user`
is the least privilege that can call Vertex models.

`wif-config.json` holds no secret — it names the pool, provider and service
account, and the actual credential is minted per request from the compute role.
If you used a service account key instead, that file **is** an unexpiring
private key: delete it immediately and keep it out of the repo.

Leave `GCP_SA_KEY` unset locally so your machine keeps using ADC. The parsing
lives in [lib/ai/gemini.ts](../lib/ai/gemini.ts) and accepts raw JSON too.

---

## 4. Grant the compute role Bedrock + S3

The `/api/*` routes call Bedrock and S3 from the SSR compute, so its **execution
(compute) role** needs permission. Prefer the CloudFormation policy (IaC):

```bash
aws cloudformation deploy \
  --template-file infra/amplify-compute-policy.yaml \
  --stack-name proselleros-compute-policy \
  --parameter-overrides ArtifactBucketName=YOUR-BUCKET \
  --capabilities CAPABILITY_NAMED_IAM \
  --region ap-southeast-2
# -> copy the PolicyArn output
```

Then attach that managed policy to the Amplify app's **compute (SSR) role**
(Amplify console -> App settings -> **IAM roles** -> the SSR/compute role ->
Attach policy). If your app has no compute role yet, create one Amplify can
assume for compute and set it there.

Prefer the console/CLI by hand? [infra/amplify-compute-policy.json](../infra/amplify-compute-policy.json)
is the same policy as an inline document — replace `ACCOUNT_ID`, `REGION`,
`BUCKET_NAME`.

**S3 CORS** (only if the browser will fetch artifact URLs directly): add a CORS
rule on the bucket allowing `GET` from your Amplify domain.

---

## 5. Deploy & verify

1. Trigger a build (push to `main`, or **Redeploy this version**).
2. Check every backing service at once — **do this first**, it names the broken
   one instead of leaving you to guess from a mock answer:
   ```bash
   curl -s https://YOUR-APP.amplifyapp.com/api/health
   ```
   Want `provider:"gemini"`, `vertex:true`, and `ok:true` for `db`, `llm`, `s3`.
   [app/api/health/route.ts](../app/api/health/route.ts) reports each subsystem's
   real error; secrets are redacted from the output.
3. Open the Amplify URL -> **/assistant**.
4. Ask *"Which products are declining and why?"* You should get a streamed answer
   plus the declining-products chart.
5. Confirm it is **live**, not mock: the `/api/assistant` stream ends with
   `{"type":"done",...,"source":"live"}`. Check with:
   ```bash
   curl -sN -X POST https://YOUR-APP.amplifyapp.com/api/assistant \
     -H "Content-Type: application/json" \
     -d '{"prompt":"declining products","sessionId":"deploy-check"}' | tail -1
   ```
6. Confirm CockroachDB memory persisted the turn:
   ```sql
   SELECT role, left(content,60), created_at
   FROM agent_memory ORDER BY created_at DESC LIMIT 5;
   ```

---

## 6. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Answers work but `source:"mock"` | Live backend not fully configured or the agent threw. Check CloudWatch logs for `[assistant] live agent failed`. Usually a missing env var or the compute role lacks Bedrock/S3. |
| `AccessDeniedException` on Bedrock | Compute role missing the policy from step 4, **or** model access not enabled in the Bedrock console for this region. |
| `Operation not allowed` / model-id error | In ap-southeast-2 you must use the `apac.` cross-region **inference profile** id, not the raw model id. |
| `Operation not allowed` on **every** Bedrock model, including Titan | Account-level zero quota, not a config error. Check with `aws service-quotas list-service-quotas --service-code bedrock --region ap-southeast-2`; if the on-demand requests-per-minute values are `0.0` and marked `Adjustable: False`, only AWS Support can raise them. Set `AI_PROVIDER=gemini` to run the full live agent meanwhile. |
| `Could not load the default credentials` / 401 from Vertex, only when deployed | `GEMINI_USE_VERTEX=true` with no `GCP_SA_KEY`. Amplify has no ADC file — see [Vertex AI on Amplify](#vertex-ai-on-amplify). |
| `GCP_SA_KEY is set but is not valid JSON or base64-encoded JSON` | The value was truncated or mangled when pasted. Re-copy the `base64 -w0` output as a single line. |
| `The size of mapped attribute google.subject exceeds the 127 bytes limit` | Amplify role ARNs are too long for the default AWS mapping. Remap the subject to the role name — see [Vertex AI on Amplify](#vertex-ai-on-amplify). |
| `Permission 'iam.serviceAccounts.getAccessToken' denied` | The `workloadIdentityUser` binding does not match the mapped subject, or has not propagated yet. Confirm with `gcloud iam service-accounts get-iam-policy`, then wait a few minutes. |
| `FAILED_PRECONDITION: Key creation is not allowed on this service account` | Org policy `constraints/iam.disableServiceAccountKeyCreation`. Don't fight it — use Workload Identity Federation, which needs no key. |
| Everything mocks and `/api/health` shows `provider` wrong, `COCKROACH_DSN not set` | Console env vars never reach the Next.js server runtime. [amplify.yml](../amplify.yml) must write them to `.env.production` during the build. |
| Vertex `403 Permission denied` on `aiplatform` | Service account is missing `roles/aiplatform.user`, or the Vertex AI API is not enabled: `gcloud services enable aiplatform.googleapis.com`. |
| Gemini answers are empty but tools ran | Output budget consumed by thinking tokens. The adapter sets `thinkingConfig.thinkingBudget = 0` for this reason; if you raise it, also raise `maxTokens`. |
| Gemini 400 on a tool call | A no-argument tool sent `properties: {}`. Gemini rejects empty OBJECT schemas; the adapter omits `parameters` for such tools ([lib/ai/gemini-agent.ts](../lib/ai/gemini-agent.ts)). |
| Semantic search quality dropped after switching provider | Re-run `npm run db:ingest`. Vectors from different embedding models are not comparable. |
| `ThrottlingException` | Bedrock on-demand quota. Retry, or request a quota increase. |
| DB connect fails on Amplify | DSN must be the full `sslmode=verify-full` string; ensure the cluster allows the Amplify egress. |
| Stream appears to arrive all at once | Some CDN/compute layers buffer responses. The UI renders identically either way; the response already sets `Cache-Control: no-transform`. Functionality is unaffected. |

---

## What each file does

- [lib/ai/provider.ts](../lib/ai/provider.ts) — selects the LLM backend from `AI_PROVIDER`; the agent imports from here and never names a vendor.
- [lib/ai/contract.ts](../lib/ai/contract.ts) — the shared provider interface both adapters implement.
- [lib/ai/bedrock.ts](../lib/ai/bedrock.ts) / [lib/ai/gemini-agent.ts](../lib/ai/gemini-agent.ts) — the two interchangeable adapters.
- [amplify.yml](../amplify.yml) — build spec (Node 20, `npm ci`, `next build`, `.next` artifacts + caches).
- [.nvmrc](../.nvmrc) — pins the Amplify build to Node 20.
- [infra/amplify-compute-policy.yaml](../infra/amplify-compute-policy.yaml) — CloudFormation managed policy (Bedrock + S3) for the compute role.
- [infra/amplify-compute-policy.json](../infra/amplify-compute-policy.json) — the same policy as an inline IAM document.
