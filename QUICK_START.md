# ⚡ Quick Start - RegiFarm

Guida rapida per iniziare con GitHub e fly.io.

## 🎯 Checklist Iniziale

### 1. Repository GitHub
- [ ] Leggi [GITHUB_SETUP.md](./GITHUB_SETUP.md)
- [ ] Crea repository su GitHub
- [ ] Push del codice iniziale
- [ ] Configura branch protection (opzionale)

### 2. Deploy Backend su fly.io
- [ ] Installa flyctl: `brew install flyctl` (macOS) o [fly.io/docs](https://fly.io/docs/getting-started/installing-flyctl/)
- [ ] Accedi: `fly auth login`
- [ ] Vai in `backend/` e esegui: `fly launch`
- [ ] Configura secrets: `fly secrets set DATABASE_URL="..."` (vedi sotto)
- [ ] Deploy: `fly deploy`

### 3. Configurazione Database

**IMPORTANTE**: Usa sempre la connessione diretta Supabase (porta 5432):

```bash
fly secrets set DATABASE_URL="postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
fly secrets set SECRET_KEY="your-super-secret-key"
fly secrets set SUPABASE_URL="https://[PROJECT-REF].supabase.co"
fly secrets set SUPABASE_ANON_KEY="your-anon-key"
```

## 📝 Comandi Essenziali

### Git
```bash
git add .
git commit -m "Messaggio"
git push origin main
```

### fly.io
```bash
# Deploy
cd backend && fly deploy

# Logs
fly logs

# Status
fly status

# Secrets
fly secrets list
fly secrets set KEY="value"
```

### Sviluppo Locale
```bash
# Backend
cd backend
source venv/bin/activate
uvicorn app.main:app --reload

# Frontend
npm run dev
```

## 🔗 Link Utili

- **Documentazione completa**: [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Setup GitHub**: [GITHUB_SETUP.md](./GITHUB_SETUP.md)
- **fly.io Docs**: https://fly.io/docs/
- **FastAPI Docs**: https://fastapi.tiangolo.com/

## ⚠️ Note Importanti

1. **Database**: Usa sempre porta 5432 (connessione diretta), NON 6543 (pooler)
2. **Secrets**: Non committare mai `.env` o credenziali
3. **CORS**: In produzione, limita CORS a domini specifici invece di `["*"]`
4. **HTTPS**: Già configurato in `fly.toml` con `force_https = true`

## 🆘 Problemi Comuni

**Database connection error?**
- Verifica che il progetto Supabase sia attivo (non in pausa)
- Controlla che usi porta 5432
- Verifica le credenziali: `fly secrets list`

**App non si avvia?**
- Controlla i log: `fly logs`
- Verifica le variabili d'ambiente: `fly secrets list`
- Testa localmente prima di deployare

**Migrations non funzionano?**
- Esegui manualmente: `fly ssh console` → `alembic upgrade head`

