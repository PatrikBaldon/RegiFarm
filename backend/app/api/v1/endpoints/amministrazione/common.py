"""
Common imports and utilities for Amministrazione module
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, selectinload, joinedload
from sqlalchemy import func, or_
from typing import List, Optional, Dict
from datetime import datetime, date
from decimal import Decimal, InvalidOperation
from pydantic import BaseModel
import asyncio
import json
import tempfile
import os

from app.core.database import get_db

# Models
from app.models.amministrazione import (
    FornitoreTipo,
    VenditaProdottoAgricolo,
    ProdottoDerivato,
    FatturaAmministrazione,
    FatturaAmministrazionePagamento,
    PartitaAnimale,
    ModalitaGestionePartita,
    PartitaAnimaleAnimale,
    PartitaMovimentoFinanziario,
    Pagamento,
    PrimaNota,
    Attrezzatura,
    ScadenzaAttrezzatura,
    Ammortamento,
    AssicurazioneAziendale,
    ContrattoSoccida,
)
from app.models.amministrazione.pn import PNMovimento, PNTipoOperazione, PNStatoMovimento
from app.models.amministrazione import Fornitore
from app.models.allevamento.azienda import Azienda
from app.models.allevamento.animale import Animale
from app.models.allevamento.sede import Sede
from app.models.allevamento.box import Box
from app.models.allevamento.stabilimento import Stabilimento
from app.models.terreni.terreno import Terreno

# Schemas
from app.schemas.amministrazione import (
    AmmortamentoCreate,
    AmmortamentoResponse,
    AmmortamentoUpdate,
    AssicurazioneAziendaleCreate,
    AssicurazioneAziendaleResponse,
    AssicurazioneAziendaleSummary,
    AssicurazioneAziendaleUpdate,
    AttrezzaturaCreate,
    AttrezzaturaResponse,
    AttrezzaturaUpdate,
    AttrezzaturaWithDetails,
    AttrezzaturaCostWindow,
    AttrezzaturaCostiRiepilogo,
    FatturaAmministrazioneCreate,
    FatturaAmministrazioneResponse,
    FatturaAmministrazioneUpdate,
    FornitoreTipoCreate,
    FornitoreTipoResponse,
    FornitoreTipoUpdate,
    PagamentoCreate,
    PagamentoResponse,
    PagamentoUpdate,
    PartitaAnimaleConfirm,
    PartitaAnimaleCreate,
    PartitaAnimaleResponse,
    PartitaAnimaleUpdate,
    PartitaMovimentoFinanziarioCreate,
    PartitaMovimentoFinanziarioUpdate,
    PartitaMovimentoFinanziarioResponse,
    PrimaNotaCreate,
    PrimaNotaResponse,
    PrimaNotaSummary,
    PrimaNotaUpdate,
    PNContoIbanCreate,
    PNContoIbanResponse,
    PNContoIbanUpdate,
    PNContoCreate,
    PNContoResponse,
    PNContoUpdate,
    PNSetupResponse,
    PNMovimentiListResponse,
    PNMovimentoCreate,
    PNMovimentoUpdate,
    PNMovimentoResponse,
    PNDocumentoApertoResponse,
    ProdottoDerivatoCreate,
    ProdottoDerivatoResponse,
    ProdottoDerivatoUpdate,
    ScadenzaAttrezzaturaCreate,
    ScadenzaAttrezzaturaResponse,
    ScadenzaAttrezzaturaUpdate,
    VenditaProdottoAgricoloCreate,
    VenditaProdottoAgricoloResponse,
    VenditaProdottoAgricoloUpdate,
    ContrattoSoccidaCreate,
    ContrattoSoccidaUpdate,
    ContrattoSoccidaResponse,
    ContrattoSoccidaWithRelations,
)


def build_pagamento_from_payload(pagamento_input):
    """Build FatturaAmministrazionePagamento from payload"""
    if pagamento_input is None:
        return None
    if hasattr(pagamento_input, "dict"):
        data = pagamento_input.dict(exclude_unset=True)
    else:
        data = dict(pagamento_input)
    # Evita di creare record vuoti
    if not any(
        [
            data.get("modalita_pagamento"),
            data.get("importo") not in (None, ""),
            data.get("data_scadenza"),
            data.get("iban"),
            data.get("banca"),
            data.get("note"),
        ]
    ):
        return None
    return FatturaAmministrazionePagamento(
        modalita_pagamento=data.get("modalita_pagamento"),
        data_scadenza=data.get("data_scadenza"),
        importo=data.get("importo"),
        iban=data.get("iban"),
        banca=data.get("banca"),
        note=data.get("note"),
    )


def apply_default_categoria_to_fatture(
    db: Session, 
    fornitore_id: int, 
    categoria: Optional[str], 
    macrocategoria: Optional[str] = None
) -> None:
    """
    Aggiorna le fatture amministrative collegate a un fornitore assegnando la categoria
    e macrocategoria predefinita solo se attualmente non valorizzate.
    """
    if not fornitore_id:
        return

    base_filters = [
        FatturaAmministrazione.fornitore_id == fornitore_id,
        FatturaAmministrazione.deleted_at.is_(None),
    ]
    
    # Aggiorna categoria se fornita e la fattura non ha categoria
    if categoria:
        db.query(FatturaAmministrazione).filter(
            *base_filters,
            or_(
                FatturaAmministrazione.categoria.is_(None),
                FatturaAmministrazione.categoria == "",
            ),
        ).update({FatturaAmministrazione.categoria: categoria}, synchronize_session=False)
    
    # Aggiorna macrocategoria se fornita e la fattura non ha macrocategoria
    if macrocategoria:
        db.query(FatturaAmministrazione).filter(
            *base_filters,
            or_(
                FatturaAmministrazione.macrocategoria.is_(None),
                FatturaAmministrazione.macrocategoria == "",
            ),
        ).update({FatturaAmministrazione.macrocategoria: macrocategoria}, synchronize_session=False)

