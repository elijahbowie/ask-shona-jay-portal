CREATE TABLE IF NOT EXISTS download_assets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  strategy_key TEXT NOT NULL,
  linked_slug TEXT NOT NULL,
  status TEXT NOT NULL,
  visibility_tier TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, r2_key)
);

CREATE INDEX IF NOT EXISTS idx_download_assets_slug
  ON download_assets (tenant_id, linked_slug, status, visibility_tier, sort_order);

CREATE INDEX IF NOT EXISTS idx_download_assets_strategy
  ON download_assets (tenant_id, strategy_key, status, visibility_tier);
