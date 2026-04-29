use serde::{Deserialize, Serialize};

static TEXT_MODELS: &[(&str, &str, &str)] = &[
    ("nemotron-3-super-120b-a12b", "geekai", "nemotron-3-super-120b-a12b"),
    ("minimax-m2.7:free", "geekai", "minimax-m2.7:free"),
    (
        "hunyuan-3.0-preview",
        "geekai",
        "hunyuan-3.0-preview",
    ),
    ("MiniMax-M2.7", "minimax", "MiniMax-M2.7"),
    ("claude-sonnet-4-6", "claude", "claude-sonnet-4-6"),
    ("glm-4-plus", "glm", "glm-4-plus"),
];

static IMAGE_MODELS: &[(&str, &str, &str)] = &[
    ("gpt-image-2", "geekai", "gpt-image-2"),
    (
        "gemini-3.1-flash-image-preview",
        "geekai",
        "gemini-3.1-flash-image-preview",
    ),
    ("nano-banana-2", "geekai", "nano-banana-2"),
    ("nano-banana-hd", "geekai", "nano-banana-hd"),
    ("jimeng_t2i_v40", "geekai", "jimeng_t2i_v40"),
    ("gpt-image-1", "geekai", "gpt-image-1"),
    (
        "jimeng-image-enhance-v2",
        "geekai",
        "jimeng-image-enhance-v2",
    ),
    ("minimax-image", "minimax", "image-01"),
    ("dall-e-3", "gpt", "dall-e-3"),
];

pub fn resolve_text_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, TEXT_MODELS, ("geekai", "nemotron-3-super-120b-a12b"))
}

pub fn resolve_image_model(model_id: &str) -> (&str, &str) {
    resolve_model(model_id, IMAGE_MODELS, ("geekai", "gpt-image-2"))
}

fn resolve_model<'a>(
    model_id: &str,
    table: &'a [(&'a str, &'a str, &'a str)],
    fallback: (&'a str, &'a str),
) -> (&'a str, &'a str) {
    table
        .iter()
        .find(|(id, _, _)| *id == model_id)
        .map(|(_, provider, api_model)| (*provider, *api_model))
        .unwrap_or(fallback)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

pub struct AiCompletion {
    pub text: String,
}

pub struct ImageResult {
    pub image_data: Vec<u8>,
    #[allow(dead_code)]
    pub url: Option<String>,
}
