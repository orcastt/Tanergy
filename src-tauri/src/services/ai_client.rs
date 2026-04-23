use crate::crypto;
use crate::db;
use crate::services::provider;
use base64::Engine;
use serde::{Deserialize, Serialize};

// ── Model registry: maps model IDs to provider + actual model name ──

static TEXT_MODELS: &[(&str, &str, &str)] = &[
    // (model_id, provider, api_model_name)
    ("MiniMax-M2.7", "minimax", "MiniMax-M2.7"),
    ("claude-sonnet-4-6", "claude", "claude-sonnet-4-6"),
    ("gpt-4o", "gpt", "gpt-4o"),
    ("gemini-2.5-pro", "gemini", "gemini-2.5-pro"),
    ("glm-4-plus", "glm", "glm-4-plus"),
];

static IMAGE_MODELS: &[(&str, &str, &str)] = &[
    ("minimax-image", "minimax", "image-01"),
    ("dall-e-3", "gpt", "dall-e-3"),
];

fn resolve_model<'a>(model_id: &str, table: &'a [(&'a str, &'a str, &'a str)]) -> (&'a str, &'a str) {
    table
        .iter()
        .find(|(id, _, _)| *id == model_id)
        .map(|(_, provider, api_model)| (*provider, *api_model))
        .unwrap_or(("minimax", "MiniMax-M2.7"))
}

pub fn resolve_text_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, TEXT_MODELS)
}

pub fn resolve_image_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, IMAGE_MODELS)
}

// ── Data types ──

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
struct ChatRequest {
    model: String,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
struct ChatChoiceMessage {
    content: String,
}

#[derive(Debug, Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}

pub struct AiCompletion {
    pub text: String,
}

#[derive(Debug, Serialize)]
struct ImageGenRequest {
    model: String,
    prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    aspect_ratio: Option<String>,
}

pub struct ImageResult {
    pub image_data: Vec<u8>,
    #[allow(dead_code)]
    pub url: Option<String>,
}

// ── API key helper ──

pub fn get_decrypted_key(app_dir: &str, provider_id: &str) -> Result<String, String> {
    let enc_key = crypto::get_or_create_key(app_dir)?;
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT encrypted_key FROM api_keys WHERE provider = ?1")
        .map_err(|e| e.to_string())?;
    let blob: Vec<u8> = stmt
        .query_row(rusqlite::params![provider_id], |row| row.get(0))
        .map_err(|_| format!("no API key set for {}", provider_id))?;
    crypto::decrypt(&blob, &enc_key)
}

fn strip_think_tags(text: &str) -> String {
    if let Some(close_pos) = text.find("</think") {
        if let Some(gt_pos) = text[close_pos..].find('>') {
            return text[close_pos + gt_pos + 1..].trim().to_string();
        }
    }
    text.trim().to_string()
}

// ── Chat completion with smart routing ──

pub async fn chat_completion(
    model_id: &str,
    _fallback_model: &str,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: Option<f64>,
) -> Result<AiCompletion, String> {
    let (provider_id, api_model) = resolve_text_model(model_id);

    // Route 1: Official API (default for logged-in users)
    if crate::services::credits::has_official_access() {
        return crate::services::credits::official_chat_completion(
            provider_id, api_model, messages, max_tokens, temperature,
        ).await;
    }

    // Route 2: User's own API key (fallback)
    if crate::services::credits::has_own_key(provider_id) {
        return chat_completion_direct(provider_id, api_model, messages, max_tokens, temperature).await;
    }

    // No access
    Err("LOGIN_REQUIRED".into())
}

async fn chat_completion_direct(
    provider_id: &str,
    api_model: &str,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: Option<f64>,
) -> Result<AiCompletion, String> {
    let preset = provider::get_preset(provider_id).ok_or(format!("unknown provider: {}", provider_id))?;
    let url = format!("{}/chat/completions", preset.base_url);

    let app_dir = db::get_app_dir();
    let api_key = get_decrypted_key(&app_dir, provider_id)?;

    let body = ChatRequest {
        model: api_model.to_string(),
        messages,
        max_tokens,
        temperature,
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(&api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, text));
    }

    let chat_resp: ChatResponse = resp
        .json()
        .await
        .map_err(|e| format!("parse response: {}", e))?;

    let text = chat_resp
        .choices
        .into_iter()
        .next()
        .map(|c| c.message.content)
        .ok_or("empty response")?;

    Ok(AiCompletion { text: strip_think_tags(&text) })
}

// ── Image generation with smart routing ──

pub async fn image_generation(
    model_id: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
) -> Result<ImageResult, String> {
    let (provider_id, api_model) = resolve_image_model(model_id);

    // Route 1: Official API
    if crate::services::credits::has_official_access() {
        let data = crate::services::credits::official_image_generation(
            provider_id, prompt, aspect_ratio,
        ).await?;
        return Ok(ImageResult { image_data: data, url: None });
    }

    // Route 2: User's own API key
    if !crate::services::credits::has_own_key(provider_id) {
        return Err("LOGIN_REQUIRED".into());
    }

    let preset = provider::get_preset(provider_id).ok_or(format!("unknown provider: {}", provider_id))?;
    let url = format!("{}/image_generation", preset.base_url);

    let app_dir = db::get_app_dir();
    let api_key = get_decrypted_key(&app_dir, provider_id)?;

    let body = ImageGenRequest {
        model: api_model.to_string(),
        prompt: prompt.to_string(),
        aspect_ratio: aspect_ratio.map(|s| s.to_string()),
    };

    let client = reqwest::Client::new();
    let resp = client
        .post(&url)
        .bearer_auth(&api_key)
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("image request failed: {}", e))?;

    if !resp.status().is_success() {
        let status = resp.status();
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("Image API error {}: {}", status, text));
    }

    let img_resp: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("parse image response: {}", e))?;

    // Try base64 first
    if let Some(b64) = img_resp.get("data").and_then(|d| d.get("base64")).and_then(|v| v.as_str()) {
        let image_data = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| format!("base64 decode: {}", e))?;
        return Ok(ImageResult { image_data, url: None });
    }

    // Try image_urls
    if let Some(urls) = img_resp.get("data").and_then(|d| d.get("image_urls")).and_then(|v| v.as_array()) {
        if let Some(url_str) = urls.first().and_then(|v| v.as_str()) {
            let img_resp = client.get(url_str).send().await.map_err(|e| format!("download image: {}", e))?;
            let image_data = img_resp.bytes().await.map_err(|e| format!("read image bytes: {}", e))?.to_vec();
            return Ok(ImageResult { image_data, url: Some(url_str.to_string()) });
        }
    }

    // Fallback: nested structures
    if let Some(data) = img_resp.get("data") {
        if let Some(arr) = data.as_array() {
            if let Some(first) = arr.first() {
                if let Some(b64) = first.get("b64_json").and_then(|v| v.as_str()) {
                    let image_data = base64::engine::general_purpose::STANDARD.decode(b64).map_err(|e| format!("base64 decode: {}", e))?;
                    return Ok(ImageResult { image_data, url: None });
                }
                if let Some(url_str) = first.get("url").and_then(|v| v.as_str()) {
                    let img_resp = client.get(url_str).send().await.map_err(|e| format!("download image: {}", e))?;
                    let image_data = img_resp.bytes().await.map_err(|e| format!("read image bytes: {}", e))?.to_vec();
                    return Ok(ImageResult { image_data, url: Some(url_str.to_string()) });
                }
            }
        }
    }

    Err(format!("unexpected image response format: {}", img_resp))
}
