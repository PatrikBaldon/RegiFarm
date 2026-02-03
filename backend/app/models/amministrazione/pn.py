from __future__ import annotations

from enum import Enum
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from sqlalchemy import ForeignKey


class PNContoTipo(str, Enum):
    CASSA = "cassa"
    BANCA = "banca"
    ALTRO = "altro"


class PNGirocontoStrategia(str, Enum):
    AUTOMATICO = "automatico"
    MANUALE = "manuale"


class PNTipoOperazione(str, Enum):
    ENTRATA = "entrata"
    USCITA = "uscita"
    GIROCONTO = "giroconto"


class PNStatoMovimento(str, Enum):
    PROVVISORIO = "provvisorio"
    DEFINITIVO = "definitivo"


class PNMovimentoOrigine(str, Enum):
    MANUALE = "manuale"
    AUTOMATICO = "automatico"
    RICONCILIAZIONE = "riconciliazione"
    GIROCONTO = "giroconto"


class PNDocumentoTipo(str, Enum):
    FATTURA_EMESSA = "fattura_emessa"
    FATTURA_AMMINISTRAZIONE = "fattura_amministrazione"
    NOTA_CREDITO = "nota_credito"
    NOTA_DEBITO = "nota_debito"
    ALTRO = "altro"


class PNConto(Base):
    __tablename__ = "pn_conti"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    tipo = Column(
        SQLEnum(
            PNContoTipo,
            name="pn_conto_tipo",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=PNContoTipo.CASSA.value,
    )
    saldo_iniziale = Column(Numeric(12, 2), nullable=False, default=0)
    saldo_attuale = Column(Numeric(12, 2), nullable=False, default=0)
    attivo = Column(Boolean, nullable=False, default=True)
    note = Column(Text, nullable=True)
    giroconto_strategia = Column(
        SQLEnum(
            PNGirocontoStrategia,
            name="pn_giroconto_strategia",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=PNGirocontoStrategia.AUTOMATICO.value,
    )
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    movimenti = relationship(
        "PNMovimento",
        back_populates="conto",
        primaryjoin="and_(PNConto.id==PNMovimento.conto_id, PNMovimento.deleted_at.is_(None))",
    )
    ibans = relationship(
        "PNContoIban",
        back_populates="conto",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        UniqueConstraint("azienda_id", "nome", name="uq_pn_conti_azienda_nome"),
    )


class PNPreferenze(Base):
    __tablename__ = "pn_preferenze"

    id = Column(Integer, primary_key=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), unique=True, nullable=False)
    conto_predefinito_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="SET NULL"), nullable=True)
    conto_incassi_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="SET NULL"), nullable=True)
    conto_pagamenti_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="SET NULL"), nullable=True)
    conto_debiti_fornitori_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="SET NULL"), nullable=True)
    conto_crediti_clienti_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    conto_predefinito = relationship("PNConto", foreign_keys=[conto_predefinito_id])
    conto_incassi = relationship("PNConto", foreign_keys=[conto_incassi_id])
    conto_pagamenti = relationship("PNConto", foreign_keys=[conto_pagamenti_id])
    conto_debiti_fornitori = relationship("PNConto", foreign_keys=[conto_debiti_fornitori_id])
    conto_crediti_clienti = relationship("PNConto", foreign_keys=[conto_crediti_clienti_id])


class PNCategoria(Base):
    __tablename__ = "pn_categorie"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    codice = Column(String(60), nullable=True)
    tipo_operazione = Column(
        SQLEnum(
            PNTipoOperazione,
            name="pn_categoria_tipo_operazione",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    descrizione = Column(Text, nullable=True)
    ordine = Column(Integer, nullable=False, default=0)
    attiva = Column(Boolean, nullable=False, default=True)
    creata_dal_sistema = Column(Boolean, nullable=False, default=False)
    # Flag per indicare se la categoria richiede l'associazione di un terreno
    richiede_terreno = Column(Boolean, nullable=False, default=False)
    # Flag per indicare se la categoria richiede l'associazione di un'attrezzatura
    richiede_attrezzatura = Column(Boolean, nullable=False, default=False)
    # Macrocategoria per compatibilità con sistema fatture (opzionale)
    macrocategoria = Column(String(50), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("azienda_id", "nome", "tipo_operazione", name="uq_pn_categoria_per_azienda"),
    )


class PNMovimento(Base):
    __tablename__ = "pn_movimenti"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    conto_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="CASCADE"), nullable=False, index=True)
    conto_destinazione_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="CASCADE"), nullable=True, index=True)
    categoria_id = Column(Integer, ForeignKey("pn_categorie.id", ondelete="SET NULL"), nullable=True, index=True)
    tipo_operazione = Column(
        SQLEnum(
            PNTipoOperazione,
            name="pn_movimento_tipo_operazione",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    stato = Column(
        SQLEnum(
            PNStatoMovimento,
            name="pn_movimento_stato",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=PNStatoMovimento.DEFINITIVO.value,
    )
    origine = Column(
        SQLEnum(
            PNMovimentoOrigine,
            name="pn_movimento_origine",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=PNMovimentoOrigine.MANUALE.value,
    )
    data = Column(Date, nullable=False, index=True)
    descrizione = Column(String(500), nullable=False)
    note = Column(Text, nullable=True)
    importo = Column(Numeric(12, 2), nullable=False)
    quota_extra = Column(Numeric(12, 2), nullable=True)
    contropartita_nome = Column(String(200), nullable=True)
    metodo_pagamento = Column(String(80), nullable=True)
    documento_riferimento = Column(String(120), nullable=True)
    riferimento_esterno = Column(String(120), nullable=True)
    # DEPRECATO: mantieni per compatibilità durante migrazione, ma non più foreign key
    fattura_emessa_id = Column(Integer, nullable=True, index=True)  # ForeignKey rimosso: tabella fatture_emesse non esiste più
    fattura_amministrazione_id = Column(Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True)
    pagamento_id = Column(Integer, ForeignKey("pagamenti.id", ondelete="SET NULL"), nullable=True, index=True)
    partita_id = Column(Integer, ForeignKey("partite_animali.id", ondelete="SET NULL"), nullable=True, index=True)
    attrezzatura_id = Column(Integer, ForeignKey("attrezzature.id", ondelete="SET NULL"), nullable=True, index=True)
    contratto_soccida_id = Column(Integer, ForeignKey("contratti_soccida.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    conto = relationship("PNConto", foreign_keys=[conto_id], back_populates="movimenti")
    conto_destinazione = relationship("PNConto", foreign_keys=[conto_destinazione_id])
    categoria = relationship("PNCategoria")
    partita = relationship("PartitaAnimale", back_populates="movimenti_prima_nota")
    attrezzatura = relationship("Attrezzatura", back_populates="movimenti_prima_nota")
    contratto_soccida = relationship("ContrattoSoccida", back_populates="pn_movimenti")
    # fattura_emessa = relationship("FatturaEmessa", foreign_keys=[fattura_emessa_id])  # DEPRECATO: usa fattura_amministrazione con tipo='entrata'
    fattura_amministrazione = relationship("FatturaAmministrazione", foreign_keys=[fattura_amministrazione_id])
    movimenti_partita = relationship(
        "PartitaMovimentoFinanziario",
        back_populates="pn_movimento",
        uselist=True,
    )
    documenti = relationship(
        "PNMovimentoDocumento",
        back_populates="movimento",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        CheckConstraint("importo >= 0", name="ck_pn_movimento_importo_non_negativo"),
    )


class PNMovimentoDocumento(Base):
    __tablename__ = "pn_movimenti_documenti"

    id = Column(Integer, primary_key=True)
    movimento_id = Column(Integer, ForeignKey("pn_movimenti.id", ondelete="CASCADE"), nullable=False, index=True)
    documento_tipo = Column(
        SQLEnum(
            PNDocumentoTipo,
            name="pn_documento_tipo",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
        default=PNDocumentoTipo.ALTRO.value,
    )
    documento_id = Column(Integer, nullable=False)
    importo = Column(Numeric(12, 2), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    movimento = relationship("PNMovimento", back_populates="documenti")

    __table_args__ = (
        CheckConstraint("importo >= 0", name="ck_pn_mov_doc_importo_non_negativo"),
    )


class PNContoIban(Base):
    __tablename__ = "pn_conti_iban"

    id = Column(Integer, primary_key=True, index=True)
    conto_id = Column(Integer, ForeignKey("pn_conti.id", ondelete="CASCADE"), nullable=False, index=True)
    iban = Column(String(34), nullable=False)
    descrizione = Column(String(120), nullable=True)
    predefinito = Column(Boolean, nullable=False, default=False)
    attivo = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    conto = relationship("PNConto", back_populates="ibans")

    __table_args__ = (
        UniqueConstraint("conto_id", "iban", name="uq_pn_conti_iban_conto"),
    )

    def __repr__(self) -> str:
        return f"<PNContoIban(id={self.id}, conto_id={self.conto_id}, iban='{self.iban}', attivo={self.attivo})>"
