"""
Animale model - Anagrafica completa animali
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, DateTime, ForeignKey, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Animale(Base):
    __tablename__ = "animali"
    
    id = Column(Integer, primary_key=True, index=True)
    auricolare = Column(String(20), unique=True, nullable=False)
    azienda_id = Column(Integer, ForeignKey("aziende.id"), nullable=False)
    
    # Dati anagrafici base
    specie = Column(String(20), server_default='bovino')
    razza = Column(String(50), nullable=True)
    sesso = Column(String(1), nullable=True)
    data_nascita = Column(Date, nullable=True)
    
    # Dati anagrafe nazionali
    codice_elettronico = Column(String(50), nullable=True)
    codice_madre = Column(String(20), nullable=True)
    codice_assegnato_precedenza = Column(String(20), nullable=True)
    
    # Provenienza anagrafe
    codice_azienda_anagrafe = Column(String(20), nullable=True)
    codice_provenienza = Column(String(20), nullable=True)
    identificativo_fiscale_provenienza = Column(String(20), nullable=True)
    specie_allevata_provenienza = Column(String(50), nullable=True)
    
    # Ingresso
    motivo_ingresso = Column(String(1), nullable=True)
    data_arrivo = Column(Date, nullable=False)
    peso_arrivo = Column(Numeric(6, 2), nullable=True)
    numero_modello_ingresso = Column(String(50), nullable=True)
    data_modello_ingresso = Column(Date, nullable=True)
    
    # Ciclo di vita interno
    tipo_allevamento = Column(String(20), nullable=True)
    
    # Dati fisici attuali
    peso_attuale = Column(Numeric(6, 2), nullable=True)
    data_ultima_pesata = Column(Date, nullable=True)
    
    # Uscita
    stato = Column(String(20), nullable=False, server_default='presente')
    motivo_uscita = Column(String(1), nullable=True)
    data_uscita = Column(Date, nullable=True)
    numero_modello_uscita = Column(String(50), nullable=True)
    data_modello_uscita = Column(Date, nullable=True)
    
    # Destinazione uscita
    codice_azienda_destinazione = Column(String(20), nullable=True)
    codice_fiera_destinazione = Column(String(20), nullable=True)
    codice_stato_destinazione = Column(String(20), nullable=True)
    regione_macello_destinazione = Column(String(100), nullable=True)
    codice_macello_destinazione = Column(String(20), nullable=True)
    codice_pascolo_destinazione = Column(String(20), nullable=True)
    codice_circo_destinazione = Column(String(20), nullable=True)
    
    # Macellazione
    data_macellazione = Column(Date, nullable=True)
    abbattimento = Column(String(1), nullable=True)
    data_provvvedimento = Column(Date, nullable=True)
    
    # Localizzazione attuale
    box_id = Column(Integer, ForeignKey("box.id"), nullable=True)
    data_inserimento_box = Column(DateTime(timezone=True), server_default=func.now())
    
    # Soccida
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Valore economico specifico dell'animale (in euro)
    valore = Column(Numeric(12, 2), nullable=True)
    
    # Origine e sync dati
    origine_dati = Column(String(20), nullable=False, server_default='manuale')
    ultima_sync_anagrafe = Column(DateTime(timezone=True), nullable=True)
    data_estrazione_dati_anagrafe = Column(Date, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="animali")
    box = relationship("Box", back_populates="animali")
    movimentazioni = relationship("Movimentazione", back_populates="animale", cascade="all, delete-orphan")
    decesso = relationship("Decesso", back_populates="animale", uselist=False)
    partite = relationship("PartitaAnimaleAnimale", back_populates="animale", cascade="all, delete-orphan")
    piani_uscita_link = relationship("PianoUscitaAnimale", back_populates="animale", cascade="all, delete-orphan")
    piani_uscita = relationship("PianoUscita", secondary="piani_uscita_animali", back_populates="animali", overlaps="piani_uscita_link")
    contratto_soccida = relationship("ContrattoSoccida", back_populates="animali")
    storico_tipo_allevamento = relationship("StoricoTipoAllevamento", back_populates="animale", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("sesso IN ('M', 'F') OR sesso IS NULL"),
        CheckConstraint("tipo_allevamento IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento IS NULL"),
        CheckConstraint("stato IN ('presente', 'venduto', 'deceduto', 'trasferito', 'macellato')"),
        CheckConstraint("origine_dati IN ('manuale', 'anagrafe', 'misto')"),
    )

