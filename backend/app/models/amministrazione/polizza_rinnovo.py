"""
PolizzaRinnovo model - Storico rinnovi delle polizze attrezzature
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.amministrazione.polizza_attrezzatura import JSONType
from app.core.database import Base


class PolizzaRinnovo(Base):
    """
    Storico rinnovi delle polizze attrezzature con tracciamento dei cambiamenti
    """
    __tablename__ = "polizza_rinnovi"
    
    id = Column(Integer, primary_key=True, index=True)
    polizza_id = Column(Integer, ForeignKey("polizze_attrezzature.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Data rinnovo
    data_rinnovo = Column(Date, nullable=False, index=True)
    
    # Cambiamenti premio
    premio_precedente = Column(Numeric(12, 2), nullable=True)
    premio_nuovo = Column(Numeric(12, 2), nullable=False)
    
    # Cambiamenti coperture (JSON)
    coperture_precedenti = Column(JSONType, nullable=True)  # Coperture prima del rinnovo
    coperture_nuove = Column(JSONType, nullable=True)  # Coperture dopo il rinnovo
    
    # Note sui cambiamenti
    note_cambiamenti = Column(Text, nullable=True)
    
    # Nuovo periodo
    nuova_data_inizio = Column(Date, nullable=True)
    nuova_data_scadenza = Column(Date, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    polizza = relationship("PolizzaAttrezzatura", back_populates="rinnovi")
    
    def __repr__(self):
        return f"<PolizzaRinnovo(id={self.id}, polizza_id={self.polizza_id}, data_rinnovo={self.data_rinnovo})>"

