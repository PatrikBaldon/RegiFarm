"""Modello LottoFarmaco - Magazzino medicinali per azienda"""
from sqlalchemy import Column, Integer, String, Numeric, Date, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class LottoFarmaco(Base):
    """Magazzino medicinali - Lotti di farmaci per azienda"""
    __tablename__ = "lotti_farmaco"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Foreign keys
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    farmaco_id = Column(Integer, ForeignKey("farmaci.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dati lotto
    lotto = Column(String(50), nullable=False)
    scadenza = Column(Date, index=True)
    
    # Quantità
    quantita_iniziale = Column(Numeric(10, 2), nullable=False, server_default="0")
    quantita_rimanente = Column(Numeric(10, 2), nullable=False, server_default="0")
    
    # Fornitore (opzionale)
    fornitore = Column(String(200))
    numero_fattura = Column(String(100))
    data_acquisto = Column(Date)
    
    # Note
    note = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('quantita_iniziale >= 0', name='check_quantita_iniziale_positiva'),
        CheckConstraint('quantita_rimanente >= 0', name='check_quantita_rimanente_positiva'),
        CheckConstraint('quantita_rimanente <= quantita_iniziale', name='check_quantita_rimanente_logic'),
    )
    
    # Relazioni
    azienda = relationship("Azienda", backref="lotti_farmaco")
    farmaco = relationship("Farmaco", back_populates="lotti")
    somministrazioni = relationship("Somministrazione", back_populates="lotto_farmaco")
    
    def __repr__(self):
        return f"<LottoFarmaco(id={self.id}, azienda_id={self.azienda_id}, farmaco_id={self.farmaco_id}, lotto='{self.lotto}', rimanente={self.quantita_rimanente})>"

