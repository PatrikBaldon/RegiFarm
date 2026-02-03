"""
Modello per i pagamenti (DatiPagamento) pianificati di una fattura amministrazione.
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
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class FatturaAmministrazionePagamento(Base):
    """DatiPagamento / DettaglioPagamento di una fattura amministrazione."""

    __tablename__ = "fatture_amministrazione_pagamenti"

    id = Column(Integer, primary_key=True, index=True)
    fattura_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    modalita_pagamento = Column(String(10), nullable=True)
    data_riferimento = Column(Date, nullable=True)
    giorni_termine = Column(Integer, nullable=True)
    data_scadenza = Column(Date, nullable=True)
    importo = Column(Numeric(14, 2), nullable=True)
    codice_pagamento = Column(String(255), nullable=True)
    iban = Column(String(34), nullable=True)
    banca = Column(String(200), nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fattura = relationship(
        "FatturaAmministrazione",
        back_populates="pagamenti_programmati",
    )


