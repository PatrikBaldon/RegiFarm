"""
ContrattoSoccida model - Gestione contratti di soccida per bovini
"""
from sqlalchemy import Column, Integer, String, Date, Numeric, DateTime, ForeignKey, Text, Boolean, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ContrattoSoccida(Base):
    """
    Tabella per gestire i contratti di soccida
    Il soccidante è il proprietario effettivo (cliente), il soccidario è l'azienda che gestisce l'allevamento
    """
    __tablename__ = "contratti_soccida"
    
    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    soccidante_id = Column(Integer, ForeignKey("fornitori.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    # Dati contratto
    numero_contratto = Column(String(50), nullable=True, index=True)
    data_inizio = Column(Date, nullable=False)
    data_fine = Column(Date, nullable=True)  # NULL = contratto aperto
    
    # Tipologia di soccida
    # 'semplice': soccidante conferisce bestiame, soccidario presta attività
    # 'parziaria': entrambi conferiscono bestiame, soccidario fornisce attività
    # 'con_pascolo': soccidante conferisce pascolo, soccidario bestiame e lavoro
    # 'monetizzato': remunerazione monetaria fissa (flag logico separato sotto)
    tipologia = Column(String(50), nullable=False, index=True)
    # Oggetto del contratto
    specie_bestiame = Column(String(50), nullable=True, index=True)  # es. 'bovino'
    numero_capi_previsti = Column(Integer, nullable=True)
    # Direzione tecnica (per compliance: in capo al soccidante nella semplice)
    direzione_tecnica_soccidante = Column(Boolean, nullable=False, server_default='true')
    
    # Modalità di remunerazione
    # 'ripartizione_utili': ripartizione accrescimenti, prodotti e utili
    # 'quota_giornaliera': quota fissa giornaliera per capo
    # 'prezzo_kg': prezzo fisso per kg prodotto
    # 'percentuale': percentuale su vendita/accrescimento
    modalita_remunerazione = Column(String(50), nullable=False)
    # Monetizzazione della quota (soccida monetizzata)
    monetizzata = Column(Boolean, nullable=False, server_default='true')
    
    # Parametri remunerazione (dipendono dalla modalità)
    quota_giornaliera = Column(Numeric(10, 2), nullable=True)  # Per modalità quota_giornaliera
    prezzo_per_kg = Column(Numeric(10, 2), nullable=True)  # Per modalità prezzo_kg
    percentuale_remunerazione = Column(Numeric(5, 2), nullable=True)  # Per modalità percentuale
    percentuale_soccidante = Column(Numeric(5, 2), nullable=True)  # Per ripartizione_utili
    # Riparto base a favore del soccidario (per modalità ripartizione accrescimenti)
    percentuale_riparto_base = Column(Numeric(5, 2), nullable=True)
    # Bonus performance configurabili
    bonus_mortalita_attivo = Column(Boolean, nullable=False, server_default='false')  # Toggle per attivare bonus mortalità
    bonus_mortalita_percentuale = Column(Numeric(5, 2), nullable=True)  # Percentuale bonus mortalità (es. +2.00 %)
    bonus_incremento_attivo = Column(Boolean, nullable=False, server_default='false')  # Toggle per attivare bonus incremento peso
    bonus_incremento_kg_soglia = Column(Numeric(6, 2), nullable=True)  # es. 350.00 kg/capo (soglia eccedenza)
    bonus_incremento_percentuale = Column(Numeric(5, 2), nullable=True)  # es. +1.00 (%) (percentuale bonus incremento)
    
    # Gestione mangimi e medicinali
    mangimi_a_carico_soccidante = Column(Boolean, nullable=False, server_default='false')
    medicinali_a_carico_soccidante = Column(Boolean, nullable=False, server_default='false')
    
    # Gestione decessi
    quota_decesso_tipo = Column(String(20), nullable=True)  # 'fissa', 'per_capo', 'percentuale'
    quota_decesso_valore = Column(Numeric(10, 2), nullable=True)  # Valore quota decesso
    termine_responsabilita_soccidario_giorni = Column(Integer, nullable=True)  # Giorni di responsabilità soccidario
    copertura_totale_soccidante = Column(Boolean, nullable=False, server_default='false')  # Tutti i decessi a carico soccidante
    franchigia_mortalita_giorni = Column(Integer, nullable=True)  # Giorni a carico soccidante (X)
    
    # Aggiunte e sottrazioni percentuali per calcolo kg netti
    percentuale_aggiunta_arrivo = Column(Numeric(5, 2), nullable=True, server_default='0')
    percentuale_sottrazione_uscita = Column(Numeric(5, 2), nullable=True, server_default='0')
    
    # Tipo di allevamento (un solo tipo per contratto)
    tipo_allevamento = Column(String(20), nullable=True)  # 'svezzamento', 'ingrasso', 'universale', NULL
    
    # Prezzo per tipo di allevamento (esclusa IVA)
    prezzo_allevamento = Column(Numeric(10, 2), nullable=True)  # Prezzo per capo/giorno/kg (dipende da modalita_remunerazione)
    
    # IVA indetraibile (monitoraggio impatto per soccidario)
    traccia_iva_indetraibile = Column(Boolean, nullable=False, server_default='true')
    
    # Durata e rinnovo legati al ciclo
    data_prima_consegna = Column(Date, nullable=True)
    rinnovo_per_consegna = Column(Boolean, nullable=False, server_default='true')
    preavviso_disdetta_giorni = Column(Integer, nullable=False, server_default='90')
    giorni_gestione_previsti = Column(Integer, nullable=True)  # Durata prevista gestione animali (es. 180 giorni dalla data di arrivo)
    
    # Scenario ripartizione utili (per modalita_remunerazione='ripartizione_utili')
    # 'vendita_diretta': i capi vengono venduti e il ricavato viene ripartito
    # 'diventano_proprieta': i capi diventano di proprietà del soccidario, nessun movimento contabile immediato
    scenario_ripartizione = Column(String(50), nullable=True, comment="Scenario ripartizione utili: 'vendita_diretta' o 'diventano_proprieta'")
    
    # Note e condizioni
    note = Column(Text, nullable=True)
    condizioni_particolari = Column(Text, nullable=True)
    
    # Stato contratto
    attivo = Column(Boolean, nullable=False, server_default='true', index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
    
    # Relationships
    azienda = relationship("Azienda", back_populates="contratti_soccida")
    soccidante = relationship("Fornitore", back_populates="contratti_soccida")
    animali = relationship("Animale", back_populates="contratto_soccida")
    # Collegamenti finanziari/gestionali (settati sui modelli relazionati)
    fatture_amministrazione = relationship("FatturaAmministrazione", back_populates="contratto_soccida", cascade="all, delete-orphan")
    pn_movimenti = relationship("PNMovimento", back_populates="contratto_soccida", cascade="all, delete-orphan")
    partite = relationship("PartitaAnimale", back_populates="contratto_soccida", cascade="all, delete-orphan")
    decessi = relationship("Decesso", back_populates="contratto_soccida")
    report_fatture_utilizzate = relationship("ReportAllevamentoFattureUtilizzate", back_populates="contratto_soccida", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint("tipologia IN ('semplice', 'parziaria', 'con_pascolo', 'monetizzato')"),
        CheckConstraint("modalita_remunerazione IN ('ripartizione_utili', 'quota_giornaliera', 'prezzo_kg', 'percentuale')"),
        CheckConstraint("quota_decesso_tipo IN ('fissa', 'per_capo', 'percentuale') OR quota_decesso_tipo IS NULL"),
        CheckConstraint("tipo_allevamento IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento IS NULL"),
        CheckConstraint("scenario_ripartizione IN ('vendita_diretta', 'diventano_proprieta') OR scenario_ripartizione IS NULL"),
    )
    
    def __repr__(self):
        return f"<ContrattoSoccida(id={self.id}, numero={self.numero_contratto}, tipologia='{self.tipologia}')>"

