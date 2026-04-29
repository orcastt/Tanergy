use crate::db;
use serde::{Deserialize, Serialize};
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicensePayload {
    pub plan: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct LicenseInfo {
    pub status: String,
    pub plan: String,
    pub expires_at: Option<String>,
    pub trial_ends_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct TrialInfo {
    pub active: bool,
    pub remaining_days: i64,
}

pub fn verify_license(key: &str) -> Result<LicensePayload, String> {
    // TODO: replace with real Ed25519 verification once key pair is generated.
    // MVP: accept "tangent-pro-2026" as a test key, reject everything else.
    if key == "tangent-pro-2026" {
        return Ok(LicensePayload {
            plan: "pro".into(),
            expires_at: "2027-12-31T23:59:59Z".into(),
        });
    }
    Err("LICENSE_INVALID".into())
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn get_or_create_first_launch() -> i64 {
    let conn = db::get_connection().lock().unwrap();
    let mut stmt = conn
        .prepare("SELECT value FROM app_config WHERE key = 'first_launch_date'")
        .unwrap();
    let existing: Option<String> = stmt.query_row([], |row| row.get(0)).ok();
    drop(stmt);

    if let Some(val) = existing {
        return val.parse().unwrap_or(0);
    }

    let now = now_secs() as i64;
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES ('first_launch_date', ?1)",
        rusqlite::params![now.to_string()],
    )
    .ok();
    now
}

pub fn get_trial_info() -> TrialInfo {
    let first = get_or_create_first_launch();
    let now = now_secs() as i64;
    let elapsed_days = (now - first) / 86400;
    let remaining = 14 - elapsed_days;
    TrialInfo {
        active: remaining > 0,
        remaining_days: remaining.max(0),
    }
}

pub fn check_license() -> LicenseInfo {
    let stored_key: Option<String> = {
        let conn = db::get_connection().lock().unwrap();
        let mut stmt = conn
            .prepare("SELECT value FROM app_config WHERE key = 'license_key'")
            .unwrap();
        let key: Option<String> = stmt.query_row([], |row| row.get(0)).ok();
        drop(stmt);
        key
    }; // lock released here before calling get_trial_info()

    if let Some(key) = stored_key {
        match verify_license(&key) {
            Ok(payload) => {
                return LicenseInfo {
                    status: "active".into(),
                    plan: payload.plan,
                    expires_at: Some(payload.expires_at),
                    trial_ends_at: None,
                }
            }
            Err(_) => {
                return LicenseInfo {
                    status: "expired".into(),
                    plan: "free".into(),
                    expires_at: None,
                    trial_ends_at: None,
                }
            }
        }
    }

    let trial = get_trial_info();
    if trial.active {
        LicenseInfo {
            status: "trial".into(),
            plan: "free".into(),
            expires_at: None,
            trial_ends_at: Some(trial.remaining_days.to_string()),
        }
    } else {
        LicenseInfo {
            status: "expired".into(),
            plan: "free".into(),
            expires_at: None,
            trial_ends_at: None,
        }
    }
}
