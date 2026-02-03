"""
Box model - Compartimenti all'interno degli stabilimenti
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, CheckConstraint, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Box(Base):
    __tablename__ = "box"
    
    id = Column(Integer, primary_key=True, index=True)
    stabilimento_id = Column(Integer, ForeignKey("stabilimenti.id"), nullable=False)
    nome = Column(String(50), nullable=False)
    capacita = Column(Integer, nullable=False)  # Numero capi
    tipo_allevamento = Column(String(20), nullable=True)
    stato = Column(String(20), nullable=False, server_default='libero')
    note = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    stabilimento = relationship("Stabilimento", back_populates="box")
    animali = relationship("Animale", back_populates="box")
    movimentazioni_da = relationship("Movimentazione", foreign_keys="Movimentazione.da_box_id", back_populates="da_box")
    movimentazioni_a = relationship("Movimentazione", foreign_keys="Movimentazione.a_box_id", back_populates="a_box")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint('stabilimento_id', 'nome', name='uq_box_stabilimento_nome'),
        CheckConstraint("tipo_allevamento IN ('svezzamento', 'ingrasso', 'universale') OR tipo_allevamento IS NULL"),
        CheckConstraint("stato IN ('libero', 'occupato', 'pulizia', 'manutenzione')"),
    )
    
    @property
    def occupazione(self):
        """Calcola il numero di animali presenti nel box"""
        if self.animali:
            return len([a for a in self.animali if a.stato == 'presente'])
        return 0
    
    @property
    def disponibilita(self):
        """Calcola la disponibilità (capienza - occupazione)"""
        return self.capacita - self.occupazione

