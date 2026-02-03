"""
GruppoDecessi model - Raggruppa decessi per data con certificato smaltimento
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class GruppoDecessi(Base):
    __tablename__ = "gruppi_decessi"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Data uscita (per raggruppamento)
    data_uscita = Column(Date, nullable=False, index=True)
    
    # Certificato smaltimento
    numero_certificato_smaltimento = Column(String(100), nullable=True, index=True)
    
    # Collegamento fattura smaltimento (opzionale)
    fattura_smaltimento_id = Column(Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Valore economico totale (opzionale)
    valore_economico_totale = Column(Numeric(10, 2), nullable=True)
    
    # A carico o non a carico
    a_carico = Column(Boolean, nullable=False, default=True)  # True = a carico, False = non a carico
    
    # Informazioni import
    file_anagrafe_origine = Column(String(500), nullable=True)
    data_importazione = Column(DateTime(timezone=True), nullable=True)
    
    # Note
    note = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="gruppi_decessi")
    fattura_smaltimento = relationship("FatturaAmministrazione", foreign_keys=[fattura_smaltimento_id])
    decessi = relationship("Decesso", back_populates="gruppo_decessi")
    
    def __repr__(self):
        return f"<GruppoDecessi(id={self.id}, data_uscita={self.data_uscita}, certificato={self.numero_certificato_smaltimento})>"

