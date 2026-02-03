"""Modello Somministrazione - Registrazione somministrazioni a animali"""
from sqlalchemy import Column, Integer, Numeric, DateTime, Date, String, Text, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Somministrazione(Base):
    """Registrazione somministrazione farmaco ad animale"""
    __tablename__ = "somministrazioni"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    animale_id = Column(Integer, ForeignKey("animali.id", ondelete="CASCADE"), nullable=False, index=True)
    farmaco_id = Column(Integer, ForeignKey("farmaci.id", ondelete="CASCADE"), nullable=False, index=True)
    lotto_farmaco_id = Column(Integer, ForeignKey("lotti_farmaco.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Dettagli somministrazione
    data_ora = Column(DateTime(timezone=True), nullable=False, default=func.now(), index=True)
    quantita = Column(Numeric(10, 2), nullable=False)
    
    # Operatore (per ora solo testo, può essere esteso con modello Utente in futuro)
    operatore_id = Column(Integer, nullable=True)  # Può essere collegato a utenti in futuro
    operatore_nome = Column(String(100))  # Nome operatore
    veterinario = Column(String(100))
    
    # Note
    note = Column(Text)
    reazioni_avverse = Column(Text)
    
    # Compliance - periodo di sospensione (giorni di attesa prima della macellazione)
    periodo_sospensione = Column(Integer)  # Giorni
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relazioni
    animale = relationship("Animale", backref="somministrazioni")
    farmaco = relationship("Farmaco", back_populates="somministrazioni")
    lotto_farmaco = relationship("LottoFarmaco", back_populates="somministrazioni")
    
    def __repr__(self):
        return f"<Somministrazione(id={self.id}, animale_id={self.animale_id}, farmaco_id={self.farmaco_id}, data={self.data_ora})>"

