"""
VenditaProdottoAgricolo model - Gestione vendite prodotti agricoli
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class VenditaProdottoAgricolo(Base):
    """
    Gestione vendite di prodotti agricoli (es. mais, grano, fieno)
    Permette di attribuire ricavi ai prodotti e bilanciare con costi terreni
    """
    __tablename__ = "vendite_prodotti_agricoli"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dati vendita
    prodotto = Column(String(200), nullable=False, index=True)  # 'mais', 'grano', 'fieno', etc.
    data_vendita = Column(Date, nullable=False, index=True)
    quantita = Column(Numeric(12, 3), nullable=False)  # quantità venduta
    unita_misura = Column(String(20), default='kg')  # kg, q, t
    prezzo_unitario = Column(Numeric(10, 2), nullable=False)  # prezzo per unità
    importo_totale = Column(Numeric(12, 2), nullable=False)  # quantita * prezzo_unitario
    
    # Collegamento a terreno/raccolto (opzionale)
    terreno_id = Column(Integer, ForeignKey("terreni.id", ondelete="SET NULL"), nullable=True, index=True)
    raccolto_id = Column(Integer, ForeignKey("raccolti_terreno.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Acquirente
    acquirente = Column(String(200), nullable=True)
    numero_fattura = Column(String(50), nullable=True)
    numero_ddt = Column(String(50), nullable=True)
    
    # Bilanciamento costi
    costi_terreno_totale = Column(Numeric(12, 2), default=0)  # costi totali terreno attribuiti
    costi_terreno_quantita = Column(Numeric(12, 2), default=0)  # costi per unità prodotta
    margine = Column(Numeric(12, 2), nullable=True)  # importo_totale - costi_terreno_totale
    
    # Note
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    def __repr__(self):
        return f"<VenditaProdottoAgricolo(id={self.id}, prodotto='{self.prodotto}', data={self.data_vendita})>"

