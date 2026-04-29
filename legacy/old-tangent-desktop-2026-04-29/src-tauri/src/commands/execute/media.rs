use super::{extract_text, get_text_model, ExecutePayload, ExecuteResult};
use crate::db;
use crate::services::ai_client::{self, ChatMessage};
use crate::services::library_assets;
use serde_json::Value;
use std::fs;
use std::path::PathBuf;
use tauri::Emitter;

mod image_planner;
pub use image_planner::exec_image_planner;

pub async fn exec_image_gen(
    payload: &ExecutePayload,
    app_handle: &tauri::AppHandle,
) -> Result<ExecuteResult, String> {
    // Accept plans from image_planner, outline_generator, or generate from text input
    // input_data["in"] can be: the array directly, an object with image_plans key, or an image_planner result
    let plans_val = payload
        .input_data
        .get("in")
        .cloned()
        .map(|v| {
            if v.is_array() {
                v
            } else if let Some(arr) = v.get("image_plans") {
                arr.clone()
            } else {
                v
            }
        })
        .or_else(|| payload.input_data.get("image_plans").cloned());

    let text_input = payload
        .input_data
        .get("text")
        .and_then(extract_text)
        .unwrap_or("");

    let count = payload
        .node_data
        .get("count")
        .and_then(|v| v.as_u64())
        .unwrap_or(1) as usize;

    let model = payload
        .node_data
        .get("model")
        .and_then(|v| v.as_str())
        .unwrap_or("gpt-image-2");
    let size = payload.node_data.get("size").and_then(|v| v.as_str());
    let quality = payload.node_data.get("quality").and_then(|v| v.as_str());
    let image_size = payload.node_data.get("image_size").and_then(|v| v.as_str());

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
            ChatMessage {
                role: "system".into(),
                content: system,
            },
            ChatMessage {
                role: "user".into(),
                content: text_input.to_string(),
            },
        ];
        let completion = ai_client::chat_completion(
            &get_text_model(&payload.node_data),
            "",
            messages,
            2048,
            Some(0.7),
        )
        .await?;
        let raw = completion.text.trim();
        if raw.starts_with('[') {
            serde_json::from_str::<Vec<Value>>(raw).unwrap_or_default()
        } else if let Some(s) = raw.find('[') {
            let end = raw.rfind(']').unwrap_or(raw.len() - 1);
            serde_json::from_str::<Vec<Value>>(&raw[s..=end]).unwrap_or_default()
        } else {
            vec![
                serde_json::json!({ "prompt": text_input, "description": text_input, "aspect_ratio": "16:9" }),
            ]
        }
    } else {
        return Err("image_list: no image plans or text input".into());
    };

    if plans.is_empty() {
        return Err("image_list: empty image plans".into());
    }

    let limited_plans: Vec<Value> = plans.into_iter().take(count).collect();

    let workflow_id = payload
        .node_data
        .get("workflow_id")
        .and_then(|v| v.as_str())
        .unwrap_or("default")
        .to_string();

    let node_id = payload
        .node_data
        .get("node_id")
        .and_then(|v| v.as_str())
        .unwrap_or("image_list")
        .to_string();

    let app_dir = db::get_app_dir();
    let assets_dir = PathBuf::from(&app_dir).join("assets").join(&workflow_id);
    fs::create_dir_all(&assets_dir).map_err(|e| format!("create assets dir: {}", e))?;

    let total = limited_plans.len();
    eprintln!(
        "[image_gen] total={} plans, count={}, model={}",
        total, count, model
    );
    for (i, p) in limited_plans.iter().enumerate() {
        eprintln!(
            "[image_gen] plan[{}]: id={}, prompt='{}'",
            i,
            p.get("id").and_then(|v| v.as_str()).unwrap_or("?"),
            p.get("prompt").and_then(|v| v.as_str()).unwrap_or("?")
        );
    }

    let mut images = Vec::new();
    let mut per_image = serde_json::Map::new();

    for (i, plan) in limited_plans.iter().enumerate() {
        let plan_id = plan
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or("img")
            .to_string();
        let filename = format!("{}_{}_{}.png", node_id, plan_id, i + 1);
        let base_prompt = plan
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or("a professional illustration");
        let aspect_ratio = plan.get("aspect_ratio").and_then(|v| v.as_str());

        let _ = app_handle.emit(
            "node_progress",
            serde_json::json!({
                "node_id": node_id,
                "progress": (i + 1) as u32,
                "total": total as u32,
            }),
        );

        let description = plan
            .get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let position = plan.get("position").and_then(|v| v.as_str()).unwrap_or("");
        let prompt = base_prompt.to_string();

        eprintln!(
            "[image_gen] call {}/{} prompt='{}' model={}",
            i + 1,
            total,
            &prompt[..prompt.len().min(80)],
            model
        );

        let result = ai_client::image_generation(
            model,
            &prompt,
            aspect_ratio,
            size,
            quality,
            image_size,
        )
        .await?;

        eprintln!(
            "[image_gen] call {}/{} returned {} bytes, saved to {}",
            i + 1,
            total,
            result.image_data.len(),
            filename
        );

        let file_path = assets_dir.join(&filename);
        fs::write(&file_path, &result.image_data).map_err(|e| format!("save image: {}", e))?;

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

        let library_title = if description.trim().is_empty() {
            format!("AI Image {}", i + 1)
        } else {
            description.to_string()
        };
        let library_item = library_assets::save_generated_image(
            &result.image_data,
            &library_title,
            &prompt,
            &workflow_id,
            &node_id,
            model,
        )?;

        let img_obj = serde_json::json!({
            "id": asset_id,
            "plan_id": plan_id,
            "file_path": file_path_str,
            "library_item_id": library_item.id,
            "library_file_path": library_item.file_path,
            "library_tags": library_item.tags,
            "model": model,
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
