use serde::{Deserialize, Serialize};

use crate::services::credits;

#[derive(Debug, Serialize)]
pub struct CheckoutResult {
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct SubscriptionInfo {
    pub plan: String,
    pub credits_remaining: i64,
}

#[tauri::command]
pub async fn create_checkout(plan: String) -> Result<CheckoutResult, String> {
    let jwt = credits::get_jwt().ok_or("not logged in")?;
    let backend = credits::backend_url();

    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/api/v1/billing/checkout", backend))
        .header("Authorization", format!("Bearer {}", jwt))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "plan": plan }))
        .send()
        .await
        .map_err(|e| format!("checkout request: {}", e))?;

    if !resp.status().is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("checkout error: {}", text));
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("parse: {}", e))?;
    let url = data["url"]
        .as_str()
        .ok_or("no url in checkout response")?
        .to_string();

    Ok(CheckoutResult { url })
}

#[tauri::command]
pub async fn get_subscription() -> Result<SubscriptionInfo, String> {
    let jwt = credits::get_jwt().ok_or("not logged in")?;
    let backend = credits::backend_url();

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{}/api/v1/billing/subscription", backend))
        .header("Authorization", format!("Bearer {}", jwt))
        .send()
        .await
        .map_err(|e| format!("subscription request: {}", e))?;

    if !resp.status().is_success() {
        return Err("failed to get subscription".into());
    }

    let data: serde_json::Value = resp.json().await.map_err(|e| format!("parse: {}", e))?;

    Ok(SubscriptionInfo {
        plan: data["plan"].as_str().unwrap_or("free").to_string(),
        credits_remaining: data["credits_remaining"].as_i64().unwrap_or(0),
    })
}
