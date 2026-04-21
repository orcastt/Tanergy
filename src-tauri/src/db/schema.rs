use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct AppConfig {
    pub key: String,
    pub value: String,
    pub updated_at: String,
}
