use crate::services::ai_client::{self, ChatMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;

mod html_formatter;
mod legacy_text;
mod media;
mod mock;

#[derive(Debug, Deserialize)]
pub struct ExecutePayload {
    pub node_type: String,
    pub node_data: Value,
    pub input_data: Value,
}

#[derive(Debug, Serialize)]
pub struct ExecuteResult {
    pub output: Value,
    pub status: String,
}

const DEFAULT_TEXT_MODEL: &str = "hunyuan-3.0-preview";

const AI_NODE_TYPES: &[&str] = &[
    "research",
    "outline_generator",
    "writer",
    "reviewer",
    "image_planner",
    "image_gen",
    "image_list",
    "html_formatter",
];

/// Extract a text string from input data. Handles both direct strings and
/// wrapped objects like `{ text: "..." }` or `{ raw: "..." }`.
fn extract_text(value: &Value) -> Option<&str> {
    value
        .as_str()
        .or_else(|| value.get("text").and_then(|v| v.as_str()))
        .or_else(|| value.get("content").and_then(|v| v.as_str()))
        .or_else(|| value.get("raw").and_then(|v| v.as_str()))
}

/// Get the model ID from node_data, falling back to the default text model.
fn get_text_model(node_data: &Value) -> String {
    node_data
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or(DEFAULT_TEXT_MODEL)
        .to_string()
}

#[tauri::command]
pub async fn execute_node(
    payload: ExecutePayload,
    app_handle: tauri::AppHandle,
) -> Result<ExecuteResult, String> {
    // Mock mode: return canned responses
    let mock_mode = crate::db::get_connection()
        .lock()
        .unwrap()
        .query_row(
            "SELECT value FROM app_config WHERE key = 'mock_mode'",
            [],
            |row| row.get::<_, String>(0),
        )
        .unwrap_or_else(|_| "false".to_string());

    if mock_mode == "true" {
        return mock::exec_mock(&payload).await;
    }

    // AI nodes require official backend access
    if AI_NODE_TYPES.contains(&payload.node_type.as_str()) {
        if !crate::services::credits::has_official_access() {
            return Err("LOGIN_REQUIRED".into());
        }
    }

    match payload.node_type.as_str() {
        "text_input" => exec_text_input(&payload),
        "research" => exec_research(&payload).await,
        "outline_generator" => exec_outline(&payload).await,
        "writer" => legacy_text::exec_writer(&payload).await,
        "reviewer" => legacy_text::exec_reviewer(&payload).await,
        "image_planner" => media::exec_image_planner(&payload).await,
        "image_gen" | "image_list" => media::exec_image_gen(&payload, &app_handle).await,
        "html_formatter" => html_formatter::exec_html_formatter(&payload).await,
        _ => Err(format!("unsupported node type: {}", payload.node_type)),
    }
}

fn exec_text_input(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let text = payload
        .node_data
        .get("text")
        .and_then(|v| v.as_str())
        .or_else(|| payload.input_data.get("in").and_then(extract_text))
        .unwrap_or("")
        .to_string();

    if text.trim().is_empty() {
        return Err("text_input: empty text".into());
    }

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": text }),
        status: "done".into(),
    })
}

async fn exec_research(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let query = payload
        .input_data
        .get("in")
        .and_then(extract_text)
        .or_else(|| payload.node_data.get("query").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    if query.trim().is_empty() {
        return Err("research: empty query".into());
    }

    let direction = payload
        .node_data
        .get("direction")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let system = if direction.is_empty() {
        "你是一个专业的研究助手。根据用户给出的主题，进行深入调研，输出详细的调研报告。包括：核心概念、最新趋势、关键数据点、行业观点、可引用的案例。用中文回答。".to_string()
    } else {
        format!(
            "你是一个专业的研究助手。根据用户给出的主题，进行深入调研，重点侧重【{}】方向，\
             输出详细的调研报告。包括：核心概念、最新趋势、关键数据点、行业观点、可引用的案例。用中文回答。",
            direction
        )
    };

    let user_msg = format!(
        "请对以下主题进行深入调研：{}\n\n请输出结构化的调研报告，包含关键事实、数据和洞察。",
        query
    );

    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: system,
        },
        ChatMessage {
            role: "user".into(),
            content: user_msg,
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
        output: serde_json::json!({ "text": completion.text }),
        status: "done".into(),
    })
}

async fn exec_outline(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let topic = payload
        .input_data
        .get("in")
        .and_then(extract_text)
        .unwrap_or("");

    let research = payload
        .input_data
        .get("research")
        .and_then(extract_text)
        .unwrap_or("");

    let style = payload
        .node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("干货清单");

    let custom = payload
        .node_data
        .get("promptOverride")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let system = format!(
        "你是公众号写作大纲规划师。根据主题和调研资料，生成一篇文章的详细大纲。\n\
         风格：{}{}\n\n\
         输出规则：\n\
         1. 用 **[1]**, **[2]**, **[3]**... 标记每个章节开头（必须严格使用此格式）\n\
         2. 每个章节包含：标题 + 2-4 个要点\n\
         3. 章节数量：3-6 个，根据主题复杂度决定\n\
         4. 最后输出如下 JSON 块（图片数量 = 章节数 - 1）：\n\
         ---IMAGE_PLANS_START---\n\
         [{{\"position\":\"第X节后\",\"description\":\"...\",\"prompt\":\"...\",\"aspect_ratio\":\"16:9\"}}]\n\
         ---IMAGE_PLANS_END---\n\
         只输出大纲正文和 JSON 块，不要其他说明。",
        style,
        if custom.is_empty() { "".to_string() } else { format!("\n附加要求：{}", custom) }
    );

    let user_msg = format!(
        "主题：{}\n\n调研资料：\n{}\n\n请生成详细大纲。",
        topic, research
    );

    let messages = vec![
        ChatMessage {
            role: "system".into(),
            content: system,
        },
        ChatMessage {
            role: "user".into(),
            content: user_msg,
        },
    ];

    let completion = ai_client::chat_completion(
        &get_text_model(&payload.node_data),
        "",
        messages,
        4096,
        Some(0.8),
    )
    .await?;

    let raw = completion.text.trim();
    let mut sections = parse_sections(raw);
    let image_plans = parse_image_plans(raw);
    inject_image_markers(&mut sections, &image_plans);

    let options = vec![serde_json::json!({
        "title": sections.first()
            .and_then(|s| s.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("文章大纲"),
        "angle": format!("{} 风格", style),
        "sections": sections.iter()
            .filter_map(|s| s.get("title").and_then(|v| v.as_str()))
            .collect::<Vec<_>>(),
    })];

    Ok(ExecuteResult {
        output: serde_json::json!({
            "sections": sections,
            "image_plans": image_plans,
            "options": options,
            "raw": raw,
        }),
        status: "done".into(),
    })
}

fn parse_sections(raw: &str) -> Vec<Value> {
    let outline_text = raw
        .split("---IMAGE_PLANS_START---")
        .next()
        .unwrap_or(raw)
        .trim();

    // Split on **[N]** markers
    let parts: Vec<&str> = outline_text
        .split("**[")
        .filter(|s| !s.is_empty())
        .collect();
    if parts.is_empty() {
        return vec![serde_json::json!({"id": "1", "title": "大纲", "content": outline_text})];
    }

    parts
        .iter()
        .filter_map(|part| {
            let close = part.find("]**")?;
            let section_id = part[..close].trim().to_string();
            let rest = part[close + 3..].trim();
            let title = rest
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .trim_start_matches(':')
                .trim()
                .to_string();
            Some(serde_json::json!({
                "id": section_id,
                "title": title,
                "content": format!("**[{}]** {}", section_id, rest),
            }))
        })
        .collect()
}

fn parse_image_plans(raw: &str) -> Value {
    if let Some(start_pos) = raw.find("---IMAGE_PLANS_START---") {
        if let Some(end_pos) = raw.find("---IMAGE_PLANS_END---") {
            let json_str = raw[start_pos + 23..end_pos].trim();
            // Find the JSON array within
            if let Some(arr_start) = json_str.find('[') {
                if let Some(arr_end) = json_str.rfind(']') {
                    let arr_str = &json_str[arr_start..=arr_end];
                    if let Ok(parsed) = serde_json::from_str::<Vec<Value>>(arr_str) {
                        let with_ids: Vec<Value> = parsed
                            .into_iter()
                            .enumerate()
                            .map(|(i, mut p)| {
                                if let Some(obj) = p.as_object_mut() {
                                    obj.insert(
                                        "id".into(),
                                        serde_json::json!(format!("img_{}", i + 1)),
                                    );
                                }
                                p
                            })
                            .collect();
                        return serde_json::json!(with_ids);
                    }
                }
            }
        }
    }
    serde_json::json!([])
}

fn inject_image_markers(sections: &mut Vec<Value>, image_plans: &Value) {
    let plans = match image_plans.as_array() {
        Some(arr) => arr,
        None => return,
    };
    for (img_idx, plan) in plans.iter().enumerate() {
        let position = plan.get("position").and_then(|v| v.as_str()).unwrap_or("");
        let section_idx = extract_section_index(position)
            .map(|n| (n as usize).saturating_sub(1))
            .unwrap_or_else(|| img_idx.min(sections.len().saturating_sub(1)));
        if let Some(sec) = sections.get_mut(section_idx) {
            if let Some(content_str) = sec.get("content").and_then(|v| v.as_str()) {
                let new_content = format!("{}\n\n[图{}]", content_str, img_idx + 1);
                if let Some(obj) = sec.as_object_mut() {
                    obj.insert("content".into(), serde_json::json!(new_content));
                }
            }
        }
    }
}

fn extract_section_index(position: &str) -> Option<u32> {
    let digits: String = position.chars().filter(|c| c.is_ascii_digit()).collect();
    digits.parse::<u32>().ok()
}
