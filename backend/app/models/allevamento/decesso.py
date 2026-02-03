"""
Decesso model - Registrazione decessi con dettagli economici
"""
from sqlalchemy import Column, Integer, String, Text, Numeric, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Decesso(Base):
    __tablename__ = "decessi"
    
    id = Column(Integer, primary_key=True, index=True)
    animale_id = Column(Integer, ForeignKey("animali.id"), unique=True, nullable=False)
    
    # Collegamento al gruppo decessi (per raggruppamento per data)
    gruppo_decessi_id = Column(Integer, ForeignKey("gruppi_decessi.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Informazioni decesso
    data_ora = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    causa = Column(String(100), nullable=True)
    note = Column(Text, nullable=True)
    
    # Economico
    valore_capo = Column(Numeric(10, 2), nullable=True)
    costi_fino_al_decesso = Column(Numeric(10, 2), default=0)
    perdita_totale = Column(Numeric(10, 2), nullable=True)
    
    # Contratto soccida
    tipo_contratto = Column(String(50), nullable=True)  # 'produzione_propria', 'soccida_monetizzato', etc.
    quota_decesso = Column(Numeric(10, 2), nullable=True)
    responsabile = Column(String(20), default='soccidario')  # 'soccidario', 'soccidante', 'esonero'
    giorni_dall_arrivo = Column(Integer, nullable=True)
    
    # Verifica contratto
    entro_termine_responsabilita = Column(Boolean, nullable=True)
    limite_esonero = Column(Numeric(10, 2), nullable=True)
    
    # Smaltimento
    fattura_smaltimento_id = Column(Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True)
    costo_smaltimento = Column(Numeric(10, 2), nullable=True)
    # Collegamento a contratto soccida
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Relationships
    animale = relationship("Animale", back_populates="decesso")
    gruppo_decessi = relationship("GruppoDecessi", back_populates="decessi")
    fattura_smaltimento = relationship("FatturaAmministrazione", foreign_keys=[fattura_smaltimento_id])
    contratto_soccida = relationship("ContrattoSoccida", back_populates="decessi")

