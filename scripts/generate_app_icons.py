#!/usr/bin/env python3
"""
Genera icon.ico (Windows) e icon.icns (macOS) dal logo PNG usato nei PDF.
- Windows: ICO con 16, 32, 48, 256 px (trasparenza supportata in 32-bit).
- macOS: ICNS con tutte le dimensioni incluso Retina, trasparenza preservata.
  Usa npx electron-icon-builder per ICNS (compatibile con tutte le versioni macOS).
"""
from pathlib import Path
import shutil
import subprocess
import sys

try:
    from PIL import Image
except ImportError:
    print("Errore: installa Pillow con: pip install Pillow")
    sys.exit(1)

# Root del progetto RegiFarm-Pro
SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent

# Logo sorgente (stesso usato nei PDF)
LOGO_CANDIDATES = [
    PROJECT_ROOT / "RegiFarm_Logo.png",
    PROJECT_ROOT / "electron-app" / "public" / "RegiFarm_Logo.png",
]

# Destinazioni
BUILD_DIR = PROJECT_ROOT / "build"
ICONS_PUBLIC = PROJECT_ROOT / "electron-app" / "public" / "icons"

# Dimensioni standard ICO (Windows)
ICO_SIZES = [(16, 16), (32, 32), (48, 48), (256, 256)]


def find_logo() -> Path:
    for p in LOGO_CANDIDATES:
        if p.is_file():
            return p
    raise FileNotFoundError(
        f"Logo non trovato. Cerca in: {[str(p) for p in LOGO_CANDIDATES]}"
    )


def load_logo_rgba(path: Path) -> Image.Image:
    im = Image.open(path)
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    return im


def generate_ico(logo: Image.Image, out_path: Path) -> None:
    """Genera ICO per Windows con più dimensioni e trasparenza."""
    out_path.parent.mkdir(parents=True, exist_ok=True)
    logo.save(out_path, format="ICO", sizes=ICO_SIZES)
    print(f"  Scritto: {out_path}")


def run_electron_icon_builder(logo_path: Path) -> bool:
    """Usa electron-icon-builder per generare ICO e ICNS (preserva trasparenza)."""
    result = subprocess.run(
        [
            "npx",
            "--yes",
            "electron-icon-builder",
            "--input", str(logo_path),
            "--output", str(BUILD_DIR),
        ],
        cwd=PROJECT_ROOT,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print("  electron-icon-builder stderr:", result.stderr or result.stdout)
        return False
    return True


def main() -> None:
    print("Generazione icone app da logo PDF (RegiFarm_Logo.png)")
    logo_path = find_logo()
    print(f"  Logo: {logo_path}")
    logo = load_logo_rgba(logo_path)

    BUILD_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_PUBLIC.mkdir(parents=True, exist_ok=True)

    # 1) ICO con Pillow (veloce, dimensioni corrette)
    ico_build = BUILD_DIR / "icon.ico"
    generate_ico(logo, ico_build)

    # 2) ICO + ICNS con electron-icon-builder (ICNS con trasparenza e Retina)
    print("  Generazione ICNS (e ICO multi-size) con electron-icon-builder...")
    if run_electron_icon_builder(logo_path):
        win_ico = BUILD_DIR / "icons" / "win" / "icon.ico"
        mac_icns = BUILD_DIR / "icons" / "mac" / "icon.icns"
        if mac_icns.is_file():
            shutil.copy(mac_icns, BUILD_DIR / "icon.icns")
            print(f"  Scritto: {BUILD_DIR / 'icon.icns'}")
        if win_ico.is_file():
            shutil.copy(win_ico, ico_build)
    else:
        # Fallback: solo ICO da Pillow; per ICNS usare build/icon.png su Mac (electron-builder lo converte)
        icon_png = BUILD_DIR / "icon.png"
        logo.save(icon_png, format="PNG")
        print("  Salvato build/icon.png; su macOS electron-builder può generare .icns da questo.")

    # Copia in public/icons per uso runtime
    for name in ("icon.ico", "icon.icns"):
        src = BUILD_DIR / name
        if src.is_file():
            shutil.copy(src, ICONS_PUBLIC / name)

    print("Fatto. electron-builder userà build/icon.ico e build/icon.icns.")


if __name__ == "__main__":
    main()
