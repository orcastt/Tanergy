use crate::crypto;
use crate::db;
use crate::services::provider;
use base64::Engine;
pub use super::ai_types::{AiCompletion, ChatMessage, ImageResult};
use super::ai_types::{ChatRequest, ChatResponse, ImageGenRequest, resolve_image_model, resolve_text_model};

// ── AI-powered image editing ──

/// Edit an image based on user instruction:
/// 1. Use vision model to understand current image
/// 2. Generate new image based on instruction + context
pub async fn ai_edit_image(
    _image_base64: &str,
    instruction: &str,
    model: &str,
    aspect_ratio: Option<&str>,
) -> Result<ImageResult, String> {
    // Step 1: Use a text model to generate an enriched prompt for image generation
    let system = "你是一个专业的AI图片编辑助手。用户会给你一张图片的描述和编辑指令。\
                  请生成一个详细的英文 prompt，用于 AI 生图工具重新生成编辑后的图片。\
                  prompt 需要保留原图的核心内容，同时体现用户的编辑指令。\
                  只输出 prompt，不要其他内容。";

    let user_msg = format!(
        "原始图片描述：用户画板截图（包含图片和手绘内容）\n编辑指令：{}\n\n请生成生图 prompt：",
        instruction
    );

    let text_model = get_text_model_for_edit(model);
    let messages = vec![
        ChatMessage { role: "system".into(), content: system.into() },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = chat_completion(&text_model, "", messages, 1024, Some(0.7)).await?;
    let prompt = completion.text.trim().to_string();

    eprintln!("[ai_edit] generated prompt: {}", &prompt[..prompt.len().min(120)]);

    // Step 2: Generate new image with the enriched prompt
    image_generation(model, &prompt, aspect_ratio).await
}

fn get_text_model_for_edit(_image_model: &str) -> String {
    // Use default text model for prompt generation
    "MiniMax-M2.7".to_string()
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
