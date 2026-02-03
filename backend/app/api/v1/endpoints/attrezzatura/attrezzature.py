"""
Attrezzature, Scadenze e Ammortamenti endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional, Dict, Tuple
from datetime import datetime, date
from decimal import Decimal

from app.core.database import get_db
from app.models.amministrazione import (
    Attrezzatura,
    ScadenzaAttrezzatura,
    Ammortamento,
    FatturaAmministrazione,
)
from app.models.amministrazione.pn import PNMovimento
from app.models.allevamento.azienda import Azienda
from app.schemas.amministrazione import (
    AttrezzaturaCreate,
    AttrezzaturaResponse,
    AttrezzaturaUpdate,
    AttrezzaturaWithDetails,
    AttrezzaturaCostWindow,
    AttrezzaturaCostiRiepilogo,
    ScadenzaAttrezzaturaCreate,
    ScadenzaAttrezzaturaResponse,
    ScadenzaAttrezzaturaUpdate,
    AmmortamentoCreate,
    AmmortamentoResponse,
    AmmortamentoUpdate,
)

router = APIRouter(prefix="", tags=["attrezzatura"])


def _attrezzature_costs_for_period(
    db: Session,
    azienda_id: int,
    start_date: Optional[date],
) -> Tuple[Dict[int, Decimal], Dict[int, Decimal]]:
    """
    Calcola i costi delle attrezzature da fatture e movimenti prima nota
    per un periodo specifico.
    """
    fattura_query = (
        db.query(
            FatturaAmministrazione.attrezzatura_id,
            func.coalesce(func.sum(FatturaAmministrazione.importo_totale), 0).label("totale"),
        )
        .filter(
            FatturaAmministrazione.azienda_id == azienda_id,
            FatturaAmministrazione.deleted_at.is_(None),
            FatturaAmministrazione.attrezzatura_id.isnot(None),
        )
    )
    if start_date:
        fattura_query = fattura_query.filter(FatturaAmministrazione.data_fattura >= start_date)
    fattura_query = fattura_query.group_by(FatturaAmministrazione.attrezzatura_id)
    
    fatture_map: Dict[int, Decimal] = {}
    for row in fattura_query.all():
        if row.attrezzatura_id:
            fatture_map[row.attrezzatura_id] = Decimal(str(row.totale or 0))

    movimento_query = (
        db.query(
            PNMovimento.attrezzatura_id,
            func.coalesce(func.sum(PNMovimento.importo), 0).label("totale"),
        )
        .filter(
            PNMovimento.azienda_id == azienda_id,
            PNMovimento.deleted_at.is_(None),
            PNMovimento.attrezzatura_id.isnot(None),
        )
    )
    if start_date:
        movimento_query = movimento_query.filter(PNMovimento.data_operazione >= start_date)
    movimento_query = movimento_query.group_by(PNMovimento.attrezzatura_id)
    
    movimenti_map: Dict[int, Decimal] = {}
    for row in movimento_query.all():
        if row.attrezzatura_id:
            movimenti_map[row.attrezzatura_id] = Decimal(str(row.totale or 0))

    return fatture_map, movimenti_map


def _compose_cost_window(
    attrezzatura_id: int,
    fatture_map: Dict[int, Decimal],
    movimenti_map: Dict[int, Decimal],
) -> AttrezzaturaCostWindow:
    """Compone la finestra costi per un'attrezzatura."""
    fatture = fatture_map.get(attrezzatura_id, Decimal("0"))
    movimenti = movimenti_map.get(attrezzatura_id, Decimal("0"))
    return AttrezzaturaCostWindow(
        fatture=float(fatture),
        movimenti_pn=float(movimenti),
        totale=float(fatture + movimenti),
    )


@router.get("/attrezzature/costi-riepilogo", response_model=List[AttrezzaturaCostiRiepilogo])
async def attrezzature_costi_riepilogo(
    azienda_id: int = Query(..., description="ID azienda"),
    db: Session = Depends(get_db),
):
    """Riepilogo costi attrezzature per periodo"""
    today = date.today()
    start_year = date(today.year, 1, 1)
    start_month = date(today.year, today.month, 1)

    attrezzature = (
        db.query(Attrezzatura)
        .filter(
            Attrezzatura.azienda_id == azienda_id,
            Attrezzatura.deleted_at.is_(None),
        )
        .order_by(Attrezzatura.nome.asc())
        .all()
    )

    if not attrezzature:
        return []

    fatture_all, movimenti_all = _attrezzature_costs_for_period(db, azienda_id, None)
    fatture_year, movimenti_year = _attrezzature_costs_for_period(db, azienda_id, start_year)
    fatture_month, movimenti_month = _attrezzature_costs_for_period(db, azienda_id, start_month)

    response: List[AttrezzaturaCostiRiepilogo] = []
    for attrezzatura in attrezzature:
        att_id = attrezzatura.id
        tipo_attr = getattr(attrezzatura, "tipo", None)
        if hasattr(tipo_attr, "value"):
            tipo_value = tipo_attr.value
        elif tipo_attr is not None:
            tipo_value = str(tipo_attr)
        else:
            tipo_value = None
        response.append(
            AttrezzaturaCostiRiepilogo(
                attrezzatura_id=att_id,
                attrezzatura_nome=attrezzatura.nome,
                attrezzatura_tipo=tipo_value,
                totale=_compose_cost_window(att_id, fatture_all, movimenti_all),
                anno_corrente=_compose_cost_window(att_id, fatture_year, movimenti_year),
                mese_corrente=_compose_cost_window(att_id, fatture_month, movimenti_month),
            )
        )

    return response


@router.get("/attrezzature", response_model=List[AttrezzaturaResponse])
async def get_attrezzature(
    azienda_id: int = Query(..., description="ID azienda"),
    tipo: Optional[str] = None,
    attiva: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all attrezzature con filtri"""
    query = db.query(Attrezzatura).filter(
        Attrezzatura.azienda_id == azienda_id,
        Attrezzatura.deleted_at.is_(None)
    )
    
    if tipo:
        query = query.filter(Attrezzatura.tipo == tipo)
    if attiva is not None:
        query = query.filter(Attrezzatura.attiva == attiva)
    
    return query.order_by(Attrezzatura.nome).offset(skip).limit(limit).all()


@router.get("/attrezzature/{attrezzatura_id}", response_model=AttrezzaturaWithDetails)
async def get_attrezzatura(attrezzatura_id: int, db: Session = Depends(get_db)):
    """Get a specific attrezzatura con scadenze e ammortamenti"""
    attrezzatura = db.query(Attrezzatura).filter(
        Attrezzatura.id == attrezzatura_id,
        Attrezzatura.deleted_at.is_(None)
    ).first()
    if not attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    scadenze = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.attrezzatura_id == attrezzatura_id,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).all()
    
    ammortamenti = db.query(Ammortamento).filter(
        Ammortamento.attrezzatura_id == attrezzatura_id,
        Ammortamento.deleted_at.is_(None)
    ).order_by(Ammortamento.anno.desc(), Ammortamento.mese).all()
    
    result = AttrezzaturaWithDetails.model_validate(attrezzatura)
    result.scadenze = [ScadenzaAttrezzaturaResponse.model_validate(s) for s in scadenze]
    result.ammortamenti = [AmmortamentoResponse.model_validate(a) for a in ammortamenti]
    return result


@router.post("/attrezzature", response_model=AttrezzaturaResponse, status_code=status.HTTP_201_CREATED)
async def create_attrezzatura(attrezzatura: AttrezzaturaCreate, db: Session = Depends(get_db)):
    """Create a new attrezzatura"""
    azienda = db.query(Azienda).filter(Azienda.id == attrezzatura.azienda_id).first()
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")
    
    db_attrezzatura = Attrezzatura(**attrezzatura.dict())
    db.add(db_attrezzatura)
    db.commit()
    db.refresh(db_attrezzatura)
    return db_attrezzatura


@router.put("/attrezzature/{attrezzatura_id}", response_model=AttrezzaturaResponse)
async def update_attrezzatura(
    attrezzatura_id: int,
    update: AttrezzaturaUpdate,
    db: Session = Depends(get_db)
):
    """Update an attrezzatura"""
    db_attrezzatura = db.query(Attrezzatura).filter(
        Attrezzatura.id == attrezzatura_id,
        Attrezzatura.deleted_at.is_(None)
    ).first()
    if not db_attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_attrezzatura, key, value)
    
    db.commit()
    db.refresh(db_attrezzatura)
    return db_attrezzatura


@router.delete("/attrezzature/{attrezzatura_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_attrezzatura(attrezzatura_id: int, db: Session = Depends(get_db)):
    """Soft delete an attrezzatura"""
    db_attrezzatura = db.query(Attrezzatura).filter(
        Attrezzatura.id == attrezzatura_id,
        Attrezzatura.deleted_at.is_(None)
    ).first()
    if not db_attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    db_attrezzatura.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ SCADENZE ATTREZZATURE ============
@router.get("/attrezzature/{attrezzatura_id}/scadenze", response_model=List[ScadenzaAttrezzaturaResponse])
async def get_scadenze_attrezzatura(
    attrezzatura_id: int,
    tipo: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Get all scadenze for an attrezzatura"""
    query = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.attrezzatura_id == attrezzatura_id,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    )
    
    if tipo:
        query = query.filter(ScadenzaAttrezzatura.tipo == tipo)
    
    return query.order_by(ScadenzaAttrezzatura.data_scadenza).all()


@router.post("/attrezzature/{attrezzatura_id}/scadenze", response_model=ScadenzaAttrezzaturaResponse, status_code=status.HTTP_201_CREATED)
async def create_scadenza_attrezzatura(
    attrezzatura_id: int,
    scadenza: ScadenzaAttrezzaturaCreate,
    db: Session = Depends(get_db)
):
    """Create a new scadenza for an attrezzatura"""
    attrezzatura = db.query(Attrezzatura).filter(Attrezzatura.id == attrezzatura_id).first()
    if not attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    scadenza_data = scadenza.dict()
    scadenza_data['attrezzatura_id'] = attrezzatura_id
    db_scadenza = ScadenzaAttrezzatura(**scadenza_data)
    db.add(db_scadenza)
    db.commit()
    db.refresh(db_scadenza)
    return db_scadenza


@router.put("/scadenze-attrezzature/{scadenza_id}", response_model=ScadenzaAttrezzaturaResponse)
async def update_scadenza_attrezzatura(
    scadenza_id: int,
    update: ScadenzaAttrezzaturaUpdate,
    db: Session = Depends(get_db)
):
    """Update a scadenza"""
    db_scadenza = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.id == scadenza_id,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not db_scadenza:
        raise HTTPException(status_code=404, detail="Scadenza non trovata")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_scadenza, key, value)
    
    db.commit()
    db.refresh(db_scadenza)
    return db_scadenza


@router.delete("/scadenze-attrezzature/{scadenza_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_scadenza_attrezzatura(scadenza_id: int, db: Session = Depends(get_db)):
    """Soft delete a scadenza"""
    db_scadenza = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.id == scadenza_id,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).first()
    if not db_scadenza:
        raise HTTPException(status_code=404, detail="Scadenza non trovata")
    
    db_scadenza.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ AMMORTAMENTI ============
@router.get("/attrezzature/{attrezzatura_id}/ammortamenti", response_model=List[AmmortamentoResponse])
async def get_ammortamenti_attrezzatura(
    attrezzatura_id: int,
    anno: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all ammortamenti for an attrezzatura"""
    query = db.query(Ammortamento).filter(
        Ammortamento.attrezzatura_id == attrezzatura_id,
        Ammortamento.deleted_at.is_(None)
    )
    
    if anno:
        query = query.filter(Ammortamento.anno == anno)
    
    return query.order_by(Ammortamento.anno.desc(), Ammortamento.mese).all()


@router.post("/attrezzature/{attrezzatura_id}/ammortamenti", response_model=AmmortamentoResponse, status_code=status.HTTP_201_CREATED)
async def create_ammortamento(
    attrezzatura_id: int,
    ammortamento: AmmortamentoCreate,
    db: Session = Depends(get_db)
):
    """Create a new ammortamento for an attrezzatura"""
    attrezzatura = db.query(Attrezzatura).filter(Attrezzatura.id == attrezzatura_id).first()
    if not attrezzatura:
        raise HTTPException(status_code=404, detail="Attrezzatura non trovata")
    
    ammortamento_data = ammortamento.dict()
    ammortamento_data['attrezzatura_id'] = attrezzatura_id
    db_ammortamento = Ammortamento(**ammortamento_data)
    db.add(db_ammortamento)
    db.commit()
    db.refresh(db_ammortamento)
    return db_ammortamento


@router.put("/ammortamenti/{ammortamento_id}", response_model=AmmortamentoResponse)
async def update_ammortamento(
    ammortamento_id: int,
    update: AmmortamentoUpdate,
    db: Session = Depends(get_db)
):
    """Update an ammortamento"""
    db_ammortamento = db.query(Ammortamento).filter(
        Ammortamento.id == ammortamento_id,
        Ammortamento.deleted_at.is_(None)
    ).first()
    if not db_ammortamento:
        raise HTTPException(status_code=404, detail="Ammortamento non trovato")
    
    for key, value in update.dict(exclude_unset=True).items():
        setattr(db_ammortamento, key, value)
    
    db.commit()
    db.refresh(db_ammortamento)
    return db_ammortamento


@router.delete("/ammortamenti/{ammortamento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_ammortamento(ammortamento_id: int, db: Session = Depends(get_db)):
    """Soft delete an ammortamento"""
    db_ammortamento = db.query(Ammortamento).filter(
        Ammortamento.id == ammortamento_id,
        Ammortamento.deleted_at.is_(None)
    ).first()
    if not db_ammortamento:
        raise HTTPException(status_code=404, detail="Ammortamento non trovato")
    
    db_ammortamento.deleted_at = datetime.utcnow()
    db.commit()
    return None

