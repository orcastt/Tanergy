CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY
);
INSERT OR IGNORE INTO schema_version (version) VALUES (1);

CREATE TABLE IF NOT EXISTS app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS api_keys (
  provider      TEXT PRIMARY KEY,
  encrypted_key BLOB NOT NULL,
  is_valid      INTEGER NOT NULL DEFAULT 0,
  last_tested_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workflows (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  graph_json     TEXT NOT NULL DEFAULT '{}',
  thumbnail_path TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_workflows_updated ON workflows(updated_at);

CREATE TABLE IF NOT EXISTS assets (
  id                TEXT PRIMARY KEY,
  workflow_id       TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  node_id           TEXT NOT NULL,
  type              TEXT NOT NULL CHECK(type IN ('image','video','audio','html')),
  file_path         TEXT NOT NULL,
  original_filename TEXT,
  size_bytes        INTEGER NOT NULL,
  mime_type         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_assets_workflow ON assets(workflow_id);

CREATE TABLE IF NOT EXISTS execution_logs (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT,
  node_id       TEXT NOT NULL,
  node_type     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('running','success','failed','cancelled')),
  error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_logs_workflow ON execution_logs(workflow_id);
