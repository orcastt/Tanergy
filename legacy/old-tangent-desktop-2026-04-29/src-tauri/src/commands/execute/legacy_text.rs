use super::{ExecutePayload, ExecuteResult, extract_text, get_text_model};
use crate::services::ai_client::{self, ChatMessage};

pub async fn exec_writer(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let outline = payload.input_data
        .get("outline")
        .and_then(extract_text)
        .or_else(|| payload.input_data.get("in").and_then(extract_text))
        .unwrap_or("");
    let research = payload.input_data.get("research").and_then(extract_text).unwrap_or("");
    let materials = payload.input_data.get("materials").and_then(|v| v.as_str()).unwrap_or("");
    let target_words = payload.node_data.get("target_words").and_then(|v| v.as_u64()).unwrap_or(3000);
    let style = payload.node_data.get("style").and_then(|v| v.as_str()).unwrap_or("干货清单");

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

    let completion = ai_client::chat_completion(
        &get_text_model(&payload.node_data),
        "",
        vec![
            ChatMessage { role: "system".into(), content: system },
            ChatMessage { role: "user".into(), content: user_parts.join("") },
        ],
        8192,
        Some(0.7),
    ).await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": completion.text }),
        status: "done".into(),
    })
}

pub async fn exec_reviewer(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let draft = payload.input_data
        .get("in")
        .and_then(extract_text)
        .or_else(|| payload.input_data.get("draft").and_then(extract_text))
        .unwrap_or("");
    let research = payload.input_data.get("research").and_then(extract_text).unwrap_or("");
    let model = get_text_model(&payload.node_data);

    if draft.trim().is_empty() {
        return Err("reviewer: empty draft".into());
    }

    let pass1 = ai_client::chat_completion(
        &model,
        "",
        vec![
            ChatMessage { role: "system".into(), content: "你是一个严谨的事实核查编辑。核对文章中的所有数据、时间、产品名称是否与提供的调研资料一致。如果有不一致或无法验证的内容，进行修正或标注。输出修正后的完整文章（Markdown），不要加额外注释。".into() },
            ChatMessage { role: "user".into(), content: format!("调研资料：\n{}\n\n待核查文章：\n{}", research, draft) },
        ],
        8192,
        Some(0.3),
    ).await?;

    let pass2 = ai_client::chat_completion(
        &model,
        "",
        vec![
            ChatMessage { role: "system".into(), content: "你是一个反AI洗稿编辑。将文章改写得更像人写的：删除套话，拆解排比句，加入个人态度和真实感受，口语化，像在跟朋友聊天。输出改写后的完整文章（Markdown）。".into() },
            ChatMessage { role: "user".into(), content: format!("请对以下文章进行反AI洗稿：\n{}", pass1.text) },
        ],
        8192,
        Some(0.7),
    ).await?;

    let pass3 = ai_client::chat_completion(
        &model,
        "",
        vec![
            ChatMessage { role: "system".into(), content: "你是一个排版编辑。拆分超过30字的长句，每段不超过5行，优化标点和阅读节奏，保持 Markdown 格式整洁。输出最终成稿（Markdown）。".into() },
            ChatMessage { role: "user".into(), content: format!("请优化以下文章的节奏和格式：\n{}", pass2.text) },
        ],
        8192,
        Some(0.3),
    ).await?;

    Ok(ExecuteResult {
        output: serde_json::json!({ "text": pass3.text }),
        status: "done".into(),
    })
}
