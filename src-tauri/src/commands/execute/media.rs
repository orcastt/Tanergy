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
    // Accept plans from image_planner, outline_generator, or generate from text input
    // input_data["in"] can be: the array directly, an object with image_plans key, or an image_planner result
    let plans_val = payload.input_data
        .get("in")
        .cloned()
        .map(|v| {
            if v.is_array() { v }
            else if let Some(arr) = v.get("image_plans") { arr.clone() }
            else { v }
        })
        .or_else(|| payload.input_data.get("image_plans").cloned());

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
        } else if pv.is_object() {
            // Could be { image_plans: [...] } from outline_generator
            if let Some(arr) = pv.get("image_plans").and_then(|v| v.as_array()) {
                arr.clone()
            } else if pv.get("raw").is_some() {
                return Err("image_list: planner returned raw text, not valid plans".into());
            } else {
                return Err("image_list: no valid image plans".into());
            }
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
    eprintln!("[image_gen] total={} plans, count={}, model={}", total, count, model);
    for (i, p) in limited_plans.iter().enumerate() {
        eprintln!("[image_gen] plan[{}]: id={}, prompt='{}'", i,
            p.get("id").and_then(|v| v.as_str()).unwrap_or("?"),
            p.get("prompt").and_then(|v| v.as_str()).unwrap_or("?"));
    }

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

        let description = plan.get("description").and_then(|v| v.as_str()).unwrap_or("");
        let position = plan.get("position").and_then(|v| v.as_str()).unwrap_or("");
        let prompt = base_prompt.to_string();

        eprintln!("[image_gen] call {}/{} prompt='{}' model={}", i + 1, total, &prompt[..prompt.len().min(80)], model);

        let result = ai_client::image_generation(model, &prompt, aspect_ratio).await?;

        eprintln!("[image_gen] call {}/{} returned {} bytes, saved to {}", i + 1, total, result.image_data.len(), filename);

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
    // 1. Collect text sections: text_1, text_2, ... (dynamic ports)
    let mut sections: Vec<String> = Vec::new();
    let mut i = 1;
    loop {
        let key = format!("text_{}", i);
        if let Some(txt) = payload.input_data.get(&key).and_then(extract_text) {
            sections.push(txt.to_string());
            i += 1;
        } else {
            break;
        }
    }
    // Fallback: single "text" or "in" port (backward compat)
    if sections.is_empty() {
        if let Some(txt) = payload.input_data.get("text").and_then(extract_text)
            .or_else(|| payload.input_data.get("in").and_then(extract_text))
        {
            sections.push(txt.to_string());
        }
    }
    if sections.is_empty() {
        return Err("html_formatter: no text input".into());
    }
    let combined_text = sections.join("\n\n");

    // 2. Collect images from image_list output or dynamic image_N ports
    let mut images: Vec<Value> = Vec::new();
    for (key, value) in payload.input_data.as_object().into_iter().flatten() {
        let is_image_port = key == "images" || key == "image_slot" || key.starts_with("image_");
        if !is_image_port {
            continue;
        }

        if let Some(arr) = value.get("images").and_then(|v| v.as_array()) {
            images.extend(arr.iter().cloned());
        } else if let Some(arr) = value.as_array() {
            images.extend(arr.iter().cloned());
        } else if value.is_object() {
            images.push(value.clone());
        }
    }

    // 3. Replace [图N] markers with inline HTML
    let replaced_text = replace_image_markers(&combined_text, &images);

    let style = payload.node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("标准紫");

    let system = if style == "标准紫" {
        "你是微信公众号排版专家，精通「Tanvas 视觉规范」。将 Markdown 内容转换为微信编辑器兼容的原生内联样式 HTML。风格：标准紫 — 主题色 #5965AF，紫色系视觉系统。严格按以下组件库输出（只替换方括号内容，不修改 style 属性）：\
         【H2 二级标题 - 带浅紫大数字背景】<section style=\"margin-top:48px;margin-bottom:20px;display:flex;flex-direction:column;\"><svg width=\"100\" height=\"70\" style=\"margin-bottom:-45px;display:block;\" xmlns=\"http://www.w3.org/2000/svg\"><text x=\"0\" y=\"55\" font-size=\"65\" font-weight=\"900\" fill=\"#5965AF\" fill-opacity=\"0.15\" font-family=\"Arial,sans-serif\">[序号如01、02、03]</text></svg><span style=\"font-size:22px;font-weight:700;line-height:1.6;color:#252525;display:block;position:relative;z-index:10;\">[二级标题文字]</span></section>\
         【H3 三级标题 - 黑底白字副标题】<section style=\"display:inline-block;background-color:#1a1a1a;color:#ffffff;font-size:15px;font-weight:bold;padding:4px 12px;margin-top:30px;margin-bottom:10px;border-radius:2px;\">[三级标题文字]</section>\
         【H4 四级标题 - 紫色左修饰线】<section style=\"font-size:16px;font-weight:bold;color:#5965AF;margin-top:24px;margin-bottom:12px;display:flex;align-items:center;\"><span style=\"display:inline-block;width:4px;height:16px;background-color:#5965AF;margin-right:8px;border-radius:2px;\"></span>[四级标题文字]</section>\
         【Quote 引用卡片】<section style=\"padding:14px 18px;border-left:3px solid #5965AF;background:#fdfdfd;border-radius:5px;box-shadow:0px 2px 6px rgba(0,0,0,0.08);color:#878b8e;font-size:14px;line-height:1.6;font-style:italic;margin:28px 4px;\"><span style=\"color:#5965AF;font-weight:bold;font-style:normal;display:block;margin-bottom:8px;\">[选填引导词如「💡 核心洞察」]</span>[引用或导语内容]</section>\
         【Highlight 重点高亮】<span style=\"font-family:'Noto Sans SC',sans-serif;font-size:15px;line-height:1.8;color:#5965AF;font-weight:bold;background-color:#EDE4F1;padding:2px 4px;border-radius:2px;\">[高亮词汇]</span>\
         【Bold 加粗】<span style=\"font-weight:bold;color:#5965AF;\">[加粗文字]</span>\
         【Paragraph 普通正文段落】<section style=\"margin-top:20px;font-family:'Noto Sans SC',sans-serif;font-weight:normal;font-size:15px;line-height:1.8;color:#333333;letter-spacing:0.5px;text-align:justify;\">[正文内容，高亮和加粗需嵌套在此标签内]</section>\
         【Code Block macOS风格】<section style=\"background-color:#1e1e2e;border-radius:10px;margin-top:24px;margin-bottom:24px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);\"><section style=\"background-color:#252540;padding:12px 16px;border-bottom:1px solid #33334a;\"><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ff5f56;margin-right:6px;\"></span><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ffbd2e;margin-right:6px;\"></span><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#27c93f;\"></span></section><section style=\"padding:18px 20px;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:2;color:#e0e0e0;word-break:break-all;\">[代码内容，每行用br换行]</section></section>\
         输出规则：禁止修改 style 属性；普通文本换行必须用 Paragraph 包裹；Markdown 映射：H1→H2组件, H2→H3组件(黑底), H3→H4组件(左竖线), 引用→Quote卡片, 高亮→Highlight, 加粗→Bold, 普通段落→Paragraph；保留已有 img 和 div 占位标签原样不变；直接输出 HTML 片段，不包裹 html body".to_string()
    } else {
        format!(
            "你是微信公众号排版专家。将 Markdown 内容转换为微信编辑器兼容的原生内联样式 HTML。风格：{}\n\n要求：内联样式，字体 -apple-system/PingFang SC/sans-serif。标题用 <section> 包裹，正文用 <p>，列表用 <ul>/<li>。保留 <img> 标签原样不变。直接输出 HTML 片段，不包裹 <html><body>。",
            style
        )
    };

    let user_msg = format!("文章内容（含图片占位）：\n{}", replaced_text);

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion(&get_text_model(&payload.node_data), "", messages, 8192, Some(0.3)).await?;

    let html = completion.text;
    let word_count = combined_text.chars().filter(|c| !c.is_whitespace()).count();

    Ok(ExecuteResult {
        output: serde_json::json!({
            "html": html,
            "word_count": word_count,
            "reading_time": (word_count as f64 / 400.0).ceil() as u32,
        }),
        status: "done".into(),
    })
}

fn replace_image_markers(text: &str, images: &[Value]) -> String {
    let mut result = text.to_string();
    for (i, img) in images.iter().enumerate() {
        let marker = format!("[图{}]", i + 1);
        let file_path = img.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
        let description = img.get("description").and_then(|v| v.as_str()).unwrap_or("");

        let replacement = if file_path.starts_with("data:") {
            format!(
                "<div style=\"text-align:center;margin:16px 0\"><img src=\"{}\" alt=\"{}\" style=\"max-width:100%;border-radius:8px\" /></div>",
                file_path, description
            )
        } else if !file_path.is_empty() {
            format!(
                "<div style=\"text-align:center;margin:16px 0;padding:20px;background:#f5f3ff;border-radius:8px;color:#6d28d9;font-size:14px\">[配图：{}]</div>",
                description
            )
        } else {
            format!(
                "<div style=\"text-align:center;margin:16px 0;padding:20px;background:#f5f3ff;border-radius:8px;color:#6d28d9;font-size:14px\">[配图占位：{}]</div>",
                description
            )
        };
        result = result.replace(&marker, &replacement);
    }
    result
}
