ALTER TABLE api_keys ADD COLUMN base_url TEXT;
ALTER TABLE api_keys ADD COLUMN config_json TEXT;
UPDATE schema_version SET version = 2;
