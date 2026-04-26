use super::{ExecutePayload, ExecuteResult, extract_text, get_text_model};
use crate::services::ai_client::{self, ChatMessage};
use serde_json::Value;

pub async fn exec_html_formatter(payload: &ExecutePayload) -> Result<ExecuteResult, String> {
    let sections = collect_text_sections(payload)?;
    let combined_text = sections.join("\n\n");
    let images = collect_images(payload);
    let text_with_image_markers = ensure_image_markers(&combined_text, images.len());
    let style = payload.node_data
        .get("style")
        .and_then(|v| v.as_str())
        .unwrap_or("标准紫");

    let messages = vec![
        ChatMessage { role: "system".into(), content: html_system_prompt(style) },
        ChatMessage { role: "user".into(), content: format!("文章内容（含图片占位）：\n{}", text_with_image_markers) },
    ];

    let completion = ai_client::chat_completion(&get_text_model(&payload.node_data), "", messages, 8192, Some(0.3)).await?;
    let html = replace_image_markers(&completion.text, &images);
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

fn collect_text_sections(payload: &ExecutePayload) -> Result<Vec<String>, String> {
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
    Ok(sections)
}

fn collect_images(payload: &ExecutePayload) -> Vec<Value> {
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
    images
}

fn html_system_prompt(style: &str) -> String {
    if style == "标准紫" {
        return standard_purple_prompt();
    }
    format!(
        "你是微信公众号排版专家。将 Markdown 内容转换为微信编辑器兼容的原生内联样式 HTML。风格：{}\n\n要求：内联样式，字体 -apple-system/PingFang SC/sans-serif。标题用 <section> 包裹，正文用 <p>，列表用 <ul>/<li>。必须保留 [图1]、[图2] 这类图片占位符原文，不要改写、删除或包进代码块。直接输出 HTML 片段，不包裹 <html><body>。",
        style
    )
}

fn standard_purple_prompt() -> String {
    "你是微信公众号排版专家，精通「Tanvas 视觉规范」。将 Markdown 内容转换为微信编辑器兼容的原生内联样式 HTML。风格：标准紫 — 主题色 #5965AF，紫色系视觉系统。严格按以下组件库输出（只替换方括号内容，不修改 style 属性）：\
     【H2 二级标题 - 带浅紫大数字背景】<section style=\"margin-top:48px;margin-bottom:20px;display:flex;flex-direction:column;\"><svg width=\"100\" height=\"70\" style=\"margin-bottom:-45px;display:block;\" xmlns=\"http://www.w3.org/2000/svg\"><text x=\"0\" y=\"55\" font-size=\"65\" font-weight=\"900\" fill=\"#5965AF\" fill-opacity=\"0.15\" font-family=\"Arial,sans-serif\">[序号如01、02、03]</text></svg><span style=\"font-size:22px;font-weight:700;line-height:1.6;color:#252525;display:block;position:relative;z-index:10;\">[二级标题文字]</span></section>\
     【H3 三级标题 - 黑底白字副标题】<section style=\"display:inline-block;background-color:#1a1a1a;color:#ffffff;font-size:15px;font-weight:bold;padding:4px 12px;margin-top:30px;margin-bottom:10px;border-radius:2px;\">[三级标题文字]</section>\
     【H4 四级标题 - 紫色左修饰线】<section style=\"font-size:16px;font-weight:bold;color:#5965AF;margin-top:24px;margin-bottom:12px;display:flex;align-items:center;\"><span style=\"display:inline-block;width:4px;height:16px;background-color:#5965AF;margin-right:8px;border-radius:2px;\"></span>[四级标题文字]</section>\
     【Quote 引用卡片】<section style=\"padding:14px 18px;border-left:3px solid #5965AF;background:#fdfdfd;border-radius:5px;box-shadow:0px 2px 6px rgba(0,0,0,0.08);color:#878b8e;font-size:14px;line-height:1.6;font-style:italic;margin:28px 4px;\"><span style=\"color:#5965AF;font-weight:bold;font-style:normal;display:block;margin-bottom:8px;\">[选填引导词如「💡 核心洞察」]</span>[引用或导语内容]</section>\
     【Highlight 重点高亮】<span style=\"font-family:'Noto Sans SC',sans-serif;font-size:15px;line-height:1.8;color:#5965AF;font-weight:bold;background-color:#EDE4F1;padding:2px 4px;border-radius:2px;\">[高亮词汇]</span>\
     【Bold 加粗】<span style=\"font-weight:bold;color:#5965AF;\">[加粗文字]</span>\
     【Paragraph 普通正文段落】<section style=\"margin-top:20px;font-family:'Noto Sans SC',sans-serif;font-weight:normal;font-size:15px;line-height:1.8;color:#333333;letter-spacing:0.5px;text-align:justify;\">[正文内容，高亮和加粗需嵌套在此标签内]</section>\
     【Code Block macOS风格】<section style=\"background-color:#1e1e2e;border-radius:10px;margin-top:24px;margin-bottom:24px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.3);\"><section style=\"background-color:#252540;padding:12px 16px;border-bottom:1px solid #33334a;\"><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ff5f56;margin-right:6px;\"></span><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#ffbd2e;margin-right:6px;\"></span><span style=\"display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#27c93f;\"></span></section><section style=\"padding:18px 20px;font-family:'Courier New',Courier,monospace;font-size:13px;line-height:2;color:#e0e0e0;word-break:break-all;\">[代码内容，每行用br换行]</section></section>\
     输出规则：禁止修改 style 属性；普通文本换行必须用 Paragraph 包裹；Markdown 映射：H1→H2组件, H2→H3组件(黑底), H3→H4组件(左竖线), 引用→Quote卡片, 高亮→Highlight, 加粗→Bold, 普通段落→Paragraph；必须保留 [图1]、[图2] 这类图片占位符原文，不要改写、删除或包进代码块；直接输出 HTML 片段，不包裹 html body".to_string()
}

fn ensure_image_markers(text: &str, image_count: usize) -> String {
    let mut result = text.to_string();
    for i in 0..image_count {
        let marker = format!("[图{}]", i + 1);
        if !result.contains(&marker) {
            result.push_str(&format!("\n\n{}", marker));
        }
    }
    result
}

fn replace_image_markers(text: &str, images: &[Value]) -> String {
    let mut result = text.to_string();
    let mut missing_blocks: Vec<String> = Vec::new();

    for (i, img) in images.iter().enumerate() {
        let marker = format!("[图{}]", i + 1);
        let replacement = render_local_image_block(img, i + 1);
        if result.contains(&marker) {
            result = result.replace(&marker, &replacement);
        } else {
            missing_blocks.push(replacement);
        }
    }

    if !missing_blocks.is_empty() {
        result.push('\n');
        result.push_str(&missing_blocks.join("\n"));
    }
    result
}

fn render_local_image_block(img: &Value, index: usize) -> String {
    let file_path = img.get("file_path").and_then(|v| v.as_str()).unwrap_or("");
    let remote_url = img.get("remote_url").and_then(|v| v.as_str()).unwrap_or("");
    let description = img.get("description").and_then(|v| v.as_str()).unwrap_or("");
    let position = img.get("position").and_then(|v| v.as_str()).unwrap_or("");
    let plan_id = img.get("plan_id").and_then(|v| v.as_str()).unwrap_or("");
    let src = if !remote_url.is_empty() { remote_url } else { file_path };

    if src.is_empty() {
        return format!(
            "<section data-tanvas-image=\"true\" data-tanvas-image-index=\"{}\" data-tanvas-description=\"{}\" style=\"text-align:center;margin:22px 0;padding:18px 20px;background:#f5f3ff;border:1px solid #EDE4F1;border-radius:10px;color:#5965AF;font-size:14px;line-height:1.7;\">[配图占位：{}]</section>",
            index,
            escape_html_attr(description),
            escape_html_text(description)
        );
    }

    format!(
        "<section data-tanvas-image=\"true\" data-tanvas-image-index=\"{}\" data-tanvas-file-path=\"{}\" data-tanvas-remote-url=\"{}\" data-tanvas-description=\"{}\" data-tanvas-position=\"{}\" data-tanvas-plan-id=\"{}\" style=\"text-align:center;margin:24px 0;\"><img src=\"{}\" alt=\"{}\" data-tanvas-file-path=\"{}\" data-tanvas-remote-url=\"{}\" data-tanvas-description=\"{}\" data-tanvas-position=\"{}\" data-tanvas-plan-id=\"{}\" style=\"max-width:100%;height:auto;border-radius:10px;display:block;margin:0 auto;\" /><span style=\"display:block;margin-top:8px;color:#878b8e;font-size:12px;line-height:1.5;\">{}</span></section>",
        index,
        escape_html_attr(file_path),
        escape_html_attr(remote_url),
        escape_html_attr(description),
        escape_html_attr(position),
        escape_html_attr(plan_id),
        escape_html_attr(src),
        escape_html_attr(description),
        escape_html_attr(file_path),
        escape_html_attr(remote_url),
        escape_html_attr(description),
        escape_html_attr(position),
        escape_html_attr(plan_id),
        escape_html_text(description)
    )
}

fn escape_html_attr(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

fn escape_html_text(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
