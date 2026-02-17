# Icone app (Windows e macOS)

Le icone dell’app sono generate dal **logo PNG usato nei PDF** (`RegiFarm_Logo.png`).

## Generare le icone

Dalla root del progetto:

```bash
npm run icons
```

Oppure:

```bash
python3 scripts/generate_app_icons.py
```

Vengono creati:

- **Windows**: `build/icon.ico` (16, 32, 48, 256 px, con trasparenza dove supportata)
- **macOS**: `build/icon.icns` (da 16 a 1024 px incluso Retina, con trasparenza)

Le stesse icone vengono copiate in `electron-app/public/icons/` per uso runtime.

**Prima di fare la build** per Windows o macOS assicurati di aver eseguito `npm run icons` (la cartella `build/` è in `.gitignore`, quindi le icone vanno rigenerate dopo un clone o dopo `npm run clean`).

## Requisiti

- **Python 3** con **Pillow**: `pip install Pillow`
- **Node/npm** (per `electron-icon-builder`, usato per generare l’ICNS con trasparenza)

## electron-builder

Con `buildResources: "build"`, electron-builder usa automaticamente:

- `build/icon.ico` per Windows (NSIS)
- `build/icon.icns` per macOS (DMG/app bundle)

Non serve configurare percorsi aggiuntivi in `package.json`.
