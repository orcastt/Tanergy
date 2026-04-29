use crate::services::credits;
use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct CreditInfoResponse {
    pub balance: i64,
    pub is_logged_in: bool,
}

#[tauri::command]
pub fn get_credit_balance() -> Result<CreditInfoResponse, String> {
    let jwt = credits::get_jwt();
    let is_logged_in = jwt.is_some();
    let balance = if is_logged_in {
        credits::get_cached_balance()
    } else {
        0
    };
    Ok(CreditInfoResponse {
        balance,
        is_logged_in,
    })
}

#[tauri::command]
pub async fn refresh_credits() -> Result<CreditInfoResponse, String> {
    let info = credits::refresh_credit_balance().await?;
    Ok(CreditInfoResponse {
        balance: info.balance,
        is_logged_in: true,
    })
}

#[tauri::command]
pub async fn list_official_models() -> Result<Vec<credits::OfficialModel>, String> {
    credits::list_official_models().await
}

#[tauri::command]
pub async fn login_official(email: String) -> Result<(), String> {
    credits::login_official(&email).await
}

#[tauri::command]
pub async fn verify_otp(email: String, token: String) -> Result<(), String> {
    credits::verify_otp(&email, &token).await?;
    Ok(())
}

#[tauri::command]
pub fn logout_official() -> Result<(), String> {
    credits::clear_jwt()
}
