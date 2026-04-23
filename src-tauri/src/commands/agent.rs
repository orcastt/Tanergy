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
            "desc": "Text input, inject user content via data.text",
            "inputs": [],
            "outputs": [{"id": "out", "type": "text"}],
            "injectUserText": true
        }),
        serde_json::json!({
            "type": "research",
            "desc": "Deep research on a topic",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "research_result"}]
        }),
        serde_json::json!({
            "type": "outline_generator",
            "desc": "Generate outline options for an article",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "in", "type": "text"}, {"id": "research", "type": "research_result"}],
            "outputs": [{"id": "out", "type": "outline_options"}]
        }),
        serde_json::json!({
            "type": "gate",
            "desc": "Pause for user to select an outline option or input material",
            "inputs": [{"id": "in", "type": "outline_options"}],
            "outputs": [{"id": "out", "type": "outline_options"}]
        }),
        serde_json::json!({
            "type": "writer",
            "desc": "AI long-form article writing",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "outline", "type": "outline_options"}],
            "outputs": [{"id": "out", "type": "text"}]
        }),
        serde_json::json!({
            "type": "reviewer",
            "desc": "Three-pass review: fact check, anti-AI polish, rhythm & format",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "text"}]
        }),
        serde_json::json!({
            "type": "image_planner",
            "desc": "AI image planning from article text",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "in", "type": "text"}],
            "outputs": [{"id": "out", "type": "image_plans"}]
        }),
        serde_json::json!({
            "type": "image_list",
            "desc": "AI image generation from plans or text description",
            "modelCategory": "image",
            "defaultModel": "minimax-image",
            "inputs": [{"id": "in", "type": "image_plans"}, {"id": "text", "type": "text"}],
            "outputs": []
        }),
        serde_json::json!({
            "type": "image_gallery",
            "desc": "Collect and display images from upstream",
            "inputs": [{"id": "in", "type": "image_slot"}],
            "outputs": []
        }),
        serde_json::json!({
            "type": "html_formatter",
            "desc": "Convert Markdown to WeChat-compatible styled HTML",
            "modelCategory": "text",
            "defaultModel": "MiniMax-M2.7",
            "inputs": [{"id": "text", "type": "text"}, {"id": "image_slot", "type": "image_slot"}],
            "outputs": [{"id": "out", "type": "structured"}]
        }),
        serde_json::json!({
            "type": "preview_wechat",
            "desc": "WeChat article preview with copy-to-clipboard",
            "inputs": [{"id": "html", "type": "structured"}],
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
  "message": "Explain to the user what you created",
  "actions": [
    {{"op": "add", "type": "node_type", "name": "unique_name", "position": [x, y], "data": {{}}}},
    {{"op": "connect", "from": "source_name", "fromPort": "port_id", "to": "target_name", "toPort": "port_id"}}
  ]
}}

## Rules
1. Every "add" must have a unique "name" (e.g. "topic", "research1", "outline"). "connect" uses name to reference nodes.
2. position.x starts at 100, increment by 300 for each node.
3. text_input MUST include "data": {{"text": "the user's full input content"}} — put the user's topic/request here.
4. fromPort and toPort MUST be exact port IDs from the registry (e.g. "out", "in", "research", "text", "outline", "html", "image_slot").
5. Port types must match: source output type === target input type. Valid types: text, research_result, outline_options, image_plans, image_slot, structured.
6. Include ALL connect actions to form a complete pipeline.
7. Be flexible based on user needs. Examples:
   - "Write a WeChat article about AI" → text_input→research→outline_generator→gate→writer→reviewer→image_planner→image_list→html_formatter→preview_wechat
   - "Just research this topic" → text_input→research
   - "E-commerce poster" → text_input→research→writer→image_planner→image_list
   - "Write an article without images" → skip image_planner and image_list
   - "I only need HTML formatting" → text_input→html_formatter→preview_wechat
8. When adding a node that has a "defaultModel", include it in the data: {{"model": "defaultModel"}}. Use the default unless the user explicitly requests a different model.
9. Output ONLY the JSON object, nothing else."#
    )
}

#[tauri::command]
pub async fn agent_chat(
    payload: AgentChatPayload,
) -> Result<AgentChatResult, String> {
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

    let completion = ai_client::chat_completion("minimax", "MiniMax-M2.7", messages, 2048, Some(0.7)).await?;

    Ok(AgentChatResult {
        message: completion.text,
    })
}
