use crate::services::credits::{backend_url, clear_jwt, get_jwt};

const DEFAULT_GEMINI_IMAGE_SIZE: &str = "0.5K";
const DEFAULT_GPT_IMAGE_2_QUALITY: &str = "low";

pub async fn official_image_generation(
    provider_id: &str,
    model: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
    size: Option<&str>,
    quality: Option<&str>,
) -> Result<Vec<u8>, String> {
    let quality = if model == "gpt-image-2" {
        quality.or(Some(DEFAULT_GPT_IMAGE_2_QUALITY))
    } else {
        quality
    };
    let resp = reqwest::Client::new()
        .post(format!("{}/api/v1/proxy/image", backend_url()))
        .header("Authorization", format!("Bearer {}", required_jwt()?))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "model": model,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "size": size,
            "quality": quality,
        }))
        .send()
        .await
        .map_err(|e| format!("official image API: {}", e))?;
    read_image_response(resp, "official image API", "read image").await
}

pub async fn official_chat_image_generation(
    provider_id: &str,
    model: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
    image_size: Option<&str>,
) -> Result<Vec<u8>, String> {
    let image_size = image_size.unwrap_or(DEFAULT_GEMINI_IMAGE_SIZE);
    let resp = reqwest::Client::new()
        .post(format!("{}/api/v1/proxy/image/chat", backend_url()))
        .header("Authorization", format!("Bearer {}", required_jwt()?))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "model": model,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
            "image_size": image_size,
            "enable_search": false,
            "background": false,
        }))
        .send()
        .await
        .map_err(|e| format!("official chat image API: {}", e))?;
    read_image_response(resp, "official chat image API", "read chat image").await
}

pub async fn official_chat_image_edit(
    provider_id: &str,
    model: &str,
    image_base64: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
) -> Result<Vec<u8>, String> {
    let resp = reqwest::Client::new()
        .post(format!("{}/api/v1/proxy/image/chat", backend_url()))
        .header("Authorization", format!("Bearer {}", required_jwt()?))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "model": model,
            "prompt": prompt,
            "images": [image_base64],
            "aspect_ratio": aspect_ratio,
            "image_size": DEFAULT_GEMINI_IMAGE_SIZE,
            "enable_search": false,
            "background": false,
        }))
        .send()
        .await
        .map_err(|e| format!("official chat image edit API: {}", e))?;
    read_image_response(resp, "official chat image edit API", "read chat image edit").await
}

pub async fn official_image_edit(
    provider_id: &str,
    model: &str,
    image_base64: &str,
    prompt: &str,
    aspect_ratio: Option<&str>,
) -> Result<Vec<u8>, String> {
    let resp = reqwest::Client::new()
        .post(format!("{}/api/v1/proxy/image/edit", backend_url()))
        .header("Authorization", format!("Bearer {}", required_jwt()?))
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "provider": provider_id,
            "model": model,
            "image": image_base64,
            "prompt": prompt,
            "aspect_ratio": aspect_ratio,
        }))
        .send()
        .await
        .map_err(|e| format!("official image edit API: {}", e))?;
    read_image_response(resp, "official image edit API", "read image edit").await
}

fn required_jwt() -> Result<String, String> {
    get_jwt().ok_or("INSUFFICIENT_CREDITS: not logged in".to_string())
}

async fn read_image_response(
    resp: reqwest::Response,
    error_label: &str,
    read_label: &str,
) -> Result<Vec<u8>, String> {
    if !resp.status().is_success() {
        let status = resp.status();
        if status.as_u16() == 401 {
            clear_jwt()?;
            return Err("LOGIN_REQUIRED".to_string());
        }
        let text = resp.text().await.unwrap_or_default();
        return Err(format!("{} error {}: {}", error_label, status, text));
    }

    let body = resp
        .bytes()
        .await
        .map_err(|e| format!("{}: {}", read_label, e))?;
    Ok(body.to_vec())
}
