#!/bin/bash

# Script per avviare RegiFarm Pro facilmente
# Questo script naviga automaticamente nella directory corretta

echo "🚀 RegiFarm Pro - Avvio Applicazione"
echo ""

# Naviga nella directory del progetto
cd "$(dirname "$0")" || exit 1

# Verifica di essere nella directory corretta
if [ ! -f "package.json" ]; then
    echo "❌ Errore: package.json non trovato"
    echo "Assicurati di essere nella directory RegiFarm-Pro"
    exit 1
fi

echo "✅ Directory corretta: $(pwd)"
echo ""
echo "Avvio backend, webpack e electron..."
echo ""

# Avvia l'applicazione
npm run dev

