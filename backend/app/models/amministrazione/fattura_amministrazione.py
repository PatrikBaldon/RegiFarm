"""
FatturaAmministrazione model - Estensione fattura con periodo attribuzione e scadenze
"""
from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey, Text, TypeDecorator, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base
from sqlalchemy import ForeignKey


class TipoFattura(str, enum.Enum):
    """Tipi di fattura"""
    ENTRATA = "entrata"
    USCITA = "uscita"


class StatoPagamento(str, enum.Enum):
    """Stati pagamento fattura (unificato per entrate e uscite)"""
    # Stati per fatture ricevute (uscita)
    DA_PAGARE = "da_pagare"
    PAGATA = "pagata"
    # Stati per fatture emesse (entrata)
    DA_INCASSARE = "da_incassare"
    INCASSATA = "incassata"
    # Stati comuni
    SCADUTA = "scaduta"
    PARZIALE = "parziale"
    ANNULLATA = "annullata"


class TipoFatturaType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione TipoFattura"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, TipoFattura):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Cerca per valore invece che per nome
        for tipo in TipoFattura:
            if tipo.value == value:
                return tipo
        # Fallback: prova a cercare per nome (per compatibilità)
        try:
            return TipoFattura[value.upper()]
        except KeyError:
            return TipoFattura(value)


class StatoPagamentoType(TypeDecorator):
    """TypeDecorator per gestire correttamente la conversione StatoPagamento"""
    impl = String
    cache_ok = True
    
    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, StatoPagamento):
            return value.value
        return value
    
    def process_result_value(self, value, dialect):
        if value is None:
            return None
        # Cerca per valore invece che per nome
        for stato in StatoPagamento:
            if stato.value == value:
                return stato
        # Fallback: prova a cercare per nome (per compatibilità)
        try:
            # Converti da snake_case a UPPER_SNAKE_CASE
            nome = value.upper().replace(' ', '_')
            return StatoPagamento[nome]
        except KeyError:
            return StatoPagamento(value)


class FatturaAmministrazione(Base):
    """
    Estensione modello Fattura per gestione completa fatture con:
    - Periodo di attribuzione (per bollette energia/acqua post-consumo)
    - Scadenze pagamenti
    - Categorizzazione avanzata
    """
    __tablename__ = "fatture_amministrazione"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Collegamento a fattura base (opzionale, può essere standalone)
    fattura_id = Column(Integer, ForeignKey("fatture.id", ondelete="CASCADE"), nullable=True, index=True)
    
    # Collegamento azienda (obbligatorio per tipo=entrata, opzionale per tipo=uscita)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # Dati base fattura
    tipo = Column(TipoFatturaType(20), nullable=False, server_default='uscita')  # Default: uscita (fattura ricevuta)
    numero = Column(String(50), nullable=False, index=True)
    data_fattura = Column(Date, nullable=False, index=True)
    data_registrazione = Column(Date, nullable=False, server_default=func.current_date())
    divisa = Column(String(5), nullable=True)
    tipo_documento = Column(String(10), nullable=True)
    
    # Fornitore (per tipo=uscita) o Cliente (per tipo=entrata)
    fornitore_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    # Cliente (per tipo=entrata, fatture emesse)
    cliente_id = Column(Integer, ForeignKey("fornitori.id", ondelete="SET NULL"), nullable=True, index=True)
    cliente_nome = Column(String(200), nullable=True)  # Nome cliente se non è in fornitori
    cliente_piva = Column(String(50), nullable=True)
    cliente_cf = Column(String(50), nullable=True)
    
    # Importi
    importo_totale = Column(Numeric(12, 2), nullable=False)
    importo_iva = Column(Numeric(12, 2), default=0)
    importo_netto = Column(Numeric(12, 2), nullable=False)  # totale - iva
    importo_pagato = Column(Numeric(12, 2), default=0)  # Per tipo=uscita (fatture ricevute)
    importo_incassato = Column(Numeric(12, 2), default=0)  # Per tipo=entrata (fatture emesse)
    
    # Stato pagamento (unificato per entrate e uscite)
    stato_pagamento = Column(StatoPagamentoType(20), nullable=False, server_default='da_pagare')
    data_scadenza = Column(Date, nullable=True, index=True)
    data_pagamento = Column(Date, nullable=True)  # Per tipo=uscita (fatture ricevute)
    data_incasso = Column(Date, nullable=True)  # Per tipo=entrata (fatture emesse)
    condizioni_pagamento = Column(String(10), nullable=True)
    
    # Periodo di attribuzione (per bollette energia/acqua)
    periodo_da = Column(Date, nullable=True)  # inizio periodo riferimento
    periodo_a = Column(Date, nullable=True)  # fine periodo riferimento
    periodo_attribuzione = Column(String(100), nullable=True)  # descrizione periodo (es. "Gennaio 2024")
    
    # Categoria spesa (legacy - mantenuto per retrocompatibilità)
    categoria = Column(String(100), nullable=True, index=True)  # 'energia', 'acqua', 'gas', 'mangimi', 'farmaci', 'lavorazione_terreni', etc.
    
    # Categoria unificata Prima Nota (preferita se disponibile)
    categoria_id = Column(Integer, ForeignKey("pn_categorie.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Macrocategoria: 'nessuna', 'alimento', 'terreno', 'attrezzatura', 'sanitario', 'utilities', 'personale', 'servizi', 'assicurazioni', 'finanziario', 'amministrativo'
    macrocategoria = Column(String(50), nullable=True, index=True)
    
    # Collegamento a terreno (per attribuzione costi)
    terreno_id = Column(Integer, ForeignKey("terreni.id", ondelete="SET NULL"), nullable=True, index=True)
    # Collegamento ad attrezzatura (per costi mezzi/macchinari)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="SET NULL"), nullable=True, index=True)
    # Collegamento a contratto di soccida (costi attribuibili a contratto)
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Collegamenti moduli
    # Se fattura farmaci
    # Se fattura smaltimento (collegamento a decessi)
    # Se fattura mangimi
    
    # Note e allegati
    note = Column(Text, nullable=True)
    allegato_path = Column(String(500), nullable=True)  # path al file PDF/documento
    dati_xml = Column(JSON, nullable=True)  # metadati completi estratti dal tracciato
    xml_raw = Column(Text, nullable=True)  # contenuto XML originale per riferimento
    righe = Column(JSON, nullable=True)  # righe di dettaglio in formato JSON (estratte da DettaglioLinee)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Relazioni con dati strutturati
    linee = relationship(
        "FatturaAmministrazioneLinea",
        back_populates="fattura",
        cascade="all, delete-orphan",
    )
    riepiloghi = relationship(
        "FatturaAmministrazioneRiepilogo",
        back_populates="fattura",
        cascade="all, delete-orphan",
    )
    pagamenti_programmati = relationship(
        "FatturaAmministrazionePagamento",
        back_populates="fattura",
        cascade="all, delete-orphan",
    )
    ricezioni = relationship(
        "FatturaAmministrazioneRicezione",
        back_populates="fattura",
        cascade="all, delete-orphan",
    )
    attrezzatura = relationship("Attrezzatura", back_populates="fatture_amministrazione")
    contratto_soccida = relationship("ContrattoSoccida", back_populates="fatture_amministrazione")
    azienda = relationship("Azienda", back_populates="fatture_amministrazione")
    report_utilizzate = relationship("ReportAllevamentoFattureUtilizzate", back_populates="fattura", cascade="all, delete-orphan")
    cliente = relationship("Fornitore", foreign_keys=[cliente_id], backref="fatture_amministrazione_cliente")
    fornitore = relationship("Fornitore", foreign_keys=[fornitore_id], backref="fatture_amministrazione_fornitore")
    pagamenti = relationship("Pagamento", back_populates="fattura_amministrazione", cascade="all, delete-orphan")
    categoria_pn = relationship("PNCategoria", foreign_keys=[categoria_id], backref="fatture_amministrazione")
    
    def __repr__(self):
        return f"<FatturaAmministrazione(id={self.id}, numero='{self.numero}', tipo='{self.tipo}')>"

