CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS client_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  ghl_contact_id TEXT,
  tier TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  lifecycle_stage TEXT NOT NULL,
  tags_json TEXT NOT NULL,
  has_children INTEGER NOT NULL DEFAULT 0,
  access_status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, email),
  FOREIGN KEY (tenant_id) REFERENCES tenants (id)
);

CREATE TABLE IF NOT EXISTS auth_codes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT,
  admin_email TEXT,
  role TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  normalized_r2_key TEXT,
  content_hash TEXT NOT NULL,
  version_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  visibility_tier TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  effective_year TEXT NOT NULL,
  audience TEXT NOT NULL,
  review_owner TEXT NOT NULL,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, version_hash)
);

CREATE TABLE IF NOT EXISTS wiki_pages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_id TEXT,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  compiled_r2_key TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility TEXT NOT NULL,
  visibility_tier TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  effective_year TEXT NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  published_at TEXT,
  version_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, slug, version_hash)
);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  wiki_page_id TEXT,
  source_id TEXT,
  vector_id TEXT NOT NULL,
  corpus TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  text TEXT NOT NULL,
  citation_json TEXT NOT NULL,
  published INTEGER NOT NULL,
  visibility TEXT NOT NULL,
  visibility_tier TEXT NOT NULL,
  source_type TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  effective_year TEXT NOT NULL,
  requires_review INTEGER NOT NULL,
  content_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  answer_state TEXT NOT NULL,
  confidence REAL NOT NULL,
  citations_json TEXT NOT NULL,
  recommended_trainings_json TEXT NOT NULL,
  next_steps_json TEXT NOT NULL,
  escalation_required INTEGER NOT NULL,
  escalation_reason TEXT,
  model_id TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS escalations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  conversation_id TEXT,
  status TEXT NOT NULL,
  reason TEXT NOT NULL,
  question TEXT NOT NULL,
  redacted_summary TEXT NOT NULL,
  ghl_task_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL,
  rating TEXT NOT NULL,
  category TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  external_id TEXT NOT NULL,
  status TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, external_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions (client_id);
CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions (admin_email);
CREATE INDEX IF NOT EXISTS idx_sources_status ON source_documents (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_wiki_status ON wiki_pages (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_chunks_retrieval ON knowledge_chunks (tenant_id, published, visibility_tier, strategy_key, effective_year);
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations (tenant_id, client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_escalations_status ON escalations (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_health_status ON health_findings (tenant_id, status);
