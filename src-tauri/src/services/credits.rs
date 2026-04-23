use crate::db;
use serde::{Deserialize, Serialize};

// Backend URL — configure via app_config or env var
pub fn backend_url() -> String {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT value FROM app_config WHERE key = 'backend_url'",
        [],
        |row| row.get::<_, String>(0),
    );
    drop(locked);
    result.unwrap_or_else(|_| "http://localhost:8000".to_string())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditInfo {
    pub balance: i64,
    pub plan: String,
}

#[derive(Debug, Deserialize)]
struct BalanceResponse {
    balance: i64,
    plan: String,
}

#[derive(Debug, Deserialize)]
struct VerifyOtpResponse {
    token: String,
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

/// Check if user has official API access (logged in with valid JWT)
pub fn has_official_access() -> bool {
    get_jwt().is_some()
}

/// Check if user has ANY own API key configured (across all providers)
pub fn has_any_user_key() -> bool {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT COUNT(*) FROM api_keys",
        [],
        |row| row.get::<_, i64>(0),
    );
    drop(locked);
    result.unwrap_or(0) > 0
}

/// Get stored JWT from app_config
pub fn get_jwt() -> Option<String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    let result = locked.query_row(
        "SELECT value FROM app_config WHERE key = 'backend_jwt'",
        [],
        |row| row.get::<_, String>(0),
    );
    drop(locked);
    result.ok().filter(|s| !s.is_empty())
}

/// Store JWT
fn store_jwt(token: &str) -> Result<(), String> {
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('backend_jwt', ?1)",
        rusqlite::params![token],
    ).map_err(|e| e.to_string())?;
    drop(locked);
    Ok(())
}

/// Clear stored JWT (logout)
pub fn clear_jwt() -> Result<(), String> {
    store_jwt("")
}

/// Send OTP to email via backend
pub async fn login_official(email: &str) -> Result<(), String> {
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/v1/auth/send-otp", backend_url()))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "email": email }))
        .send()
        .await
        .map_err(|e| format!("send OTP failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("OTP send error {}: {}", status, text));
    }
    Ok(())
}

/// Verify OTP and store JWT
pub async fn verify_otp(email: &str, code: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let resp: serde_json::Value = client
        .post(format!("{}/api/v1/auth/verify-otp", backend_url()))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "email": email,
            "code": code,
        }))
        .send()
        .await
        .map_err(|e| format!("verify OTP failed: {}", e))?
        .json()
        .await
        .map_err(|e| format!("parse OTP response: {}", e))?;

    let token = resp
        .get("token")
        .and_then(|v| v.as_str())
        .ok_or("no token in response")?;

    store_jwt(token)?;

    // Refresh balance after login
    let _ = refresh_credit_balance().await;

    Ok(token.to_string())
}

/// Refresh credit balance from backend, cache locally
pub async fn refresh_credit_balance() -> Result<CreditInfo, String> {
    let jwt = get_jwt().ok_or("not logged in")?;
    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/v1/credits/balance", backend_url()))
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await
        .map_err(|e| format!("fetch balance: {}", e))?;

    if !resp.status().is_success() {
        // JWT might be expired
        let status = resp.status();
        if status.as_u16() == 401 {
            clear_jwt()?;
            return Err("Session expired, please login again".into());
        }
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("fetch balance error {}: {}", status, text));
    }

    let balance_resp: BalanceResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse balance: {}", e))?;

    // Cache locally
    let conn = db::get_connection();
    let locked = conn.lock().unwrap();
    locked.execute(
        "INSERT OR REPLACE INTO app_config (key, value) VALUES ('credit_balance_cache', ?1)",
        rusqlite::params![balance_resp.balance.to_string()],
    ).map_err(|e| e.to_string())?;
    drop(locked);

    Ok(CreditInfo {
        balance: balance_resp.balance,
        plan: balance_resp.plan,
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

/// Call official chat API via backend proxy
pub async fn official_chat_completion(
    provider_id: &str,
    model: &str,
    messages: Vec<crate::services::ai_client::ChatMessage>,
    max_tokens: u32,
    temperature: Option<f64>,
) -> Result<crate::services::ai_client::AiCompletion, String> {
    let jwt = get_jwt().ok_or("INSUFFICIENT_CREDITS: not logged in")?;
    let client = reqwest::Client::new();
    let http_resp = client
        .post(format!("{}/api/v1/proxy/chat", backend_url()))
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

    if !http_resp.status().is_success() {
        let status = http_resp.status();
        let text = http_resp.text().await.unwrap_or_default();
        if status.as_u16() == 401 {
            clear_jwt()?;
            return Err("LOGIN_REQUIRED".to_string());
        }
        // Try to extract error detail
        if let Ok(err_json) = serde_json::from_str::<serde_json::Value>(&text) {
            if let Some(detail) = err_json.get("detail").and_then(|v| v.as_str()) {
                if detail.contains("INSUFFICIENT") {
                    return Err("INSUFFICIENT_CREDITS".to_string());
                }
                return Err(format!("official API: {}", detail));
            }
        }
        return Err(format!("official API error {}: {}", status, text));
    }

    let resp: serde_json::Value = http_resp
        .json()
        .await
        .map_err(|e| format!("parse response: {}", e))?;

    let text: String = resp
        .get("text")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    // Update cached balance after successful call
    if let Some(used) = resp.get("credits_used").and_then(|v| v.as_i64()) {
        let current = get_cached_balance();
        let conn = db::get_connection();
        let locked = conn.lock().unwrap();
        let _ = locked.execute(
            "INSERT OR REPLACE INTO app_config (key, value) VALUES ('credit_balance_cache', ?1)",
            rusqlite::params![(current - used).to_string()],
        );
        drop(locked);
    }

    Ok(crate::services::ai_client::AiCompletion { text })
}

/// Call official image generation via backend proxy
pub async fn official_image_generation(
    provider_id: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
) -> Result<Vec<u8>, String> {
    let jwt = get_jwt().ok_or("INSUFFICIENT_CREDITS: not logged in")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/v1/proxy/image", backend_url()))
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

    if !resp.status().is_success() {
        let status = resp.status();
        if status.as_u16() == 401 {
            clear_jwt()?;
            return Err("LOGIN_REQUIRED".to_string());
        }
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("official image API error {}: {}", status, text));
    }

    let body = resp.bytes().await.map_err(|e| format!("read image: {}", e))?;
    Ok(body.to_vec())
}
