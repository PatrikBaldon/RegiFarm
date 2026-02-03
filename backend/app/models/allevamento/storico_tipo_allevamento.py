"""
StoricoTipoAllevamento model - Log dei cambi di tipo allevamento per animali
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, DateTime, ForeignKey, Text, Boolean, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class StoricoTipoAllevamento(Base):
    """
    Tabella per tracciare i cambi di tipo_allevamento degli animali
    Permette di registrare il passaggio da svezzamento a ingrasso (o viceversa)
    con peso di ingresso e possibilità di annullare il cambio
    """
    __tablename__ = "storico_tipo_allevamento"
    
    id = Column(Integer, primary_key=True, index=True)
    animale_id = Column(Integer, ForeignKey("animali.id", ondelete="CASCADE"), nullable=False, index=True)
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Tipo allevamento precedente e nuovo
    tipo_allevamento_precedente = Column(String(20), nullable=True)  # 'svezzamento', 'ingrasso', 'universale', NULL
    tipo_allevamento_nuovo = Column(String(20), nullable=False)  # 'svezzamento', 'ingrasso', 'universale'
    
    # Peso al momento del cambio (importante per calcolo spese/ricavi)
    peso_ingresso = Column(Numeric(6, 2), nullable=True)  # Peso dell'animale al cambio di gestione
    
    # Data del cambio
    data_cambio = Column(Date, nullable=False)
    
    # Note sul cambio
    note = Column(Text, nullable=True)
    
    # Flag per annullamento
    annullato = Column(Boolean, nullable=False, server_default='false')
    data_annullamento = Column(DateTime(timezone=True), nullable=True)
    motivo_annullamento = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    animale = relationship("Animale", back_populates="storico_tipo_allevamento")
    contratto_soccida = relationship("ContrattoSoccida")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("tipo_allevamento_precedente IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento_precedente IS NULL"),
        CheckConstraint("tipo_allevamento_nuovo IN ('svezzamento', 'ingrasso', 'universale')"),
    )
    
    def __repr__(self):
        return f"<StoricoTipoAllevamento(id={self.id}, animale_id={self.animale_id}, {self.tipo_allevamento_precedente} -> {self.tipo_allevamento_nuovo})>"

