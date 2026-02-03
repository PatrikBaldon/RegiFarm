# RegiFarm

Desktop Application for Beef Cattle Farm Management

## 🏗️ Architettura

RegiFarm è un'applicazione desktop multi-piattaforma composta da:

- **Frontend**: Electron + React (app desktop)
- **Backend**: FastAPI (Python) - deployabile su fly.io
- **Database**: PostgreSQL (Supabase)

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 14+ (o account Supabase)

### Installation

```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd backend
python3 -m venv venv
source venv/bin/activate  # su Windows: venv\Scripts\activate
pip install -r requirements.txt

# Setup database
# Configura DATABASE_URL nel file .env (vedi env.example)
alembic upgrade head

# Run development
cd ..
npm run dev
```

## 📦 Deployment

### Distribuzione installer Windows (per utenti tester)

Vedi [docs/DISTRIBUZIONE.md](./docs/DISTRIBUZIONE.md) per generare l'installer Windows tramite GitHub Actions e distribuirlo agli utenti.

### Backend su fly.io

Il backend può essere deployato su fly.io per renderlo accessibile in rete.

Vedi [DEPLOYMENT.md](./DEPLOYMENT.md) per la guida completa al deployment.

**Quick start**:
```bash
cd backend
fly launch
fly secrets set DATABASE_URL="your-database-url"
fly deploy
```

## 📁 Project Structure

```
RegiFarm-Pro/
├── backend/              # Backend FastAPI
│   ├── app/             # Codice applicazione
│   ├── Dockerfile       # Per deployment fly.io
│   ├── fly.toml         # Configurazione fly.io
│   └── requirements.txt
├── electron-app/        # Frontend Electron/React
├── shared/              # Codice condiviso
├── database/            # Migrations e seeds
└── docs/                # Documentazione
```

Vedi `STRUTTURA_PROGETTO.md` per la struttura dettagliata.

## 🔧 Sviluppo

### Backend Locale
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend Locale
```bash
npm run dev
```

### Build per Produzione
```bash
# Build Electron app
npm run build

# Build per piattaforma specifica
npm run build:mac
npm run build:win
npm run build:linux
```

## 📚 Documentazione

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Guida al deployment su fly.io
- [STRUTTURA_PROGETTO.md](../STRUTTURA_PROGETTO.md) - Struttura dettagliata del progetto

## 🔒 Sicurezza

- Le variabili d'ambiente sensibili vanno configurate tramite `fly secrets` (per fly.io) o file `.env` (locale)
- Non committare mai file `.env` o credenziali
- Vedi `env.example` per le variabili necessarie

## 📝 License

Proprietary - All Rights Reserved
