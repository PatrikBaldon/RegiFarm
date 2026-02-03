"""
Piani di Uscita endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

from app.core.database import get_db
from app.models.allevamento import Azienda, Sede, Stabilimento, Box, Animale, PianoUscita, PianoUscitaAnimale
from app.schemas.allevamento.piano_uscita import (
    PianoUscitaCreate,
    PianoUscitaUpdate,
    PianoUscitaResponse,
    PianoUscitaDetailResponse,
    PianoUscitaAddAnimaliRequest,
    PianoUscitaAnimaleResponse,
)
# PDF imports lazy - caricati solo quando servono per risparmiare memoria


class PianoUscitaRequest(BaseModel):
    animale_ids: List[int]


def _get_piano_or_404(db: Session, piano_id: int) -> PianoUscita:
    piano = (
        db.query(PianoUscita)
        .filter(
            PianoUscita.id == piano_id,
            PianoUscita.deleted_at.is_(None),
        )
        .first()
    )
    if not piano:
        raise HTTPException(status_code=404, detail="Piano di uscita non trovato")
    return piano


def _build_piano_detail(db: Session, piano: PianoUscita) -> PianoUscitaDetailResponse:
    links = (
        db.query(PianoUscitaAnimale)
        .join(Animale)
        .outerjoin(Box, Animale.box_id == Box.id)
        .outerjoin(Stabilimento, Box.stabilimento_id == Stabilimento.id)
        .outerjoin(Sede, Stabilimento.sede_id == Sede.id)
        .filter(
            PianoUscitaAnimale.piano_uscita_id == piano.id,
            Animale.deleted_at.is_(None),
        )
        .all()
    )

    animali_data: List[PianoUscitaAnimaleResponse] = []
    for link in links:
        animale = link.animale
        if not animale or animale.deleted_at:
            continue

        nome_box = None
        nome_stabilimento = None
        nome_sede = None

        if animale.box:
            nome_box = animale.box.nome
            if animale.box.stabilimento:
                nome_stabilimento = animale.box.stabilimento.nome
                if animale.box.stabilimento.sede:
                    nome_sede = animale.box.stabilimento.sede.nome
        elif animale.codice_azienda_anagrafe:
            sede = (
                db.query(Sede)
                .filter(
                    Sede.codice_stalla == animale.codice_azienda_anagrafe,
                    Sede.azienda_id == piano.azienda_id,
                    Sede.deleted_at.is_(None),
                )
                .first()
            )
            if sede:
                nome_sede = sede.nome

        animali_data.append(
            PianoUscitaAnimaleResponse(
                id=animale.id,
                auricolare=animale.auricolare,
                stato=animale.stato,
                nome_sede=nome_sede,
                nome_stabilimento=nome_stabilimento,
                nome_box=nome_box,
            )
        )

    return PianoUscitaDetailResponse(
        id=piano.id,
        azienda_id=piano.azienda_id,
        nome=piano.nome,
        note=piano.note,
        stato=piano.stato,
        data_uscita=piano.data_uscita,
        created_at=piano.created_at,
        updated_at=piano.updated_at,
        animali=animali_data,
    )


router = APIRouter()

@router.get("/piani-uscita", response_model=List[PianoUscitaResponse])
async def list_piani_uscita(
    azienda_id: int = Query(..., description="Identificativo azienda"),
    stato: Optional[str] = Query(None, description="Filtra per stato del piano"),
    db: Session = Depends(get_db),
):
    """List piani di uscita for an azienda"""
    query = db.query(PianoUscita).filter(
        PianoUscita.deleted_at.is_(None),
        PianoUscita.azienda_id == azienda_id,
    )
    if stato:
        query = query.filter(PianoUscita.stato == stato)
    return query.order_by(PianoUscita.created_at.desc()).all()


@router.get("/piani-uscita/{piano_id}", response_model=PianoUscitaDetailResponse)
async def get_piano_uscita(piano_id: int, db: Session = Depends(get_db)):
    """Retrieve piano di uscita with related animals"""
    piano = _get_piano_or_404(db, piano_id)
    return _build_piano_detail(db, piano)


@router.post("/piani-uscita", response_model=PianoUscitaDetailResponse, status_code=status.HTTP_201_CREATED)
async def create_piano_uscita(payload: PianoUscitaCreate, db: Session = Depends(get_db)):
    """Create a new piano di uscita"""
    azienda = (
        db.query(Azienda)
        .filter(
            Azienda.id == payload.azienda_id,
            Azienda.deleted_at.is_(None),
        )
        .first()
    )
    if not azienda:
        raise HTTPException(status_code=404, detail="Azienda non trovata")

    animale_ids = list(dict.fromkeys(payload.animale_ids))  # preserve order, remove duplicates
    if not animale_ids:
        raise HTTPException(status_code=400, detail="Seleziona almeno un animale da includere")

    animali = (
        db.query(Animale)
        .filter(
            Animale.id.in_(animale_ids),
            Animale.deleted_at.is_(None),
        )
        .all()
    )
    if len(animali) != len(animale_ids):
        raise HTTPException(status_code=404, detail="Alcuni animali non sono stati trovati")

    for animale in animali:
        if animale.azienda_id != payload.azienda_id:
            raise HTTPException(
                status_code=400,
                detail=f"L'animale {animale.auricolare} non appartiene all'azienda selezionata",
            )

    piano = PianoUscita(
        azienda_id=payload.azienda_id,
        nome=payload.nome,
        note=payload.note,
        stato=payload.stato or "bozza",
        data_uscita=payload.data_uscita,
    )
    db.add(piano)
    db.flush()

    for animale in animali:
        db.add(PianoUscitaAnimale(piano_uscita_id=piano.id, animale_id=animale.id))

    db.commit()
    db.refresh(piano)
    return _build_piano_detail(db, piano)


@router.put("/piani-uscita/{piano_id}", response_model=PianoUscitaDetailResponse)
async def update_piano_uscita(
    piano_id: int,
    payload: PianoUscitaUpdate,
    db: Session = Depends(get_db),
):
    """Update piano di uscita"""
    piano = _get_piano_or_404(db, piano_id)

    update_data = payload.dict(exclude_unset=True)
    if "stato" in update_data:
        stato = update_data["stato"]
        if stato and stato not in {"bozza", "confermato", "completato"}:
            raise HTTPException(status_code=400, detail="Stato non valido")

    for field, value in update_data.items():
        setattr(piano, field, value)

    db.commit()
    db.refresh(piano)
    return _build_piano_detail(db, piano)


@router.post("/piani-uscita/{piano_id}/animali", response_model=PianoUscitaDetailResponse)
async def add_animali_to_piano(
    piano_id: int,
    payload: PianoUscitaAddAnimaliRequest,
    db: Session = Depends(get_db),
):
    """Add animals to an existing piano di uscita"""
    piano = _get_piano_or_404(db, piano_id)
    if not payload.animale_ids:
        raise HTTPException(status_code=400, detail="Nessun animale selezionato")

    animale_ids = list(dict.fromkeys(payload.animale_ids))
    animali = (
        db.query(Animale)
        .filter(
            Animale.id.in_(animale_ids),
            Animale.deleted_at.is_(None),
        )
        .all()
    )

    if len(animali) != len(animale_ids):
        raise HTTPException(status_code=404, detail="Alcuni animali non sono stati trovati")

    existing_links = {
        link.animale_id
        for link in db.query(PianoUscitaAnimale).filter(PianoUscitaAnimale.piano_uscita_id == piano.id).all()
    }

    for animale in animali:
        if animale.azienda_id != piano.azienda_id:
            raise HTTPException(
                status_code=400,
                detail=f"L'animale {animale.auricolare} non appartiene all'azienda del piano",
            )
        if animale.id in existing_links:
            continue
        db.add(PianoUscitaAnimale(piano_uscita_id=piano.id, animale_id=animale.id))

    db.commit()
    db.refresh(piano)
    return _build_piano_detail(db, piano)


@router.delete(
    "/piani-uscita/{piano_id}/animali/{animale_id}",
    response_model=PianoUscitaDetailResponse,
)
async def remove_animale_from_piano(
    piano_id: int,
    animale_id: int,
    db: Session = Depends(get_db),
):
    """Remove an animal from a piano di uscita"""
    piano = _get_piano_or_404(db, piano_id)
    link = (
        db.query(PianoUscitaAnimale)
        .filter(
            PianoUscitaAnimale.piano_uscita_id == piano.id,
            PianoUscitaAnimale.animale_id == animale_id,
        )
        .first()
    )
    if not link:
        raise HTTPException(status_code=404, detail="Associazione animale/piano non trovata")

    db.delete(link)
    db.commit()
    db.refresh(piano)
    return _build_piano_detail(db, piano)


@router.delete("/piani-uscita/{piano_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_piano_uscita(piano_id: int, db: Session = Depends(get_db)):
    """Soft delete a piano di uscita"""
    piano = _get_piano_or_404(db, piano_id)
    piano.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ PIANO USCITA PDF ============
@router.post("/piano-uscita/pdf")
async def generate_piano_uscita_pdf_endpoint(
    request: PianoUscitaRequest,
    db: Session = Depends(get_db)
):
    """Genera PDF per piano uscita"""
    # Lazy import per risparmiare memoria all'avvio
    from app.utils.pdf_generator import generate_piano_uscita_pdf
    
    if not request.animale_ids:
        raise HTTPException(status_code=400, detail="Lista animali vuota")
    
    animali = db.query(Animale).filter(
        Animale.id.in_(request.animale_ids),
        Animale.deleted_at.is_(None)
    ).all()
    
    if len(animali) != len(request.animale_ids):
        raise HTTPException(status_code=404, detail="Alcuni animali non trovati")
    
    pdf_bytes = generate_piano_uscita_pdf(animali)
    
    return StreamingResponse(
        iter([pdf_bytes]),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=piano_uscita_{datetime.utcnow().strftime('%Y%m%d')}.pdf"}
    )
