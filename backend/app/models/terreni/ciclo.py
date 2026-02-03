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


class CicloTerreno(Base):
    __tablename__ = "cicli_terreno"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    terreno_id = Column(Integer, ForeignKey("terreni.id", ondelete="CASCADE"), nullable=False, index=True)
    coltura = Column(String(120), nullable=False)
    anno = Column(Integer, nullable=True, index=True)
    data_inizio = Column(Date, nullable=True)
    data_fine = Column(Date, nullable=True)
    superficie_coinvolta = Column(Numeric(12, 4), nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    terreno = relationship("Terreno", back_populates="cicli")
    fasi = relationship("CicloTerrenoFase", back_populates="ciclo", cascade="all, delete-orphan")
    costi = relationship("CicloTerrenoCosto", back_populates="ciclo", cascade="all, delete-orphan")


class CicloTerrenoFase(Base):
    __tablename__ = "cicli_terreno_fasi"

    id = Column(Integer, primary_key=True, index=True)
    ciclo_id = Column(Integer, ForeignKey("cicli_terreno.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    tipo = Column(String(30), nullable=False, index=True)
    ordine = Column(Integer, nullable=True)
    data_inizio = Column(Date, nullable=True)
    data_fine = Column(Date, nullable=True)
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    ciclo = relationship("CicloTerreno", back_populates="fasi")
    costi = relationship("CicloTerrenoCosto", back_populates="fase")


class CicloTerrenoCosto(Base):
    __tablename__ = "cicli_terreno_costi"

    id = Column(Integer, primary_key=True, index=True)
    ciclo_id = Column(Integer, ForeignKey("cicli_terreno.id", ondelete="CASCADE"), nullable=False, index=True)
    fase_id = Column(Integer, ForeignKey("cicli_terreno_fasi.id", ondelete="SET NULL"), nullable=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    terreno_id = Column(Integer, ForeignKey("terreni.id", ondelete="CASCADE"), nullable=False, index=True)

    source_type = Column(String(20), nullable=False, default="manuale")  # manuale | fattura | lavorazione
    descrizione = Column(String(180), nullable=False)
    data = Column(Date, nullable=True)
    importo = Column(Numeric(12, 2), nullable=True)
    fattura_amministrazione_id = Column(
        Integer, ForeignKey("fatture_amministrazione.id", ondelete="SET NULL"), nullable=True, index=True
    )
    lavorazione_id = Column(
        Integer, ForeignKey("lavorazioni_terreno.id", ondelete="SET NULL"), nullable=True, index=True
    )
    note = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    ciclo = relationship("CicloTerreno", back_populates="costi")
    fase = relationship("CicloTerrenoFase", back_populates="costi")

