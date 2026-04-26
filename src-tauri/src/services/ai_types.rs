use serde::{Deserialize, Serialize};

static TEXT_MODELS: &[(&str, &str, &str)] = &[
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

pub fn resolve_text_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, TEXT_MODELS)
}

pub fn resolve_image_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, IMAGE_MODELS)
}

fn resolve_model<'a>(model_id: &str, table: &'a [(&'a str, &'a str, &'a str)]) -> (&'a str, &'a str) {
    table
        .iter()
        .find(|(id, _, _)| *id == model_id)
        .map(|(_, provider, api_model)| (*provider, *api_model))
        .unwrap_or(("minimax", "MiniMax-M2.7"))
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ChatRequest {
    pub model: String,
    pub messages: Vec<ChatMessage>,
    pub max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f64>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatChoice {
    pub message: ChatChoiceMessage,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatChoiceMessage {
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub(crate) struct ChatResponse {
    pub choices: Vec<ChatChoice>,
}

pub struct AiCompletion {
    pub text: String,
}

#[derive(Debug, Serialize)]
pub(crate) struct ImageGenRequest {
    pub model: String,
    pub prompt: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub aspect_ratio: Option<String>,
}

pub struct ImageResult {
    pub image_data: Vec<u8>,
    #[allow(dead_code)]
    pub url: Option<String>,
}
