"""
Configuration settings for RegiFarm Pro
"""
from typing import Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    # IMPORTANT: For Supabase, use DIRECT CONNECTION (port 5432), NOT the pooler (port 6543)
    # Direct connection format: postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    # DO NOT use: pooler.supabase.com or port 6543 (these are for connection pooling)
    # Default: uses postgres superuser (modify in .env file for production)
    DATABASE_URL: str = "postgresql://postgres@localhost:5432/regifarm"
    
    # Application
    APP_NAME: str = "RegiFarm Pro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = True
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Supabase integration
    SUPABASE_URL: Optional[str] = None
    SUPABASE_SERVICE_ROLE_KEY: Optional[str] = None
    SUPABASE_ANON_KEY: Optional[str] = None
    SUPABASE_TENANT_ID: Optional[str] = None
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()

