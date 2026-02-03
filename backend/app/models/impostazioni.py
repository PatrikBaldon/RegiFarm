from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.sql import func
from app.core.database import Base

class Impostazioni(Base):
    __tablename__ = 'impostazioni'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey('aziende.id'), nullable=False, index=True)
    modulo = Column(String(50), nullable=False, index=True)
    configurazione = Column(JSON, nullable=False, default={})
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Unique constraint su (azienda_id, modulo) per garantire una sola configurazione per modulo per azienda
    __table_args__ = (
        UniqueConstraint('azienda_id', 'modulo', name='uq_impostazioni_azienda_modulo'),
    )

