<div align="center">

<img src="public/logo.svg" width="64" height="64" alt="StayUp logo" />

# StayUp

**Stay up to date with everything that matters.**

StayUp aggregates GitHub releases, YouTube videos, RSS feeds, and web pages into a single personalized feed — so you never miss a release or update again.

[![CI](https://github.com/stayup-app/stayup-desktop/actions/workflows/ci.yml/badge.svg)](https://github.com/stayup-app/stayup-desktop/actions/workflows/ci.yml)
[![Release](https://github.com/stayup-app/stayup-desktop/actions/workflows/release.yml/badge.svg)](https://github.com/stayup-app/stayup-desktop/actions/workflows/release.yml)
[![Pages](https://github.com/stayup-app/stayup-desktop/actions/workflows/pages.yml/badge.svg)](https://github.com/stayup-app/stayup-desktop/actions/workflows/pages.yml)
[![Latest release](https://img.shields.io/github/v/release/stayup-app/stayup-desktop)](https://github.com/stayup-app/stayup-desktop/releases/latest)
[![License](https://img.shields.io/github/license/stayup-app/stayup-desktop)](LICENSE)

![macOS](https://img.shields.io/badge/macOS-000000?logo=apple&logoColor=white)
![Windows](https://img.shields.io/badge/Windows-0078D4?logo=windows&logoColor=white)
![Linux](https://img.shields.io/badge/Linux-FCC624?logo=linux&logoColor=black)

[**Download**](https://github.com/stayup-app/stayup-desktop/releases/latest) · [**Landing page**](https://stayup-app.github.io/stayup-desktop)

</div>

---

## Features

- **GitHub releases** — subscribe to any repository and receive its release notes as they drop
- **YouTube channels** — follow creators and see new videos in your feed
- **RSS / Atom feeds** — add any RSS URL to stay updated from blogs, podcasts, and news sites
- **Web scraping** — track web pages via CSS selectors when no feed is available
- **Unified feed** — all sources merged and sorted chronologically in one view
- **Auto-update** — the app updates itself silently in the background
- **Light & dark theme** — follows your OS preference
- **Multilingual** — English and French included

---

## Installation

### macOS

Download the `.dmg` for your architecture from the [latest release](https://github.com/stayup-app/stayup-desktop/releases/latest):

| Architecture | File |
|---|---|
| Apple Silicon (M1/M2/M3…) | `StayUp_x.x.x_aarch64.dmg` |
| Intel | `StayUp_x.x.x_x64.dmg` |

Open the `.dmg`, drag **StayUp** to your Applications folder, and launch it.

> On first launch macOS may warn about an unidentified developer. Go to **System Settings → Privacy & Security** and click **Open Anyway**.

**Homebrew Cask**

```sh
brew install --cask stayup-app/tap/stayup
```

### Windows

Download `StayUp_x.x.x_x64-setup.exe` from the [latest release](https://github.com/stayup-app/stayup-desktop/releases/latest) and run the installer.

An MSI package (`StayUp_x.x.x_x64_en-US.msi`) is also available for enterprise/group-policy deployments.

### Linux

#### Debian / Ubuntu (`.deb`)

```sh
sudo dpkg -i StayUp_x.x.x_amd64.deb
```

#### Fedora / RHEL (`.rpm`)

```sh
sudo rpm -i StayUp-x.x.x-1.x86_64.rpm
```

#### AppImage (any distro)

```sh
chmod +x StayUp_x.x.x_amd64.AppImage
./StayUp_x.x.x_amd64.AppImage
```

---

## Uninstallation

### macOS

Drag **StayUp** from `/Applications` to the Trash.

To also remove user data:

```sh
rm -rf ~/Library/Application\ Support/dev.r-sik.stayup-desktop
```

**Homebrew Cask**

```sh
brew uninstall --cask stayup
```

### Windows

Go to **Settings → Apps → Installed apps**, search for **StayUp**, and click **Uninstall**.

To also remove user data, delete the folder:

```
%APPDATA%\dev.r-sik.stayup-desktop
```

### Linux

#### `.deb`

```sh
sudo apt remove stayup
```

#### `.rpm`

```sh
sudo rpm -e StayUp
```

User data is stored in `~/.local/share/dev.r-sik.stayup-desktop`.

---

## Auto-update

StayUp checks for updates automatically at launch and notifies you via a banner. Updates download in the background — no manual intervention required.

---

## CI / CD

| Workflow | Trigger | Description |
|---|---|---|
| **CI** | Push / PR on `main` | Runs TypeScript type checking, ESLint, Prettier, and unit tests |
| **Release** | Push of a `v*` tag | Builds for macOS (ARM + x64), Windows, and Linux; publishes to GitHub Releases and updates the Homebrew cask |

Releases are only published when **all** platform builds succeed.

---

## Development

**Prerequisites:** Node.js 20+, Rust stable, platform-specific [Tauri prerequisites](https://tauri.app/start/prerequisites/).

```sh
# Install frontend dependencies
npm ci

# Start the development server (hot reload)
npm run tauri dev
```

**Available scripts:**

```sh
npm run typecheck      # TypeScript type checking
npm run lint           # ESLint
npm run format         # Prettier (fix)
npm run format:check   # Prettier (check only)
npm run test           # Vitest unit tests
npm run tauri build    # Production build
```

---

## Tech stack

- [Tauri 2](https://tauri.app) — desktop shell (Rust)
- [React 18](https://react.dev) + [TypeScript](https://www.typescriptlang.org)
- [Vite](https://vitejs.dev) — bundler
- [Tailwind CSS](https://tailwindcss.com) — styling
- [Zustand](https://zustand-demo.pmnd.rs) — state management
- [Vitest](https://vitest.dev) + [Playwright](https://playwright.dev) — testing

---

## License

MIT © [StayUp](https://github.com/stayup-app)
