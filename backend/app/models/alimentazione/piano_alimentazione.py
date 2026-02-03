from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class PianoAlimentazione(Base):
    __tablename__ = 'piani_alimentazione'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)
    descrizione = Column(Text)
    tipo_allevamento = Column(String(20))
    versione = Column(String(20))
    validita_da = Column(Date)
    validita_a = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
