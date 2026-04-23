use super::{ExecutePayload, ExecuteResult, extract_text, get_text_model};
use crate::db;
use crate::services::ai_client::{self, ChatMessage};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

pub async fn exec_image_planner(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let article = payload.input_data
        .get("in")
        .and_then(extract_text)
        .or_else(|| payload.input_data.get("text").and_then(extract_text))
        .unwrap_or("");

    if article.trim().is_empty() {
        return Err("image_planner: empty article text".into());
    }

    let count = payload.node_data
        .get("count")
        .and_then(|v| v.as_u64())
        .unwrap_or(3) as u32;

    let style = payload.node_data
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

    let user_msg = format!("请为以下文章规划配图：\n\n{}", article);

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion(&get_text_model(&payload.node_data), "", messages, 4096, Some(0.7)).await?;

    let raw = completion.text.trim();
    let plans = parse_json_array(raw);

    Ok(ExecuteResult {
        output: serde_json::json!({ "image_plans": plans }),
        status: "done".into(),
    })
}

fn parse_json_array(raw: &str) -> Value {
    let add_ids = |arr: Vec<Value>| -> Vec<Value> {
        arr.into_iter().enumerate().map(|(i, mut p)| {
            if let Some(obj) = p.as_object_mut() {
                obj.insert("id".into(), serde_json::json!(format!("img_{}", i + 1)));
            }
            p
        }).collect()
    };

    if raw.starts_with('[') {
        if let Ok(arr) = serde_json::from_str::<Vec<Value>>(raw) {
            return serde_json::json!(add_ids(arr));
        }
    }
    // Try to extract JSON from markdown code block
    if let Some(start) = raw.find('[') {
        if let Some(end) = raw.rfind(']') {
            if let Ok(arr) = serde_json::from_str::<Vec<Value>>(&raw[start..=end]) {
                return serde_json::json!(add_ids(arr));
            }
        }
    }
    serde_json::json!({ "raw": raw })
}

pub async fn exec_image_gen(
    payload: &ExecutePayload,
    app_handle: &tauri::AppHandle,
) -> Result<ExecuteResult, String> {
    // Accept plans from image_planner or generate from text input
    let plans_val = payload.input_data
        .get("in")
        .and_then(|v| v.get("image_plans"))
        .or_else(|| payload.input_data.get("image_plans"))
        .cloned();

    let text_input = payload.input_data
        .get("text")
        .and_then(extract_text)
        .unwrap_or("");

    let count = payload.node_data
        .get("count")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as usize;

    let model = payload.node_data
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("minimax-image");

    let plans: Vec<Value> = if let Some(pv) = plans_val {
        if pv.is_array() {
            pv.as_array().unwrap().clone()
        } else if pv.is_object() && pv.get("raw").is_some() {
            return Err("image_list: planner returned raw text, not valid plans".into());
        } else {
            return Err("image_list: no valid image plans".into());
        }
    } else if !text_input.is_empty() {
        // Generate plans from text input using AI
        let system = format!(
            "你是配图策划。根据文本生成 {} 张配图方案。输出严格 JSON 数组：\n\
             [{{\"position\": \"...\", \"description\": \"...\", \"prompt\": \"...\", \"aspect_ratio\": \"...\"}}]\n\
             只输出 JSON。",
            count
        );
        let messages = vec![
            ChatMessage { role: "system".into(), content: system },
            ChatMessage { role: "user".into(), content: text_input.to_string() },
        ];
        let completion = ai_client::chat_completion(&get_text_model(&payload.node_data), "", messages, 2048, Some(0.7)).await?;
        let raw = completion.text.trim();
        if raw.starts_with('[') {
            serde_json::from_str::<Vec<Value>>(raw).unwrap_or_default()
        } else if let Some(s) = raw.find('[') {
            let end = raw.rfind(']').unwrap_or(raw.len() - 1);
            serde_json::from_str::<Vec<Value>>(&raw[s..=end]).unwrap_or_default()
        } else {
            vec![serde_json::json!({ "prompt": text_input, "description": text_input, "aspect_ratio": "16:9" })]
        }
    } else {
        return Err("image_list: no image plans or text input".into());
    };

    if plans.is_empty() {
        return Err("image_list: empty image plans".into());
    }

    let limited_plans: Vec<Value> = plans.into_iter().take(count).collect();

    let workflow_id = payload.node_data
        .get("workflow_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .to_string();

    let node_id = payload.node_data
        .get("node_id")
        .and_then(|v| v.as_str())
        .unwrap_or("image_list")
        .to_string();

    let app_dir = db::get_app_dir();
    let assets_dir = PathBuf::from(&app_dir).join("assets").join(&workflow_id);
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("create assets dir: {}", e))?;

    let total = limited_plans.len();
    let mut images = Vec::new();
    let mut per_image = serde_json::Map::new();

    for (i, plan) in limited_plans.iter().enumerate() {
        let plan_id = plan.get("id").and_then(|v| v.as_str()).unwrap_or("img").to_string();
        let filename = format!("{}_{}_{}.png", node_id, plan_id, i + 1);
        let base_prompt = plan.get("prompt").and_then(|v| v.as_str()).unwrap_or("a professional illustration");
        let aspect_ratio = plan.get("aspect_ratio").and_then(|v| v.as_str());

        let _ = app_handle.emit("node_progress", serde_json::json!({
            "node_id": node_id,
            "progress": (i + 1) as u32,
            "total": total as u32,
        }));

        // Enrich prompt with plan-specific context to ensure each image is distinct
        let description = plan.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let position = plan.get("position").and_then(|v| v.as_str()).unwrap_or("");
        let prompt = if total > 1 {
            format!(
                "[variation {} of {}] Image for article section '{}'. Context: {}. {}",
                i + 1, total, position, description, base_prompt,
            )
        } else {
            base_prompt.to_string()
        };

        let result = ai_client::image_generation(model, &prompt, aspect_ratio).await?;

        let file_path = assets_dir.join(&filename);
        fs::write(&file_path, &result.image_data)
            .map_err(|e| format!("save image: {}", e))?;

        let asset_id = uuid::Uuid::new_v4().to_string();
        let file_path_str = file_path.to_string_lossy().to_string();
        let size_bytes = result.image_data.len() as i64;

        let conn = db::get_connection();
        let locked = conn.lock().unwrap();
        locked.execute(
            "INSERT INTO assets (id, workflow_id, node_id, type, file_path, original_filename, size_bytes, mime_type) \
             VALUES (?1, ?2, ?3, 'image', ?4, ?5, ?6, 'image/png')",
            rusqlite::params![&asset_id, &workflow_id, &node_id, &file_path_str, &filename, size_bytes],
        ).map_err(|e| format!("insert asset: {}", e))?;
        drop(locked);

        let img_obj = serde_json::json!({
            "id": asset_id,
            "plan_id": plan_id,
            "file_path": file_path_str,
            "prompt": base_prompt,
            "description": description,
            "position": position,
        });

        per_image.insert(format!("image{}", i + 1), img_obj.clone());
        images.push(img_obj);
    }

    let mut output = serde_json::json!({ "images": images });
    if let serde_json::Value::Object(map) = &mut output {
        for (k, v) in per_image {
            map.insert(k, v);
        }
    }

    Ok(ExecuteResult {
        output,
        status: "done".into(),
    })
}

pub async fn exec_html_formatter(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let text = payload.input_data
        .get("text")
        .and_then(extract_text)
        .or_else(|| payload.input_data.get("in").and_then(extract_text))
        .unwrap_or("");

    if text.trim().is_empty() {
        return Err("html_formatter: empty text input".into());
    }

    let style = payload.node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("经典");

    let font_size = payload.node_data
        .get("fontSize")
        .and_then(|v| v.as_u64())
        .unwrap_or(16);

    let line_height = payload.node_data
        .get("lineHeight")
        .and_then(|v| v.as_f64())
        .unwrap_or(1.75);

    let images_info = payload.input_data
        .get("image_slot")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter().filter_map(|img| {
                let pos = img.get("position").and_then(|v| v.as_str()).unwrap_or("");
                let desc = img.get("description").and_then(|v| v.as_str()).unwrap_or("");
                let fp = img.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
                if !fp.is_empty() {
                    Some(format!("- 位置: {}, 描述: {}, 文件: {}", pos, desc, fp))
                } else { None }
            }).collect::<Vec<_>>().join("\n")
        })
        .unwrap_or_default();

    let style_guide = match style {
        "简约" => "极简风格，大量留白，浅灰色分隔线，无装饰元素",
        "活泼" => "活泼风格，鲜艳强调色（橙色 #FF6B35），圆角卡片布局",
        "专业" => "专业商务风格，深蓝色强调（#1a5276），严谨排版",
        _ => "经典公众号风格，温暖色调，适度分隔线和强调元素",
    };

    let system = format!(
        "你是微信公众号排版专家。将 Markdown 转为微信编辑器兼容的 HTML。\n\n\
         风格：{}\n字号: {}px, 行高: {}\n\n\
         要求：内联样式（无 class/CSS），字体 -apple-system/'PingFang SC'/sans-serif\n\
         正文 #333 {}px，H2 {}px 加粗 #1a1a1a，图片居中 border-radius:8px\n\
         引用块：左边框 3px #ddd，背景 #f8f8f8。代码块：背景 #f5f5f5 等宽字体\n\
         图片用 <img src=\"{{file_path}}\" alt=\"{{description}}\"> 插入\n\
         直接输出 HTML，不包裹 <html><body>",
        style_guide, font_size, line_height, font_size, font_size + 4,
    );

    let mut user_msg = format!("文章 Markdown：\n{}", text);
    if !images_info.is_empty() {
        user_msg.push_str(&format!("\n\n图片资源：\n{}", images_info));
    }

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion(&get_text_model(&payload.node_data), "", messages, 8192, Some(0.3)).await?;

    let html = completion.text;
    let word_count = text.chars().filter(|c| !c.is_whitespace()).count();

    Ok(ExecuteResult {
        output: serde_json::json!({
            "html": html,
            "word_count": word_count,
            "reading_time": (word_count as f64 / 400.0).ceil() as u32,
        }),
        status: "done".into(),
    })
}
