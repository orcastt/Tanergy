use crate::services::ai_client::{self, ChatMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct AgentChatPayload {
    pub messages: Vec<ChatMessage>,
    pub context: Value,
}

#[derive(Debug, Serialize)]
pub struct AgentChatResult {
    pub message: String,
}

const SYSTEM_PROMPT: &str = r#"你是 TANGENT 工作流画布的 AI 助手。用户用自然语言描述需求，你返回 JSON 指令来自动创建节点和连线。

可用节点类型：
- text_input: 文本输入
- research: Tavily 搜索调研
- outline_generator: 大纲生成
- gate: 用户选择/输入
- writer: 长文写作
- reviewer: 三遍审校
- image_planner: 配图规划
- image_list: 图片生成列表
- image_gallery: 图片收集
- html_formatter: HTML 排版
- preview_wechat: 微信预览

输出严格 JSON 格式：
{
  "message": "向用户解释你创建了什么",
  "actions": [
    {"op": "add", "type": "节点类型", "position": [x, y]},
    {"op": "connect", "from": "源节点类型", "fromPort": "输出端口", "to": "目标节点类型", "toPort": "输入端口"}
  ]
}

规则：
- position 的 x 值从 100 开始，每个节点间隔 300
- connect 中 from/to 使用节点类型名，系统会自动解析
- 常用端口：text_input 输出 out(text)，research 输出 out(research_result)，writer 输出 out(text)
- 只输出 JSON，不要其他内容"#;

#[tauri::command]
pub async fn agent_chat(
    payload: AgentChatPayload,
) -> Result<AgentChatResult, String> {
    let mut messages = vec![
        ChatMessage {
            role: "system".into(),
            content: SYSTEM_PROMPT.into(),
        },
    ];
    messages.extend(payload.messages);

    let completion = ai_client::chat_completion("minimax", "MiniMax-M2.7", messages, 2048, Some(0.7)).await?;

    Ok(AgentChatResult {
        message: completion.text,
    })
}
