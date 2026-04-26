use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[allow(dead_code)]
pub struct AppConfig {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
