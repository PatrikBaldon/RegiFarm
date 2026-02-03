"""
PolizzaPagamento model - Pagamenti delle polizze attrezzature
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PolizzaPagamento(Base):
    """
    Pagamenti delle polizze attrezzature (collegati automaticamente a Prima Nota)
    """
    __tablename__ = "polizza_pagamenti"
    
    id = Column(Integer, primary_key=True, index=True)
    polizza_id = Column(Integer, ForeignKey("polizze_attrezzature.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dati pagamento
    importo = Column(Numeric(12, 2), nullable=False)
    data_pagamento = Column(Date, nullable=False, index=True)
    
    # Rata
    numero_rate = Column(Integer, nullable=True)  # Numero totale rate
    rata_numero = Column(Integer, nullable=True)  # Numero della rata corrente (1, 2, 3, ...)
    
    # Collegamento a Prima Nota (automatico)
    prima_nota_movimento_id = Column(Integer, ForeignKey("pn_movimenti.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Note
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    polizza = relationship("PolizzaAttrezzatura", back_populates="pagamenti")
    prima_nota_movimento = relationship("PNMovimento")
    
    def __repr__(self):
        return f"<PolizzaPagamento(id={self.id}, polizza_id={self.polizza_id}, importo={self.importo}, data={self.data_pagamento})>"

