# GitHub Actions Workflows

## Setup per Deploy Automatico

Per abilitare il deploy automatico su fly.io:

1. **Ottieni il token API di fly.io**:
```bash
fly auth token
```

2. **Aggiungi il token come secret su GitHub**:
   - Vai su GitHub → Settings → Secrets and variables → Actions
   - Clicca "New repository secret"
   - Nome: `FLY_API_TOKEN`
   - Valore: il token ottenuto dal comando sopra

3. **Modifica il nome dell'app in `deploy-fly.yml`**:
   - Sostituisci `regifarm-backend` con il nome della tua app fly.io

4. **Il workflow si attiverà automaticamente** quando:
   - Fai push su `main` con modifiche in `backend/`
   - Oppure lo triggeri manualmente da GitHub Actions

## Workflow Disponibili

- **deploy-fly.yml**: Deploy automatico del backend su fly.io

