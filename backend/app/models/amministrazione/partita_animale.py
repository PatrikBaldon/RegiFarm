"""
PartitaAnimale model - Gestione partite animali per sincronizzazione anagrafe
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    Date,
    ForeignKey,
    Text,
    Enum as SQLEnum,
    TypeDecorator,
    Boolean,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base
from sqlalchemy import ForeignKey


class TipoPartita(str, enum.Enum):
    """Tipi di partita"""
    INGRESSO = "ingresso"
    USCITA = "uscita"


class ModalitaGestionePartita(str, enum.Enum):
    """Modalità di gestione economica della partita"""
    PROPRIETA = "proprieta"
    SOCCIDA_MONETIZZATA = "soccida_monetizzata"
    SOCCIDA_FATTURATA = "soccida_fatturata"


class TipoPartitaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoPartita"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoPartita):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Cerca per valore invece che per nome
        for tipo in TipoPartita:
            if tipo.value == value:
                return tipo
        # Fallback: prova a cercare per nome (per compatibilità)
        try:
            return TipoPartita[value.upper()]
        except KeyError:
            # Se non trova, prova il valore lowercase
            return TipoPartita(value)


class PartitaAnimale(Base):
    """
    Gestione partite animali per sincronizzazione con anagrafe nazionale
    Permette di creare partite in ingresso/uscita con dati aggregati
    """
    __tablename__ = "partite_animali"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Tipo partita
    tipo = Column(TipoPartitaType(20), nullable=False, index=True)
    
    # Dati partita
    data = Column(Date, nullable=False, index=True)
    numero_partita = Column(String(50), nullable=True, unique=True, index=True)  # numero univoco partita
    
    # Provenienza/Destinazione (esterna)
    codice_stalla = Column(String(20), nullable=False, index=True)  # codice stalla provenienza/destinazione esterna
    nome_stalla = Column(String(200), nullable=True)  # nome leggibile stalla esterna
    
    # Codice stalla dell'allevamento dell'utente
    codice_stalla_azienda = Column(String(20), nullable=True, index=True)  # codice stalla dell'allevamento dell'utente (destinazione per ingressi, provenienza per uscite)
    
    # Dati aggregati
    numero_capi = Column(Integer, nullable=False)  # numero capi nella partita
    peso_totale = Column(Numeric(10, 2), nullable=True)  # peso totale (se disponibile)
    peso_medio = Column(Numeric(6, 2), nullable=True)  # peso medio per capo
    
    # Modalità economica
    # NULL per trasferimenti interni tra allevamenti gestiti o uscite verso allevamenti non gestiti
    modalita_gestione = Column(
        SQLEnum(
            ModalitaGestionePartita,
            name="partita_modalita_gestione",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=True,
        default=None,
    )
    costo_unitario = Column(Numeric(12, 2), nullable=True)
    valore_totale = Column(Numeric(12, 2), nullable=True)
    fattura_amministrazione_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    fattura_emessa_id = Column(
        Integer,
        ForeignKey("fatture_emesse.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # Collegamento a contratto soccida
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Pesi per capo (se inseriti manualmente)
    # JSON string con array di pesi [{"auricolare": "IT123", "peso": 450}, ...]
    pesi_individuali = Column(Text, nullable=True)
    
    # Collegamento anagrafe
    file_anagrafe_origine = Column(String(500), nullable=True)  # path file .gzip originale
    data_importazione = Column(DateTime(timezone=True), nullable=True)
    
    # Dati movimento
    motivo = Column(String(1), nullable=True)  # motivo ingresso/uscita (K, A, N, V, M, etc.)
    numero_modello = Column(String(50), nullable=True)  # numero modello movimento
    
    # Tipo trasferimento
    is_trasferimento_interno = Column(Boolean, nullable=False, default=False)  # True se trasferimento interno, False se esterno
    
    # Note
    note = Column(Text, nullable=True)
    
    # Chiusura partita (saldo a chiusura soccida): se valorizzata la partita non compare più in acconti/saldi
    data_chiusura = Column(Date, nullable=True, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    animali_partita = relationship("PartitaAnimaleAnimale", back_populates="partita", cascade="all, delete-orphan")
    movimenti_finanziari = relationship(
        "PartitaMovimentoFinanziario",
        back_populates="partita",
        cascade="all, delete-orphan",
    )
    movimenti_prima_nota = relationship(
        "PNMovimento",
        back_populates="partita",
        primaryjoin="PartitaAnimale.id==PNMovimento.partita_id",
    )
    fattura_amministrazione = relationship("FatturaAmministrazione", foreign_keys=[fattura_amministrazione_id])
    fattura_emessa = relationship("FatturaEmessa", foreign_keys=[fattura_emessa_id])
    contratto_soccida = relationship("ContrattoSoccida", back_populates="partite")
    
    def __repr__(self):
        return (
            f"<PartitaAnimale(id={self.id}, tipo='{self.tipo}', data={self.data}, capi={self.numero_capi}, "
            f"modalita='{self.modalita_gestione}')>"
        )

