"""
Modello per i dati di ricezione (DatiRicezione) della fattura amministrazione.
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class FatturaAmministrazioneRicezione(Base):
    """DatiRicezione associati a una fattura amministrazione."""

    __tablename__ = "fatture_amministrazione_ricezioni"

    id = Column(Integer, primary_key=True, index=True)
    fattura_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    riferimento_numero_linea = Column(Integer, nullable=True)
    id_documento = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    fattura = relationship(
        "FatturaAmministrazione",
        back_populates="ricezioni",
    )


