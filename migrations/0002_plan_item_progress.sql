CREATE TABLE IF NOT EXISTS plan_item_progress (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  title TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  committed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, client_id, title),
  FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  FOREIGN KEY (client_id) REFERENCES client_profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_plan_item_progress_client
  ON plan_item_progress (tenant_id, client_id, updated_at);
