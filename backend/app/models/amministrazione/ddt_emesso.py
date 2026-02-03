"""
DdtEmesso model - Documenti di Trasporto emessi dall'azienda
"""
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Numeric, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class DdtEmesso(Base):
    """
    Documenti di Trasporto (DDT) emessi dall'azienda ai clienti/soccidanti
    """
    __tablename__ = "ddt_emessi"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Numerazione
    numero_progressivo = Column(Integer, nullable=False, index=True)  # Numero progressivo per anno (1, 2, 3...)
    anno = Column(Integer, nullable=False, index=True)  # Anno di riferimento (2026, 2027...)
    numero = Column(String(50), nullable=False, index=True)  # Numero formattato (es. "1/2026" o "001-26")
    
    # Data documento
    data = Column(Date, nullable=False, index=True)
    
    # Cliente/Destinatario (può essere un fornitore con is_cliente=True o soccidante)
    cliente_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Snapshot dati destinatario (per preservare dati storici)
    destinatario_nome = Column(String(200), nullable=True)
    destinatario_indirizzo = Column(String(500), nullable=True)
    destinatario_cap = Column(String(10), nullable=True)
    destinatario_comune = Column(String(120), nullable=True)
    destinatario_provincia = Column(String(10), nullable=True)
    destinatario_nazione = Column(String(5), nullable=True, server_default='IT')
    destinatario_piva = Column(String(50), nullable=True)
    destinatario_cf = Column(String(50), nullable=True)
    
    # Dati trasporto
    luogo_destinazione = Column(String(200), nullable=True)
    causale_trasporto = Column(String(200), nullable=True)
    aspetto_beni = Column(String(200), nullable=True)  # Es. "Imballati", "Sfusi", etc.
    
    # Dati colli e peso
    numero_colli = Column(Integer, nullable=True)
    peso_lordo = Column(Numeric(10, 3), nullable=True)  # kg
    peso_netto = Column(Numeric(10, 3), nullable=True)  # kg
    
    # Trasporto
    data_inizio_trasporto = Column(DateTime(timezone=True), nullable=True)
    trasporto_a_mezzo = Column(String(50), nullable=True)  # 'mittente', 'vettore', 'destinatario'
    vettore = Column(String(200), nullable=True)  # Nome vettore se trasporto_a_mezzo = 'vettore'
    vettore_ragione_sociale = Column(String(200), nullable=True)  # Ragione sociale vettore
    vettore_sede_legale = Column(String(500), nullable=True)  # Sede legale vettore
    vettore_partita_iva = Column(String(50), nullable=True)  # Partita IVA vettore
    vettore_licenza = Column(String(100), nullable=True)  # Licenza di trasporto vettore
    vettore_targhe = Column(String(200), nullable=True)  # Targhe veicoli utilizzati
    vettore_autista = Column(String(200), nullable=True)  # Autista designato
    data_ritiro = Column(Date, nullable=True)
    
    # Articoli/Beni trasportati (JSON array)
    # Formato: [{"descrizione": "...", "unita_misura": "kg", "quantita": 100.5}, ...]
    articoli = Column(JSON, nullable=True, default=list)
    
    # Annotazioni
    annotazioni = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", foreign_keys=[azienda_id])
    cliente = relationship("Fornitore", foreign_keys=[cliente_id])
    
    def __repr__(self):
        return f"<DdtEmesso(id={self.id}, numero='{self.numero}', data={self.data})>"

