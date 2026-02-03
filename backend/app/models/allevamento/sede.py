"""
Sede model - Strutture fisiche separate
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Sede(Base):
    __tablename__ = "sedi"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False)
    nome = Column(String(100), nullable=False)
    codice_stalla = Column(String(20), unique=True, nullable=False)
    indirizzo = Column(Text, nullable=True)
    latitudine = Column(Numeric(10, 8), nullable=True)
    longitudine = Column(Numeric(11, 8), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="sedi")
    stabilimenti = relationship("Stabilimento", back_populates="sede", cascade="all, delete-orphan")

