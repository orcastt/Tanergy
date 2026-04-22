use crate::services::ai_client::{self, ChatMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;

mod media;

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
        "image_planner" => media::exec_image_planner(&payload).await,
        "image_gen" | "image_list" => media::exec_image_gen(&payload, &app_handle).await,
        "html_formatter" => media::exec_html_formatter(&payload).await,
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
