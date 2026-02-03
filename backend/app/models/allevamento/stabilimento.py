"""
Stabilimento model - Edifici/capannoni per ogni sede
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Stabilimento(Base):
    __tablename__ = "stabilimenti"
    
    id = Column(Integer, primary_key=True, index=True)
    sede_id = Column(Integer, ForeignKey("sedi.id"), nullable=False)
    nome = Column(String(100), nullable=False)
    tipo = Column(String(50), nullable=True)  # Riscaldato, ventilato, etc.
    capacita_totale = Column(Integer, nullable=True)  # Numero massimo capi
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    sede = relationship("Sede", back_populates="stabilimenti")
    box = relationship("Box", back_populates="stabilimento", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('sede_id', 'nome', name='uq_stabilimento_sede_nome'),
    )

