"""
FornitoreTipo model - Categorizzazione fornitori per modulo amministrazione
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class FornitoreTipo(Base):
    """
    Tabella di relazione per categorizzare fornitori per tipo di servizio
    Permette di associare fornitori a categorie specifiche dell'amministrazione
    """
    __tablename__ = "fornitori_tipi"
    
    id = Column(Integer, primary_key=True, index=True)
    fornitore_id = Column(Integer, ForeignKey("fornitori.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Categorie: 'mangimi', 'lavorazione_terreni', 'farmacia', 'veterinario', 'altro'
    categoria = Column(String(50), nullable=False, index=True)
    
    # Macrocategoria: 'nessuna', 'alimento', 'terreno', 'attrezzatura', 'sanitario', 'utilities', 'personale', 'servizi', 'assicurazioni', 'finanziario', 'amministrativo'
    macrocategoria = Column(String(50), nullable=True, index=True)
    
    # Note specifiche per questa categoria
    note = Column(String(500), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    fornitore = relationship("Fornitore", back_populates="tipi")
    
    def __repr__(self):
        return f"<FornitoreTipo(id={self.id}, fornitore_id={self.fornitore_id}, categoria='{self.categoria}')>"

