#!/bin/bash
# Script per avviare il server FastAPI
cd "$(dirname "$0")"
python3 -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000


