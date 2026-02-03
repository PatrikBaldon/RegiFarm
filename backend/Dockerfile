# Dockerfile per RegiFarm Backend (FastAPI)
# Ottimizzato per fly.io

FROM python:3.11-slim

# Imposta variabili d'ambiente
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONHASHSEED=0 \
    MALLOC_ARENA_MAX=2

# Installa dipendenze di sistema necessarie per psycopg2
# Rimuovi build-essential dopo l'installazione per risparmiare spazio
RUN apt-get update && apt-get install -y \
    postgresql-client \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Crea directory di lavoro
WORKDIR /app

# Copia requirements e installa dipendenze Python
COPY requirements.txt .
RUN pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    apt-get purge -y build-essential && \
    apt-get autoremove -y && \
    rm -rf /tmp/* /var/tmp/* /root/.cache

# Copia il codice dell'applicazione
COPY . .

# Crea directory per i log (se necessario)
RUN mkdir -p /app/logs

# Copia e rendi eseguibile lo script di avvio
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Esponi la porta (fly.io userà la porta da fly.toml)
EXPOSE 8000

# Comando di avvio
# Nota: fly.io può iniettare variabili d'ambiente, quindi DATABASE_URL sarà disponibile
CMD ["/app/start.sh"]

