use super::{ExecutePayload, ExecuteResult};

pub async fn exec_mock(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    use crate::test::mock_data;
    std::thread::sleep(std::time::Duration::from_millis(300));

    let output = match payload.node_type.as_str() {
        "text_input" => mock_data::mock_text_input(&payload.node_data, &payload.input_data),
        "research" => mock_data::mock_research(&payload.input_data),
        "outline_generator" => mock_data::mock_outline(&payload.input_data),
        "writer" => mock_data::mock_writer(&payload.input_data),
        "reviewer" => mock_data::mock_reviewer(&payload.input_data),
        "image_planner" => mock_data::mock_image_planner(&payload.input_data),
        "image_gen" | "image_list" => mock_data::mock_image_list(&payload.input_data),
        "html_formatter" => mock_data::mock_html_formatter(&payload.input_data),
        _ => serde_json::json!({ "ok": true }),
    };

    Ok(ExecuteResult {
        output,
        status: "done".into(),
    })
}
