"""
Piano d'uscita models
"""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Date,
    DateTime,
    Text,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class PianoUscita(Base):
    __tablename__ = "piani_uscita"

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(120), nullable=False)
    stato = Column(String(20), nullable=False, server_default="bozza")
    note = Column(Text, nullable=True)
    data_uscita = Column(Date, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    azienda = relationship("Azienda", back_populates="piani_uscita")
    animali_link = relationship("PianoUscitaAnimale", back_populates="piano", cascade="all, delete-orphan", overlaps="animali,piani_uscita")
    animali = relationship("Animale", secondary="piani_uscita_animali", back_populates="piani_uscita", overlaps="piani_uscita_link,animali_link")


class PianoUscitaAnimale(Base):
    __tablename__ = "piani_uscita_animali"

    id = Column(Integer, primary_key=True, index=True)
    piano_uscita_id = Column(
        Integer,
        ForeignKey("piani_uscita.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    animale_id = Column(
        Integer,
        ForeignKey("animali.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    piano = relationship("PianoUscita", back_populates="animali_link", overlaps="animali,piani_uscita")
    animale = relationship("Animale", back_populates="piani_uscita_link", overlaps="animali,piani_uscita")

    __table_args__ = (
        UniqueConstraint("piano_uscita_id", "animale_id", name="uq_piano_uscita_animale"),
    )

