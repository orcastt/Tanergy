use crate::services::ai_client::{self, ChatMessage};
use crate::db;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

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

const MINIMAX_MODEL: &str = "MiniMax-M2.7";

#[tauri::command]
pub async fn execute_node(
    payload: ExecutePayload,
    app_handle: tauri::AppHandle,
) -> Result<ExecuteResult, String> {
    match payload.node_type.as_str() {
        "text_input" => exec_text_input(&payload),
        "research" => exec_research(&payload).await,
        "outline_generator" => exec_outline(&payload).await,
        "writer" => exec_writer(&payload).await,
        "reviewer" => exec_reviewer(&payload).await,
        "image_planner" => exec_image_planner(&payload).await,
        "image_gen" => exec_image_gen(&payload, &app_handle).await,
        _ => Err(format!("unsupported node type: {}", payload.node_type)),
    }
}

fn exec_text_input(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let text = payload.node_data
        .get("text")
        .and_then(|v| v.as_str())
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
    let query = payload.input_data
        .get("in")
        .and_then(|v| v.get("text"))
        .and_then(|v| v.as_str())
        .or_else(|| payload.node_data.get("query").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();

    if query.trim().is_empty() {
        return Err("research: empty query".into());
    }

    let system = "你是一个专业的研究助手。根据用户给出的主题，进行深入调研，输出详细的调研报告。包括：核心概念、最新趋势、关键数据点、行业观点、可引用的案例。用中文回答。";
    let user_msg = format!("请对以下主题进行深入调研：{}\n\n请输出结构化的调研报告，包含关键事实、数据和洞察。", query);

    let messages = vec![
        ChatMessage { role: "system".into(), content: system.into() },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion("minimax", MINIMAX_MODEL, messages, 4096, Some(0.7)).await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": completion.text }),
        status: "done".into(),
    })
}

async fn exec_outline(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let topic = payload.input_data
        .get("in")
        .and_then(|v| v.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let research = payload.input_data
        .get("research")
        .and_then(|v| v.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let style = payload.node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("干货清单");

    let system = "你是一个公众号写作大纲规划师。根据用户主题和调研资料，生成3个不同角度的文章大纲选项。\n每个选项包含：标题、角度说明、3-5个章节标题。\n\n输出严格 JSON 格式：\n{\"options\": [{\"title\": \"...\", \"angle\": \"...\", \"sections\": [\"...\"]}]}\n只输出 JSON，不要其他内容。";

    let user_msg = format!(
        "主题：{}\n风格：{}\n\n调研资料：\n{}\n\n请生成3个大纲选项。",
        topic, style, research
    );

    let messages = vec![
        ChatMessage { role: "system".into(), content: system.into() },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion("minimax", MINIMAX_MODEL, messages, 2048, Some(0.8)).await?;

    let options_str = completion.text.trim();
    let options_json: Value = if options_str.starts_with('{') || options_str.starts_with('[') {
        serde_json::from_str(options_str).unwrap_or(serde_json::json!({ "raw": options_str }))
    } else {
        serde_json::json!({ "raw": options_str })
    };

    Ok(ExecuteResult {
        output: options_json,
        status: "done".into(),
    })
}

async fn exec_writer(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let outline = payload.input_data
        .get("outline")
        .and_then(|v| v.as_str())
        .or_else(|| payload.input_data.get("in").and_then(|v| v.as_str()))
        .unwrap_or("");

    let research = payload.input_data
        .get("research")
        .and_then(|v| v.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let materials = payload.input_data
        .get("materials")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let target_words = payload.node_data
        .get("target_words")
        .and_then(|v| v.as_u64())
        .unwrap_or(3000);

    let style = payload.node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("干货清单");

    if outline.trim().is_empty() {
        return Err("writer: empty outline".into());
    }

    let system = format!(
        "你是一位资深公众号作者。请根据提供的大纲、调研资料和用户素材，撰写一篇完整的公众号长文。\n\n\
         写作风格：{}\n\
         目标字数：约{}字\n\n\
         严格规则：\n\
         - 用真实经历或具体场景引入，不用「在当今时代」「随着...的发展」等套话开头\n\
         - 所有数据和案例必须来自调研资料或用户素材，不得编造\n\
         - 禁止使用：综上所述、值得注意的是、不缺...缺的是...、毋庸置疑\n\
         - 超过30字的长句必须拆短\n\
         - 每段不超过5行（手机屏幕友好）\n\
         - 口语化表达，避免书面词汇\n\
         - 输出 Markdown 格式，用 ## 作为章节标题",
        style, target_words
    );

    let mut user_parts = vec![format!("大纲：\n{}", outline)];
    if !research.is_empty() {
        user_parts.push(format!("\n\n调研资料：\n{}", research));
    }
    if !materials.is_empty() {
        user_parts.push(format!("\n\n用户提供的真实素材：\n{}", materials));
    }
    let user_msg = user_parts.join("");

    let messages = vec![
        ChatMessage { role: "system".into(), content: system },
        ChatMessage { role: "user".into(), content: user_msg },
    ];

    let completion = ai_client::chat_completion("minimax", MINIMAX_MODEL, messages, 8192, Some(0.7)).await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": completion.text }),
        status: "done".into(),
    })
}

async fn exec_reviewer(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let draft = payload.input_data
        .get("in")
        .and_then(|v| v.as_str())
        .or_else(|| payload.input_data.get("draft").and_then(|v| v.as_str()))
        .unwrap_or("");

    let research = payload.input_data
        .get("research")
        .and_then(|v| v.get("text"))
        .and_then(|v| v.as_str())
        .unwrap_or("");

    if draft.trim().is_empty() {
        return Err("reviewer: empty draft".into());
    }

    // Pass 1: Fact check
    let pass1_system = "你是一个严谨的事实核查编辑。核对文章中的所有数据、时间、产品名称是否与提供的调研资料一致。\
                        如果有不一致或无法验证的内容，进行修正或标注。输出修正后的完整文章（Markdown），不要加额外注释。";
    let pass1_msg = format!("调研资料：\n{}\n\n待核查文章：\n{}", research, draft);

    let pass1 = ai_client::chat_completion(
        "minimax", MINIMAX_MODEL,
        vec![
            ChatMessage { role: "system".into(), content: pass1_system.into() },
            ChatMessage { role: "user".into(), content: pass1_msg },
        ],
        8192, Some(0.3),
    ).await?;

    // Pass 2: De-AI
    let pass2_system = "你是一个反AI洗稿编辑。将文章改写得更像人写的：\n\
                        - 删除所有套话和模板化表达\n\
                        - 拆解排比句，让句式长短错落\n\
                        - 加入个人态度和真实感受\n\
                        - 口语化，像在跟朋友聊天\n\
                        - 风格参考：自然、直接、有态度\n\
                        输出改写后的完整文章（Markdown）。";
    let pass2_msg = format!("请对以下文章进行反AI洗稿：\n{}", pass1.text);

    let pass2 = ai_client::chat_completion(
        "minimax", MINIMAX_MODEL,
        vec![
            ChatMessage { role: "system".into(), content: pass2_system.into() },
            ChatMessage { role: "user".into(), content: pass2_msg },
        ],
        8192, Some(0.7),
    ).await?;

    // Pass 3: Rhythm & format
    let pass3_system = "你是一个排版编辑。优化文章的阅读节奏和格式：\n\
                        - 拆分超过30字的长句\n\
                        - 每段不超过5行\n\
                        - 优化标点符号使用\n\
                        - 确保段落之间有呼吸感\n\
                        - 保持 Markdown 格式整洁\n\
                        输出最终成稿（Markdown）。";
    let pass3_msg = format!("请优化以下文章的节奏和格式：\n{}", pass2.text);

    let pass3 = ai_client::chat_completion(
        "minimax", MINIMAX_MODEL,
        vec![
            ChatMessage { role: "system".into(), content: pass3_system.into() },
            ChatMessage { role: "user".into(), content: pass3_msg },
        ],
        8192, Some(0.3),
    ).await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": pass3.text }),
        status: "done".into(),
    })
}

async fn exec_image_planner(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let article = payload.input_data
        .get("in")
        .and_then(|v| v.as_str())
        .or_else(|| payload.input_data.get("text").and_then(|v| v.as_str()))
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

    let completion = ai_client::chat_completion("minimax", MINIMAX_MODEL, messages, 4096, Some(0.7)).await?;

    let raw = completion.text.trim();
    let plans: Value = if raw.starts_with('[') {
        let arr: Vec<Value> = serde_json::from_str(raw)
            .unwrap_or_else(|_| vec![serde_json::json!({ "raw": raw })]);
        let plans: Vec<Value> = arr.into_iter().enumerate().map(|(i, mut p)| {
            if let Some(obj) = p.as_object_mut() {
                obj.insert("id".into(), serde_json::json!(format!("img_{}", i + 1)));
            }
            p
        }).collect();
        serde_json::json!(plans)
    } else {
        // Try to extract JSON from markdown code block
        if let Some(start) = raw.find('[') {
            if let Some(end) = raw.rfind(']') {
                let slice = &raw[start..=end];
                if let Ok(arr) = serde_json::from_str::<Vec<Value>>(slice) {
                    let plans: Vec<Value> = arr.into_iter().enumerate().map(|(i, mut p)| {
                        if let Some(obj) = p.as_object_mut() {
                            obj.insert("id".into(), serde_json::json!(format!("img_{}", i + 1)));
                        }
                        p
                    }).collect();
                    serde_json::json!(plans)
                } else {
                    serde_json::json!({ "raw": raw })
                }
            } else {
                serde_json::json!({ "raw": raw })
            }
        } else {
            serde_json::json!({ "raw": raw })
        }
    };

    Ok(ExecuteResult {
        output: serde_json::json!({ "image_plans": plans }),
        status: "done".into(),
    })
}

async fn exec_image_gen(
    payload: &ExecutePayload,
    app_handle: &tauri::AppHandle,
) -> Result<ExecuteResult, String> {
    let plans_val = payload.input_data
        .get("in")
        .and_then(|v| v.get("image_plans"))
        .or_else(|| payload.input_data.get("image_plans"))
        .cloned()
        .unwrap_or(serde_json::json!([]));

    let plans: Vec<Value> = if plans_val.is_array() {
        plans_val.as_array().unwrap().clone()
    } else if plans_val.is_object() && plans_val.get("raw").is_some() {
        return Err("image_gen: planner returned raw text, not valid plans".into());
    } else {
        return Err("image_gen: no image plans received".into());
    };

    if plans.is_empty() {
        return Err("image_gen: empty image plans".into());
    }

    let workflow_id = payload.node_data
        .get("workflow_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .to_string();

    let node_id = payload.node_data
        .get("node_id")
        .and_then(|v| v.as_str())
        .unwrap_or("image_gen")
        .to_string();

    let app_dir = db::get_app_dir();
    let assets_dir = PathBuf::from(&app_dir).join("assets").join(&workflow_id);
    fs::create_dir_all(&assets_dir)
        .map_err(|e| format!("create assets dir: {}", e))?;

    let total = plans.len();
    let mut images = Vec::new();

    for (i, plan) in plans.iter().enumerate() {
        let plan_id = plan.get("id").and_then(|v| v.as_str()).unwrap_or("img").to_string();
        let prompt = plan.get("prompt").and_then(|v| v.as_str()).unwrap_or("a professional illustration");
        let aspect_ratio = plan.get("aspect_ratio").and_then(|v| v.as_str());

        // Emit progress
        let _ = app_handle.emit("node_progress", serde_json::json!({
            "node_id": node_id,
            "progress": (i + 1) as u32,
            "total": total as u32,
            "status": format!("生成中 {}/{}...", i + 1, total),
        }));

        let result = ai_client::image_generation("minimax", prompt, aspect_ratio).await?;

        let filename = format!("{}_{}.png", node_id, plan_id);
        let file_path = assets_dir.join(&filename);
        fs::write(&file_path, &result.image_data)
            .map_err(|e| format!("save image: {}", e))?;

        let asset_id = uuid::Uuid::new_v4().to_string();
        let file_path_str = file_path.to_string_lossy().to_string();
        let size_bytes = result.image_data.len() as i64;

        // Insert into assets table
        let conn = db::get_connection();
        let locked = conn.lock().unwrap();
        locked.execute(
            "INSERT INTO assets (id, workflow_id, node_id, type, file_path, original_filename, size_bytes, mime_type) \
             VALUES (?1, ?2, ?3, 'image', ?4, ?5, ?6, 'image/png')",
            rusqlite::params![
                &asset_id,
                &workflow_id,
                &node_id,
                &file_path_str,
                &filename,
                size_bytes,
            ],
        ).map_err(|e| format!("insert asset: {}", e))?;
        drop(locked);

        images.push(serde_json::json!({
            "id": asset_id,
            "plan_id": plan_id,
            "file_path": file_path_str,
            "prompt": prompt,
            "description": plan.get("description").and_then(|v| v.as_str()).unwrap_or(""),
            "position": plan.get("position").and_then(|v| v.as_str()).unwrap_or(""),
            "aspect_ratio": aspect_ratio.unwrap_or("16:9"),
        }));
    }

    Ok(ExecuteResult {
        output: serde_json::json!({ "images": images }),
        status: "done".into(),
    })
}
