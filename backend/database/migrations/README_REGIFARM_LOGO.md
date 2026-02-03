# Setup Logo RegiFarm su Supabase Storage

Questo documento spiega come configurare il logo RegiFarm per renderlo accessibile nei PDF generati dal backend su fly.io.

## Problema

Il backend su fly.io non ha accesso ai file locali, quindi il logo deve essere caricato su un servizio cloud accessibile via URL pubblico.

## Soluzione

Caricare il logo RegiFarm su Supabase Storage in un bucket pubblico accessibile a tutte le aziende.

## Istruzioni

### 1. Crea il bucket in Supabase

1. Vai su **Supabase Dashboard** → **Storage**
2. Clicca su **"New bucket"**
3. Nome bucket: `regifarm_assets`
4. **IMPORTANTE**: Spunta **"Public bucket"** per renderlo accessibile pubblicamente
5. Clicca **"Create bucket"**

### 2. Configura le policy RLS (opzionale ma consigliato)

1. Vai su **Supabase Dashboard** → **SQL Editor**
2. Esegui lo script: `setup_regifarm_logo_bucket.sql`
3. Questo crea una policy per permettere la lettura pubblica del logo

### 3. Carica il logo

Hai tre opzioni:

#### Opzione A: Via Dashboard Supabase (più semplice)

1. Vai su **Storage** → **regifarm_assets**
2. Clicca **"Upload file"**
3. Seleziona `RegiFarm_Logo.png`
4. Il file deve essere chiamato esattamente: `RegiFarm_Logo.png`

#### Opzione B: Via script Python (consigliato per deployment)

```bash
cd backend
python scripts/upload_regifarm_logo.py
```

Lo script cercherà automaticamente il logo nella root del progetto.

#### Opzione C: Via curl (per test)

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"

curl -X POST \
  "${SUPABASE_URL}/storage/v1/object/regifarm_assets/RegiFarm_Logo.png" \
  -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
  -H "Content-Type: image/png" \
  -H "x-upsert: true" \
  --data-binary @RegiFarm_Logo.png
```

### 4. Verifica

L'URL pubblico del logo sarà:
```
{SUPABASE_URL}/storage/v1/object/public/regifarm_assets/RegiFarm_Logo.png
```

Puoi verificare aprendo questo URL nel browser - dovresti vedere il logo.

## Come funziona

Il codice in `app/utils/pdf_layout.py` cerca il logo in questo ordine:

1. File locale (sviluppo): `PROJECT_ROOT/RegiFarm_Logo.png`
2. File locale (sviluppo): `backend/static/RegiFarm_Logo.png`
3. **URL pubblico Supabase** (produzione): `{SUPABASE_URL}/storage/v1/object/public/regifarm_assets/RegiFarm_Logo.png`

Se `SUPABASE_URL` è configurato, l'URL pubblico viene usato come fallback quando i file locali non sono disponibili (come su fly.io).

## Sicurezza

Il bucket `regifarm_assets` è pubblico, ma contiene solo asset comuni (logo RegiFarm) che devono essere accessibili a tutte le aziende senza autenticazione. Questo è corretto per il logo dell'applicazione.

Se vuoi aggiungere altri asset privati in futuro, crea un bucket separato con policy RLS appropriate.

## Troubleshooting

### Logo non appare nei PDF

1. Verifica che il bucket `regifarm_assets` esista e sia pubblico
2. Verifica che il file sia stato caricato come `RegiFarm_Logo.png`
3. Controlla i log del backend per vedere quale URL/path viene usato
4. Testa l'URL pubblico aprendolo nel browser

### Errore "bucket not found"

- Verifica che il bucket sia stato creato correttamente
- Verifica che il nome del bucket sia esattamente `regifarm_assets`

### Errore "Unauthorized" durante l'upload

- Verifica che `SUPABASE_SERVICE_ROLE_KEY` sia configurato correttamente
- Verifica che la Service Role Key abbia i permessi corretti
