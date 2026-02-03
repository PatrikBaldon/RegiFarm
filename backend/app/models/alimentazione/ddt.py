from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class Ddt(Base):
	__tablename__ = 'ddt'

	id = Column(Integer, primary_key=True, index=True)
	azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
	data = Column(Date, nullable=False)
	numero = Column(String(50), nullable=False, index=True)
	fornitore_id = Column(Integer, ForeignKey('fornitori.id', ondelete='SET NULL'), index=True, nullable=True)
	note = Column(Text)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), onupdate=func.now())
	deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
