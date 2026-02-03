"""Schemi Pydantic per DdtEmesso"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal


class ArticoloDDT(BaseModel):
    """Articolo/Bene trasportato nel DDT"""
    descrizione: str = Field(..., description="Descrizione del bene")
    unita_misura: str = Field(..., description="Unità di misura (kg, pz, etc.)")
    quantita: Decimal = Field(..., description="Quantità")


class DdtEmessoBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    numero_progressivo: Optional[int] = Field(None, description="Numero progressivo per anno")
    anno: Optional[int] = Field(None, description="Anno di riferimento")
    numero: Optional[str] = Field(None, max_length=50, description="Numero formattato DDT (generato automaticamente se non fornito)")
    data: date = Field(..., description="Data documento")
    cliente_id: Optional[int] = Field(None, description="ID cliente (fornitore con is_cliente=True)")
    destinatario_nome: Optional[str] = Field(None, max_length=200, description="Nome destinatario")
    destinatario_indirizzo: Optional[str] = Field(None, max_length=500, description="Indirizzo destinatario")
    destinatario_cap: Optional[str] = Field(None, max_length=10, description="CAP destinatario")
    destinatario_comune: Optional[str] = Field(None, max_length=120, description="Comune destinatario")
    destinatario_provincia: Optional[str] = Field(None, max_length=10, description="Provincia destinatario")
    destinatario_nazione: Optional[str] = Field(None, max_length=5, description="Nazione destinatario")
    destinatario_piva: Optional[str] = Field(None, max_length=50, description="Partita IVA destinatario")
    destinatario_cf: Optional[str] = Field(None, max_length=50, description="Codice fiscale destinatario")
    luogo_destinazione: Optional[str] = Field(None, max_length=200, description="Luogo di destinazione")
    causale_trasporto: Optional[str] = Field(None, max_length=200, description="Causale del trasporto")
    aspetto_beni: Optional[str] = Field(None, max_length=200, description="Aspetto dei beni")
    numero_colli: Optional[int] = Field(None, description="Numero colli")
    peso_lordo: Optional[Decimal] = Field(None, description="Peso lordo (kg)")
    peso_netto: Optional[Decimal] = Field(None, description="Peso netto (kg)")
    data_inizio_trasporto: Optional[datetime] = Field(None, description="Data inizio trasporto")
    trasporto_a_mezzo: Optional[str] = Field(None, max_length=50, description="Trasporto a mezzo: mittente, vettore, destinatario")
    vettore: Optional[str] = Field(None, max_length=200, description="Nome vettore")
    vettore_ragione_sociale: Optional[str] = Field(None, max_length=200, description="Ragione sociale vettore")
    vettore_sede_legale: Optional[str] = Field(None, max_length=500, description="Sede legale vettore")
    vettore_partita_iva: Optional[str] = Field(None, max_length=50, description="Partita IVA vettore")
    vettore_licenza: Optional[str] = Field(None, max_length=100, description="Licenza di trasporto vettore")
    vettore_targhe: Optional[str] = Field(None, max_length=200, description="Targhe veicoli utilizzati")
    vettore_autista: Optional[str] = Field(None, max_length=200, description="Autista designato")
    data_ritiro: Optional[date] = Field(None, description="Data ritiro")
    articoli: Optional[List[Dict[str, Any]]] = Field(None, description="Lista articoli/beni trasportati")
    annotazioni: Optional[str] = Field(None, description="Annotazioni")


class DdtEmessoCreate(DdtEmessoBase):
    pass


class DdtEmessoUpdate(BaseModel):
    numero_progressivo: Optional[int] = None
    anno: Optional[int] = None
    numero: Optional[str] = Field(None, max_length=50)
    data: Optional[date] = None
    cliente_id: Optional[int] = None
    destinatario_nome: Optional[str] = Field(None, max_length=200)
    destinatario_indirizzo: Optional[str] = Field(None, max_length=500)
    destinatario_cap: Optional[str] = Field(None, max_length=10)
    destinatario_comune: Optional[str] = Field(None, max_length=120)
    destinatario_provincia: Optional[str] = Field(None, max_length=10)
    destinatario_nazione: Optional[str] = Field(None, max_length=5)
    destinatario_piva: Optional[str] = Field(None, max_length=50)
    destinatario_cf: Optional[str] = Field(None, max_length=50)
    luogo_destinazione: Optional[str] = Field(None, max_length=200)
    causale_trasporto: Optional[str] = Field(None, max_length=200)
    aspetto_beni: Optional[str] = Field(None, max_length=200)
    numero_colli: Optional[int] = None
    peso_lordo: Optional[Decimal] = None
    peso_netto: Optional[Decimal] = None
    data_inizio_trasporto: Optional[datetime] = None
    trasporto_a_mezzo: Optional[str] = Field(None, max_length=50)
    vettore: Optional[str] = Field(None, max_length=200)
    vettore_ragione_sociale: Optional[str] = Field(None, max_length=200)
    vettore_sede_legale: Optional[str] = Field(None, max_length=500)
    vettore_partita_iva: Optional[str] = Field(None, max_length=50)
    vettore_licenza: Optional[str] = Field(None, max_length=100)
    vettore_targhe: Optional[str] = Field(None, max_length=200)
    vettore_autista: Optional[str] = Field(None, max_length=200)
    data_ritiro: Optional[date] = None
    articoli: Optional[List[Dict[str, Any]]] = None
    annotazioni: Optional[str] = None


class DdtEmessoResponse(DdtEmessoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

