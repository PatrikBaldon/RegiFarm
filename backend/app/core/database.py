"""
Database configuration and session management

IMPORTANT: This uses DIRECT CONNECTION to Supabase (port 5432).
DO NOT use Supabase connection pooler (port 6543) as it doesn't support
all PostgreSQL features needed for migrations and transactions.
"""
from sqlalchemy import create_engine, text, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import Pool
from .config import settings

# Create database engine with direct connection to Supabase
# IMPORTANT: This uses DIRECT CONNECTION (port 5432), NOT Supabase pooler (port 6543)
# We use SQLAlchemy's local connection pooling (different from Supabase pooler)
# Local pooling improves performance while using direct database connection
# NOTE: Supabase requires IPv6 for database connections
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    # Configurazione ottimizzata per 1GB RAM
    # Pool adeguato per gestire richieste parallele (apertura app, dashboard, etc.)
    # 5 base + 5 overflow = 10 connessioni max (ogni connessione ~10-20MB = max ~200MB per pool)
    pool_size=5,  # 5 connessioni base permanenti
    max_overflow=5,  # 5 connessioni extra in caso di picco
    pool_recycle=300,  # Ricicla connessioni ogni 5 minuti
    pool_timeout=30,  # Timeout 30s per attendere connessione disponibile
    pool_reset_on_return='commit',  # Reset automatico connessioni al ritorno al pool
    connect_args={
        "connect_timeout": 10,  # 10 second connection timeout
        "keepalives": 1,  # Enable TCP keepalives
        "keepalives_idle": 30,  # Seconds before sending keepalive
        "keepalives_interval": 10,  # Seconds between keepalives
        "keepalives_count": 5,  # Max keepalive retries
    },
    echo=False,  # Disabilita logging SQL per performance
)


# Thread tracking per il warmup
_warmup_thread = None
_warmup_complete = False


def warmup_pool():
    """Pre-create connections to reduce cold start latency"""
    import threading
    global _warmup_thread, _warmup_complete
    
    def _warmup_sync():
        """Esegue il warmup in modo sincrono in un thread separato"""
        global _warmup_complete
        try:
            # Pre-crea connessioni per ridurre cold start latency
            # Con pool_size=5, scaldiamo 2 connessioni (40% del pool base)
            connections = []
            for _ in range(2):  # 2 connessioni per warmup
                try:
                    conn = engine.connect()
                    conn.execute(text("SELECT 1"))
                    connections.append(conn)
                except Exception as e:
                    print(f"[Database] Warning: Failed to create connection during warmup: {e}")
                    # Continua con le altre connessioni anche se una fallisce
            
            # Return them to pool
            for conn in connections:
                try:
                    conn.close()
                except Exception:
                    pass
            
            if connections:
                print(f"[Database] Connection pool warmed up ({len(connections)} connections)")
            else:
                print("[Database] Warning: No connections were warmed up")
        except Exception as e:
            print(f"[Database] Pool warmup failed: {e}")
        finally:
            _warmup_complete = True
    
    # Esegui il warmup in un thread separato per non bloccare l'avvio dell'app
    # Il thread è daemon=True quindi si chiuderà automaticamente quando il processo termina
    _warmup_thread = threading.Thread(target=_warmup_sync, daemon=True)
    _warmup_thread.start()


def wait_for_warmup_complete(timeout=5.0):
    """Attende che il warmup sia completo (opzionale, per shutdown pulito)"""
    import time
    global _warmup_complete
    
    if _warmup_complete:
        return True
    
    start_time = time.time()
    while not _warmup_complete and (time.time() - start_time) < timeout:
        time.sleep(0.1)
    
    return _warmup_complete


# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class for models
Base = declarative_base()


def get_db():
    """Dependency to get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
