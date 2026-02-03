"""
Modello per il dettaglio delle linee di una fattura amministrazione.
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    Date,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class FatturaAmministrazioneLinea(Base):
    """Voce di dettaglio (DettaglioLinee) di una fattura amministrazione."""

    __tablename__ = "fatture_amministrazione_linee"

    id = Column(Integer, primary_key=True, index=True)
    fattura_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    numero_linea = Column(Integer, nullable=True)
    descrizione = Column(Text, nullable=True)
    quantita = Column(Numeric(14, 4), nullable=True)
    unita_misura = Column(String(20), nullable=True)
    data_inizio_periodo = Column(Date, nullable=True)
    data_fine_periodo = Column(Date, nullable=True)
    prezzo_unitario = Column(Numeric(14, 4), nullable=True)
    prezzo_totale = Column(Numeric(14, 2), nullable=True)
    aliquota_iva = Column(Numeric(6, 2), nullable=True)
    natura = Column(String(10), nullable=True)
    tipo_cessione_prestazione = Column(String(20), nullable=True)
    riferimento_amministrazione = Column(String(100), nullable=True)
    codice_articolo = Column(String(100), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fattura = relationship(
        "FatturaAmministrazione",
        back_populates="linee",
    )


