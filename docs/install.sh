#!/bin/sh
# StayUp installer for macOS and Linux.
# Usage: curl -fsSL https://stayup-app.github.io/stayup-desktop/install.sh | sh
set -eu

REPO="stayup-app/stayup-desktop"
API="https://api.github.com/repos/${REPO}/releases/latest"

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

fetch_release() {
  curl -fsSL -H "Accept: application/vnd.github+json" "$API" \
    || die "could not reach GitHub to fetch the latest release."
}

# Extracts the first browser_download_url whose asset name matches the given
# extended-regex pattern.
find_asset_url() {
  pattern="$1"
  printf '%s\n' "$RELEASE_JSON" \
    | grep -o '"browser_download_url": *"[^"]*"' \
    | sed -E 's/.*"(https:[^"]+)"/\1/' \
    | grep -E "$pattern" \
    | head -n1
}

install_macos() {
  if ! command -v brew >/dev/null 2>&1; then
    log "Homebrew is required and was not found — installing it now..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
    if [ -x /opt/homebrew/bin/brew ]; then
      eval "$(/opt/homebrew/bin/brew shellenv)"
    elif [ -x /usr/local/bin/brew ]; then
      eval "$(/usr/local/bin/brew shellenv)"
    else
      die "Homebrew installation finished but 'brew' was not found on PATH. Open a new shell and re-run this script."
    fi
  fi

  log "Installing StayUp via Homebrew..."
  brew install --cask stayup-app/tap/stayup
}

install_linux() {
  arch=$(uname -m)
  case "$arch" in
    x86_64) ;;
    *) die "no Linux build is published for architecture '$arch' (only x86_64 is supported)." ;;
  esac

  RELEASE_JSON=$(fetch_release)
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT

  if command -v dpkg >/dev/null 2>&1; then
    url=$(find_asset_url '_amd64\.deb$')
    [ -n "$url" ] || die "could not find a .deb asset in the latest release."
    log "Downloading $(basename "$url")..."
    curl -fsSL "$url" -o "$tmp/stayup.deb"
    log "Installing (sudo required)..."
    sudo dpkg -i "$tmp/stayup.deb" || sudo apt-get install -f -y
  elif command -v rpm >/dev/null 2>&1; then
    url=$(find_asset_url '\.x86_64\.rpm$')
    [ -n "$url" ] || die "could not find an .rpm asset in the latest release."
    log "Downloading $(basename "$url")..."
    curl -fsSL "$url" -o "$tmp/stayup.rpm"
    log "Installing (sudo required)..."
    sudo rpm -i "$tmp/stayup.rpm"
  else
    url=$(find_asset_url '_amd64\.AppImage$')
    [ -n "$url" ] || die "could not find an AppImage asset in the latest release."
    mkdir -p "$HOME/.local/bin"
    dest="$HOME/.local/bin/StayUp.AppImage"
    log "Downloading $(basename "$url")..."
    curl -fsSL "$url" -o "$dest"
    chmod +x "$dest"
    log "Installed to $dest"
    case ":$PATH:" in
      *":$HOME/.local/bin:"*) ;;
      *) printf '\033[1;33mNote:\033[0m add %s to your PATH to run "StayUp.AppImage" from anywhere.\n' "$HOME/.local/bin" ;;
    esac
  fi
}

case "$(uname -s)" in
  Darwin) install_macos ;;
  Linux)  install_linux ;;
  *)      die "unsupported OS '$(uname -s)'. See https://stayup-app.github.io/stayup-desktop for manual downloads." ;;
esac

log "StayUp installed 🎉"
