#!/usr/bin/env python3
"""Construit le latest.json de l'updater à partir des assets d'une release.

tauri-action écrit lui-même ce fichier, mais chaque job de la matrice le réécrit
sur la même release : les quatre écritures se courent après et certaines se font
écraser. La v0.14.0 est sortie avec 5 plateformes sur 11 — ni Linux ni Apple
Silicon — et l'app répondait « erreur lors de la vérification des mises à jour »
sur ces machines.

On génère donc la manifeste une seule fois, après tous les builds, et on échoue
si une plateforme manque plutôt que d'en publier une incomplète.

Tout passe par l'API REST : la release est encore un brouillon à ce moment-là, et
`gh release view/download` résout mal un brouillon par son tag.

Usage: build-updater-manifest.py <tag> <output.json>
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO = "stayup-app/stayup-desktop"

# Chaque clé de plateforme attendue par l'updater Tauri, et l'asset qui la sert.
# `{v}` est la version sans le « v » du tag.
PLATFORMS: dict[str, str] = {
    "darwin-x86_64": "StayUp_x64.app.tar.gz",
    "darwin-x86_64-app": "StayUp_x64.app.tar.gz",
    "darwin-aarch64": "StayUp_aarch64.app.tar.gz",
    "darwin-aarch64-app": "StayUp_aarch64.app.tar.gz",
    "linux-x86_64": "StayUp_{v}_amd64.AppImage",
    "linux-x86_64-appimage": "StayUp_{v}_amd64.AppImage",
    "linux-x86_64-deb": "StayUp_{v}_amd64.deb",
    "linux-x86_64-rpm": "StayUp-{v}-1.x86_64.rpm",
    "windows-x86_64": "StayUp_{v}_x64_en-US.msi",
    "windows-x86_64-msi": "StayUp_{v}_x64_en-US.msi",
    "windows-x86_64-nsis": "StayUp_{v}_x64-setup.exe",
}


def gh_api(path: str, *, binary: bool = False) -> bytes | object:
    args = ["gh", "api", path]
    if binary:
        args += ["-H", "Accept: application/octet-stream"]
    out = subprocess.run(args, check=True, capture_output=True).stdout
    return out if binary else json.loads(out)


def find_release(tag: str) -> dict:
    """La release portant ce tag, brouillon compris."""
    for page in range(1, 6):
        releases = gh_api(f"repos/{REPO}/releases?per_page=100&page={page}")
        if not releases:
            break
        for release in releases:
            if release["tag_name"] == tag:
                return release
    raise SystemExit(f"Aucune release trouvée pour le tag {tag}")


def main() -> int:
    if len(sys.argv) != 3:
        print(__doc__, file=sys.stderr)
        return 2

    tag, output = sys.argv[1], Path(sys.argv[2])
    version = tag.lstrip("v")

    release = find_release(tag)
    assets = {a["name"]: a["id"] for a in release["assets"]}
    wanted = {key: name.format(v=version) for key, name in PLATFORMS.items()}

    missing = sorted(
        {a for a in wanted.values() if a not in assets}
        | {f"{a}.sig" for a in wanted.values() if f"{a}.sig" not in assets}
    )
    if missing:
        print(f"Assets absents de la release {tag} :", file=sys.stderr)
        for name in missing:
            print(f"  - {name}", file=sys.stderr)
        print(
            "Un build de la matrice a échoué ou n'a rien téléversé : publier la "
            "manifeste maintenant laisserait ces plateformes sans mise à jour.",
            file=sys.stderr,
        )
        return 1

    signatures = {
        asset: gh_api(f"repos/{REPO}/releases/assets/{assets[f'{asset}.sig']}", binary=True)
        .decode("utf-8")
        .strip()
        for asset in sorted(set(wanted.values()))
    }

    base = f"https://github.com/{REPO}/releases/download/{tag}"
    manifest = {
        "version": version,
        "notes": "",
        "pub_date": release.get("published_at") or release["created_at"],
        "platforms": {
            key: {"signature": signatures[asset], "url": f"{base}/{asset}"}
            for key, asset in wanted.items()
        },
    }

    output.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"{output} : {len(manifest['platforms'])} plateformes pour {tag}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
