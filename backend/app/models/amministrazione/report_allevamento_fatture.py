"""
ReportAllevamentoFattureUtilizzate model - Tracciamento importi fatture utilizzati nei report
"""
from sqlalchemy import Column, Integer, Numeric, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ReportAllevamentoFattureUtilizzate(Base):
    """
    Tabella per tracciare gli importi delle fatture acconto utilizzati nei report allevamento.
    Permette di scalare la parte rimanente delle fatture nei report successivi.
    """
    __tablename__ = "report_allevamento_fatture_utilizzate"
    
    id = Column(Integer, primary_key=True, index=True)
    contratto_soccida_id = Column(
        Integer,
        ForeignKey("contratti_soccida.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    fattura_id = Column(
        Integer,
        ForeignKey("fatture_amministrazione.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    importo_utilizzato = Column(Numeric(12, 2), nullable=False)
    data_report = Column(Date, nullable=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relazioni
    contratto_soccida = relationship("ContrattoSoccida", back_populates="report_fatture_utilizzate")
    fattura = relationship("FatturaAmministrazione", back_populates="report_utilizzate")

