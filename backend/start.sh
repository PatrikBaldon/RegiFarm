#!/bin/sh
# Script di avvio per Fly.io
# Fly.io si aspetta che l'app ascolti su 0.0.0.0:8000 (come specificato in fly.toml internal_port)

# Usa PORT dalla variabile d'ambiente se disponibile, altrimenti usa 8000
# Fly.io può iniettare PORT automaticamente, ma per sicurezza usiamo 8000 come default
PORT=${PORT:-8000}

echo "=========================================="
echo "Starting RegiFarm Pro API"
echo "Host: 0.0.0.0"
echo "Port: ${PORT}"
echo "Fly.io internal_port: 8000"
echo "=========================================="

# Esegui migrazioni Alembic prima di avviare l'app (usa DATABASE_URL dai secrets Fly)
echo "Running database migrations..."
if ! alembic upgrade head; then
  echo "ERROR: Migrations failed. Exiting."
  exit 1
fi
echo "Migrations completed."

# Assicurati che stiamo ascoltando su 0.0.0.0 (non localhost o 127.0.0.1)
# Questo è richiesto da Fly.io per accettare connessioni esterne
exec uvicorn app.main:app \
  --host 0.0.0.0 \
  --port ${PORT} \
  --workers 1 \
  --timeout-keep-alive 30 \
  --access-log

