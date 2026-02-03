"""
Tabella di join tra PartitaAnimale e Animale
Permette di tracciare tutti i movimenti di ogni animale attraverso le partite
"""
from sqlalchemy import Column, Integer, ForeignKey, DateTime, Numeric, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class PartitaAnimaleAnimale(Base):
    """
    Tabella di join per collegare animali alle partite
    Traccia ogni movimento dell'animale attraverso le partite
    """
    __tablename__ = "partita_animale_animali"
    
    id = Column(Integer, primary_key=True, index=True)
    partita_animale_id = Column(Integer, ForeignKey("partite_animali.id", ondelete="CASCADE"), nullable=False, index=True)
    animale_id = Column(Integer, ForeignKey("animali.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Peso specifico dell'animale in questa partita (può differire dal peso medio)
    peso = Column(Numeric(6, 2), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    partita = relationship("PartitaAnimale", back_populates="animali_partita")
    animale = relationship("Animale", back_populates="partite")
    
    # Unique constraint per evitare duplicati (un animale non può essere nella stessa partita due volte)
    __table_args__ = (
        UniqueConstraint('partita_animale_id', 'animale_id', name='uq_partita_animale_animale'),
    )

