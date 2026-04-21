use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{Aes256Gcm, AeadCore, Nonce};
use rand::RngCore;
use std::fs;
use std::path::Path;

const KEY_FILE: &str = ".enc_key";
const KEY_LEN: usize = 32;
const NONCE_LEN: usize = 12;

fn key_path(app_dir: &str) -> String {
    format!("{}/{}", app_dir, KEY_FILE)
}

pub fn get_or_create_key(app_dir: &str) -> Result<[u8; KEY_LEN], String> {
    let path = key_path(app_dir);
    if Path::new(&path).exists() {
        let bytes = fs::read(&path).map_err(|e| format!("read enc_key: {}", e))?;
        if bytes.len() != KEY_LEN {
            return Err("encryption key file is corrupt".into());
        }
        let mut key = [0u8; KEY_LEN];
        key.copy_from_slice(&bytes);
        return Ok(key);
    }
    let mut key = [0u8; KEY_LEN];
    OsRng.fill_bytes(&mut key);
    fs::write(&path, &key).map_err(|e| format!("write enc_key: {}", e))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }
    Ok(key)
}

pub fn encrypt(plaintext: &str, key: &[u8; KEY_LEN]) -> Result<Vec<u8>, String> {
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("aes init: {}", e))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_bytes())
        .map_err(|e| format!("encrypt: {}", e))?;
    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

pub fn decrypt(blob: &[u8], key: &[u8; KEY_LEN]) -> Result<String, String> {
    if blob.len() < NONCE_LEN {
        return Err("encrypted blob too short".into());
    }
    let (nonce_bytes, ciphertext) = blob.split_at(NONCE_LEN);
    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| format!("aes init: {}", e))?;
    let nonce = Nonce::from_slice(nonce_bytes);
    let plaintext = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("decrypt: {}", e))?;
    String::from_utf8(plaintext).map_err(|e| format!("utf8: {}", e))
}
