"""
PolizzaAttrezzatura model - Gestione polizze assicurative per attrezzature
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator, Boolean, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
import json
from app.core.database import Base


class TipoPolizza(str, enum.Enum):
    """Tipi di polizza assicurativa"""
    RCA = "rca"  # Responsabilità Civile Auto
    KASKO = "kasko"  # Casco
    FURTO = "furto"
    INCENDIO = "incendio"
    INFORTUNI = "infortuni"
    MULTIRISCHIO = "multirischio"
    ALTRO = "altro"


class TipoPolizzaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoPolizza"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoPolizza):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoPolizza:
            if tipo.value == value:
                return tipo
        try:
            return TipoPolizza[value.upper()]
        except KeyError:
            return TipoPolizza(value)


class JSONType(TypeDecorator):
    """TypeDecorator per gestire campi JSON"""
    impl = Text
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, dict):
            return json.dumps(value)
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, str):
            try:
                return json.loads(value)
            except (json.JSONDecodeError, TypeError):
                return {}
        return value


class PolizzaAttrezzatura(Base):
    """
    Polizze assicurative per attrezzature
    """
    __tablename__ = "polizze_attrezzature"
    
    id = Column(Integer, primary_key=True, index=True)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="CASCADE"), nullable=False, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Tipo polizza
    tipo_polizza = Column(TipoPolizzaType(20), nullable=False)
    
    # Dati polizza
    numero_polizza = Column(String(100), nullable=False, index=True)
    compagnia = Column(String(200), nullable=False)
    
    # Periodo copertura
    data_inizio = Column(Date, nullable=False, index=True)
    data_scadenza = Column(Date, nullable=False, index=True)
    
    # Importi
    premio_annuale = Column(Numeric(12, 2), nullable=False)
    importo_assicurato = Column(Numeric(12, 2), nullable=True)  # Massimale copertura
    
    # Coperture (JSON: lista di coperture incluse)
    coperture = Column(JSONType, nullable=True)  # Es: ["RCA", "Furto", "Incendio"]
    
    # Pagamenti
    numero_rate = Column(Integer, nullable=True, server_default='1')  # Numero rate annuali
    data_prossimo_pagamento = Column(Date, nullable=True)
    
    # Note
    note = Column(Text, nullable=True)
    allegato_path = Column(String(500), nullable=True)  # path al file polizza
    
    # Stato
    attiva = Column(Boolean, nullable=False, server_default='true')
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    attrezzatura = relationship("Attrezzatura", back_populates="polizze")
    azienda = relationship("Azienda")
    pagamenti = relationship("PolizzaPagamento", back_populates="polizza", cascade="all, delete-orphan")
    rinnovi = relationship("PolizzaRinnovo", back_populates="polizza", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<PolizzaAttrezzatura(id={self.id}, tipo='{self.tipo_polizza}', numero='{self.numero_polizza}')>"

