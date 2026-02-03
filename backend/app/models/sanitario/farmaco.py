"""Modello Farmaco - Anagrafe farmaci"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship

from app.core.database import Base


class Farmaco(Base):
    """Anagrafe generale dei farmaci"""
    __tablename__ = "farmaci"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome_commerciale = Column(String(200), nullable=False, index=True)
    principio_attivo = Column(String(200))
    unita_misura = Column(String(20), default='ml')  # ml, gr, confezioni, unità

    # Note e descrizione
    descrizione = Column(Text)
    note = Column(Text)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    # Relazioni
    lotti = relationship("LottoFarmaco", back_populates="farmaco", cascade="all, delete-orphan")
    somministrazioni = relationship("Somministrazione", back_populates="farmaco")
    azienda = relationship("Azienda", backref="catalogo_farmaci")

    def __repr__(self):
        return f"<Farmaco(id={self.id}, nome='{self.nome_commerciale}')>"

