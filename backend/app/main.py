"""
RegiFarm Pro - FastAPI Backend
Main application entry point
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import OperationalError
import logging
import traceback

from app.api.v1.endpoints import alimentazione
from app.api.v1.endpoints import allevamento, aziende, sanitario
from app.api.v1.endpoints import amministrazione, attrezzatura, impostazioni, statistiche, terreni
from app.api.v1.endpoints import onboarding
from app.api.v1.endpoints import sync
from app.api.v1.endpoints import compatibility
from app.core.database import warmup_pool

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Startup: Pre-warm database connection pool
    # Riabilitato con 2 connessioni per ridurre cold start latency
    warmup_pool()
    
    # ML RIMOSSO: sklearn/numpy/pandas occupavano ~200-300MB di RAM
    # causando OOM su Fly.io con 512MB/1GB di memoria
    # Se necessario in futuro, usare un worker separato o servizio esterno
    
    yield
    # Shutdown: Close database connections gracefully
    try:
        from app.core.database import engine, wait_for_warmup_complete
        # Attendi che il warmup finisca se è ancora in corso (al massimo 1 secondo)
        wait_for_warmup_complete(timeout=1.0)
        logger.info("Closing database connection pool...")
        engine.dispose(close=True)
        logger.info("Database connection pool closed successfully")
    except Exception as e:
        logger.error(f"Error closing database connections: {e}")


app = FastAPI(
    title="RegiFarm Pro API",
    description="Backend API for RegiFarm Pro - Beef Cattle Farm Management System",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# GZip compression middleware - comprime risposte > 1000 bytes
# Riduce bandwidth del 60-80% senza impatto significativo su CPU
app.add_middleware(GZipMiddleware, minimum_size=1000)


# Global exception handler for database connection errors
@app.exception_handler(OperationalError)
async def database_error_handler(request: Request, exc: OperationalError):
    """Handle database connection errors with user-friendly messages"""
    error_msg = str(exc.orig) if hasattr(exc, 'orig') else str(exc)
    
    # Check for DNS resolution errors (common during Supabase maintenance)
    if "could not translate host name" in error_msg or "nodename nor servname provided" in error_msg:
        logger.error(f"Database DNS resolution error: {error_msg}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": "Errore di connessione al database. L'hostname del database non può essere risolto. "
                         "Questo potrebbe essere dovuto a manutenzione di Supabase o al progetto pausato. "
                         "Verifica lo stato del progetto nella dashboard Supabase.",
                "error_type": "database_connection_error",
                "suggestions": [
                    "Verifica che il progetto Supabase sia attivo nella dashboard",
                    "Controlla se c'è manutenzione in corso su https://status.supabase.com",
                    "Verifica che il DATABASE_URL nel file .env sia corretto",
                    "Assicurati di usare la connessione diretta (porta 5432), non il pooler"
                ]
            }
        )
    
    # Other database connection errors
    logger.error(f"Database operational error: {error_msg}")
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "detail": "Errore di connessione al database. Il servizio potrebbe essere temporaneamente non disponibile.",
            "error_type": "database_error",
            "error": error_msg
        }
    )


# Global exception handler per errori 500 - logga traceback completo per debug
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    """Logga eccezioni non gestite e restituisce 500 con messaggio generico"""
    tb = traceback.format_exc()
    logger.error(f"Unhandled exception: {exc}\n{tb}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Errore interno del server. Contatta il supporto se il problema persiste.",
        }
    )


# Include routers
app.include_router(aziende.router, prefix="/api/v1")
app.include_router(allevamento.router, prefix="/api/v1")
app.include_router(sanitario.router, prefix="/api/v1")
app.include_router(alimentazione.router, prefix="/api/v1")
app.include_router(terreni.router, prefix="/api/v1")
app.include_router(amministrazione.router, prefix="/api/v1")
app.include_router(attrezzatura.router, prefix="/api/v1")
app.include_router(impostazioni.router, prefix="/api/v1")
app.include_router(statistiche.router, prefix="/api/v1")
app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(sync.router, prefix="/api/v1")
# Compatibility router for backward compatibility with frontend API calls
app.include_router(compatibility.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "RegiFarm Pro API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint - fast version for fly.io"""
    # Versione veloce senza test database (per evitare timeout su fly.io)
    # Il database viene testato solo quando necessario
    return {
        "status": "healthy",
        "service": "regifarm-pro-api",
        "version": "1.0.0"
    }

@app.get("/health/detailed")
async def health_check_detailed():
    """Detailed health check with database connectivity test"""
    from app.core.database import engine
    from sqlalchemy import text
    
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        
        return {
            "status": "healthy",
            "service": "regifarm-pro-api",
            "database": "connected"
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "regifarm-pro-api",
                "database": "disconnected",
                "error": str(e)
            }
        )


if __name__ == "__main__":
    import uvicorn
    import signal
    import sys

    def signal_handler(sig, frame):
        """Handle shutdown signals gracefully"""
        logger.info("Received shutdown signal, closing gracefully...")
        try:
            from app.core.database import engine, wait_for_warmup_complete
            # Attendi che il warmup finisca se è ancora in corso (al massimo 0.5 secondi)
            wait_for_warmup_complete(timeout=0.5)
            engine.dispose(close=True)
            logger.info("Database connections closed")
        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
        sys.exit(0)

    # Register signal handlers for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    uvicorn.run(app, host="0.0.0.0", port=8000)

