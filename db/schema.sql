-- ProSellerOS Copilot — CockroachDB schema
-- Persistent memory + distributed vector layer for the agentic seller copilot.
--
-- Vector columns are VECTOR(1024), matching both Amazon Titan Text Embeddings v2
-- (default 1024 dims) and gemini-embedding-001 (flexible 128-3072 dims, asked for
-- 1024). If you change EMBED_DIMS, change the dimension here too, and re-run
-- `npm run db:ingest` — vectors from different models are not comparable.
-- C-SPANN distributed vector indexes (CockroachDB v25.2+) power ANN search;
-- if your cluster predates vector indexes, the CREATE VECTOR INDEX lines are
-- skipped by scripts/setup-db.ts and queries fall back to exact search.

-- ── Core commerce tables (mirror lib/mock/) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS sellers (
  id        STRING PRIMARY KEY,
  name      STRING NOT NULL,
  email     STRING,
  org       STRING,
  plan      STRING,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplaces (
  id       STRING PRIMARY KEY,
  name     STRING NOT NULL,
  color    STRING,
  region   STRING,
  category STRING
);

CREATE TABLE IF NOT EXISTS products (
  id           STRING PRIMARY KEY,
  seller_id    STRING NOT NULL REFERENCES sellers(id),
  sku          STRING NOT NULL,
  name         STRING NOT NULL,
  category     STRING,
  brand        STRING,
  price        DECIMAL,
  cost         DECIMAL,
  stock        INT,
  reorder_point INT,
  status       STRING,
  rating       DECIMAL,
  reviews      INT,
  units_30d    INT,
  revenue_30d  DECIMAL,
  trend        DECIMAL,
  margin       DECIMAL,
  tags         STRING[],
  created_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS product_listings (
  product_id  STRING NOT NULL REFERENCES products(id),
  marketplace STRING NOT NULL,
  status      STRING,
  price       DECIMAL,
  PRIMARY KEY (product_id, marketplace)
);

CREATE TABLE IF NOT EXISTS orders (
  id          STRING PRIMARY KEY,
  seller_id   STRING NOT NULL REFERENCES sellers(id),
  number      STRING,
  marketplace STRING,
  customer    STRING,
  city        STRING,
  status      STRING,
  payment     STRING,
  total       DECIMAL,
  item_count  INT,
  placed_at   TIMESTAMPTZ,
  flagged     BOOL
);

CREATE TABLE IF NOT EXISTS order_items (
  order_id   STRING NOT NULL REFERENCES orders(id),
  product_id STRING,
  name       STRING,
  sku        STRING,
  qty        INT,
  price      DECIMAL,
  seq        INT,
  PRIMARY KEY (order_id, seq)
);

CREATE TABLE IF NOT EXISTS insights (
  id      STRING PRIMARY KEY,
  seller_id STRING NOT NULL REFERENCES sellers(id),
  type    STRING,
  title   STRING,
  detail  STRING,
  impact  STRING,
  action  STRING
);

-- ── Agent memory (conversation history + long-term facts) ───────────────────
-- Every copilot turn is persisted here with its embedding, so past context is
-- recalled by semantic similarity across sessions — the "persistent memory".

CREATE TABLE IF NOT EXISTS agent_memory (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id  STRING NOT NULL,
  session_id STRING NOT NULL,
  role       STRING NOT NULL,          -- 'user' | 'assistant' | 'fact'
  content    STRING NOT NULL,
  embedding  VECTOR(1024),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_memory_session_idx
  ON agent_memory (seller_id, session_id, created_at);

-- ── Catalog embeddings (semantic search / RAG over products & insights) ─────

CREATE TABLE IF NOT EXISTS catalog_embeddings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   STRING NOT NULL,
  entity_type STRING NOT NULL,         -- 'product' | 'order' | 'insight'
  entity_id   STRING NOT NULL,
  content     STRING NOT NULL,
  metadata    JSONB,
  embedding   VECTOR(1024),
  UNIQUE (entity_type, entity_id)
);

-- ── C-SPANN distributed vector indexes (v25.2+; skipped gracefully if older) ─
CREATE VECTOR INDEX IF NOT EXISTS agent_memory_vec_idx ON agent_memory (embedding);
CREATE VECTOR INDEX IF NOT EXISTS catalog_embeddings_vec_idx ON catalog_embeddings (embedding);
