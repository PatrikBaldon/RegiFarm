"""
Movimentazione model - Tracciamento tutti gli spostamenti
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Movimentazione(Base):
    __tablename__ = "movimentazioni"
    
    id = Column(Integer, primary_key=True, index=True)
    animale_id = Column(Integer, ForeignKey("animali.id"), nullable=False)
    
    # Da dove
    da_box_id = Column(Integer, ForeignKey("box.id"), nullable=True)
    
    # Verso dove
    a_box_id = Column(Integer, ForeignKey("box.id"), nullable=False)
    
    # Quando e chi
    data_ora = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    operatore_id = Column(Integer, nullable=True)  # TODO: ForeignKey to utenti when available
    motivo = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    animale = relationship("Animale", back_populates="movimentazioni")
    da_box = relationship("Box", foreign_keys=[da_box_id], back_populates="movimentazioni_da")
    a_box = relationship("Box", foreign_keys=[a_box_id], back_populates="movimentazioni_a")

