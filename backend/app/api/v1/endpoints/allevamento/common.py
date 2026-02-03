"""
Common imports and utilities for Allevamento module
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, date

from app.core.database import get_db
from app.models.allevamento import (
    Azienda,
    Sede,
    Stabilimento,
    Box,
    Animale,
    Movimentazione,
    PianoUscita,
    PianoUscitaAnimale,
)
from app.schemas.allevamento.sede import SedeCreate, SedeUpdate, SedeResponse
from app.schemas.allevamento.stabilimento import StabilimentoCreate, StabilimentoUpdate, StabilimentoResponse
from app.schemas.allevamento.box import BoxCreate, BoxUpdate, BoxResponse
from app.schemas.allevamento.animale import AnimaleCreate, AnimaleUpdate, AnimaleResponse
from app.schemas.allevamento.storico_tipo_allevamento import (
    StoricoTipoAllevamentoCreate,
    StoricoTipoAllevamentoUpdate,
    StoricoTipoAllevamentoResponse
)
from app.schemas.allevamento.movimentazione import MovimentazioneCreate, MovimentazioneResponse
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


class AssegnaAnimaliRequest(BaseModel):
    azienda_id: int
    codice_stalla: Optional[str] = None
    distribuzione_uniforme: bool = True


class RiassegnaAnimaliRequest(BaseModel):
    azienda_id: int
    codice_stalla: Optional[str] = None
    rimuovi_assegnazioni_esistenti: bool = True


def get_piano_or_404(db: Session, piano_id: int) -> PianoUscita:
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


def build_piano_detail(db: Session, piano: PianoUscita) -> PianoUscitaDetailResponse:
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

