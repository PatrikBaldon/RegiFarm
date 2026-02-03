from sqlalchemy import Column, Integer, String, DateTime, Numeric, ForeignKey, Date, Text
from sqlalchemy.sql import func
from app.core.database import Base

class Fattura(Base):
    __tablename__ = 'fatture'

    id = Column(Integer, primary_key=True, index=True)
    data = Column(Date)
    numero = Column(String(50), nullable=False)
    fornitore_id = Column(Integer, ForeignKey('fornitori.id', ondelete='SET NULL'), index=True)
    importo = Column(Numeric(12, 2))
    note = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
