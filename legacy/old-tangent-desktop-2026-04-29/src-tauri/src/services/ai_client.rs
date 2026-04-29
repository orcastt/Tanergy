use super::ai_types::{resolve_image_model, resolve_text_model};
pub use super::ai_types::{AiCompletion, ChatMessage, ImageResult};

// ── AI-powered image editing ──

pub async fn ai_edit_image(
    image_base64: &str,
    instruction: &str,
    model: &str,
    aspect_ratio: Option<&str>,
) -> Result<ImageResult, String> {
    let (provider_id, api_model) = resolve_image_model(model);
    if !crate::services::credits::has_official_access() {
        return Err("LOGIN_REQUIRED".into());
    }
    let data = if api_model == "gemini-3.1-flash-image-preview" {
        crate::services::official_images::official_chat_image_edit(
            provider_id,
            api_model,
            image_base64,
            instruction,
            aspect_ratio,
        )
        .await?
    } else {
        crate::services::official_images::official_image_edit(
            provider_id,
            api_model,
            image_base64,
            instruction,
            aspect_ratio,
        )
        .await?
    };
    Ok(ImageResult {
        image_data: data,
        url: None,
    })
}

// ── Chat completion via official backend routing ──

pub async fn chat_completion(
    model_id: &str,
    _fallback_model: &str,
    messages: Vec<ChatMessage>,
    max_tokens: u32,
    temperature: Option<f64>,
) -> Result<AiCompletion, String> {
    let (provider_id, api_model) = resolve_text_model(model_id);
    if !crate::services::credits::has_official_access() {
        return Err("LOGIN_REQUIRED".into());
    }
    crate::services::credits::official_chat_completion(
        provider_id,
        api_model,
        messages,
        max_tokens,
        temperature,
    )
    .await
}

// ── Image generation via official backend routing ──

pub async fn image_generation(
    model_id: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
    size: Option<&str>,
    quality: Option<&str>,
    image_size: Option<&str>,
) -> Result<ImageResult, String> {
    let (provider_id, api_model) = resolve_image_model(model_id);
    if !crate::services::credits::has_official_access() {
        return Err("LOGIN_REQUIRED".into());
    }
    let data = if api_model == "gemini-3.1-flash-image-preview" {
        crate::services::official_images::official_chat_image_generation(
            provider_id,
            api_model,
            prompt,
            aspect_ratio,
            image_size,
        )
        .await?
    } else {
        crate::services::official_images::official_image_generation(
            provider_id,
            api_model,
            prompt,
            aspect_ratio,
            size,
            quality,
        )
        .await?
    };
    Ok(ImageResult {
        image_data: data,
        url: None,
    })
}
