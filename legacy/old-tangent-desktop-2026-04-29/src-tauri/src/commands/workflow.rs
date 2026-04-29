use crate::db;
use crate::services::license;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowOut {
    pub id: String,
    pub name: String,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct WorkflowDetail {
    pub id: String,
    pub name: String,
    pub graph_json: Option<String>,
    pub thumbnail_path: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[tauri::command]
pub fn list_workflows() -> Result<Vec<WorkflowOut>, String> {
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, thumbnail_path, created_at, updated_at FROM workflows ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(WorkflowOut {
                id: row.get(0)?,
                name: row.get(1)?,
                thumbnail_path: row.get(2)?,
                created_at: row.get(3)?,
                updated_at: row.get(4)?,
            })
        })
        .map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

#[tauri::command]
pub fn get_workflow(id: String) -> Result<WorkflowDetail, String> {
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT id, name, graph_json, thumbnail_path, created_at, updated_at FROM workflows WHERE id = ?1")
        .map_err(|e| e.to_string())?;
    stmt.query_row(rusqlite::params![id], |row| {
        Ok(WorkflowDetail {
            id: row.get(0)?,
            name: row.get(1)?,
            graph_json: row.get(2)?,
            thumbnail_path: row.get(3)?,
            created_at: row.get(4)?,
            updated_at: row.get(5)?,
        })
    })
    .map_err(|e| format!("workflow not found: {}", e))
}

#[tauri::command]
pub fn create_workflow(name: Option<String>) -> Result<WorkflowDetail, String> {
    let info = license::check_license();
    let conn = db::get_connection().lock().unwrap();

    if info.plan != "pro" {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM workflows", [], |r| r.get(0))
            .unwrap_or(0);
        if count >= 10 {
            return Err("FREE_PLAN_LIMIT".into());
        }
    }

    let id = Uuid::new_v4().to_string();
    let workflow_name = name.unwrap_or_else(|| {
        let n: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(CAST(SUBSTR(name, 7) AS INTEGER)), 0) + 1 FROM workflows WHERE name LIKE '未命名工作流%'",
                [],
                |r| r.get(0),
            )
            .unwrap_or(1);
        format!("未命名工作流 {}", n)
    });

    conn.execute(
        "INSERT INTO workflows (id, name, graph_json) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, workflow_name, r#"{"nodes":[],"edges":[]}"#],
    )
    .map_err(|e| format!("create: {}", e))?;

    drop(conn);
    get_workflow(id)
}

#[derive(Deserialize)]
pub struct UpdatePayload {
    pub name: Option<String>,
    pub graph_json: Option<String>,
}

#[tauri::command]
pub fn update_workflow(id: String, payload: UpdatePayload) -> Result<WorkflowDetail, String> {
    let conn = db::get_connection().lock().unwrap();

    if let Some(ref name) = payload.name {
        conn.execute(
            "UPDATE workflows SET name = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![name, id],
        )
        .map_err(|e| e.to_string())?;
    }
    if let Some(ref graph_json) = payload.graph_json {
        conn.execute(
            "UPDATE workflows SET graph_json = ?1, updated_at = datetime('now') WHERE id = ?2",
            rusqlite::params![graph_json, id],
        )
        .map_err(|e| e.to_string())?;
    }

    drop(conn);
    get_workflow(id)
}

#[tauri::command]
pub fn delete_workflow(id: String) -> Result<(), String> {
    let conn = db::get_connection().lock().unwrap();
    conn.execute("DELETE FROM workflows WHERE id = ?1", rusqlite::params![id])
        .map_err(|e| format!("delete: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn export_workflow(id: String) -> Result<String, String> {
    let conn = db::get_connection().lock().unwrap();
    let graph_json: Option<String> = conn
        .query_row(
            "SELECT graph_json FROM workflows WHERE id = ?1",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .map_err(|_| "workflow not found")?;
    Ok(graph_json.unwrap_or_else(|| "{}".to_string()))
}

#[tauri::command]
pub fn import_workflow(name: String, graph_json: String) -> Result<WorkflowDetail, String> {
    // Validate JSON
    serde_json::from_str::<serde_json::Value>(&graph_json)
        .map_err(|e| format!("invalid JSON: {}", e))?;

    let info = license::check_license();
    let conn = db::get_connection().lock().unwrap();

    if info.plan != "pro" {
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM workflows", [], |r| r.get(0))
            .unwrap_or(0);
        if count >= 10 {
            return Err("FREE_PLAN_LIMIT".into());
        }
    }

    let id = Uuid::new_v4().to_string();
    conn.execute(
        "INSERT INTO workflows (id, name, graph_json) VALUES (?1, ?2, ?3)",
        rusqlite::params![id, name, graph_json],
    )
    .map_err(|e| format!("import: {}", e))?;

    drop(conn);
    get_workflow(id)
}
