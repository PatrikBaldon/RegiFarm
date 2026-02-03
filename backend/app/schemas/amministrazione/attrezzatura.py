"""Schemi Pydantic per Attrezzatura, ScadenzaAttrezzatura e Ammortamento"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date
from decimal import Decimal
from app.models.amministrazione.attrezzatura import TipoAttrezzatura, TipoScadenza


# ============ ATTREZZATURA ============
class AttrezzaturaBase(BaseModel):
    azienda_id: int = Field(..., description="ID azienda")
    nome: str = Field(..., max_length=200, description="Nome attrezzatura")
    tipo: TipoAttrezzatura = Field(TipoAttrezzatura.ALTRO, description="Tipo attrezzatura")
    marca: Optional[str] = Field(None, max_length=100, description="Marca")
    modello: Optional[str] = Field(None, max_length=100, description="Modello")
    numero_serie: Optional[str] = Field(None, max_length=100, description="Numero serie")
    targa: Optional[str] = Field(None, max_length=20, description="Targa (per veicoli)")
    data_acquisto: Optional[date] = Field(None, description="Data acquisto")
    costo_acquisto: Optional[Decimal] = Field(None, description="Costo acquisto")
    fornitore_id: Optional[int] = Field(None, description="ID fornitore")
    valore_residuo: Optional[Decimal] = Field(None, description="Valore residuo previsto")
    durata_ammortamento_anni: Optional[int] = Field(None, description="Durata ammortamento in anni")
    metodo_ammortamento: Optional[str] = Field(None, max_length=50, description="Metodo ammortamento")
    attiva: bool = Field(True, description="Attrezzatura attiva")
    note: Optional[str] = Field(None, description="Note")


class AttrezzaturaCreate(AttrezzaturaBase):
    pass


class AttrezzaturaUpdate(BaseModel):
    nome: Optional[str] = Field(None, max_length=200)
    tipo: Optional[TipoAttrezzatura] = None
    marca: Optional[str] = Field(None, max_length=100)
    modello: Optional[str] = Field(None, max_length=100)
    numero_serie: Optional[str] = Field(None, max_length=100)
    targa: Optional[str] = Field(None, max_length=20)
    data_acquisto: Optional[date] = None
    costo_acquisto: Optional[Decimal] = None
    fornitore_id: Optional[int] = None
    valore_residuo: Optional[Decimal] = None
    durata_ammortamento_anni: Optional[int] = None
    metodo_ammortamento: Optional[str] = Field(None, max_length=50)
    attiva: Optional[bool] = None
    note: Optional[str] = None


class AttrezzaturaResponse(AttrezzaturaBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AttrezzaturaWithDetails(AttrezzaturaResponse):
    """Attrezzatura con scadenze e ammortamenti"""
    scadenze: List = []  # Will be populated with ScadenzaAttrezzaturaResponse
    ammortamenti: List = []  # Will be populated with AmmortamentoResponse
    
    class Config:
        from_attributes = True


# ============ SCADENZA ATTREZZATURA ============
class ScadenzaAttrezzaturaBase(BaseModel):
    attrezzatura_id: int = Field(..., description="ID attrezzatura")
    tipo: TipoScadenza = Field(..., description="Tipo scadenza")
    descrizione: str = Field(..., max_length=200, description="Descrizione scadenza")
    data_scadenza: date = Field(..., description="Data scadenza")
    data_ultimo_rinnovo: Optional[date] = Field(None, description="Data ultimo rinnovo")
    costo: Optional[Decimal] = Field(None, description="Costo")
    note: Optional[str] = Field(None, description="Note")
    numero_polizza: Optional[str] = Field(None, max_length=100, description="Numero polizza (per assicurazioni)")


class ScadenzaAttrezzaturaCreate(ScadenzaAttrezzaturaBase):
    pass


class ScadenzaAttrezzaturaUpdate(BaseModel):
    tipo: Optional[TipoScadenza] = None
    descrizione: Optional[str] = Field(None, max_length=200)
    data_scadenza: Optional[date] = None
    data_ultimo_rinnovo: Optional[date] = None
    costo: Optional[Decimal] = None
    note: Optional[str] = None
    numero_polizza: Optional[str] = Field(None, max_length=100)


class ScadenzaAttrezzaturaResponse(ScadenzaAttrezzaturaBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============ AMMORTAMENTO ============
class AmmortamentoBase(BaseModel):
    attrezzatura_id: int = Field(..., description="ID attrezzatura")
    azienda_id: int = Field(..., description="ID azienda")
    anno: int = Field(..., description="Anno ammortamento")
    mese: Optional[int] = Field(None, description="Mese ammortamento (opzionale)")
    quota_ammortamento: Decimal = Field(..., description="Quota ammortamento per il periodo")
    valore_residuo: Optional[Decimal] = Field(None, description="Valore residuo dopo ammortamento")
    note: Optional[str] = Field(None, description="Note")


class AmmortamentoCreate(AmmortamentoBase):
    pass


class AmmortamentoUpdate(BaseModel):
    anno: Optional[int] = None
    mese: Optional[int] = None
    quota_ammortamento: Optional[Decimal] = None
    valore_residuo: Optional[Decimal] = None
    note: Optional[str] = None


class AmmortamentoResponse(AmmortamentoBase):
    id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    deleted_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class AttrezzaturaCostWindow(BaseModel):
    totale: Decimal = Field(default=Decimal("0"))
    totale_fatture: Decimal = Field(default=Decimal("0"))
    totale_movimenti: Decimal = Field(default=Decimal("0"))
    fatture_count: int = 0
    movimenti_count: int = 0


class AttrezzaturaCostiRiepilogo(BaseModel):
    attrezzatura_id: int
    attrezzatura_nome: str
    attrezzatura_tipo: Optional[str] = None
    totale: AttrezzaturaCostWindow = Field(default_factory=AttrezzaturaCostWindow)
    anno_corrente: AttrezzaturaCostWindow = Field(default_factory=AttrezzaturaCostWindow)
    mese_corrente: AttrezzaturaCostWindow = Field(default_factory=AttrezzaturaCostWindow)

