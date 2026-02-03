from sqlalchemy import Column, Integer, String, Date, DateTime, Numeric, Text, ForeignKey
from sqlalchemy.sql import func
from app.core.database import Base


class MagazzinoMovimento(Base):
	__tablename__ = 'magazzino_movimenti'

	id = Column(Integer, primary_key=True, index=True)
	azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
	data = Column(Date, nullable=False)
	tipo = Column(String(20), nullable=False)  # 'carico', 'scarico', 'rettifica'
	componente_alimentare_id = Column(Integer, ForeignKey('componenti_alimentari.id', ondelete='SET NULL'), index=True, nullable=True)
	mangime_confezionato_id = Column(Integer, ForeignKey('mangimi_confezionati.id', ondelete='SET NULL'), index=True, nullable=True)
	quantita = Column(Numeric(12, 4), nullable=False)
	unita_misura = Column(String(20), nullable=False, default='kg')
	causale = Column(String(100), nullable=True)
	ddt_riga_id = Column(Integer, ForeignKey('ddt_righe.id', ondelete='SET NULL'), index=True, nullable=True)
	note = Column(Text, nullable=True)
	created_at = Column(DateTime(timezone=True), server_default=func.now())
	updated_at = Column(DateTime(timezone=True), onupdate=func.now())
	deleted_at = Column(DateTime(timezone=True), nullable=True, index=True)
