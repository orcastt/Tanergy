use crate::crypto;
use crate::db;
use crate::services::provider;
use serde::Serialize;
use tauri::Manager;

#[derive(Debug, Clone, Serialize)]
pub struct KeyStatus {
    pub is_set: bool,
    pub is_valid: Option<bool>,
    pub last_tested: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProviderInfo {
    pub id: String,
    pub name: String,
    pub key_prefix: String,
    pub base_url: String,
    pub is_set: bool,
    pub is_valid: Option<bool>,
    pub last_tested: Option<String>,
}

#[tauri::command]
pub fn set_api_key(
    app: tauri::AppHandle,
    provider_id: String,
    key: String,
) -> Result<(), String> {
    provider::get_preset(&provider_id).ok_or("unknown provider")?;
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    let enc_key = crypto::get_or_create_key(&app_dir)?;
    let encrypted = crypto::encrypt(&key, &enc_key)?;

    let conn = db::get_connection().lock().unwrap();
    conn.execute(
        "INSERT INTO api_keys (provider, encrypted_key, is_valid) VALUES (?1, ?2, 0)
         ON CONFLICT(provider) DO UPDATE SET encrypted_key = excluded.encrypted_key, is_valid = 0",
        rusqlite::params![provider_id, encrypted],
    )
    .map_err(|e| format!("save key: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn get_api_key_status(provider_id: String) -> Result<KeyStatus, String> {
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT is_valid, last_tested_at FROM api_keys WHERE provider = ?1")
        .map_err(|e| e.to_string())?;
    let result: Option<(Option<i32>, Option<String>)> = stmt
        .query_row(rusqlite::params![provider_id], |row| {
            Ok((row.get(0)?, row.get(1)?))
        })
        .ok();

    match result {
        Some((valid, last_tested)) => Ok(KeyStatus {
            is_set: true,
            is_valid: valid.map(|v| v == 1),
            last_tested,
        }),
        None => Ok(KeyStatus {
            is_set: false,
            is_valid: None,
            last_tested: None,
        }),
    }
}

#[tauri::command]
pub fn get_all_providers() -> Result<Vec<ProviderInfo>, String> {
    let presets = provider::all_presets();
    let conn = db::get_connection().lock().unwrap();
    let mut out = Vec::new();

    for p in presets {
        let mut stmt = conn
            .prepare("SELECT is_valid, last_tested_at FROM api_keys WHERE provider = ?1")
            .map_err(|e| e.to_string())?;
        let row: Option<(Option<i32>, Option<String>)> = stmt
            .query_row(rusqlite::params![p.id], |r| Ok((r.get(0)?, r.get(1)?)))
            .ok();

        let is_set = row.is_some();
        let (is_valid, last_tested) = row.unwrap_or((None, None));
        out.push(ProviderInfo {
            id: p.id.into(),
            name: p.name.into(),
            key_prefix: p.key_prefix.into(),
            base_url: p.base_url.into(),
            is_set,
            is_valid: is_valid.map(|v| v == 1),
            last_tested,
        });
    }
    Ok(out)
}

#[tauri::command]
pub async fn test_api_key(
    app: tauri::AppHandle,
    provider_id: String,
) -> Result<bool, String> {
    let preset = provider::get_preset(&provider_id).ok_or("unknown provider")?;

    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .to_string();
    let enc_key = crypto::get_or_create_key(&app_dir)?;

    let api_key_plain = {
        let conn = db::get_connection().lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT encrypted_key FROM api_keys WHERE provider = ?1")
            .map_err(|e| e.to_string())?;
        let blob: Vec<u8> = stmt
            .query_row(rusqlite::params![provider_id], |row| row.get(0))
            .map_err(|_| "no key stored".to_string())?;
        drop(stmt);
        crypto::decrypt(&blob, &enc_key)?
    };

    let url = format!("{}{}", preset.base_url, preset.test_path);
    let client = reqwest::Client::new();

    let resp = match provider_id.as_str() {
        "gemini" => client
            .get(&format!("{}?key={}", url, api_key_plain))
            .send()
            .await,
        "claude" => client
            .post(&url)
            .header("x-api-key", &api_key_plain)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .body(r#"{"model":"claude-sonnet-4-20250514","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}"#)
            .send()
            .await,
        "gpt" => client
            .get(&url)
            .bearer_auth(&api_key_plain)
            .send()
            .await,
        "glm" => client
            .post(&url)
            .bearer_auth(&api_key_plain)
            .header("content-type", "application/json")
            .body(r#"{"model":"glm-4-flash","messages":[{"role":"user","content":"hi"}],"max_tokens":1}"#)
            .send()
            .await,
        "minimax" => client
            .post(&url)
            .bearer_auth(&api_key_plain)
            .header("content-type", "application/json")
            .body(r#"{"model":"MiniMax-M2.7","messages":[{"role":"user","content":"hi"}],"max_tokens":1}"#)
            .send()
            .await,
        _ => return Err("unknown provider".into()),
    };

    let ok = match resp {
        Ok(r) => r.status().is_success(),
        Err(e) => {
            return Err(format!("request failed: {}", e));
        }
    };

    let conn = db::get_connection().lock().unwrap();
    conn.execute(
        "UPDATE api_keys SET is_valid = ?1, last_tested_at = datetime('now') WHERE provider = ?2",
        rusqlite::params![if ok { 1 } else { 0 }, provider_id],
    )
    .ok();

    if ok {
        Ok(true)
    } else {
        Err("API key test failed — check your key and try again".into())
    }
}

#[tauri::command]
pub fn remove_api_key(provider_id: String) -> Result<(), String> {
    let conn = db::get_connection().lock().unwrap();
    conn.execute(
        "DELETE FROM api_keys WHERE provider = ?1",
        rusqlite::params![provider_id],
    )
    .map_err(|e| format!("delete: {}", e))?;
    Ok(())
}
