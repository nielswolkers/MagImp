mod api;
mod auth;

use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct GradeRow {
    pub course: String,
    pub title: String,
    pub grade: String,
    pub weight: String,
}

/// Runs the Gemairo-style login in a separate WebView, then fetches all grades once.
#[tauri::command]
async fn magister_login_and_fetch(app: tauri::AppHandle) -> Result<Vec<GradeRow>, String> {
    let tokens = auth::login(&app).await?;
    let mut client = api::MagisterClient::new(tokens).await?;
    client.fetch_grades().await
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![magister_login_and_fetch])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
