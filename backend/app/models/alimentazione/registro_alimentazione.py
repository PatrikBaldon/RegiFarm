from sqlalchemy import Column, Integer, Date, DateTime, ForeignKey, Text, Numeric, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class RegistroAlimentazione(Base):
    __tablename__ = 'registro_alimentazione'

    id = Column(Integer, primary_key=True, index=True)
    box_id = Column(Integer, ForeignKey('box.id', ondelete='SET NULL'), nullable=True)
    data = Column(Date)
    razione_id = Column(Integer, ForeignKey('piani_alimentazione.id', ondelete='SET NULL'), nullable=True)
    note = Column(Text)
    quantita_totale = Column(Numeric(12, 4), nullable=True)
    target_tipo = Column(String(20), nullable=True)
    target_id = Column(Integer, nullable=True)
    tipo_alimento = Column(String(20), nullable=True)
    componente_alimentare_id = Column(Integer, ForeignKey('componenti_alimentari.id', ondelete='SET NULL'), nullable=True)
    mangime_confezionato_id = Column(Integer, ForeignKey('mangimi_confezionati.id', ondelete='SET NULL'), nullable=True)
    numero_capi = Column(Integer, nullable=True)
    quota_per_capo = Column(Numeric(12, 4), nullable=True)
    giorni_permanenza_min = Column(Integer, nullable=True)
    giorni_permanenza_max = Column(Integer, nullable=True)
    azienda_id = Column(Integer, ForeignKey('aziende.id', ondelete='CASCADE'), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    dettagli = relationship(
        "RegistroAlimentazioneDettaglio",
        back_populates="registro",
        cascade="all, delete-orphan",
    )
    componente_alimentare = relationship("ComponenteAlimentare")
    mangime_confezionato = relationship("MangimeConfezionato")
    piano = relationship("PianoAlimentazione", lazy="joined", uselist=False)
    azienda = relationship("Azienda")


class RegistroAlimentazioneDettaglio(Base):
    __tablename__ = 'registro_alimentazione_dettagli'

    id = Column(Integer, primary_key=True, index=True)
    registro_id = Column(Integer, ForeignKey('registro_alimentazione.id', ondelete='CASCADE'), nullable=False)
    box_id = Column(Integer, ForeignKey('box.id', ondelete='SET NULL'), nullable=True)
    numero_capi = Column(Integer, nullable=False)
    quantita = Column(Numeric(12, 4), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    note = Column(Text, nullable=True)

    registro = relationship("RegistroAlimentazione", back_populates="dettagli")
    box = relationship("Box")
