from sqlalchemy import Column, Integer, String, Numeric, DateTime, Date, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class RaccoltoTerreno(Base):
    __tablename__ = 'raccolti_terreno'

    id = Column(Integer, primary_key=True)
    azienda_id = Column(Integer, ForeignKey('aziende.id', ondelete='CASCADE'), nullable=False, index=True)
    terreno_id = Column(Integer, ForeignKey('terreni.id', ondelete='CASCADE'), index=True)
    prodotto = Column(String(100), nullable=False)
    data_inizio = Column(Date)
    data_fine = Column(Date)
    resa_quantita = Column(Numeric(12, 3))
    unita_misura = Column(String(10))
    destinazione = Column(String(20))
    prezzo_vendita = Column(Numeric(12, 2))
    note = Column(String(500))

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)

    terreno = relationship("Terreno", back_populates="raccolti")
    prodotti_derivati = relationship("ProdottoDerivato", back_populates="raccolto", cascade="all, delete-orphan")
