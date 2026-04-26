CREATE TABLE IF NOT EXISTS library_items (
  id                 TEXT PRIMARY KEY,
  kind               TEXT NOT NULL CHECK(kind IN ('text','image')),
  title              TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
  content_html       TEXT,
  plain_text         TEXT,
  file_path          TEXT,
  mime_type          TEXT,
  source_workflow_id TEXT,
  source_node_id     TEXT,
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_library_items_kind_updated ON library_items(kind, updated_at);

CREATE TABLE IF NOT EXISTS library_tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE CHECK(length(name) BETWEEN 1 AND 40),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS library_item_tags (
  item_id TEXT NOT NULL REFERENCES library_items(id) ON DELETE CASCADE,
  tag_id  TEXT NOT NULL REFERENCES library_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, tag_id)
);

UPDATE schema_version SET version = 5;
