from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, Boolean
from sqlalchemy.sql import func
from app.core.database import Base

class MangimeConfezionato(Base):
    __tablename__ = 'mangimi_confezionati'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)
    fornitore_id = Column(Integer, ForeignKey('fornitori.id'))
    tipo_allevamento = Column(String(20))  # 'svezzamento', 'ingrasso', 'universale'
    prezzo_unitario = Column(Numeric(10, 2))
    unita_misura = Column(String(20), default='kg')
    fattura_id = Column(Integer, ForeignKey('fatture.id'))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
