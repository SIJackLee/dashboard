"""Generate Android launcher icons from public/app_logo.png."""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "app_logo2.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
OUT = ROOT / "resources"

DENSITIES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}


def sample_corner_green(img: Image.Image) -> tuple[int, int, int]:
    arr = np.array(img.convert("RGB"))
    samples = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    med = np.median(np.stack(samples), axis=0)
    return tuple(int(x) for x in med)


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    green = sample_corner_green(src)
    master = src.resize((1024, 1024), Image.Resampling.LANCZOS)
    # Adaptive foreground도 동일 풀블리드 — inset 하면 원형 마스크에 테두리처럼 보임
    foreground = master

    OUT.mkdir(exist_ok=True)
    master.save(OUT / "icon.png", optimize=True)

    for folder, (launcher, fg) in DENSITIES.items():
        dest = RES / folder
        dest.mkdir(parents=True, exist_ok=True)
        master.resize((launcher, launcher), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher.png", optimize=True
        )
        master.resize((launcher, launcher), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_round.png", optimize=True
        )
        foreground.resize((fg, fg), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_foreground.png", optimize=True
        )
        print(folder, "ok")

    hex_bg = f"#{green[0]:02X}{green[1]:02X}{green[2]:02X}"
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{hex_bg}</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )
    print("source", SOURCE.name, src.size)
    print("background", hex_bg)


if __name__ == "__main__":
    main()
