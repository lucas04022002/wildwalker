#!/usr/bin/env python3
"""Convertit les PNG/JPG du dépôt en WebP.

Sharp n'est pas installé (et Smart App Control peut bloquer son binaire natif
sur ce poste) : ce script utilise Pillow, déjà installé, avec les mêmes
paramètres que prévu pour sharp (qualité 82, largeur max 1600 px, alpha
préservé pour les PNG).

Pour chaque .png/.jpg/.jpeg trouvé sous client/src/assets et
server/public/assets :
  - si le .webp correspondant existe déjà à côté, le fichier est ignoré
    (script idempotent) ;
  - sinon l'image est redimensionnée (largeur max 1600 px, ratio conservé,
    pas d'agrandissement) puis encodée en WebP qualité 82, method 6 ;
  - si le .webp obtenu dépasse 300 Ko, l'image est ré-encodée en qualité 70 ;
  - l'original est supprimé après écriture du .webp.

Usage : python scripts/optimize-images.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image

REPO_ROOT = Path(__file__).resolve().parent.parent
TARGET_DIRS = [
    REPO_ROOT / "client" / "src" / "assets",
    REPO_ROOT / "server" / "public" / "assets",
]
SOURCE_EXTS = {".png", ".jpg", ".jpeg"}
MAX_WIDTH = 1600
QUALITY = 82
FALLBACK_QUALITY = 70
SIZE_THRESHOLD_BYTES = 300 * 1024
METHOD = 6


def encode_webp(img: Image.Image, dest: Path, quality: int, has_alpha: bool) -> None:
    save_kwargs = {"format": "WEBP", "quality": quality, "method": METHOD}
    if has_alpha:
        img.save(dest, **save_kwargs)
    else:
        img.convert("RGB").save(dest, **save_kwargs)


def convert_one(src: Path) -> tuple[str, float, float, bool] | None:
    dest = src.with_suffix(".webp")
    if dest.exists():
        return None

    before_bytes = src.stat().st_size

    with Image.open(src) as img:
        img.load()
        has_alpha = img.mode in ("RGBA", "LA") or (
            img.mode == "P" and "transparency" in img.info
        )
        if has_alpha and img.mode != "RGBA":
            img = img.convert("RGBA")

        width, height = img.size
        if width > MAX_WIDTH:
            new_height = round(height * (MAX_WIDTH / width))
            img = img.resize((MAX_WIDTH, new_height), Image.LANCZOS)

        encode_webp(img, dest, QUALITY, has_alpha)
        used_fallback = False
        if dest.stat().st_size > SIZE_THRESHOLD_BYTES:
            encode_webp(img, dest, FALLBACK_QUALITY, has_alpha)
            used_fallback = True

    after_bytes = dest.stat().st_size
    src.unlink()

    rel = dest.relative_to(REPO_ROOT).as_posix()
    return rel, before_bytes / 1024, after_bytes / 1024, used_fallback


def main() -> int:
    rows: list[tuple[str, float, float, bool]] = []
    skipped: list[str] = []

    for target_dir in TARGET_DIRS:
        if not target_dir.exists():
            continue
        for src in sorted(target_dir.rglob("*")):
            if not src.is_file() or src.suffix.lower() not in SOURCE_EXTS:
                continue
            result = convert_one(src)
            if result is None:
                skipped.append(src.relative_to(REPO_ROOT).as_posix())
            else:
                rows.append(result)

    if rows:
        name_width = max(len(r[0]) for r in rows) + 2
        header = f"{'fichier'.ljust(name_width)}{'avant (Ko)'.rjust(12)}{'après (Ko)'.rjust(12)}  qualité"
        print(header)
        print("-" * len(header))
        for rel, before_kb, after_kb, fallback in rows:
            quality = FALLBACK_QUALITY if fallback else QUALITY
            print(
                f"{rel.ljust(name_width)}{before_kb:>12.1f}{after_kb:>12.1f}  {quality}"
            )
        total_before = sum(r[1] for r in rows)
        total_after = sum(r[2] for r in rows)
        print("-" * len(header))
        print(
            f"{'total'.ljust(name_width)}{total_before:>12.1f}{total_after:>12.1f}"
        )
        fallback_files = [r[0] for r in rows if r[3]]
        if fallback_files:
            print(
                f"\nQualité abaissée à {FALLBACK_QUALITY} (encore > 300 Ko à qualité {QUALITY}) pour :"
            )
            for f in fallback_files:
                print(f"  - {f}")
    else:
        print("Rien à convertir (tous les .webp existent déjà).")

    if skipped:
        print(f"\nIgnorés (déjà convertis) : {len(skipped)} fichier(s).")

    return 0


if __name__ == "__main__":
    sys.exit(main())
