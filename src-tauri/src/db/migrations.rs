use rusqlite::Connection;

const MIGRATION_001: &str = include_str!("../../migrations/001_init.sql");
const MIGRATION_002: &str = include_str!("../../migrations/002_api_keys_ext.sql");
const MIGRATION_003: &str = include_str!("../../migrations/003_credits.sql");

pub fn run(conn: &Connection) -> Result<(), String> {
    let current_version: i64 = conn
        .query_row(
            "SELECT version FROM schema_version",
            [],
            |row| row.get(0),
        )
        .unwrap_or(0);

    if current_version < 1 {
        conn.execute_batch(MIGRATION_001)
            .map_err(|e| format!("migration 001 failed: {}", e))?;
    }

    if current_version < 2 {
        conn.execute_batch(MIGRATION_002)
            .map_err(|e| format!("migration 002 failed: {}", e))?;
    }

    if current_version < 3 {
        conn.execute_batch(MIGRATION_003)
            .map_err(|e| format!("migration 003 failed: {}", e))?;
    }

    Ok(())
}
