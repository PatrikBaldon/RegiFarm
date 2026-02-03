from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class AziendaUtente(Base):
    __tablename__ = "aziende_utenti"

    id = Column(Integer, primary_key=True, index=True)
    auth_user_id = Column(UUID(as_uuid=True), unique=True, nullable=False, index=True)
    email = Column(String(150), nullable=False, index=True)
    ruolo = Column(String(50), nullable=False)
    stato = Column(String(20), nullable=False, server_default="invited")
    invite_sent_at = Column(DateTime(timezone=True), nullable=True)
    first_login_at = Column(DateTime(timezone=True), nullable=True)
    azienda_id = Column(Integer, ForeignKey("aziende.id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    azienda = relationship("Azienda", back_populates="utenti")

