"""
Compatibility router for backward compatibility with frontend API calls.
This router provides routes at the root level that are also available under module prefixes.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db

# Import models and schemas
from app.models.alimentazione.piano_alimentazione import PianoAlimentazione as PianoAlimentazioneModel
from app.models.alimentazione.composizione_piano import ComposizionePiano as ComposizionePianoModel
from app.models.alimentazione.magazzino_movimento import MagazzinoMovimento as MagazzinoMovimentoModel
from app.schemas.alimentazione import (
    PianoAlimentazioneCreate, PianoAlimentazioneUpdate, PianoAlimentazioneResponse,
    ComposizionePianoCreate, ComposizionePianoUpdate, ComposizionePianoResponse,
    ScortaItem,
)
from app.schemas.amministrazione import (
    PNCategoriaResponse,
    PNCategoriaCreate,
    PNCategoriaUpdate,
)
from app.models.amministrazione.pn import PNTipoOperazione
from app.services.amministrazione.prima_nota_service import (
    list_categorie as pn_list_categorie,
    create_categoria as pn_create_categoria,
    update_categoria as pn_update_categoria,
    delete_categoria as pn_delete_categoria,
)
from sqlalchemy import func, case

router = APIRouter()

# --- PIANI ALIMENTAZIONE ---
@router.get("/piani-alimentazione", response_model=List[PianoAlimentazioneResponse])
def list_piani_alimentazione(
    skip: int = 0,
    limit: int = 100,
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all piani alimentazione with optional filters"""
    query = db.query(PianoAlimentazioneModel).filter(PianoAlimentazioneModel.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(PianoAlimentazioneModel.azienda_id == azienda_id)
    
    return query.order_by(PianoAlimentazioneModel.nome).offset(skip).limit(limit).all()

@router.get("/piani-alimentazione/{piano_id}", response_model=PianoAlimentazioneResponse)
def get_piano_alimentazione(piano_id: int, db: Session = Depends(get_db)):
    obj = db.query(PianoAlimentazioneModel).filter(
        PianoAlimentazioneModel.id == piano_id,
        PianoAlimentazioneModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
    return obj

@router.post("/piani-alimentazione", response_model=PianoAlimentazioneResponse, status_code=status.HTTP_201_CREATED)
def create_piano_alimentazione(data: PianoAlimentazioneCreate, db: Session = Depends(get_db)):
    payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
    db_obj = PianoAlimentazioneModel(**payload)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/piani-alimentazione/{piano_id}", response_model=PianoAlimentazioneResponse)
def update_piano_alimentazione(piano_id: int, update: PianoAlimentazioneUpdate, db: Session = Depends(get_db)):
    obj = db.query(PianoAlimentazioneModel).filter(
        PianoAlimentazioneModel.id == piano_id,
        PianoAlimentazioneModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
    update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/piani-alimentazione/{piano_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_piano_alimentazione(piano_id: int, db: Session = Depends(get_db)):
    """Soft delete piano alimentazione"""
    obj = db.query(PianoAlimentazioneModel).filter(
        PianoAlimentazioneModel.id == piano_id,
        PianoAlimentazioneModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
    obj.deleted_at = datetime.utcnow()
    db.commit()
    return None

# --- COMPOSIZIONI PIANO ---
@router.get("/composizioni-piano", response_model=List[ComposizionePianoResponse])
def list_composizioni_piano(
    skip: int = 0,
    limit: int = 100,
    piano_alimentazione_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Get all composizioni piano with optional filters"""
    query = db.query(ComposizionePianoModel).filter(ComposizionePianoModel.deleted_at.is_(None))
    
    if piano_alimentazione_id is not None:
        query = query.filter(ComposizionePianoModel.piano_alimentazione_id == piano_alimentazione_id)
    
    return query.order_by(ComposizionePianoModel.ordine, ComposizionePianoModel.id).offset(skip).limit(limit).all()

@router.get("/composizioni-piano/{comp_id}", response_model=ComposizionePianoResponse)
def get_composizione_piano(comp_id: int, db: Session = Depends(get_db)):
    obj = db.query(ComposizionePianoModel).filter(
        ComposizionePianoModel.id == comp_id,
        ComposizionePianoModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Composizione piano non trovata")
    return obj

@router.post("/composizioni-piano", response_model=ComposizionePianoResponse, status_code=status.HTTP_201_CREATED)
def create_composizione_piano(data: ComposizionePianoCreate, db: Session = Depends(get_db)):
    piano = db.query(PianoAlimentazioneModel).filter(
        PianoAlimentazioneModel.id == data.piano_alimentazione_id,
        PianoAlimentazioneModel.deleted_at.is_(None)
    ).first()
    if not piano:
        raise HTTPException(status_code=404, detail="Piano alimentazione non trovato")
    
    payload = data.dict() if hasattr(data, 'dict') else data.model_dump()
    db_obj = ComposizionePianoModel(**payload)
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/composizioni-piano/{comp_id}", response_model=ComposizionePianoResponse)
def update_composizione_piano(comp_id: int, update: ComposizionePianoUpdate, db: Session = Depends(get_db)):
    obj = db.query(ComposizionePianoModel).filter(
        ComposizionePianoModel.id == comp_id,
        ComposizionePianoModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Composizione piano non trovata")
    update_data = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/composizioni-piano/{comp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_composizione_piano(comp_id: int, db: Session = Depends(get_db)):
    """Soft delete composizione piano"""
    obj = db.query(ComposizionePianoModel).filter(
        ComposizionePianoModel.id == comp_id,
        ComposizionePianoModel.deleted_at.is_(None)
    ).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Composizione piano non trovata")
    obj.deleted_at = datetime.utcnow()
    db.commit()
    return None

# --- MAGAZZINO SCORTE ---
@router.get("/magazzino/scorte", response_model=List[ScortaItem])
def get_scorte(
    azienda_id: Optional[int] = None,
    componente_alimentare_id: Optional[int] = None,
    mangime_confezionato_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Get scorte (stock) summary with optional filters"""
    query = db.query(
        MagazzinoMovimentoModel.componente_alimentare_id,
        MagazzinoMovimentoModel.mangime_confezionato_id,
        MagazzinoMovimentoModel.unita_misura,
        func.sum(
            case(
                (
                    MagazzinoMovimentoModel.tipo == 'carico',
                    MagazzinoMovimentoModel.quantita
                ),
                else_=0
            )
            - case(
                (
                    MagazzinoMovimentoModel.tipo == 'scarico',
                    MagazzinoMovimentoModel.quantita
                ),
                else_=0
            )
            + case(
                (
                    MagazzinoMovimentoModel.tipo == 'rettifica',
                    MagazzinoMovimentoModel.quantita
                ),
                else_=0
            )
        ).label('quantita_disponibile')
    ).filter(
        MagazzinoMovimentoModel.deleted_at.is_(None)
    ).group_by(
        MagazzinoMovimentoModel.componente_alimentare_id,
        MagazzinoMovimentoModel.mangime_confezionato_id,
        MagazzinoMovimentoModel.unita_misura,
    )
    
    if azienda_id is not None:
        query = query.filter(MagazzinoMovimentoModel.azienda_id == azienda_id)
    if componente_alimentare_id is not None:
        query = query.filter(MagazzinoMovimentoModel.componente_alimentare_id == componente_alimentare_id)
    if mangime_confezionato_id is not None:
        query = query.filter(MagazzinoMovimentoModel.mangime_confezionato_id == mangime_confezionato_id)

    rows = query.all()
    return [
        ScortaItem(
            componente_alimentare_id=r[0],
            mangime_confezionato_id=r[1],
            unita_misura=r[2],
            quantita_disponibile=float(r[3] or 0),
        )
        for r in rows
    ]

# --- PRIMA NOTA CATEGORIE ---
@router.get("/prima-nota/categorie", response_model=List[PNCategoriaResponse])
async def list_categorie_api(
    azienda_id: int = Query(..., description="ID azienda"),
    tipo_operazione: Optional[str] = Query(None, description="Filtra per tipo operazione"),
    attive_only: bool = Query(True, description="Mostra solo categorie attive"),
    db: Session = Depends(get_db),
):
    """Lista le categorie Prima Nota per un'azienda"""
    try:
        tipo_op = None
        if tipo_operazione:
            tipo_op = PNTipoOperazione(tipo_operazione)
        categorie = pn_list_categorie(db, azienda_id, tipo_op, attive_only)
        return [PNCategoriaResponse.model_validate(cat, from_attributes=True) for cat in categorie]
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.post("/prima-nota/categorie", response_model=PNCategoriaResponse, status_code=status.HTTP_201_CREATED)
async def create_categoria_api(
    categoria: PNCategoriaCreate,
    db: Session = Depends(get_db),
):
    """Crea una nuova categoria Prima Nota"""
    try:
        entity = pn_create_categoria(db, categoria)
        db.commit()
        db.refresh(entity)
        return PNCategoriaResponse.model_validate(entity, from_attributes=True)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.put("/prima-nota/categorie/{categoria_id}", response_model=PNCategoriaResponse)
async def update_categoria_api(
    categoria_id: int,
    categoria: PNCategoriaUpdate,
    db: Session = Depends(get_db),
):
    """Aggiorna una categoria Prima Nota"""
    try:
        entity = pn_update_categoria(db, categoria_id, categoria)
        db.commit()
        db.refresh(entity)
        return PNCategoriaResponse.model_validate(entity, from_attributes=True)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


@router.delete("/prima-nota/categorie/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_categoria_api(
    categoria_id: int,
    db: Session = Depends(get_db),
):
    """Elimina una categoria Prima Nota"""
    try:
        pn_delete_categoria(db, categoria_id)
        db.commit()
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))
    return None

