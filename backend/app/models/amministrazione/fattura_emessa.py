"""
FatturaEmessa model - Fatture emesse dall'azienda ai clienti
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base
from sqlalchemy import ForeignKey


class StatoPagamentoFatturaEmessa(str, enum.Enum):
    """Stati pagamento fattura emessa"""
    DA_INCASSARE = "da_incassare"
    INCASSATA = "incassata"
    SCADUTA = "scaduta"
    PARZIALE = "parziale"
    ANNULLATA = "annullata"


class StatoPagamentoFatturaEmessaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione StatoPagamentoFatturaEmessa"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, StatoPagamentoFatturaEmessa):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for stato in StatoPagamentoFatturaEmessa:
            if stato.value == value:
                return stato
        try:
            return StatoPagamentoFatturaEmessa[value.upper().replace(' ', '_')]
        except KeyError:
            return StatoPagamentoFatturaEmessa(value)


class FatturaEmessa(Base):
    """
    Fatture emesse dall'azienda ai clienti
    """
    __tablename__ = "fatture_emesse"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Dati fattura
    numero = Column(String(50), nullable=False, index=True)
    data_fattura = Column(Date, nullable=False, index=True)
    data_registrazione = Column(Date, nullable=False, server_default=func.current_date())
    
    # Cliente (può essere un fornitore o cliente esterno)
    cliente_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    cliente_nome = Column(String(200), nullable=True)  # Nome cliente se non è in fornitori
    cliente_piva = Column(String(50), nullable=True)
    cliente_cf = Column(String(50), nullable=True)
    
    # Importi
    importo_totale = Column(Numeric(12, 2), nullable=False)
    importo_iva = Column(Numeric(12, 2), default=0)
    importo_netto = Column(Numeric(12, 2), nullable=False)  # totale - iva
    importo_incassato = Column(Numeric(12, 2), default=0)
    
    # Stato pagamento
    stato_pagamento = Column(StatoPagamentoFatturaEmessaType(20), nullable=False, server_default='da_incassare')
    data_scadenza = Column(Date, nullable=True, index=True)
    data_incasso = Column(Date, nullable=True)
    
    # IVA
    aliquota_iva = Column(Numeric(5, 2), default=0)  # Percentuale IVA
    
    # Categoria vendita
    categoria = Column(String(100), nullable=True, index=True)  # 'carne', 'latte', 'formaggi', 'animali', 'altro'
    
    # Macrocategoria: 'nessuna', 'alimento', 'terreno', 'attrezzatura', 'sanitario', 'utilities', 'personale', 'servizi', 'assicurazioni', 'finanziario', 'amministrativo'
    macrocategoria = Column(String(50), nullable=True, index=True)
    
    # Collegamento a terreno (per attribuzione costi e ricavi)
    terreno_id = Column(Integer, ForeignKey("terreni.id", ondelete="SET NULL"), nullable=True, index=True)
    # Collegamento a contratto di soccida (ricavi attribuibili a contratto)
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Note e allegati
    note = Column(Text, nullable=True)
    allegato_path = Column(String(500), nullable=True)  # path al file PDF/documento
    dati_xml = Column(JSON, nullable=True)  # metadati completi estratti dal tracciato XML
    xml_raw = Column(Text, nullable=True)  # contenuto XML originale per consultazione
    righe = Column(JSON, nullable=True)  # righe di dettaglio in formato JSON (estratte da DettaglioLinee)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    # NOTE: Questo modello è deprecato e sarà rimosso. Le relazioni sono state disabilitate.
    # azienda = relationship("Azienda", back_populates="fatture_emesse")  # Rimossa: relazione non esiste più
    cliente = relationship("Fornitore", foreign_keys=[cliente_id])
    terreno = relationship("Terreno", foreign_keys=[terreno_id])
    # pagamenti = relationship("Pagamento", back_populates="fattura_emessa", cascade="all, delete-orphan")  # Rimossa: usa fattura_amministrazione_id
    # contratto_soccida = relationship("ContrattoSoccida", back_populates="fatture_emesse")  # Rimossa: relazione non esiste più
    
    def __repr__(self):
        return f"<FatturaEmessa(id={self.id}, numero='{self.numero}', importo={self.importo_totale})>"

