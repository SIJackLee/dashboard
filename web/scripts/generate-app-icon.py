"""Generate Android launcher icons from public/app_logo3.png.

Adaptive icon layers:
  - background: solid green (corner sample) — never masked away oddly
  - foreground: logo scaled into the safe zone (~66% center) so
    "SUNG-IL" / spiral are not clipped by squircle/circle masks

Legacy mipmap ic_launcher*: same padded composite (full asset).
"""

from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "app_logo3.png"
RES = ROOT / "android" / "app" / "src" / "main" / "res"
OUT = ROOT / "resources"

# Adaptive canvas 108dp; OEM mask keeps ~center 66% → keep content ≤ SAFE_FRAC
SAFE_FRAC = 0.62

DENSITIES = {
    "mipmap-mdpi": (48, 108),
    "mipmap-hdpi": (72, 162),
    "mipmap-xhdpi": (96, 216),
    "mipmap-xxhdpi": (144, 324),
    "mipmap-xxxhdpi": (192, 432),
}

ADAPTIVE_XML = """\
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
"""


def sample_corner_green(img: Image.Image) -> tuple[int, int, int]:
    arr = np.array(img.convert("RGB"))
    samples = [arr[0, 0], arr[0, -1], arr[-1, 0], arr[-1, -1]]
    med = np.median(np.stack(samples), axis=0)
    return tuple(int(x) for x in med)


def fit_logo_on_canvas(
    logo: Image.Image,
    size: int,
    bg: tuple[int, int, int],
    *,
    content_frac: float = SAFE_FRAC,
) -> Image.Image:
    """Place logo centered at content_frac of canvas on solid bg."""
    canvas = Image.new("RGB", (size, size), bg)
    target = max(1, int(round(size * content_frac)))
    fitted = logo.resize((target, target), Image.Resampling.LANCZOS)
    offset = (size - target) // 2
    canvas.paste(fitted, (offset, offset))
    return canvas


def main() -> None:
    src = Image.open(SOURCE).convert("RGB")
    green = sample_corner_green(src)
    # Full logo master (no pad) — used only as source to scale into safe zone
    logo_master = src.resize((1024, 1024), Image.Resampling.LANCZOS)
    # Padded composite for legacy + Capacitor icon.png
    padded_master = fit_logo_on_canvas(logo_master, 1024, green)

    OUT.mkdir(exist_ok=True)
    padded_master.save(OUT / "icon.png", optimize=True)

    for folder, (launcher, fg) in DENSITIES.items():
        dest = RES / folder
        dest.mkdir(parents=True, exist_ok=True)

        legacy = fit_logo_on_canvas(logo_master, launcher, green)
        legacy.save(dest / "ic_launcher.png", optimize=True)
        legacy.save(dest / "ic_launcher_round.png", optimize=True)

        # Foreground layer: same padded look on green (mask crops outer pad)
        foreground = fit_logo_on_canvas(logo_master, fg, green)
        foreground.save(dest / "ic_launcher_foreground.png", optimize=True)
        print(folder, "launcher", launcher, "fg", fg, "ok")

    hex_bg = f"#{green[0]:02X}{green[1]:02X}{green[2]:02X}"
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

    print("source", SOURCE.name, src.size)
    print("safe_frac", SAFE_FRAC)
    print("background", hex_bg)


if __name__ == "__main__":
    main()
