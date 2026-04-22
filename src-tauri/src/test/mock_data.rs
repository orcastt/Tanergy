use serde_json::{json, Value};

pub fn mock_text_input(node_data: &Value) -> Value {
    let text = node_data.get("text").and_then(|v| v.as_str()).unwrap_or("AI 技术发展趋势");
    json!({ "text": text })
}

pub fn mock_research(_input: &Value) -> Value {
    json!({ "text": "## 调研报告\n\n### 核心发现\n\n1. AI 技术在2026年持续快速发展，大语言模型能力显著提升\n2. 多模态AI成为主流趋势，文本、图像、视频融合处理能力增强\n3. AI Agent架构兴起，多个AI节点协作完成复杂任务成为可能\n4. 本地化AI应用增长迅速，隐私保护和数据安全受到重视\n\n### 关键数据\n\n- 全球AI市场规模预计2026年达到$500B\n- 企业AI采用率从35%提升至58%\n- 本地部署AI解决方案需求增长120%\n\n### 行业观点\n\n专家认为，2026年AI发展的关键词是「落地」和「协同」。技术不再是瓶颈，如何让AI真正融入工作流才是关键。" })
}

pub fn mock_outline(_input: &Value) -> Value {
    json!({
        "options": [
            {
                "title": "AI 重塑内容创作的三个关键趋势",
                "angle": "从工具到伙伴，AI正在改变创作者的工作方式",
                "sections": ["引言：一个创作者的日常正在被改写", "趋势一：从单一工具到工作流自动化", "趋势二：多模态融合让创作更直观", "趋势三：本地化AI让隐私和效率兼得", "结语：拥抱变化，但保持独立思考"]
            },
            {
                "title": "为什么 2026 年是 AI Agent 的元年",
                "angle": "AI从单点工具进化为协作智能体",
                "sections": ["Agent不是新概念，但2026年它真的来了", "从ChatGPT到Canvas：AI界面的进化", "工作流编排：让多个AI协作完成任务", "现实挑战：可靠性、成本和用户信任", "未来展望：每个人都会有一个AI团队"]
            },
            {
                "title": "本地AI vs 云端AI：创业者的技术选择",
                "angle": "隐私、成本、性能的三方博弈",
                "sections": ["一场正在发生的架构迁移", "云端AI的优势：规模、更新、生态", "本地AI的优势：隐私、可控、零延迟", "混合方案：Tauri + API的中间路线", "给创业者的建议：根据场景选技术栈"]
            }
        ]
    })
}

pub fn mock_writer(_input: &Value) -> Value {
    json!({ "text": "## AI 重塑内容创作的三个关键趋势\n\n你有没有想过，某天早上打开电脑，AI已经帮你完成了一半的工作？这不是科幻小说，而是2026年内容创作者的日常。\n\n### 趋势一：从单一工具到工作流自动化\n\n过去我们用ChatGPT写文案，用Midjourney做图，用WordPress排版。每个工具之间都是断裂的。但现在，像TANGENT这样的工作流画布应用开始出现，你可以把多个AI节点像搭积木一样连起来。\n\n这意味着什么？意味着AI不再是一个工具，而是一个完整的生产线。从选题到成稿，从文本到配图，从排版到发布，一条龙。\n\n### 趋势二：多模态融合让创作更直观\n\n2026年的AI不再只会处理文字。GPT-4o、Gemini、MiniMax这些模型已经能同时理解文本和图像。你可以说「帮我生成一张科技感的封面图」，AI会根据文章内容自动规划配图方案。\n\n更酷的是，你甚至可以在图片上直接画标注，让AI理解你想修改哪里。这种交互方式比写Prompt高效十倍。\n\n### 趋势三：本地化AI让隐私和效率兼得\n\n越来越多的创作者开始关注数据隐私。你辛辛苦苦写的内容，通过云端API传输，总归不太放心。桌面端AI应用正在解决这个问题——数据留在本地，API调用直接从你的电脑发出。\n\n而且，本地应用通常更稳定。不用依赖浏览器，不用排队等服务器响应，打开就用。\n\n### 结语\n\nAI不会取代创作者，但会取代不用AI的创作者。关键不是抵触变化，而是学会和AI协作。把重复性的工作交给机器，把创意和判断留给自己。" })
}

pub fn mock_reviewer(_input: &Value) -> Value {
    json!({ "text": "## AI 重塑内容创作的三个关键趋势\n\n你有没有想过，某天早上打开电脑，AI已经帮你搞定了一半工作？这不是科幻，而是2026年内容创作者的真实日常。\n\n### 趋势一：从单一工具到工作流自动化\n\n以前我们用ChatGPT写文案，用Midjourney做图，用WordPress排版。每个环节都是割裂的。但现在，像TANGENT这样的工作流画布应用开始出现，把多个AI节点像搭积木一样串联起来。\n\n这意味着AI不再只是单个工具，而是一条完整的生产线。从选题到成稿，从文本到配图，从排版到发布，全自动。\n\n### 趋势二：多模态融合让创作更自然\n\n2026年的AI早已不只会处理文字。GPT-4o、Gemini、MiniMax都能同时理解文本和图像。你说一句「帮我生成科技感封面图」，AI会根据文章上下文自动规划配图。\n\n更妙的是，你可以直接在图片上画标注，告诉AI要改哪里。这比写一大段Prompt直观太多了。\n\n### 趋势三：本地AI让隐私和速度双赢\n\n越来越多创作者开始在意数据安全。辛苦写的内容走一遍云端API，心里总不踏实。桌面端AI应用正好解决了这个痛点——数据留在你电脑上，API调用直接从本地发出。\n\n而且桌面应用更稳定。不用开浏览器，不用等服务器排队，随时能用。\n\n### 写在最后\n\nAI不会抢创作者的饭碗，但会让不用AI的人落后。核心不是抵抗变化，而是学会跟AI搭档。把重复劳动交给机器，把创意和判断留给自己。" })
}

pub fn mock_image_planner(_input: &Value) -> Value {
    json!({
        "image_plans": [
            {
                "id": "img_1",
                "position": "趋势一章节后",
                "description": "工作流自动化概念图：多个AI节点通过连线组成流水线",
                "prompt": "A modern flat illustration showing an AI workflow automation pipeline with connected nodes and glowing data streams, blue and purple color scheme, minimal design style",
                "aspect_ratio": "16:9"
            },
            {
                "id": "img_2",
                "position": "趋势二章节后",
                "description": "多模态AI交互概念图：用户在图片上标注，AI理解并修改",
                "prompt": "An illustration of a person drawing annotations on a digital canvas while an AI assistant responds with generated images, modern tech style, warm lighting",
                "aspect_ratio": "16:9"
            },
            {
                "id": "img_3",
                "position": "结语前",
                "description": "创作者与AI协作概念图：人类和AI并肩坐在桌前",
                "prompt": "A conceptual illustration of a human creator and an AI robot sitting side by side at a desk collaborating on creative work, friendly and optimistic tone, pastel colors",
                "aspect_ratio": "16:9"
            }
        ]
    })
}

pub fn mock_image_list(_input: &Value) -> Value {
    // Return placeholder images as colored SVG data URIs encoded as PNG placeholder
    json!({
        "images": [
            {
                "id": "mock_img_1",
                "plan_id": "img_1",
                "file_path": "",
                "prompt": "workflow automation illustration",
                "description": "工作流自动化概念图",
                "position": "趋势一章节后"
            },
            {
                "id": "mock_img_2",
                "plan_id": "img_2",
                "file_path": "",
                "prompt": "multimodal AI interaction illustration",
                "description": "多模态AI交互概念图",
                "position": "趋势二章节后"
            },
            {
                "id": "mock_img_3",
                "plan_id": "img_3",
                "file_path": "",
                "prompt": "human AI collaboration illustration",
                "description": "创作者与AI协作概念图",
                "position": "结语前"
            }
        ],
        "image1": {
            "id": "mock_img_1",
            "plan_id": "img_1",
            "file_path": "",
            "prompt": "workflow automation illustration",
            "description": "工作流自动化概念图",
            "position": "趋势一章节后"
        },
        "image2": {
            "id": "mock_img_2",
            "plan_id": "img_2",
            "file_path": "",
            "prompt": "multimodal AI interaction illustration",
            "description": "多模态AI交互概念图",
            "position": "趋势二章节后"
        },
        "image3": {
            "id": "mock_img_3",
            "plan_id": "img_3",
            "file_path": "",
            "prompt": "human AI collaboration illustration",
            "description": "创作者与AI协作概念图",
            "position": "结语前"
        }
    })
}

pub fn mock_html_formatter(_input: &Value) -> Value {
    json!({
        "html": "<section style=\"max-width:640px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#333;line-height:1.75;padding:20px\"><h1 style=\"font-size:24px;font-weight:700;text-align:center;margin-bottom:30px\">AI 重塑内容创作的三个关键趋势</h1><p style=\"font-size:16px;color:#666;text-align:center;margin-bottom:30px\">你有没有想过，某天早上打开电脑，AI已经帮你搞定了一半工作？</p><h2 style=\"font-size:20px;font-weight:600;border-left:4px solid #6366F1;padding-left:12px;margin:30px 0 15px\">趋势一：从单一工具到工作流自动化</h2><p style=\"font-size:16px;margin-bottom:15px\">以前我们用ChatGPT写文案，用Midjourney做图，用WordPress排版。每个环节都是割裂的。但现在，工作流画布应用把多个AI节点像搭积木一样串联起来。</p><div style=\"background:#f5f3ff;border-radius:8px;padding:20px;text-align:center;margin:20px 0;color:#6366F1;font-size:14px\">🖼️ [配图1：工作流自动化概念图]</div><h2 style=\"font-size:20px;font-weight:600;border-left:4px solid #3B82F6;padding-left:12px;margin:30px 0 15px\">趋势二：多模态融合让创作更自然</h2><p style=\"font-size:16px;margin-bottom:15px\">2026年的AI早已不只会处理文字。你说一句「帮我生成科技感封面图」，AI会根据文章上下文自动规划配图。</p><h2 style=\"font-size:20px;font-weight:600;border-left:4px solid #22C55E;padding-left:12px;margin:30px 0 15px\">趋势三：本地AI让隐私和速度双赢</h2><p style=\"font-size:16px;margin-bottom:15px\">越来越多创作者开始在意数据安全。桌面端AI应用正好解决了这个痛点——数据留在你电脑上。</p><p style=\"font-size:16px;font-weight:600;text-align:center;margin-top:30px;padding:15px;background:#f8f9fa;border-radius:8px\">AI不会抢创作者的饭碗，但会让不用AI的人落后。核心是学会跟AI搭档。</p></section>",
        "word_count": 856,
        "reading_time": 3
    })
}

pub fn mock_agent_chat(_messages: &Value) -> Value {
    json!({
        "message": "我为你创建了一个公众号长文创作工作流，包含完整的调研-写作-配图-排版链路：",
        "actions": [
            {"op": "add", "type": "text_input", "position": [100, 200]},
            {"op": "add", "type": "research", "position": [400, 200]},
            {"op": "connect", "from": "text_input", "fromPort": "out", "to": "research", "toPort": "in"},
            {"op": "add", "type": "outline_generator", "position": [700, 200]},
            {"op": "connect", "from": "research", "fromPort": "out", "to": "outline_generator", "toPort": "in"},
            {"op": "add", "type": "gate", "position": [1000, 200]},
            {"op": "connect", "from": "outline_generator", "fromPort": "out", "to": "gate", "toPort": "in"},
            {"op": "add", "type": "writer", "position": [1300, 200]},
            {"op": "connect", "from": "gate", "fromPort": "out", "to": "writer", "toPort": "outline"},
            {"op": "add", "type": "reviewer", "position": [1600, 200]},
            {"op": "connect", "from": "writer", "fromPort": "out", "to": "reviewer", "toPort": "in"},
            {"op": "add", "type": "image_planner", "position": [1900, 200]},
            {"op": "connect", "from": "reviewer", "fromPort": "out", "to": "image_planner", "toPort": "in"},
            {"op": "add", "type": "image_list", "position": [2200, 200]},
            {"op": "connect", "from": "image_planner", "fromPort": "out", "to": "image_list", "toPort": "in"},
            {"op": "add", "type": "html_formatter", "position": [2500, 200]},
            {"op": "connect", "from": "reviewer", "fromPort": "out", "to": "html_formatter", "toPort": "text"},
            {"op": "add", "type": "preview_wechat", "position": [2800, 200]},
            {"op": "connect", "from": "html_formatter", "fromPort": "out", "to": "preview_wechat", "toPort": "html"}
        ]
    })
}
