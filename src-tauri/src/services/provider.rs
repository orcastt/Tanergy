use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
pub struct ProviderPreset {
    pub id: &'static str,
    pub name: &'static str,
    pub base_url: &'static str,
    pub key_prefix: &'static str,
    pub test_path: &'static str,
}

static PRESETS: &[ProviderPreset] = &[
    ProviderPreset {
        id: "gemini",
        name: "Gemini",
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        key_prefix: "AI",
        test_path: "/models",
    },
    ProviderPreset {
        id: "claude",
        name: "Claude",
        base_url: "https://api.anthropic.com",
        key_prefix: "sk-ant-",
        test_path: "/v1/messages",
    },
    ProviderPreset {
        id: "gpt",
        name: "GPT",
        base_url: "https://api.openai.com",
        key_prefix: "sk-",
        test_path: "/v1/models",
    },
    ProviderPreset {
        id: "glm",
        name: "GLM",
        base_url: "https://open.bigmodel.cn/api/paas",
        key_prefix: "",
        test_path: "/v4/chat/completions",
    },
    ProviderPreset {
        id: "minimax",
        name: "MiniMax",
        base_url: "https://api.minimaxi.com/v1",
        key_prefix: "",
        test_path: "/chat/completions",
    },
];

pub fn get_preset(id: &str) -> Option<&'static ProviderPreset> {
    PRESETS.iter().find(|p| p.id == id)
}

pub fn all_presets() -> Vec<&'static ProviderPreset> {
    PRESETS.iter().collect()
}
