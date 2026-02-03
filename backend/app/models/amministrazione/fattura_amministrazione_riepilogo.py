"""
Modello per il riepilogo IVA di una fattura amministrazione.
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Numeric,
    DateTime,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class FatturaAmministrazioneRiepilogo(Base):
    """Riepilogo IVA (DatiRiepilogo) della fattura amministrazione."""

    __tablename__ = "fatture_amministrazione_riepiloghi"

    id = Column(Integer, primary_key=True, index=True)
    fattura_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    aliquota_iva = Column(Numeric(6, 2), nullable=True)
    natura = Column(String(10), nullable=True)
    imponibile = Column(Numeric(14, 2), nullable=True)
    imposta = Column(Numeric(14, 2), nullable=True)
    esigibilita_iva = Column(String(5), nullable=True)
    riferimento_normativo = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fattura = relationship(
        "FatturaAmministrazione",
        back_populates="riepiloghi",
    )


