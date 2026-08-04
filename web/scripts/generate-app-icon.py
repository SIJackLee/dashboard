"""Generate Android launcher icons — eliminate adaptive ring.

Both adaptive layers use the SAME full-bleed bitmap so no background
color can peek as a mint/white ring. Legacy icons are identical.
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "app_logo2.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
OUT = ROOT / "resources"

# Fixed brand green (matches app_logo2 corners) — single source of truth
GREEN = (13, 134, 82)  # #0D8652
YELLOW = (249, 196, 0)

DENSITIES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

# Same drawable for background AND foreground — zero layer color mismatch
ADAPTIVE_XML = """\
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_foreground"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""


def extract_text_crop(src: Image.Image) -> Image.Image:
    arr = np.array(src.convert("RGB"))
    rgb = arr.astype(np.int16)
    g = np.array(GREEN, dtype=np.int16)
    mask = np.abs(rgb - g).sum(axis=2) > 60
    if not np.any(mask):
        return src
    ys, xs = np.where(mask)
    pad = int(max(src.size) * 0.06)
    box = (
        max(0, int(xs.min()) - pad),
        max(0, int(ys.min()) - pad),
        min(src.size[0], int(xs.max()) + pad + 1),
        min(src.size[1], int(ys.max()) + pad + 1),
    )
    return src.crop(box)


def make_master(size: int = 1024) -> Image.Image:
    """Opaque plate: every pixel GREEN except yellow letterforms."""
    src = Image.open(SOURCE).convert("RGB")
    crop = extract_text_crop(src)

    # Rebuild on exact GREEN (no source green variation / compression fringe)
    canvas = Image.new("RGB", (size, size), GREEN)

    # Scale text to ~72% of canvas — stays inside circular safe zone (~66%+)
    # slightly under full width so mask does not clip SUNG-IL
    target = int(size * 0.72)
    cw, ch = crop.size
    scale = target / max(cw, ch)
    nw, nh = max(1, int(cw * scale)), max(1, int(ch * scale))
    layer = crop.resize((nw, nh), Image.Resampling.LANCZOS)

    # Replace near-green pixels in layer with exact GREEN so no halo
    la = np.array(layer)
    g = np.array(GREEN, dtype=np.int16)
    near = np.abs(la.astype(np.int16) - g).sum(axis=2) < 90
    la[near] = GREEN
    # Boost yellow for readability
    yell = (la[:, :, 0] > 180) & (la[:, :, 2] < 80)
    la[yell] = YELLOW
    layer = Image.fromarray(la, "RGB")

    canvas.paste(layer, ((size - nw) // 2, (size - nh) // 2))
    return canvas


def main() -> None:
    master = make_master(1024)
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
        master.resize((fg, fg), Image.Resampling.LANCZOS).save(
            dest / "ic_launcher_foreground.png", optimize=True
        )
        print(folder, "ok")

    hex_bg = f"#{GREEN[0]:02X}{GREEN[1]:02X}{GREEN[2]:02X}"
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n'
        "<resources>\n"
        f'    <color name="ic_launcher_background">{hex_bg}</color>\n'
        "</resources>\n",
        encoding="utf-8",
    )

    anydpi = RES / "mipmap-anydpi-v26"
    anydpi.mkdir(parents=True, exist_ok=True)
    (anydpi / "ic_launcher.xml").write_text(ADAPTIVE_XML, encoding="utf-8")
    (anydpi / "ic_launcher_round.xml").write_text(ADAPTIVE_XML, encoding="utf-8")

    # Neutralize legacy Capacitor vector so nothing can resolve to it
    fg_vec = RES / "drawable-v24" / "ic_launcher_foreground.xml"
    if fg_vec.exists():
        fg_vec.write_text(
            '<?xml version="1.0" encoding="utf-8"?>\n'
            '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
            '    android:width="108dp"\n'
            '    android:height="108dp"\n'
            '    android:viewportWidth="108"\n'
            '    android:viewportHeight="108">\n'
            f'    <path android:fillColor="{hex_bg}" android:pathData="M0,0h108v108h-108z"/>\n'
            "</vector>\n",
            encoding="utf-8",
        )

    print("background", hex_bg)
    print("adaptive: identical fg bitmap for both layers")


if __name__ == "__main__":
    main()
