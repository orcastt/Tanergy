use crate::db;
use base64::Engine;
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
    }
    .map_err(|e| e.to_string())?;

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
    let canonical = path
        .canonicalize()
        .map_err(|e| format!("invalid path: {}", e))?;
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

#[derive(Debug, Serialize)]
pub struct SaveResult {
    pub file_path: String,
}

#[tauri::command]
pub fn save_canvas_export(
    base64_data: String,
    workflow_id: String,
    node_id: String,
) -> Result<SaveResult, String> {
    let image_data = base64::engine::general_purpose::STANDARD
        .decode(&base64_data)
        .map_err(|e| format!("base64 decode: {}", e))?;

    let app_dir = db::get_app_dir();
    let assets_dir = PathBuf::from(&app_dir).join("assets").join(&workflow_id);
    fs::create_dir_all(&assets_dir).map_err(|e| format!("create dir: {}", e))?;

    let filename = format!(
        "{}_export_{}.png",
        node_id,
        chrono::Utc::now().format("%Y%m%d_%H%M%S")
    );
    let file_path = assets_dir.join(&filename);
    fs::write(&file_path, &image_data).map_err(|e| format!("write file: {}", e))?;

    let asset_id = uuid::Uuid::new_v4().to_string();
    let file_path_str = file_path.to_string_lossy().to_string();
    let size_bytes = image_data.len() as i64;

    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked.execute(
        "INSERT INTO assets (id, workflow_id, node_id, type, file_path, original_filename, size_bytes, mime_type) \
         VALUES (?1, ?2, ?3, 'image', ?4, ?5, ?6, 'image/png')",
        rusqlite::params![&asset_id, &workflow_id, &node_id, &file_path_str, &filename, size_bytes],
    ).map_err(|e| format!("insert asset: {}", e))?;

    Ok(SaveResult {
        file_path: file_path_str,
    })
}

#[tauri::command]
pub async fn ai_edit_image(
    image_base64: String,
    instruction: String,
    model: Option<String>,
) -> Result<serde_json::Value, String> {
    let model_id = model.unwrap_or_else(|| "gemini-nano-banana".to_string());
    let result =
        crate::services::ai_client::ai_edit_image(&image_base64, &instruction, &model_id, None)
            .await?;

    // Return base64 to frontend
    let b64 = base64::engine::general_purpose::STANDARD.encode(&result.image_data);
    Ok(serde_json::json!({ "base64": b64, "size": result.image_data.len() }))
}

#[tauri::command]
pub async fn ai_rewrite_html(
    original_html: String,
    instruction: String,
    model: Option<String>,
) -> Result<String, String> {
    use crate::services::ai_client::{chat_completion, ChatMessage};

    let system = r#"你是一个微信排版专家。用户选中了一段 HTML 内容，需要你根据指示进行改写。

要求：
1. 直接输出改写后的完整 HTML（只包含内容部分，不包裹 <html><body>）
2. 保留原有的 HTML 标签结构（<p> <h1> <h2> <h3> <blockquote> <ul> <ol> <strong> <em> <a> 等）
3. 只修改文字内容，不要改变标签结构
4. 输出纯 HTML，不要加任何解释说明
5. 风格参考用户指示，保持与原文风格一致"#;

    let user_msg = format!(
        "【原文 HTML】：\n{}\n\n【改写要求】：{}\n\n请直接输出改写后的 HTML。",
        original_html, instruction
    );

    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: system.into(),
        },
        ChatMessage {
            role: "user".into(),
            content: user_msg,
        },
    ];

    let model_id = model.unwrap_or_else(|| "hunyuan-3.0-preview".to_string());
    let result = chat_completion(&model_id, "", messages, 2048, Some(0.7)).await?;
    Ok(result.text)
}
