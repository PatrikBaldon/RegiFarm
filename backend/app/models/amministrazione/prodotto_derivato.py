"""
ProdottoDerivato model - Gestione prodotti derivati dalle lavorazioni
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ProdottoDerivato(Base):
    """
    Gestione prodotti derivati dalle lavorazioni (es. paglia dal grano)
    Utilizzabili per alimentazione o lettiera
    """
    __tablename__ = "prodotti_derivati"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Collegamento alla lavorazione/raccolto principale
    raccolto_id = Column(Integer, ForeignKey("raccolti_terreno.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dati prodotto derivato
    nome_prodotto = Column(String(200), nullable=False)  # 'paglia', 'tortello', etc.
    quantita_prodotta = Column(Numeric(12, 3), nullable=False)
    unita_misura = Column(String(20), default='kg')
    
    # Utilizzo
    destinazione = Column(String(50), nullable=False, index=True)  # 'alimentazione', 'lettiera', 'vendita', 'altro'
    
    # Se utilizzato per alimentazione
    componente_alimentare_id = Column(Integer, ForeignKey("componenti_alimentari.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Se venduto
    prezzo_vendita = Column(Numeric(10, 2), nullable=True)
    importo_vendita = Column(Numeric(12, 2), nullable=True)
    
    # Calcolo valore
    valore_equivalente = Column(Numeric(10, 2), nullable=True)  # valore se acquistato
    note = Column(Text, nullable=True)

    # Relazioni
    raccolto = relationship("RaccoltoTerreno", back_populates="prodotti_derivati")
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    def __repr__(self):
        return f"<ProdottoDerivato(id={self.id}, nome='{self.nome_prodotto}', destinazione='{self.destinazione}')>"

