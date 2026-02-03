from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class LavorazioneTerreno(Base):
    __tablename__ = 'lavorazioni_terreno'

    id = Column(Integer, primary_key=True)
    azienda_id = Column(Integer, ForeignKey('aziende.id', ondelete='CASCADE'), nullable=False, index=True)
    terreno_id = Column(Integer, ForeignKey('terreni.id', ondelete='CASCADE'), index=True)
    data = Column(Date)
    tipo = Column(String(50))
    fattura_id = Column(Integer, ForeignKey('fatture.id', ondelete='SET NULL'), nullable=True, index=True)
    costo_totale = Column(Numeric(12, 2))
    note = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    terreno = relationship("Terreno", back_populates="lavorazioni")
