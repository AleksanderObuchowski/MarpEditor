use std::ffi::OsStr;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

#[tauri::command]
fn export_pptx(markdown: String) -> Result<Vec<u8>, String> {
    let temp_dir = create_export_dir()?;
    let input_path = temp_dir.join("presentation.md");
    let output_path = temp_dir.join("presentation.pptx");

    fs::write(&input_path, markdown)
        .map_err(|err| format!("Failed to write temporary Markdown: {err}"))?;
    run_marp_cli(&input_path, &output_path)?;
    let pptx =
        fs::read(&output_path).map_err(|err| format!("Failed to read generated PPTX: {err}"))?;

    let _ = fs::remove_dir_all(&temp_dir);
    Ok(pptx)
}

fn create_export_dir() -> Result<PathBuf, String> {
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|err| format!("System clock error: {err}"))?
        .as_millis();
    let dir = std::env::temp_dir().join(format!("marpeditor-export-{timestamp}"));
    fs::create_dir_all(&dir)
        .map_err(|err| format!("Failed to create temporary export directory: {err}"))?;
    Ok(dir)
}

fn run_marp_cli(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let direct = command_with_platform_extension("marp")
        .args([
            input_path.as_os_str(),
            OsStr::new("--pptx"),
            OsStr::new("-o"),
            output_path.as_os_str(),
        ])
        .output();

    match direct {
        Ok(output) if output.status.success() => return Ok(()),
        Ok(output) => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            let fallback = run_npx_marp(input_path, output_path);
            if fallback.is_ok() {
                return Ok(());
            }
            return Err(format!("Marp CLI failed: {stderr}"));
        }
        Err(_) => run_npx_marp(input_path, output_path),
    }
}

fn run_npx_marp(input_path: &Path, output_path: &Path) -> Result<(), String> {
    let output = command_with_platform_extension("npx")
        .args([
            OsStr::new("--no-install"),
            OsStr::new("marp"),
            input_path.as_os_str(),
            OsStr::new("--pptx"),
            OsStr::new("-o"),
            output_path.as_os_str(),
        ])
        .output()
        .map_err(|err| {
            format!(
                "Failed to start Marp CLI. Install @marp-team/marp-cli or add marp to PATH: {err}"
            )
        })?;

    if output.status.success() {
        Ok(())
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr);
        Err(format!("Marp CLI failed: {stderr}"))
    }
}

fn command_with_platform_extension(command: &str) -> Command {
    if cfg!(windows) {
        Command::new(format!("{command}.cmd"))
    } else {
        Command::new(command)
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![export_pptx])
        .run(tauri::generate_context!())
        .expect("error while running MarpEditor");
}
