#[tauri::command]
pub fn health_check() -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "status": "ok",
        "version": "0.1.0"
    }))
}
