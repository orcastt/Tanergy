use super::super::{extract_text, get_text_model, ExecutePayload, ExecuteResult};
use crate::services::ai_client::{self, ChatMessage};
use serde_json::Value;

pub async fn exec_image_planner(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let article = payload
        .input_data
        .get("in")
        .and_then(extract_text)
        .or_else(|| payload.input_data.get("text").and_then(extract_text))
        .unwrap_or("");

    if article.trim().is_empty() {
        return Err("image_planner: empty article text".into());
    }

    let count = payload
        .node_data
        .get("count")
        .and_then(|v| v.as_u64())
        .unwrap_or(3) as u32;

    let style = payload
        .node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("写实");

    let system = format!(
        "你是专业的内容配图策划。分析文章内容，规划 {} 张配图方案。每张配图需包含：\n\
         - position: 在哪个段落之后插入（例如「第2段后」）\n\
         - description: 图片应呈现的内容（中文，用于展示）\n\
         - prompt: 用于 AI 生图的英文 prompt（详细、具体、有艺术风格指引，风格为 {}）\n\
         - aspect_ratio: 建议的宽高比（例如 16:9 或 4:3）\n\n\
         输出严格 JSON 数组格式：\n\
         [{{\"position\": \"...\", \"description\": \"...\", \"prompt\": \"...\", \"aspect_ratio\": \"...\"}}]\n\
         只输出 JSON，不要其他内容。",
        count, style
    );

    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: system,
        },
        ChatMessage {
            role: "user".into(),
            content: format!("请为以下文章规划配图：\n\n{}", article),
        },
    ];

    let completion = ai_client::chat_completion(
        &get_text_model(&payload.node_data),
        "",
        messages,
        4096,
        Some(0.7),
    )
    .await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "image_plans": parse_json_array(completion.text.trim()) }),
        status: "done".into(),
    })
}

fn parse_json_array(raw: &str) -> Value {
    let add_ids = |arr: Vec<Value>| -> Vec<Value> {
        arr.into_iter()
            .enumerate()
            .map(|(index, mut plan)| {
                if let Some(obj) = plan.as_object_mut() {
                    obj.insert("id".into(), serde_json::json!(format!("img_{}", index + 1)));
                }
                plan
            })
            .collect()
    };

    if raw.starts_with('[') {
        if let Ok(arr) = serde_json::from_str::<Vec<Value>>(raw) {
            return serde_json::json!(add_ids(arr));
        }
    }
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.rfind(']') {
            if let Ok(arr) = serde_json::from_str::<Vec<Value>>(&raw[start..=end]) {
                return serde_json::json!(add_ids(arr));
            }
        }
    }
    serde_json::json!({ "raw": raw })
}
