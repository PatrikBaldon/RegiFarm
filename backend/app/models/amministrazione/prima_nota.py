"""
PrimaNota model - Prima nota contabile (registrazione movimenti di cassa)
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class TipoMovimento(str, enum.Enum):
    """Tipi di movimento in prima nota"""
    ENTRATA = "entrata"
    USCITA = "uscita"


class CategoriaMovimento(str, enum.Enum):
    """Categorie di movimento"""
    VENDITA = "vendita"
    ACQUISTO = "acquisto"
    STIPENDIO = "stipendio"
    AFFITTO = "affitto"
    UTILITA = "utilita"  # Bollette luce, gas, acqua
    MANUTENZIONE = "manutenzione"
    AMMORTAMENTO = "ammortamento"
    ASSICURAZIONE = "assicurazione"
    TASSE = "tasse"
    LEASING_ATTREZZATURE = "leasing_attrezzature"
    MANUTENZIONE_ATTREZZATURE = "manutenzione_attrezzature"
    ALTRO = "altro"


class TipoMovimentoType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoMovimento"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoMovimento):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoMovimento:
            if tipo.value == value:
                return tipo
        try:
            return TipoMovimento[value.upper()]
        except KeyError:
            return TipoMovimento(value)


class CategoriaMovimentoType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione CategoriaMovimento"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, CategoriaMovimento):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for categoria in CategoriaMovimento:
            if categoria.value == value:
                return categoria
        try:
            return CategoriaMovimento[value.upper()]
        except KeyError:
            return CategoriaMovimento(value)


class PrimaNota(Base):
    """
    Prima nota contabile - Registrazione di tutti i movimenti di cassa
    """
    __tablename__ = "prima_nota"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Tipo movimento
    tipo = Column(TipoMovimentoType(20), nullable=False)
    categoria = Column(CategoriaMovimentoType(20), nullable=False, server_default='altro')
    
    # Dati movimento
    data = Column(Date, nullable=False, index=True)
    importo = Column(Numeric(12, 2), nullable=False)
    
    # Descrizione
    descrizione = Column(String(500), nullable=False)
    note = Column(Text, nullable=True)
    
    # Collegamenti opzionali
    fattura_emessa_id = Column(Integer, ForeignKey("fatture_emesse.id", ondelete="SET NULL"), nullable=True, index=True)
    fattura_amministrazione_id = Column(Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True)
    pagamento_id = Column(Integer, ForeignKey("pagamenti.id", ondelete="SET NULL"), nullable=True, index=True)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Metodo pagamento
    metodo_pagamento = Column(String(50), nullable=True)  # contanti, bonifico, assegno, etc.
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="prima_nota")
    fattura_emessa = relationship("FatturaEmessa")
    fattura_amministrazione = relationship("FatturaAmministrazione")
    pagamento = relationship("Pagamento")
    attrezzatura = relationship("Attrezzatura", back_populates="registrazioni_prima_nota")
    
    def __repr__(self):
        return f"<PrimaNota(id={self.id}, tipo='{self.tipo}', importo={self.importo}, data={self.data})>"

