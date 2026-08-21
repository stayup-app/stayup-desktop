#!/bin/sh
# StayUp uninstaller for macOS and Linux.
# Usage: curl -fsSL https://stayup-app.github.io/stayup-desktop/uninstall.sh | sh
#   Add --purge to also delete your StayUp user data:
#     curl -fsSL https://stayup-app.github.io/stayup-desktop/uninstall.sh | sh -s -- --purge
set -eu

log() { printf '\033[1;36m==>\033[0m %s\n' "$1"; }
die() { printf '\033[1;31mError:\033[0m %s\n' "$1" >&2; exit 1; }

PURGE=0
for arg in "$@"; do
  case "$arg" in
    --purge) PURGE=1 ;;
  esac
done

uninstall_macos() {
  if command -v brew >/dev/null 2>&1 && brew list --cask stayup >/dev/null 2>&1; then
    log "Uninstalling StayUp via Homebrew..."
    brew uninstall --cask stayup
  elif [ -d "/Applications/StayUp.app" ]; then
    log "Removing /Applications/StayUp.app..."
    rm -rf "/Applications/StayUp.app"
  else
    die "StayUp was not found in /Applications or Homebrew."
  fi

  if [ "$PURGE" -eq 1 ]; then
    log "Removing user data..."
    rm -rf "$HOME/Library/Application Support/dev.r-sik.stayup-desktop"
  fi
}

uninstall_linux() {
  if command -v dpkg >/dev/null 2>&1 && dpkg -s stayup >/dev/null 2>&1; then
    log "Uninstalling (sudo required)..."
    sudo apt remove -y stayup
  elif command -v rpm >/dev/null 2>&1 && rpm -q StayUp >/dev/null 2>&1; then
    log "Uninstalling (sudo required)..."
    sudo rpm -e StayUp
  elif [ -f "$HOME/.local/bin/StayUp.AppImage" ]; then
    log "Removing $HOME/.local/bin/StayUp.AppImage..."
    rm -f "$HOME/.local/bin/StayUp.AppImage"
  else
    die "no StayUp installation was found (.deb, .rpm, or AppImage)."
  fi

  if [ "$PURGE" -eq 1 ]; then
    log "Removing user data..."
    rm -rf "$HOME/.local/share/dev.r-sik.stayup-desktop"
  fi
}

case "$(uname -s)" in
  Darwin) uninstall_macos ;;
  Linux)  uninstall_linux ;;
  *)      die "unsupported OS '$(uname -s)'." ;;
esac

log "StayUp uninstalled 🎉"
if [ "$PURGE" -eq 0 ]; then
  log "User data was kept. Re-run with --purge to remove it too."
fi
