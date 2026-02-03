# Guida alla distribuzione di RegiFarm Pro

Questa guida spiega come generare l'installer Windows per gli utenti tester e come configurarlo.

## Stato del repository

Il codice è già stato pushato su [https://github.com/PatrikBaldon/RegiFarm](https://github.com/PatrikBaldon/RegiFarm). La struttura è corretta: `package.json`, `backend/`, `electron-app/` e `.github/workflows/` sono nella root del repo.

---

## Opzione 1: GitHub Actions (consigliata)

La soluzione più semplice: GitHub costruisce automaticamente l'installer su un runner Windows.

### Prerequisiti

1. **Push del codice** su [https://github.com/PatrikBaldon/RegiFarm](https://github.com/PatrikBaldon/RegiFarm)
2. **Secrets da configurare** nel repo GitHub:
   - Vai su **Settings → Secrets and variables → Actions**
   - Aggiungi:
     - `SUPABASE_URL`: URL del tuo progetto Supabase (es. `https://xxxx.supabase.co`)
     - `SUPABASE_ANON_KEY`: chiave anon Supabase (sicura per il frontend)

### Come generare l'installer

**Metodo A – Run manuale**
1. Vai su **Actions** nel repo GitHub
2. Seleziona **Build Windows Installer**
3. Clicca **Run workflow** → **Run workflow**
4. Al termine, scarica l'artifact **RegiFarm-Pro-Windows** (contiene il `.exe`)

**Metodo B – Release con tag**
1. Crea un tag: `git tag v1.0.0`
2. Push del tag: `git push origin v1.0.0`
3. Il workflow creerà una **Release** con l'installer scaricabile dalla pagina Releases

### Condivisione con l’utente tester

- Invia il file `.exe` (installer NSIS) oppure
- Invia il link alla **Release** di GitHub

---

## Opzione 2: Build locale su Mac (sperimentale)

Electron-builder permette di fare cross-compilation, ma moduli nativi come `better-sqlite3` possono dare problemi. Puoi provare:

```bash
cd RegiFarm-Pro
# Assicurati che .env contenga SUPABASE_URL e SUPABASE_ANON_KEY
npm run build:win
```

L’installer sarà in `dist/`. Se la build fallisce per moduli nativi, usa l’opzione GitHub Actions.

---

## Cosa deve fare l’utente tester

1. Scaricare l’installer `RegiFarm Pro Setup x.x.x.exe`
2. Eseguire l’installer e completare l’installazione
3. Avviare **RegiFarm Pro**
4. Fare **Registrazione** o **Login** con le credenziali Supabase

L’app si connette a:
- **Backend**: `regifarm-backend.fly.dev`
- **Auth/Database**: Supabase (configurato nel build)

---

## Note

- **Antivirus**: alcuni antivirus possono segnalare app Electron non firmate; l’utente può aggiungere un’eccezione.
- **Icona**: attualmente si usa l’icona di default di Electron. Per un’icona personalizzata, aggiungi `electron-app/public/icons/icon.ico` e ripristina la configurazione in `package.json`.
