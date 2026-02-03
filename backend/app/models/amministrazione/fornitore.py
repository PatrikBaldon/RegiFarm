from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Fornitore(Base):
    __tablename__ = 'fornitori'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(200), nullable=False)
    partita_iva = Column(String(20))
    indirizzo = Column(String(250))
    indirizzo_cap = Column(String(10))
    indirizzo_comune = Column(String(120))
    indirizzo_provincia = Column(String(10))
    indirizzo_nazione = Column(String(5))
    telefono = Column(String(50))
    email = Column(String(150))
    pec = Column(String(150))
    fax = Column(String(50))
    regime_fiscale = Column(String(20))
    rea_ufficio = Column(String(50))
    rea_numero = Column(String(50))
    rea_capitale_sociale = Column(String(50))
    note = Column(Text)
    # Un fornitore può essere sia fornitore che cliente (soccidante) contemporaneamente
    is_fornitore = Column(Boolean, nullable=False, server_default='true', index=True)
    is_cliente = Column(Boolean, nullable=False, server_default='false', index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    contratti_soccida = relationship("ContrattoSoccida", back_populates="soccidante", cascade="all, delete-orphan")
    tipi = relationship("FornitoreTipo", back_populates="fornitore", cascade="all, delete-orphan")

