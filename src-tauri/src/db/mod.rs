use rusqlite::Connection;
use std::sync::{Mutex, OnceLock};

static DB: OnceLock<Mutex<Connection>> = OnceLock::new();
static APP_DIR: OnceLock<String> = OnceLock::new();

pub fn init_database(app_dir: &str) -> Result<(), String> {
    std::fs::create_dir_all(app_dir).map_err(|e| e.to_string())?;
    let _ = APP_DIR.set(app_dir.to_string());

    let db_path = format!("{}/tangent.db", app_dir);
    let conn =
        Connection::open(&db_path).map_err(|e| format!("failed to open database: {}", e))?;

    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")
        .map_err(|e| e.to_string())?;

    migrations::run(&conn)?;

    let _ = DB.set(Mutex::new(conn));
    Ok(())
}

pub fn get_connection() -> &'static Mutex<Connection> {
    DB.get().expect("database not initialized")
}

pub fn get_app_dir() -> String {
    APP_DIR.get().expect("app dir not initialized").clone()
}

pub mod migrations;
pub mod schema;
