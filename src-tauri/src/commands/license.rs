use crate::db;
use crate::services::license;

#[tauri::command]
pub fn activate_license(key: String) -> Result<license::LicenseInfo, String> {
    let payload = license::verify_license(&key)?;

    let conn = db::get_connection().lock().unwrap();
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES ('license_key', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![key],
    )
    .map_err(|e| format!("save license: {}", e))?;
    conn.execute(
        "INSERT INTO app_config (key, value) VALUES ('license_plan', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        rusqlite::params![payload.plan],
    )
    .map_err(|e| format!("save plan: {}", e))?;

    Ok(license::LicenseInfo {
        status: "active".into(),
        plan: payload.plan,
        expires_at: Some(payload.expires_at),
        trial_ends_at: None,
    })
}

#[tauri::command]
pub fn check_license_status() -> Result<license::LicenseInfo, String> {
    Ok(license::check_license())
}

#[tauri::command]
pub fn deactivate_license() -> Result<(), String> {
    let conn = db::get_connection().lock().unwrap();
    conn.execute("DELETE FROM app_config WHERE key = 'license_key'", [])
        .map_err(|e| format!("remove license: {}", e))?;
    conn.execute("DELETE FROM app_config WHERE key = 'license_plan'", [])
        .map_err(|e| format!("remove plan: {}", e))?;
    Ok(())
}
