"""
Azienda model - Gestione multi-azienda
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Azienda(Base):
    __tablename__ = "aziende"
    
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String(100), nullable=False)
    partita_iva = Column(String(11), unique=True, nullable=True)
    codice_fiscale = Column(String(16), unique=True, nullable=False)
    indirizzo = Column(Text, nullable=True)
    indirizzo_cap = Column(String(10), nullable=True)
    indirizzo_comune = Column(String(120), nullable=True)
    indirizzo_provincia = Column(String(10), nullable=True)
    indirizzo_nazione = Column(String(5), nullable=True)
    telefono = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    pec = Column(String(150), nullable=True)
    codice_sdi = Column(String(10), nullable=True)
    rea_ufficio = Column(String(50), nullable=True)
    rea_numero = Column(String(50), nullable=True)
    rea_capitale_sociale = Column(String(50), nullable=True)
    referente_nome = Column(String(120), nullable=True)
    referente_email = Column(String(150), nullable=True)
    referente_telefono = Column(String(50), nullable=True)
    sito_web = Column(String(150), nullable=True)
    iban = Column(String(34), nullable=True)
    logo_storage_path = Column(String(255), nullable=True)
    logo_public_url = Column(String(500), nullable=True)
    # Supabase linkage (utente principale associato all'azienda)
    supabase_user_id = Column(UUID(as_uuid=True), unique=True, nullable=True)
    # Veterinario associato (fornitore con categoria 'veterinario')
    veterinario_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    # Sync anagrafe
    ultima_sync_anagrafe = Column(DateTime(timezone=True), nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    sedi = relationship("Sede", back_populates="azienda", cascade="all, delete-orphan")
    animali = relationship("Animale", back_populates="azienda")
    gruppi_decessi = relationship("GruppoDecessi", back_populates="azienda", cascade="all, delete-orphan")
    fatture_amministrazione = relationship("FatturaAmministrazione", back_populates="azienda", cascade="all, delete-orphan", foreign_keys="FatturaAmministrazione.azienda_id")
    pagamenti = relationship("Pagamento", back_populates="azienda", cascade="all, delete-orphan")
    prima_nota = relationship("PrimaNota", back_populates="azienda", cascade="all, delete-orphan")
    attrezzature = relationship("Attrezzatura", back_populates="azienda", cascade="all, delete-orphan")
    assicurazioni_aziendali = relationship("AssicurazioneAziendale", back_populates="azienda", cascade="all, delete-orphan")
    utenti = relationship("AziendaUtente", back_populates="azienda", cascade="all, delete-orphan")
    veterinario = relationship("Fornitore", foreign_keys=[veterinario_id])
    piani_uscita = relationship("PianoUscita", back_populates="azienda", cascade="all, delete-orphan")
    contratti_soccida = relationship("ContrattoSoccida", back_populates="azienda", cascade="all, delete-orphan")

