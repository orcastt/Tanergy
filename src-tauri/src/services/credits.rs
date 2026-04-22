use crate::db;
use serde::{Deserialize, Serialize};

const SUPABASE_URL: &str = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY: &str = "YOUR_ANON_KEY";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditInfo {
    pub balance: i64,
    pub plan: String,
}

/// Check if user has their own API key for a given provider
pub fn has_own_key(provider_id: &str) -> bool {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT COUNT(*) FROM api_keys WHERE provider = ?1",
        rusqlite::params![provider_id],
        |row| row.get::<_, i64>(0),
    );
    drop(locked);
    result.unwrap_or(0) > 0
}

/// Get stored Supabase JWT from app_config
pub fn get_supabase_jwt() -> Option<String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT value FROM app_config WHERE key = 'supabase_jwt'",
        [],
        |row| row.get::<_, String>(0),
    );
    drop(locked);
    result.ok().filter(|s| !s.is_empty())
}

/// Store Supabase JWT
fn store_jwt(token: &str) -> Result<(), String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('supabase_jwt', ?1)",
        rusqlite::params![token],
    ).map_err(|e| e.to_string())?;
    drop(locked);
    Ok(())
}

/// Clear stored JWT (logout)
pub fn clear_jwt() -> Result<(), String> {
    store_jwt("")
}

/// Send OTP to email via Supabase Auth
pub async fn login_official(email: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    client
        .post(format!("{}/auth/v1/otp", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email, "create_user": true }))
        .send()
        .await
        .map_err(|e| format!("send OTP failed: {}", e))?;
    Ok(())
}

/// Verify OTP and store JWT
pub async fn verify_otp(email: &str, token: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .post(format!("{}/auth/v1/verify", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": email,
            "token": token,
            "type": "email"
        }))
        .send()
        .await
        .map_err(|e| format!("verify OTP failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("parse OTP response: {}", e))?;

    let access_token = resp
        .get("access_token")
        .and_then(|v| v.as_str())
        .ok_or("no access_token in response")?;

    store_jwt(access_token)?;

    // Refresh balance after login
    let _ = refresh_credit_balance().await;

    Ok(access_token.to_string())
}

/// Refresh credit balance from Supabase, cache locally
pub async fn refresh_credit_balance() -> Result<CreditInfo, String> {
    let jwt = get_supabase_jwt().ok_or("not logged in")?;
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .get(format!("{}/rest/v1/credit_balances?select=balance", SUPABASE_URL))
        .header("apikey", SUPABASE_ANON_KEY)
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await
        .map_err(|e| format!("fetch balance: {}", e))?
        .json()
        .await
        .map_err(|e| format!("parse balance: {}", e))?;

    let balance = resp
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|obj| obj.get("balance"))
        .and_then(|v| v.as_i64())
        .unwrap_or(0);

    // Cache locally
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('credit_balance_cache', ?1)",
        rusqlite::params![balance.to_string()],
    ).map_err(|e| e.to_string())?;
    drop(locked);

    Ok(CreditInfo {
        balance,
        plan: "free".to_string(),
    })
}

/// Get cached credit balance
pub fn get_cached_balance() -> i64 {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT value FROM app_config WHERE key = 'credit_balance_cache'",
        [],
        |row| row.get::<_, String>(0),
    );
    drop(locked);
    result.ok().and_then(|s| s.parse().ok()).unwrap_or(0)
}

/// Call official chat API via Supabase Edge Function
pub async fn official_chat_completion(
    provider_id: &str,
    model: &str,
    messages: Vec<crate::services::ai_client::ChatMessage>,
    max_tokens: u32,
    temperature: Option<f64>,
) -> Result<crate::services::ai_client::AiCompletion, String> {
    let jwt = get_supabase_jwt().ok_or("INSUFFICIENT_CREDITS: not logged in")?;
    let client = reqwest::Client::new();
    let http_resp = client
        .post(format!("{}/functions/v1/proxy-chat", SUPABASE_URL))
        .header("Authorization", format!("Bearer {}", jwt))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": temperature,
        }))
        .send()
        .await
        .map_err(|e| format!("official API error: {}", e))?;

    let resp: serde_json::Value = http_resp
        .json()
        .await
        .map_err(|e| format!("parse response: {}", e))?;

    let status = resp.get("error");
    if let Some(err) = status {
        let msg: &str = err.as_str().unwrap_or("unknown error");
        if msg == "INSUFFICIENT_CREDITS" {
            return Err("INSUFFICIENT_CREDITS".to_string());
        }
        return Err(format!("official API: {}", msg));
    }

    let text: String = resp
        .get("text")
        .and_then(|v: &serde_json::Value| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(crate::services::ai_client::AiCompletion { text })
}

/// Call official image generation via Supabase Edge Function
pub async fn official_image_generation(
    provider_id: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
) -> Result<Vec<u8>, String> {
    let jwt = get_supabase_jwt().ok_or("INSUFFICIENT_CREDITS: not logged in")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/functions/v1/proxy-image", SUPABASE_URL))
        .header("Authorization", format!("Bearer {}", jwt))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }))
        .send()
        .await
        .map_err(|e| format!("official image API: {}", e))?;

    let body = resp.bytes().await.map_err(|e| format!("read image: {}", e))?;
    Ok(body.to_vec())
}
