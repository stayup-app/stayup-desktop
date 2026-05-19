use tauri::{Emitter, Manager};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn open_oauth_window(app: tauri::AppHandle, provider: String) -> Result<(), String> {
    let url_str = format!(
        "https://stayup-api.r-sik.workers.dev/auth/oauth/{}",
        provider
    );

    let parsed_url = url_str.parse::<tauri::Url>().map_err(|e| e.to_string())?;

    let app_clone = app.clone();
    tauri::WebviewWindowBuilder::new(
        &app,
        "oauth",
        tauri::WebviewUrl::External(parsed_url),
    )
    .title("Connexion")
    .inner_size(600.0, 700.0)
    .center()
    .on_navigation(move |nav_url| {
        if nav_url.path() == "/api/auth/callback" {
            let token = nav_url
                .query_pairs()
                .find(|(k, _)| k == "token")
                .map(|(_, v)| v.into_owned());

            if let Some(token) = token {
                let app = app_clone.clone();
                tauri::async_runtime::spawn(async move {
                    app.emit("oauth-token", token).ok();
                    if let Some(win) = app.get_webview_window("oauth") {
                        win.close().ok();
                    }
                });
                return false;
            }
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![greet, open_oauth_window])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
