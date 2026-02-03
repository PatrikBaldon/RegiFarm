"""
Attrezzatura model - Attrezzature aziendali con targhe, scadenze, ammortamenti
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base


class TipoAttrezzatura(str, enum.Enum):
    """Tipi di attrezzatura"""
    VEICOLO = "veicolo"
    MACCHINARIO = "macchinario"
    STRUMENTO = "strumento"
    ATTREZZATURA = "attrezzatura"
    ALTRO = "altro"


class TipoAttrezzaturaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoAttrezzatura"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoAttrezzatura):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoAttrezzatura:
            if tipo.value == value:
                return tipo
        try:
            return TipoAttrezzatura[value.upper()]
        except KeyError:
            return TipoAttrezzatura(value)


class Attrezzatura(Base):
    """
    Attrezzature aziendali (veicoli, macchinari, strumenti, etc.)
    """
    __tablename__ = "attrezzature"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Dati base
    nome = Column(String(200), nullable=False)
    tipo = Column(TipoAttrezzaturaType(20), nullable=False, server_default='altro')
    marca = Column(String(100), nullable=True)
    modello = Column(String(100), nullable=True)
    numero_serie = Column(String(100), nullable=True, index=True)
    
    # Targa (per veicoli)
    targa = Column(String(20), nullable=True, index=True)
    
    # Dati acquisto
    data_acquisto = Column(Date, nullable=True)
    costo_acquisto = Column(Numeric(12, 2), nullable=True)
    fornitore_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Ammortamento
    valore_residuo = Column(Numeric(12, 2), nullable=True)  # Valore residuo previsto
    durata_ammortamento_anni = Column(Integer, nullable=True)  # Durata ammortamento in anni
    metodo_ammortamento = Column(String(50), nullable=True)  # 'lineare', 'degressivo', etc.
    
    # Stato
    attiva = Column(Boolean, nullable=False, server_default='true')
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="attrezzature")
    fornitore = relationship("Fornitore")
    ammortamenti = relationship("Ammortamento", back_populates="attrezzatura", cascade="all, delete-orphan")
    scadenze = relationship("ScadenzaAttrezzatura", back_populates="attrezzatura", cascade="all, delete-orphan")
    polizze = relationship("PolizzaAttrezzatura", back_populates="attrezzatura", cascade="all, delete-orphan")
    fatture_amministrazione = relationship("FatturaAmministrazione", back_populates="attrezzatura")
    movimenti_prima_nota = relationship("PNMovimento", back_populates="attrezzatura")
    registrazioni_prima_nota = relationship("PrimaNota", back_populates="attrezzatura")
    
    def __repr__(self):
        return f"<Attrezzatura(id={self.id}, nome='{self.nome}', targa='{self.targa}')>"


class TipoScadenza(str, enum.Enum):
    """Tipi di scadenza per attrezzature"""
    REVISIONE = "revisione"
    ASSICURAZIONE = "assicurazione"
    BOLLO = "bollo"
    PATENTE = "patente"  # Per veicoli
    CERTIFICAZIONE = "certificazione"
    MANUTENZIONE = "manutenzione"
    ALTRO = "altro"


class TipoScadenzaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoScadenza"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoScadenza):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        for tipo in TipoScadenza:
            if tipo.value == value:
                return tipo
        try:
            return TipoScadenza[value.upper()]
        except KeyError:
            return TipoScadenza(value)


class ScadenzaAttrezzatura(Base):
    """
    Scadenze per attrezzature (revisioni, assicurazioni, bolli, etc.)
    """
    __tablename__ = "scadenze_attrezzature"
    
    id = Column(Integer, primary_key=True, index=True)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Tipo scadenza
    tipo = Column(TipoScadenzaType(20), nullable=False)
    
    # Dati scadenza
    descrizione = Column(String(200), nullable=False)
    data_scadenza = Column(Date, nullable=False, index=True)
    data_ultimo_rinnovo = Column(Date, nullable=True)
    
    # Costo
    costo = Column(Numeric(12, 2), nullable=True)
    
    # Note
    note = Column(Text, nullable=True)
    numero_polizza = Column(String(100), nullable=True)  # Per assicurazioni
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    attrezzatura = relationship("Attrezzatura", back_populates="scadenze")
    
    def __repr__(self):
        return f"<ScadenzaAttrezzatura(id={self.id}, tipo='{self.tipo}', data_scadenza={self.data_scadenza})>"


class Ammortamento(Base):
    """
    Ammortamenti delle attrezzature
    """
    __tablename__ = "ammortamenti"
    
    id = Column(Integer, primary_key=True, index=True)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="CASCADE"), nullable=False, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False, index=True)
    
    # Periodo ammortamento
    anno = Column(Integer, nullable=False, index=True)
    mese = Column(Integer, nullable=True)  # Opzionale per ammortamenti mensili
    
    # Importi
    quota_ammortamento = Column(Numeric(12, 2), nullable=False)  # Quota di ammortamento per il periodo
    valore_residuo = Column(Numeric(12, 2), nullable=True)  # Valore residuo dopo questo ammortamento
    
    # Note
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    attrezzatura = relationship("Attrezzatura", back_populates="ammortamenti")
    azienda = relationship("Azienda")
    
    def __repr__(self):
        return f"<Ammortamento(id={self.id}, attrezzatura_id={self.attrezzatura_id}, anno={self.anno}, quota={self.quota_ammortamento})>"

