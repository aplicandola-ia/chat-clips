use serde::Serialize;
use serde_json::{json, Value};
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::atomic::{AtomicU64, Ordering},
    thread,
};
use tauri::{AppHandle, Emitter, Manager};

static NEXT_TASK: AtomicU64 = AtomicU64::new(1);

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TaskOutput {
    task_id: String,
    stream: String,
    line: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TaskFinished {
    task_id: String,
    success: bool,
    code: Option<i32>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ConnectionStatus {
    twitch_connected: bool,
    youtube_connected: bool,
}

fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path)
}

fn engine_dir(app: &AppHandle) -> PathBuf {
    if let Ok(resources) = app.path().resource_dir() {
        let bundled = resources.join("engine");
        if bundled.is_dir() {
            return bundled;
        }
    }
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn node_binary(app: &AppHandle) -> PathBuf {
    if let Ok(resources) = app.path().resource_dir() {
        let name = if cfg!(windows) { "node.exe" } else { "node" };
        let bundled = resources.join("runtime").join(name);
        if bundled.is_file() {
            return bundled;
        }
    }
    PathBuf::from(if cfg!(windows) { "node.exe" } else { "node" })
}

fn read_env_file(path: &Path) -> Vec<(String, String)> {
    let Ok(contents) = fs::read_to_string(path) else {
        return Vec::new();
    };
    contents
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                return None;
            }
            let (key, raw) = line.split_once('=')?;
            let value = raw.trim().trim_matches('"').trim_matches('\'').to_string();
            Some((key.trim().to_string(), value))
        })
        .collect()
}

#[tauri::command]
fn connection_status(app: AppHandle) -> Result<ConnectionStatus, String> {
    let data = app_data(&app)?;
    let env = read_env_file(&data.join(".env"));
    let twitch_connected = env
        .iter()
        .any(|(k, v)| k == "TWITCH_CLIENT_ID" && !v.is_empty())
        && env
            .iter()
            .any(|(k, v)| k == "TWITCH_CLIENT_SECRET" && !v.is_empty());
    Ok(ConnectionStatus {
        twitch_connected,
        youtube_connected: data.join("youtube-token.json").is_file(),
    })
}

#[tauri::command]
fn save_twitch_credentials(
    app: AppHandle,
    client_id: String,
    client_secret: String,
) -> Result<(), String> {
    if client_id.trim().is_empty()
        || client_secret.trim().is_empty()
        || client_id.chars().any(|c| matches!(c, '\n' | '\r' | '='))
        || client_secret.chars().any(|c| matches!(c, '\n' | '\r'))
    {
        return Err("Enter a valid Twitch Client ID and Client Secret.".into());
    }
    let data = app_data(&app)?;
    let path = data.join(".env");
    let mut existing = read_env_file(&path);
    existing.retain(|(key, _)| key != "TWITCH_CLIENT_ID" && key != "TWITCH_CLIENT_SECRET");
    existing.push(("TWITCH_CLIENT_ID".into(), client_id.trim().into()));
    existing.push(("TWITCH_CLIENT_SECRET".into(), client_secret.trim().into()));
    let body = existing
        .iter()
        .map(|(k, v)| format!("{k}={v}"))
        .collect::<Vec<_>>()
        .join("\n")
        + "\n";
    fs::write(&path, body).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn import_youtube_credentials(app: AppHandle, path: String) -> Result<(), String> {
    let source = PathBuf::from(path);
    let raw = fs::read_to_string(&source).map_err(|e| format!("Could not read OAuth JSON: {e}"))?;
    let value: Value =
        serde_json::from_str(&raw).map_err(|e| format!("Invalid OAuth JSON: {e}"))?;
    if value.get("installed").is_none() {
        return Err("Choose a Google OAuth Desktop app JSON file (installed client).".into());
    }
    let data = app_data(&app)?;
    let destination = data.join("client_secrets.json");
    fs::write(&destination, raw).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&destination, fs::Permissions::from_mode(0o600))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn read_discovery(app: AppHandle) -> Result<Value, String> {
    let path = app_data(&app)?.join("discovery.json");
    if !path.is_file() {
        return Ok(json!({"streams": [], "vods": [], "totalLiveMatches": 0, "totalVods": 0}));
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| e.to_string())
}

#[tauri::command]
fn start_engine_task(app: AppHandle, script: String, args: Vec<String>) -> Result<String, String> {
    let allowed = [
        "chat-clips.mjs",
        "discover-twitch.mjs",
        "desktop-engine.mjs",
        "youtube-auth.mjs",
        "youtube-upload.mjs",
    ];
    if !allowed.contains(&script.as_str()) {
        return Err("This engine action is not available.".into());
    }
    let engine = engine_dir(&app);
    let script_path = engine.join(&script);
    if !script_path.is_file() {
        return Err(format!("The bundled engine file is missing: {script}"));
    }
    let data = app_data(&app)?;
    let task_id = NEXT_TASK.fetch_add(1, Ordering::Relaxed).to_string();
    let node = node_binary(&app);
    let mut command = Command::new(node);
    command
        .arg(script_path)
        .args(args)
        .current_dir(&data)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("STREAM_CLIP_CONFIG_DIR", &data);
    for (key, value) in read_env_file(&data.join(".env")) {
        command.env(key, value);
    }
    if script == "discover-twitch.mjs" {
        command.env("STREAM_CLIP_DISCOVERY_OUT", data.join("discovery.json"));
    }
    let mut child = command.spawn().map_err(|e| {
        format!("Could not start the video engine: {e}. Install the bundled runtime or Node.js.")
    })?;
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();
    let app_out = app.clone();
    let id_out = task_id.clone();
    let out_thread = thread::spawn(move || {
        if let Some(pipe) = stdout {
            for line in BufReader::new(pipe).lines().flatten() {
                let _ = app_out.emit(
                    "task-output",
                    TaskOutput {
                        task_id: id_out.clone(),
                        stream: "stdout".into(),
                        line,
                    },
                );
            }
        }
    });
    let app_err = app.clone();
    let id_err = task_id.clone();
    let err_thread = thread::spawn(move || {
        if let Some(pipe) = stderr {
            for line in BufReader::new(pipe).lines().flatten() {
                let _ = app_err.emit(
                    "task-output",
                    TaskOutput {
                        task_id: id_err.clone(),
                        stream: "stderr".into(),
                        line,
                    },
                );
            }
        }
    });
    let app_done = app.clone();
    let id_done = task_id.clone();
    thread::spawn(move || {
        let status = child.wait().ok();
        let _ = out_thread.join();
        let _ = err_thread.join();
        let code = status.and_then(|s| s.code());
        let _ = app_done.emit(
            "task-finished",
            TaskFinished {
                task_id: id_done,
                success: code == Some(0),
                code,
            },
        );
    });
    Ok(task_id)
}

#[tauri::command]
fn app_info() -> Value {
    json!({
        "name": "Stream Clip Maker",
        "version": env!("CARGO_PKG_VERSION"),
        "platform": std::env::consts::OS,
        "architecture": std::env::consts::ARCH
    })
}

#[cfg(target_os = "linux")]
fn configure_linux_fontconfig() {
    let mut candidates = Vec::new();
    if let Ok(path) = std::env::var("STREAM_CLIP_FONTCONFIG_FILE") {
        candidates.push(PathBuf::from(path));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("resources/fontconfig/fonts.conf"));
            candidates.push(parent.join("../share/stream-clip-maker/fontconfig/fonts.conf"));
            candidates.push(parent.join("../lib/stream-clip-maker/fontconfig/fonts.conf"));
            candidates.push(parent.join("../lib64/stream-clip-maker/fontconfig/fonts.conf"));
            candidates.push(parent.join("../share/Stream Clip Maker/fontconfig/fonts.conf"));
        }
    }
    candidates
        .push(PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/fontconfig/fonts.conf"));
    if let Some(config) = candidates.into_iter().find(|p| p.is_file()) {
        std::env::set_var("FONTCONFIG_FILE", &config);
        if let Some(parent) = config.parent() {
            std::env::set_var("FONTCONFIG_PATH", parent);
        }
    }
}

#[cfg(not(target_os = "linux"))]
fn configure_linux_fontconfig() {}

pub fn run() {
    // Fontconfig must be configured before WebKitGTK creates its first webview.
    configure_linux_fontconfig();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            connection_status,
            save_twitch_credentials,
            import_youtube_credentials,
            read_discovery,
            start_engine_task,
            app_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running Stream Clip Maker");
}
