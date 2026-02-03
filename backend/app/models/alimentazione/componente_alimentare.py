from sqlalchemy import Column, Integer, String, Boolean, Numeric, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base

class ComponenteAlimentare(Base):
    __tablename__ = 'componenti_alimentari'

    id = Column(Integer, primary_key=True, index=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    nome = Column(String(100), nullable=False)  # Rimosso unique per permettere stessi nomi in aziende diverse
    tipo = Column(String(50))  # 'materia_prima', 'additivo', etc.
    unita_misura = Column(String(20), default='kg')
    autoprodotto = Column(Boolean, default=False)
    costo_unitario = Column(Numeric(10, 4))
    per_svezzamento = Column(Boolean, default=True)
    per_ingrasso = Column(Boolean, default=True)
    note = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
