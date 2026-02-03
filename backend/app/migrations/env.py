"""
Alembic environment configuration

IMPORTANT: Uses DIRECT CONNECTION to Supabase (port 5432).
DO NOT use Supabase connection pooler (port 6543) as migrations require
direct database access and full PostgreSQL transaction support.
"""
from logging.config import fileConfig
from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.database import Base
from app.core.config import settings
from app.models.allevamento import *  # Import all models
from app.models.sanitario import *  # Import sanitario models
from app.models.amministrazione import *  # Import amministrazione models
from app.models.alimentazione import *  # Import alimentazione models

# this is the Alembic Config object
config = context.config

# Override sqlalchemy.url with settings
# Must use direct connection (port 5432), NOT pooler (port 6543)
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# add your model's MetaData object here
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    try:
        connectable = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )

        with connectable.connect() as connection:
            context.configure(
                connection=connection, target_metadata=target_metadata
            )

            with context.begin_transaction():
                context.run_migrations()
    except Exception as e:
        error_msg = str(e)
        if "could not translate host name" in error_msg or "nodename nor servname provided" in error_msg:
            db_url = config.get_main_option("sqlalchemy.url")
            hostname = db_url.split("@")[1].split(":")[0] if "@" in db_url else "unknown"
            print("\n" + "="*80)
            print("❌ DATABASE CONNECTION ERROR")
            print("="*80)
            print(f"\nCannot resolve database hostname: {hostname}")
            print("\nPossible causes:")
            print("  1. The Supabase project may be paused or deleted")
            print("  2. The database hostname in DATABASE_URL is incorrect")
            print("  3. Network connectivity issue")
            print("\nSolutions:")
            print("  1. Check your Supabase project status in the Supabase dashboard")
            print("  2. Verify the DATABASE_URL in your .env file uses DIRECT CONNECTION")
            print("     - Use: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres")
            print("     - DO NOT use: pooler.supabase.com or port 6543 (connection pooler)")
            print("  3. Ensure the project is active and not paused")
            print("  4. For local development, use: postgresql://postgres@localhost:5432/regifarm")
            print("\n⚠️  IMPORTANT: Migrations require DIRECT CONNECTION (port 5432), not the pooler!")
            print("\nTo use offline mode (generate SQL without connecting):")
            print("  alembic upgrade head --sql")
            print("="*80 + "\n")
        raise


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

