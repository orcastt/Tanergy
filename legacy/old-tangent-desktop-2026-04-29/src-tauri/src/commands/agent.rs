use crate::services::ai_client::{self, ChatMessage};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Deserialize)]
pub struct AgentChatPayload {
    pub messages: Vec<ChatMessage>,
    #[allow(dead_code)]
    pub context: Value,
}

#[derive(Debug, Serialize)]
pub struct AgentChatResult {
    pub message: String,
}

fn build_node_registry() -> Vec<Value> {
    vec![
        serde_json::json!({
            "type": "text_input",
            "desc": "Text input — user writes topic or content here. Put user's request in data.text.",
            "inputs": [],
            "outputs": [{"id": "out", "type": "text"}],
            "injectUserText": true
        }),
        serde_json::json!({
            "type": "research",
            "desc": "Deep research on a topic. Optional data.direction: '行业分析'|'案例研究'|'数据洞察'|'趋势预测'.",
            "modelCategory": "text",
            "defaultModelSource": "admin",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "research_result"}]
        }),
        serde_json::json!({
            "type": "outline_generator",
            "desc": "Generate a structured article outline with N sections. Outputs sections[] and image_plans[]. After running, user clicks Split to auto-create text_input nodes + image_list + html_formatter.",
            "modelCategory": "text",
            "defaultModelSource": "admin",
            "data_options": {"style": "干货清单|故事叙事|深度分析", "promptOverride": "optional extra instructions"},
            "inputs": [{"id": "in", "type": "text"}, {"id": "research", "type": "research_result"}],
            "outputs": [{"id": "out", "type": "text"}, {"id": "image_plans", "type": "image_plans"}]
        }),
        serde_json::json!({
            "type": "image_list",
            "desc": "AI image generation from image plans or text. Count auto-syncs from connected image_plans.",
            "modelCategory": "image",
            "defaultModelSource": "admin",
            "inputs": [{"id": "in", "type": "image_plans"}, {"id": "text", "type": "text"}],
            "outputs": [{"id": "out", "type": "image_slot"}]
        }),
        serde_json::json!({
            "type": "html_formatter",
            "desc": "Html Editor — combine N text sections + images into WeChat HTML. Double-click the node after running to open the built-in editor with WeChat preview. Dynamic inputs text_1, text_2... connect one per section. images port connects from image_list.out. This is the terminal output node — do not add preview_wechat after it.",
            "modelCategory": "text",
            "defaultModelSource": "admin",
            "data_options": {"style": "经典|简约|活泼|专业", "textInputs": ["text_1"]},
            "inputs": [{"id": "text_1", "type": "text"}, {"id": "images", "type": "image_slot"}],
            "outputs": []
        }),
        serde_json::json!({
            "type": "image_planner",
            "desc": "Plan images for an existing article text (alternative to outline_generator's built-in image planning)",
            "modelCategory": "text",
            "defaultModelSource": "admin",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "image_plans"}]
        }),
        serde_json::json!({
            "type": "image_gallery",
            "desc": "Collect and display images from upstream",
            "inputs": [{"id": "in", "type": "image_slot"}],
            "outputs": []
        }),
    ]
}

fn build_system_prompt() -> String {
    let nodes = serde_json::to_string_pretty(&build_node_registry()).unwrap_or_default();

    format!(
        r#"You are TANGENT, an AI workflow assistant. The user describes what they want to create, and you return JSON instructions to build the node graph.

## Node Registry
{nodes}

## Output Format
Strict JSON only, no other text:
{{
  "message": "Explain to the user what you created (in Chinese)",
  "actions": [
    {{"op": "add", "type": "node_type", "name": "unique_name", "position": [x, y], "data": {{}}}},
    {{"op": "connect", "from": "source_name", "fromPort": "port_id", "to": "target_name", "toPort": "port_id"}}
  ]
}}

## Rules
1. Every "add" must have a unique "name" (e.g. "topic", "research1", "outline"). "connect" uses name to reference nodes.
2. position.x starts at 100, increment by 300 for each node. position.y = 300 default.
3. text_input MUST include "data": {{"text": "the user's full input content"}} — put the user's topic/request here.
4. fromPort and toPort MUST be exact port IDs from the registry.
5. Port types must match: text→text, research_result→research_result, image_plans→image_plans, image_slot→image_slot.
6. Include ALL connect actions to form a complete pipeline.
7. PREFERRED WeChat article flow (new):
   text_input → research (connect out→in AND out→research to outline) → outline_generator → STOP.
   Tell user: "点击 Outline 节点的 Split 按钮，自动创建章节节点、图片生成和 HTML 排版节点。"
   Do NOT manually add html_formatter or image_list when outline_generator is in the graph — Split handles it.
8. Other flows:
   - "Just research" → text_input→research
   - "E-commerce poster" → text_input→research→image_planner→image_list
   - "Only HTML formatting" → text_input→html_formatter
   - "Polish and format text" → text_input→html_formatter
9. Do not include model in data unless the user explicitly asks for a specific model. The app injects Admin-configured default models automatically.
10. Output ONLY the JSON object, nothing else."#
    )
}

#[tauri::command]
pub async fn agent_chat(payload: AgentChatPayload) -> Result<AgentChatResult, String> {
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
        std::thread::sleep(std::time::Duration::from_millis(500));
        let mock = crate::test::mock_data::mock_agent_chat(&serde_json::json!(payload.messages));
        return Ok(AgentChatResult {
            message: serde_json::to_string(&mock).unwrap_or_default(),
        });
    }

    let mut messages = vec![ChatMessage {
        role: "system".into(),
        content: build_system_prompt(),
    }];
    messages.extend(payload.messages);

    let completion =
        ai_client::chat_completion("nemotron-3-super-120b-a12b", "", messages, 2048, Some(0.7)).await?;

    Ok(AgentChatResult {
        message: completion.text,
    })
}
