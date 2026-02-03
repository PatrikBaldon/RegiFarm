"""
Modello per movimenti finanziari collegati alle partite animali.
"""
from __future__ import annotations

from datetime import date
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base
from .partita_animale import ModalitaGestionePartita


class PartitaMovimentoDirezione(str, Enum):
    ENTRATA = "entrata"
    USCITA = "uscita"


class PartitaMovimentoTipo(str, Enum):
    ACCONTO = "acconto"
    SALDO = "saldo"
    MORTALITA = "mortalita"
    ALTRO = "altro"


class PartitaMovimentoFinanziario(Base):
    """
    Traccia movimenti economici legati a una partita di ingresso/uscita.
    Può contenere sia registrazioni monetizzate sia collegamenti a fatture.
    """

    __tablename__ = "partita_movimenti_finanziari"

    id = Column(Integer, primary_key=True, index=True)
    partita_id = Column(Integer, ForeignKey("partite_animali.id", ondelete="CASCADE"), nullable=False, index=True)

    direzione = Column(
        SQLEnum(
            PartitaMovimentoDirezione,
            name="partita_movimento_direzione",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    tipo = Column(
        SQLEnum(
            PartitaMovimentoTipo,
            name="partita_movimento_tipo",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
        ),
        nullable=False,
    )
    modalita = Column(
        SQLEnum(
            ModalitaGestionePartita,
            name="partita_modalita_gestione",  # Usa lo stesso ENUM già esistente in partite_animali
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
            validate_strings=True,
            create_type=False,  # Non ricreare il tipo, usa quello esistente
        ),
        nullable=True,
    )

    data = Column(Date, nullable=False, index=True, default=date.today)
    importo = Column(Numeric(12, 2), nullable=False)
    note = Column(Text, nullable=True)

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
    pn_movimento_id = Column(
        Integer,
        ForeignKey("pn_movimenti.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    riferimento_documento = Column(String(120), nullable=True)
    attivo = Column(Boolean, nullable=False, default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    partita = relationship("PartitaAnimale", back_populates="movimenti_finanziari")
    fattura_amministrazione = relationship("FatturaAmministrazione")
    fattura_emessa = relationship("FatturaEmessa")
    pn_movimento = relationship("PNMovimento", back_populates="movimenti_partita")

    __table_args__ = ()

    def __repr__(self) -> str:
        return (
            f"<PartitaMovimentoFinanziario(id={self.id}, partita_id={self.partita_id}, direzione={self.direzione}, "
            f"tipo={self.tipo}, importo={self.importo})>"
        )

