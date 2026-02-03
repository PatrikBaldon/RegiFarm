"""
AssicurazioneAziendale model - Assicurazioni aziendali con scadenze
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class TipoAssicurazione(str, enum.Enum):
    """Tipi di assicurazione aziendale"""
    RC_PROFESSIONALE = "rc_professionale"
    RC_STRUMENTALE = "rc_strumentale"
    INFORTUNI = "infortuni"
    MALATTIA = "malattia"
    INCENDIO = "incendio"
    FURTO = "furto"
    GRANDINE = "grandine"
    MULTIRISCHIO = "multirischio"
    ALTRO = "altro"


class TipoAssicurazioneType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoAssicurazione"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoAssicurazione):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoAssicurazione:
            if tipo.value == value:
                return tipo
        try:
            return TipoAssicurazione[value.upper()]
        except KeyError:
            return TipoAssicurazione(value)


class AssicurazioneAziendale(Base):
    """
    Assicurazioni aziendali
    """
    __tablename__ = "assicurazioni_aziendali"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Tipo assicurazione
    tipo = Column(TipoAssicurazioneType(20), nullable=False)
    
    # Dati polizza
    numero_polizza = Column(String(100), nullable=False, index=True)
    compagnia = Column(String(200), nullable=False)
    
    # Periodo copertura
    data_inizio = Column(Date, nullable=False, index=True)
    data_scadenza = Column(Date, nullable=False, index=True)
    
    # Importi
    premio_annuale = Column(Numeric(12, 2), nullable=False)
    importo_assicurato = Column(Numeric(12, 2), nullable=True)  # Massimale copertura
    
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
    azienda = relationship("Azienda", back_populates="assicurazioni_aziendali")
    
    def __repr__(self):
        return f"<AssicurazioneAziendale(id={self.id}, tipo='{self.tipo}', numero='{self.numero_polizza}')>"

