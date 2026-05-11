#!/usr/bin/env bash
set -euo pipefail

REPO="AleksanderObuchowski/MarpEditor"
API_URL="https://api.github.com/repos/${REPO}/releases/latest"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

info() {
  echo -e "${GREEN}[MarpEditor]${NC} $1"
}

warn() {
  echo -e "${YELLOW}[MarpEditor]${NC} $1"
}

error() {
  echo -e "${RED}[MarpEditor]${NC} $1" >&2
}

detect_platform() {
  local os
  os=$(uname -s)
  case "$os" in
    Darwin*) echo "mac" ;;
    Linux*)  echo "linux" ;;
    CYGWIN*|MINGW*|MSYS*) echo "windows" ;;
    *)       echo "unknown" ;;
  esac
}

get_latest_version() {
  local version=""

  # Try gh CLI first (more reliable, uses auth)
  if command -v gh >/dev/null 2>&1; then
    version=$(gh release view --repo "$REPO" --json tagName -q '.tagName' 2>/dev/null || true)
  fi

  if [ -n "$version" ]; then
    echo "$version"
    return
  fi

  # Fallback: API with retries
  local attempt=1
  while [ "$attempt" -le 3 ]; do
    version=$(curl -fsSL --max-time 10 "$API_URL" 2>/dev/null | grep '"tag_name":' | sed -E 's/.*"tag_name": "([^"]+)".*/\1/' || true)
    if [ -n "$version" ]; then
      echo "$version"
      return
    fi
    warn "API request failed (attempt $attempt/3), retrying in 2s..."
    sleep 2
    attempt=$((attempt + 1))
  done
}

download() {
  local url="$1"
  local out="$2"
  curl -fSL --progress-bar "$url" -o "$out"
}

install_mac() {
  local version="$1"
  local asset_name="MarpEditor_${version#v}_universal.dmg"
  local download_url="https://github.com/${REPO}/releases/download/${version}/${asset_name}"
  local tmp_dmg="/tmp/${asset_name}"

  info "Downloading ${asset_name}..."
  download "$download_url" "$tmp_dmg"

  info "Mounting DMG..."
  local mount_point
  mount_point=$(hdiutil attach "$tmp_dmg" -nobrowse -readonly | awk 'END {print $NF}')

  local app_name="MarpEditor.app"
  local source_app="${mount_point}/${app_name}"
  local target_app="/Applications/${app_name}"

  if [ -d "$target_app" ]; then
    warn "Removing old ${app_name}..."
    rm -rf "$target_app"
  fi

  info "Copying to /Applications..."
  cp -R "$source_app" "$target_app"

  info "Removing quarantine flag..."
  xattr -dr com.apple.quarantine "$target_app" 2>/dev/null || true

  info "Unmounting DMG..."
  hdiutil detach "$mount_point" -quiet

  info "Cleaning up..."
  rm -f "$tmp_dmg"

  info "✅ MarpEditor ${version} installed to /Applications!"
  info "Launch it from Launchpad or run: open /Applications/MarpEditor.app"
}

install_linux() {
  local version="$1"
  local asset_name="MarpEditor_${version#v}_amd64.AppImage"
  local download_url="https://github.com/${REPO}/releases/download/${version}/${asset_name}"
  local bin_dir="${HOME}/.local/bin"
  local target="${bin_dir}/marpeditor"

  mkdir -p "$bin_dir"

  info "Downloading ${asset_name}..."
  download "$download_url" "$target"

  info "Making executable..."
  chmod +x "$target"

  info "✅ MarpEditor ${version} installed to ${target}"
  info "Launch it by running: marpeditor"

  if [[ ":$PATH:" != *":${bin_dir}:"* ]]; then
    warn "${bin_dir} is not in your PATH."
    warn "Add this to your ~/.bashrc or ~/.zshrc:"
    warn "  export PATH=\"\$HOME/.local/bin:\$PATH\""
  fi
}

install_windows() {
  cat <<'EOF'
Windows installation is available via Scoop:

  scoop bucket add marpeditor https://github.com/AleksanderObuchowski/scoop-marpeditor
  scoop install marpeditor

Or download the MSI/EXE directly from:
  https://github.com/AleksanderObuchowski/MarpEditor/releases/latest
EOF
}

main() {
  echo "📦 MarpEditor Installer"
  echo ""

  local platform
  platform=$(detect_platform)

  if [ "$platform" = "unknown" ]; then
    error "Unsupported platform: $(uname -s)"
    exit 1
  fi

  info "Detecting latest version..."
  local version
  version=$(get_latest_version)

  if [ -z "$version" ]; then
    error "Could not determine latest version. Are you connected to the internet?"
    exit 1
  fi

  info "Latest version: ${version}"

  case "$platform" in
    mac)
      install_mac "$version"
      ;;
    linux)
      install_linux "$version"
      ;;
    windows)
      install_windows
      ;;
  esac
}

main "$@"
