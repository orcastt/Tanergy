use crate::db;
use base64::Engine;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

#[derive(Debug, Serialize)]
pub struct LibraryItemOut {
    pub id: String,
    pub kind: String,
    pub title: String,
    pub content_html: Option<String>,
    pub plain_text: Option<String>,
    pub file_path: Option<String>,
    pub mime_type: Option<String>,
    pub source_workflow_id: Option<String>,
    pub source_node_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateLibraryItemPayload {
    pub kind: String,
    pub title: String,
    pub content_html: Option<String>,
    pub plain_text: Option<String>,
    pub file_path: Option<String>,
    pub data_url: Option<String>,
    pub mime_type: Option<String>,
    pub source_workflow_id: Option<String>,
    pub source_node_id: Option<String>,
    pub tags: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct ListLibraryPayload {
    pub kind: Option<String>,
    pub query: Option<String>,
    pub tag: Option<String>,
}

#[tauri::command]
pub fn list_library_items(payload: ListLibraryPayload) -> Result<Vec<LibraryItemOut>, String> {
    let conn = db::get_connection().lock().unwrap();
    let pattern = format!("%{}%", payload.query.unwrap_or_default());
    let mut stmt = conn.prepare(
        "SELECT id, kind, title, content_html, plain_text, file_path, mime_type,
                source_workflow_id, source_node_id, created_at, updated_at
         FROM library_items
         WHERE (?1 IS NULL OR kind = ?1)
           AND (?2 = '%%' OR title LIKE ?2 OR COALESCE(plain_text, '') LIKE ?2)
           AND (?3 IS NULL OR id IN (
             SELECT lit.item_id FROM library_item_tags lit
             JOIN library_tags lt ON lt.id = lit.tag_id WHERE lt.name = ?3
           ))
         ORDER BY datetime(updated_at) DESC",
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(
        params![payload.kind, pattern, payload.tag],
        |row| row_to_item(row),
    ).map_err(|e| e.to_string())?;

    let mut items = Vec::new();
    for row in rows {
        let mut item = row.map_err(|e| e.to_string())?;
        item.tags = tags_for_item(&conn, &item.id)?;
        items.push(item);
    }
    Ok(items)
}

#[tauri::command]
pub fn list_library_tags() -> Result<Vec<String>, String> {
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn.prepare("SELECT name FROM library_tags ORDER BY name")
        .map_err(|e| e.to_string())?;
    let rows = stmt.query_map([], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_library_item(payload: CreateLibraryItemPayload) -> Result<LibraryItemOut, String> {
    if payload.kind != "text" && payload.kind != "image" {
        return Err("library item kind must be text or image".into());
    }
    let title = payload.title.trim();
    if title.is_empty() {
        return Err("library item title is required".into());
    }

    let file_path = resolve_library_file(&payload)?;
    let id = uuid::Uuid::new_v4().to_string();
    let mime_type = payload.mime_type.clone().unwrap_or_else(|| "text/plain".into());
    let conn = db::get_connection().lock().unwrap();
    conn.execute(
        "INSERT INTO library_items
         (id, kind, title, content_html, plain_text, file_path, mime_type, source_workflow_id, source_node_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &id,
            &payload.kind,
            title,
            payload.content_html.as_deref(),
            payload.plain_text.as_deref(),
            file_path.as_deref(),
            mime_type,
            payload.source_workflow_id.as_deref(),
            payload.source_node_id.as_deref(),
        ],
    ).map_err(|e| e.to_string())?;

    set_item_tags(&conn, &id, payload.tags.unwrap_or_default())?;
    get_library_item(&conn, &id)
}

#[tauri::command]
pub fn delete_library_item(id: String) -> Result<(), String> {
    let conn = db::get_connection().lock().unwrap();
    let file_path: Option<String> = conn.query_row(
        "SELECT file_path FROM library_items WHERE id = ?1",
        params![&id],
        |row| row.get(0),
    ).optional().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM library_items WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    if let Some(path) = file_path {
        if PathBuf::from(&path).starts_with(PathBuf::from(db::get_app_dir()).join("library")) {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

fn row_to_item(row: &rusqlite::Row) -> rusqlite::Result<LibraryItemOut> {
    Ok(LibraryItemOut {
        id: row.get(0)?,
        kind: row.get(1)?,
        title: row.get(2)?,
        content_html: row.get(3)?,
        plain_text: row.get(4)?,
        file_path: row.get(5)?,
        mime_type: row.get(6)?,
        source_workflow_id: row.get(7)?,
        source_node_id: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
        tags: Vec::new(),
    })
}

fn get_library_item(conn: &Connection, id: &str) -> Result<LibraryItemOut, String> {
    let mut item = conn.query_row(
        "SELECT id, kind, title, content_html, plain_text, file_path, mime_type,
                source_workflow_id, source_node_id, created_at, updated_at
         FROM library_items WHERE id = ?1",
        params![id],
        |row| row_to_item(row),
    ).map_err(|e| e.to_string())?;
    item.tags = tags_for_item(conn, id)?;
    Ok(item)
}

fn tags_for_item(conn: &Connection, item_id: &str) -> Result<Vec<String>, String> {
    let mut stmt = conn.prepare(
        "SELECT lt.name FROM library_tags lt
         JOIN library_item_tags lit ON lit.tag_id = lt.id
         WHERE lit.item_id = ?1 ORDER BY lt.name",
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![item_id], |row| row.get::<_, String>(0))
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn set_item_tags(conn: &Connection, item_id: &str, tags: Vec<String>) -> Result<(), String> {
    for tag in tags.into_iter().map(|t| t.trim().to_string()).filter(|t| !t.is_empty()) {
        let tag_id = ensure_tag(conn, &tag)?;
        conn.execute(
            "INSERT OR IGNORE INTO library_item_tags (item_id, tag_id) VALUES (?1, ?2)",
            params![item_id, tag_id],
        ).map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn ensure_tag(conn: &Connection, name: &str) -> Result<String, String> {
    if let Some(id) = conn.query_row(
        "SELECT id FROM library_tags WHERE name = ?1",
        params![name],
        |row| row.get::<_, String>(0),
    ).optional().map_err(|e| e.to_string())? {
        return Ok(id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO library_tags (id, name) VALUES (?1, ?2)",
        params![id, name],
    ).map_err(|e| e.to_string())?;
    Ok(id)
}

fn resolve_library_file(payload: &CreateLibraryItemPayload) -> Result<Option<String>, String> {
    if payload.kind != "image" {
        return Ok(payload.file_path.clone());
    }
    if let Some(data_url) = &payload.data_url {
        return save_data_url(data_url, payload.mime_type.as_deref().unwrap_or("image/png"));
    }
    Ok(payload.file_path.clone())
}

fn save_data_url(data_url: &str, mime_type: &str) -> Result<Option<String>, String> {
    let base64_data = data_url.split_once(',').map(|(_, data)| data).unwrap_or(data_url);
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64_data)
        .map_err(|e| format!("decode image data: {}", e))?;
    let app_dir = db::get_app_dir();
    let dir = PathBuf::from(app_dir).join("library").join("images");
    fs::create_dir_all(&dir).map_err(|e| format!("create library dir: {}", e))?;
    let ext = if mime_type.contains("jpeg") || mime_type.contains("jpg") { "jpg" } else { "png" };
    let file_path = dir.join(format!("library_{}.{}", uuid::Uuid::new_v4(), ext));
    fs::write(&file_path, bytes).map_err(|e| format!("write library image: {}", e))?;
    Ok(Some(file_path.to_string_lossy().to_string()))
}
