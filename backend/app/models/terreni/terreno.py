from sqlalchemy import Column, Integer, String, Numeric, DateTime, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Terreno(Base):
    __tablename__ = 'terreni'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey('aziende.id', ondelete='CASCADE'), nullable=False, index=True)
    denominazione = Column(String(150), nullable=False)
    localita = Column(String(200))
    superficie = Column(Numeric(10, 2))
    unita_misura = Column(String(10), default='ha')  # ettari di default
    di_proprieta = Column(Boolean, default=True)
    in_affitto = Column(Boolean, default=False)
    canone_mensile = Column(Numeric(12, 2))
    canone_annuale = Column(Numeric(12, 2))
    fattura_id = Column(Integer, ForeignKey('fatture.id'), nullable=True)
    note = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    lavorazioni = relationship("LavorazioneTerreno", back_populates="terreno", cascade="all, delete-orphan")
    raccolti = relationship("RaccoltoTerreno", back_populates="terreno", cascade="all, delete-orphan")
    cicli = relationship("CicloTerreno", back_populates="terreno", cascade="all, delete-orphan")
