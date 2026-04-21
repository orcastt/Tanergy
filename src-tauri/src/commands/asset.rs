use crate::db;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Serialize)]
pub struct AssetOut {
    pub id: String,
    pub node_id: String,
    pub r#type: String,
    pub file_path: String,
    pub original_filename: Option<String>,
    pub size_bytes: i64,
    pub mime_type: String,
    pub created_at: String,
}

fn row_to_asset(row: &rusqlite::Row) -> rusqlite::Result<AssetOut> {
    Ok(AssetOut {
        id: row.get(0)?,
        node_id: row.get(1)?,
        r#type: row.get(2)?,
        file_path: row.get(3)?,
        original_filename: row.get(4)?,
        size_bytes: row.get(5)?,
        mime_type: row.get(6)?,
        created_at: row.get(7)?,
    })
}

#[tauri::command]
pub fn get_assets(workflow_id: String, node_id: Option<String>) -> Result<Vec<AssetOut>, String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();

    let sql = if node_id.is_some() {
        "SELECT id, node_id, type, file_path, original_filename, size_bytes, mime_type, created_at \
         FROM assets WHERE workflow_id = ?1 AND node_id = ?2 ORDER BY created_at"
    } else {
        "SELECT id, node_id, type, file_path, original_filename, size_bytes, mime_type, created_at \
         FROM assets WHERE workflow_id = ?1 ORDER BY created_at"
    };

    let mut stmt = locked.prepare(sql).map_err(|e| e.to_string())?;

    let rows = match &node_id {
        Some(nid) => stmt.query_map(rusqlite::params![workflow_id, nid], row_to_asset),
        None => stmt.query_map(rusqlite::params![workflow_id], row_to_asset),
    }.map_err(|e| e.to_string())?;

    let mut assets = Vec::new();
    for row in rows {
        assets.push(row.map_err(|e| e.to_string())?);
    }
    Ok(assets)
}

#[tauri::command]
pub fn read_asset_file(file_path: String) -> Result<Vec<u8>, String> {
    let path = PathBuf::from(&file_path);

    let app_dir = db::get_app_dir();
    let assets_root = PathBuf::from(&app_dir).join("assets");
    let canonical = path.canonicalize().map_err(|e| format!("invalid path: {}", e))?;
    let canonical_root = assets_root.canonicalize().unwrap_or(assets_root);
    if !canonical.starts_with(&canonical_root) {
        return Err("path traversal: file must be under assets directory".into());
    }

    fs::read(&path).map_err(|e| format!("read file: {}", e))
}

#[tauri::command]
pub fn delete_asset(id: String) -> Result<(), String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();

    let file_path: String = locked
        .query_row(
            "SELECT file_path FROM assets WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "asset not found")?;

    locked
        .execute("DELETE FROM assets WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| e.to_string())?;

    drop(locked);

    let _ = fs::remove_file(&file_path);

    Ok(())
}
