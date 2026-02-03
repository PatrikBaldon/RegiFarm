#!/bin/bash

# Script per avviare facilmente backend e frontend in modalità sviluppo
# RegiFarm Pro - Script di Avvio Sviluppo

echo "🚀 Avvio RegiFarm Pro in modalità sviluppo..."
echo ""

# Colori per output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Verifica che siamo nella directory corretta
if [ ! -f "package.json" ]; then
    echo "❌ Errore: non sei nella directory principale di RegiFarm-Pro"
    echo "Esegui questo script dalla root del progetto"
    exit 1
fi

# Controlla se Node.js è installato
if ! command -v node &> /dev/null; then
    echo "❌ Errore: Node.js non è installato"
    exit 1
fi

# Controlla se Python è installato
if ! command -v python3 &> /dev/null; then
    echo "❌ Errore: Python 3 non è installato"
    exit 1
fi

echo "${GREEN}✅ Dipendenze trovate${NC}"
echo ""

# Funzione per cleanup
cleanup() {
    echo ""
    echo "${YELLOW}⚠️  Arresto in corso...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Trap per gestire Ctrl+C
trap cleanup SIGINT SIGTERM

# Avvia il backend in background
echo "🔧 Avvio Backend FastAPI..."
cd backend
python3 -m uvicorn app.main:app --reload --port 8000 > ../backend.log 2>&1 &
BACKEND_PID=$!
cd ..

# Aspetta che il backend parta
sleep 2

# Avvia il frontend con npm
echo "⚛️  Avvio Frontend Electron..."
npm run dev &
FRONTEND_PID=$!

# Aspetta che i processi finiscano
wait $BACKEND_PID $FRONTEND_PID

