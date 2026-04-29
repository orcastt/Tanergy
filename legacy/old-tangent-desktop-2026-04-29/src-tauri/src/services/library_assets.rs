use crate::db;
use rusqlite::{params, Connection, OptionalExtension};
use std::{fs, path::PathBuf};

pub struct SavedLibraryImage {
    pub id: String,
    pub file_path: String,
    pub tags: Vec<String>,
}

pub fn save_generated_image(
    bytes: &[u8],
    title: &str,
    prompt: &str,
    workflow_id: &str,
    node_id: &str,
    model: &str,
) -> Result<SavedLibraryImage, String> {
    let file_path = save_png(bytes)?;
    let item_id = uuid::Uuid::new_v4().to_string();
    let title = clean_title(title, prompt);
    let tags = generated_image_tags(model);
    let plain_text = format!("Prompt: {}\nModel: {}", prompt, model);

    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked
        .execute(
            "INSERT INTO library_items
             (id, kind, title, plain_text, file_path, mime_type, source_workflow_id, source_node_id)
             VALUES (?1, 'image', ?2, ?3, ?4, 'image/png', ?5, ?6)",
            params![
                &item_id,
                &title,
                &plain_text,
                &file_path,
                workflow_id,
                node_id
            ],
        )
        .map_err(|e| format!("insert generated library image: {}", e))?;

    for tag in &tags {
        let tag_id = ensure_tag(&locked, tag)?;
        locked
            .execute(
                "INSERT OR IGNORE INTO library_item_tags (item_id, tag_id) VALUES (?1, ?2)",
                params![&item_id, tag_id],
            )
            .map_err(|e| format!("tag generated library image: {}", e))?;
    }

    Ok(SavedLibraryImage {
        id: item_id,
        file_path,
        tags,
    })
}

fn save_png(bytes: &[u8]) -> Result<String, String> {
    let dir = PathBuf::from(db::get_app_dir())
        .join("library")
        .join("images");
    fs::create_dir_all(&dir).map_err(|e| format!("create library image dir: {}", e))?;
    let file_path = dir.join(format!("library_{}.png", uuid::Uuid::new_v4()));
    fs::write(&file_path, bytes).map_err(|e| format!("write generated library image: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

fn clean_title(title: &str, prompt: &str) -> String {
    let candidate = title.trim();
    let fallback = prompt.trim();
    let source = if candidate.is_empty() {
        if fallback.is_empty() {
            "AI 生成图片"
        } else {
            fallback
        }
    } else {
        candidate
    };
    source.chars().take(160).collect()
}

fn generated_image_tags(model: &str) -> Vec<String> {
    vec![
        "AI生成".to_string(),
        "image_list".to_string(),
        model.chars().take(40).collect(),
    ]
}

fn ensure_tag(conn: &Connection, name: &str) -> Result<String, String> {
    if let Some(id) = conn
        .query_row(
            "SELECT id FROM library_tags WHERE name = ?1",
            params![name],
            |row| row.get::<_, String>(0),
        )
        .optional()
        .map_err(|e| e.to_string())?
    {
        return Ok(id);
    }
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO library_tags (id, name) VALUES (?1, ?2)",
        params![&id, name],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}
