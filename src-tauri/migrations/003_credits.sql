INSERT OR IGNORE INTO app_config (key, value) VALUES ('supabase_jwt', '');
INSERT OR IGNORE INTO app_config (key, value) VALUES ('credit_balance_cache', '0');
UPDATE schema_version SET version = 3;
