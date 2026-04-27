use serde::{Deserialize, Serialize};

static TEXT_MODELS: &[(&str, &str, &str)] = &[
    ("hunyuan-3.0-preview", "geekai", "hunyuan-3.0-preview"),
    ("minimax-m2.7:free", "geekai", "minimax-m2.7:free"),
    (
        "nemotron-3-super-120b-a12b",
        "geekai",
        "nemotron-3-super-120b-a12b",
    ),
    ("MiniMax-M2.7", "minimax", "MiniMax-M2.7"),
    ("claude-sonnet-4-6", "claude", "claude-sonnet-4-6"),
    ("glm-4-plus", "glm", "glm-4-plus"),
];

static IMAGE_MODELS: &[(&str, &str, &str)] = &[
    ("gpt-image-2", "geekai", "gpt-image-2"),
    ("nano-banana-2", "geekai", "nano-banana-2"),
    ("nano-banana-hd", "geekai", "nano-banana-hd"),
    ("jimeng_t2i_v40", "geekai", "jimeng_t2i_v40"),
    ("gemini-nano-banana", "geekai", "gemini-nano-banana"),
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
    resolve_model(model_id, TEXT_MODELS, ("geekai", "hunyuan-3.0-preview"))
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
