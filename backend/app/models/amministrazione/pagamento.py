"""
Pagamento model - Pagamenti ricevuti/effettuati
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class TipoPagamento(str, enum.Enum):
    """Tipi di pagamento"""
    ENTRATA = "entrata"  # Pagamento ricevuto (per fatture emesse)
    USCITA = "uscita"    # Pagamento effettuato (per fatture ricevute)


class MetodoPagamento(str, enum.Enum):
    """Metodi di pagamento"""
    CONTANTI = "contanti"
    BONIFICO = "bonifico"
    ASSEGNO = "assegno"
    CARTA = "carta"
    RID = "rid"
    ALTRO = "altro"


class TipoPagamentoType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoPagamento"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoPagamento):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoPagamento:
            if tipo.value == value:
                return tipo
        try:
            return TipoPagamento[value.upper()]
        except KeyError:
            return TipoPagamento(value)


class MetodoPagamentoType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione MetodoPagamento"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, MetodoPagamento):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for metodo in MetodoPagamento:
            if metodo.value == value:
                return metodo
        try:
            return MetodoPagamento[value.upper()]
        except KeyError:
            return MetodoPagamento(value)


class Pagamento(Base):
    """
    Pagamenti ricevuti o effettuati
    """
    __tablename__ = "pagamenti"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Tipo pagamento
    tipo = Column(TipoPagamentoType(20), nullable=False)
    
    # Collegamento a fattura (opzionale - può essere pagamento generico)
    # Unificato: usa solo fattura_amministrazione_id (fattura_emessa_id sarà deprecato)
    fattura_amministrazione_id = Column(Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True)
    # Mantenuto per compatibilità durante migrazione, sarà rimosso dopo
    fattura_emessa_id = Column(Integer, nullable=True, index=True)  # Deprecato: non più foreign key
    
    # Dati pagamento
    importo = Column(Numeric(12, 2), nullable=False)
    data_pagamento = Column(Date, nullable=False, index=True)
    data_valuta = Column(Date, nullable=True)  # Data valuta per bonifici
    
    # Metodo pagamento
    metodo = Column(MetodoPagamentoType(20), nullable=False, server_default='contanti')
    
    # Dettagli pagamento
    numero_riferimento = Column(String(100), nullable=True)  # Numero bonifico, assegno, etc.
    banca = Column(String(200), nullable=True)  # Nome banca per bonifici/assegni
    iban = Column(String(34), nullable=True)  # IBAN per bonifici
    
    # Descrizione
    descrizione = Column(String(500), nullable=True)
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="pagamenti")
    fattura_amministrazione = relationship("FatturaAmministrazione", back_populates="pagamenti")
    
    def __repr__(self):
        return f"<Pagamento(id={self.id}, tipo='{self.tipo}', importo={self.importo}, data={self.data_pagamento})>"

