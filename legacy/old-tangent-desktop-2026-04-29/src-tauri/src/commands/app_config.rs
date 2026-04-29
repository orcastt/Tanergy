use crate::db;

#[tauri::command]
pub fn get_config(key: String) -> Result<Option<String>, String> {
    let conn = db::get_connection().lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT value FROM app_config WHERE key = ?1")
        .map_err(|e| e.to_string())?;

    let result = stmt
        .query_row(rusqlite::params![key], |row| row.get::<_, String>(0))
        .ok();

    Ok(result)
}

#[tauri::command]
pub fn set_config(key: String, value: String) -> Result<(), String> {
    let conn = db::get_connection().lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO app_config (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
        rusqlite::params![key, value],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}
