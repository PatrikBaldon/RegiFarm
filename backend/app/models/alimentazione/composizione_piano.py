from sqlalchemy import Column, Integer, ForeignKey, Numeric, DateTime, String
from sqlalchemy.sql import func
from app.core.database import Base

class ComposizionePiano(Base):
    __tablename__ = 'composizione_piano'

    id = Column(Integer, primary_key=True, index=True)
    piano_alimentazione_id = Column(Integer, ForeignKey('piani_alimentazione.id', ondelete='CASCADE'))
    componente_alimentare_id = Column(Integer, ForeignKey('componenti_alimentari.id', ondelete='CASCADE'), nullable=True)
    mangime_confezionato_id = Column(Integer, ForeignKey('mangimi_confezionati.id', ondelete='CASCADE'), nullable=True)
    quantita = Column(Numeric(10, 3), nullable=False)
    ordine = Column(Integer)
    tipo_fornitura = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
