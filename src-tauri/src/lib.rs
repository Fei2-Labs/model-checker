//! Model Checker — backend for managing OpenAI-Compatible Connections.
//!
//! This crate exposes Tauri commands used by the desktop UI to manage Saved
//! Connections, run Model Inventory Checks, and perform Availability Tests.

mod availability;
mod commands;
mod discovery;
mod domain;
mod error;
mod http_util;
mod secrets;
mod storage;

use std::{collections::HashMap, sync::Arc};

use tokio::sync::Mutex;
use uuid::Uuid;

use crate::storage::ConnectionStore;

/// Runtime state shared across Tauri commands.
pub struct AppState {
    /// Persistent store for non-secret Saved Connection records.
    pub store: Mutex<ConnectionStore>,
    /// HTTP client used for Model Discovery and Availability Tests.
    pub http: reqwest::Client,
    /// In-memory cache for Authentication Material after the first Keychain access in this app run.
    pub secret_cache: Mutex<HashMap<Uuid, String>>,
}

/// Entry point for the desktop application.
///
/// Initializes Tauri, builds the shared [`AppState`], and registers every
/// command exposed to the frontend.
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle();
            let data_dir = handle
                .path()
                .app_data_dir()
                .expect("resolving app data dir");
            std::fs::create_dir_all(&data_dir)?;
            let store = ConnectionStore::load_or_init(&data_dir)?;
            let http = reqwest::Client::builder()
                .user_agent(concat!("model-checker/", env!("CARGO_PKG_VERSION")))
                .timeout(std::time::Duration::from_secs(30))
                .build()?;
            app.manage(Arc::new(AppState {
                store: Mutex::new(store),
                http,
                secret_cache: Mutex::new(HashMap::new()),
            }));

            // Inject dark class before first paint based on the OS theme.
            if let Some(window) = app.get_webview_window("main") {
                let is_dark = window
                    .theme()
                    .map(|t| t == tauri::Theme::Dark)
                    .unwrap_or(false);
                if is_dark {
                    let _ = window.eval(
                        "document.documentElement.classList.add('dark')",
                    );
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_connections,
            commands::get_connection,
            commands::create_connection,
            commands::update_connection,
            commands::delete_connection,
            commands::refresh_models,
            commands::run_availability_test,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

// Re-export the trait used by setup for `path()` access via the manager.
use tauri::Manager;
