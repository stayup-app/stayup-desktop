#!/usr/bin/env python3
"""Construit — et vérifie — le latest.json de l'updater d'une release.

tauri-action sait écrire ce fichier, mais chaque job de la matrice le réécrit sur
la même release : les quatre écritures se courent après et certaines se perdent.
La v0.14.0 est sortie avec 5 plateformes sur 11 — ni Linux ni Apple Silicon — et
l'app répondait « erreur lors de la vérification des mises à jour » sur ces
machines, sans que rien n'apparaisse côté CI : release verte, binaires présents.

D'où trois garde-fous, chacun contre une façon différente de reproduire ça :

1. `missing` — une plateforme attendue n'a pas son binaire : un build a échoué.
2. `uncovered` — un artefact signé de la release n'est référencé par aucune
   plateforme : quelqu'un a ajouté une cible à la matrice sans l'ajouter ici.
   C'est ce contrôle qui empêche la panne de se répéter sous une autre forme,
   puisqu'il part de la release réelle et non de la table ci-dessous.
3. `verify` — la manifeste réellement servie à l'app correspond bien.

Tout passe par l'API REST : la release est encore un brouillon quand la manifeste
est construite, et `gh release view` résout mal un brouillon par son tag.

Usage:
  build-updater-manifest.py <tag> <output.json>   construit et contrôle
  build-updater-manifest.py --verify <tag>        contrôle ce qui est servi
  build-updater-manifest.py --self-test           contrôles hors-ligne
"""

from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

REPO = "stayup-app/stayup-desktop"
UPDATER_ENDPOINT = f"https://github.com/{REPO}/releases/latest/download/latest.json"

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


# ── Contrôles, isolés du réseau pour rester testables ────────────────────────

def expected_assets(version: str) -> dict[str, str]:
    return {key: name.format(v=version) for key, name in PLATFORMS.items()}


def signed_artifacts(asset_names: set[str]) -> set[str]:
    """Les artefacts de la release destinés à l'updater : ceux qui ont un .sig."""
    return {name[:-4] for name in asset_names if name.endswith(".sig")}


def find_problems(version: str, asset_names: set[str]) -> list[str]:
    wanted = expected_assets(version)
    problems: list[str] = []

    for asset in sorted(set(wanted.values())):
        if asset not in asset_names:
            problems.append(f"binaire absent : {asset}")
        if f"{asset}.sig" not in asset_names:
            problems.append(f"signature absente : {asset}.sig")

    # Le contrôle qui compte sur la durée : il part des artefacts réellement
    # publiés, donc une nouvelle cible de build ne peut plus passer inaperçue.
    uncovered = signed_artifacts(asset_names) - set(wanted.values())
    for asset in sorted(uncovered):
        problems.append(
            f"artefact signé que la manifeste ne référence pas : {asset} "
            "— ajouter sa clé de plateforme dans PLATFORMS"
        )
    return problems


# ── Accès réseau ─────────────────────────────────────────────────────────────

def gh_api(path: str, *, binary: bool = False):
    args = ["gh", "api", path]
    if binary:
        args += ["-H", "Accept: application/octet-stream"]
    out = subprocess.run(args, check=True, capture_output=True).stdout
    return out if binary else json.loads(out)


def find_release(tag: str) -> dict:
    """La release portant ce tag, brouillon compris.

    Un run de release échoué laisse son brouillon derrière lui — il en traîne
    plusieurs sur ce dépôt. Relancer le même tag crée donc une seconde release
    portant le même nom. L'API liste du plus récent au plus ancien : on prend la
    première correspondance, c'est-à-dire celle du run en cours.
    """
    for page in range(1, 6):
        releases = gh_api(f"repos/{REPO}/releases?per_page=100&page={page}")
        if not releases:
            break
        for release in releases:
            if release["tag_name"] == tag:
                return release
    raise SystemExit(f"Aucune release trouvée pour le tag {tag}")


def build(tag: str, output: Path) -> int:
    version = tag.lstrip("v")
    release = find_release(tag)
    assets = {a["name"]: a["id"] for a in release["assets"]}

    problems = find_problems(version, set(assets))
    if problems:
        print(f"Manifeste refusée pour {tag} :", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        print(
            "Publier en l'état laisserait des utilisateurs sans mise à jour, "
            "sans aucun signal côté CI.",
            file=sys.stderr,
        )
        return 1

    wanted = expected_assets(version)
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


def verify(tag: str) -> int:
    """Contrôle la manifeste telle que l'app la reçoit, pas celle qu'on a produite."""
    version = tag.lstrip("v")
    req = urllib.request.Request(UPDATER_ENDPOINT, headers={"Cache-Control": "no-cache"})
    served = json.load(urllib.request.urlopen(req))

    problems = []
    if served.get("version") != version:
        problems.append(f"version servie {served.get('version')!r}, attendu {version!r}")
    missing = set(PLATFORMS) - set(served.get("platforms", {}))
    if missing:
        problems.append("plateformes absentes : " + ", ".join(sorted(missing)))

    if problems:
        print("La manifeste servie à l'updater est incorrecte :", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        return 1

    print(f"Manifeste servie : {version}, {len(served['platforms'])} plateformes — conforme.")
    return 0


def self_test() -> int:
    """Contrôles hors-ligne : ils tournent en CI à chaque push."""
    v = "1.2.3"
    complete = set()
    for asset in set(expected_assets(v).values()):
        complete |= {asset, f"{asset}.sig"}

    cases: list[tuple[str, set[str], str | None]] = [
        ("release complète", complete, None),
        ("binaire manquant", complete - {f"StayUp_{v}_amd64.AppImage"}, "binaire absent"),
        ("signature manquante", complete - {f"StayUp_{v}_amd64.AppImage.sig"}, "signature absente"),
        (
            "nouvelle cible non déclarée",
            complete | {"StayUp_arm64.AppImage", "StayUp_arm64.AppImage.sig"},
            "ne référence pas",
        ),
    ]

    failures = 0
    for name, assets, expected in cases:
        problems = find_problems(v, assets)
        ok = (not problems) if expected is None else any(expected in p for p in problems)
        print(f"  {'ok  ' if ok else 'ÉCHEC'} {name}")
        if not ok:
            failures += 1
            for p in problems:
                print(f"        {p}")

    # La table ne doit pas contenir de clé morte ni de doublon inattendu.
    if len(PLATFORMS) != 11:
        print(f"  ÉCHEC 11 clés de plateforme attendues, {len(PLATFORMS)} trouvées")
        failures += 1

    print("self-test :", "ok" if failures == 0 else f"{failures} échec(s)")
    return 1 if failures else 0


def main() -> int:
    args = sys.argv[1:]
    if args == ["--self-test"]:
        return self_test()
    if len(args) == 2 and args[0] == "--verify":
        return verify(args[1])
    if len(args) == 2:
        return build(args[0], Path(args[1]))
    print(__doc__, file=sys.stderr)
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
