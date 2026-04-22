use tauri::Manager;

mod commands;
mod crypto;
mod db;
mod services;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir")
                .to_string_lossy()
                .to_string();

            db::init_database(&app_dir)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::health::health_check,
            commands::app_config::get_config,
            commands::app_config::set_config,
            commands::api_keys::set_api_key,
            commands::api_keys::get_api_key_status,
            commands::api_keys::get_all_providers,
            commands::api_keys::test_api_key,
            commands::api_keys::remove_api_key,
            commands::license::activate_license,
            commands::license::check_license_status,
            commands::license::deactivate_license,
            commands::workflow::list_workflows,
            commands::workflow::get_workflow,
            commands::workflow::create_workflow,
            commands::workflow::update_workflow,
            commands::workflow::delete_workflow,
            commands::workflow::export_workflow,
            commands::workflow::import_workflow,
            commands::execute::execute_node,
            commands::asset::get_assets,
            commands::asset::read_asset_file,
            commands::asset::delete_asset,
            commands::credits::get_credit_balance,
            commands::credits::refresh_credits,
            commands::credits::login_official,
            commands::credits::verify_otp,
            commands::credits::logout_official,
        ])
        .run(tauri::generate_context!())
        .expect("error while running TANGENT");
}
