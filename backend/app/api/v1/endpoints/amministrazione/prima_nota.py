"""
Prima Nota endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.models.amministrazione.pn import PNTipoOperazione, PNStatoMovimento, PNMovimento
from app.schemas.amministrazione import (
    PNContoIbanCreate,
    PNContoIbanResponse,
    PNContoIbanUpdate,
    PNContoCreate,
    PNContoResponse,
    PNContoUpdate,
    PNCategoriaCreate,
    PNCategoriaUpdate,
    PNCategoriaResponse,
    PNSetupResponse,
    PNMovimentiListResponse,
    PNMovimentoCreate,
    PNMovimentoUpdate,
    PNMovimentoResponse,
    PNDocumentoApertoResponse,
    SoccidaAccontoCreate,
    SoccidaAccontoResponse,
    SyncFattureResponse,
)
from app.services.amministrazione.prima_nota_service import (
    get_setup as pn_get_setup,
    create_conto as pn_create_conto,
    update_conto as pn_update_conto,
    delete_conto as pn_delete_conto,
    add_conto_iban as pn_add_conto_iban,
    update_conto_iban as pn_update_conto_iban,
    delete_conto_iban as pn_delete_conto_iban,
    list_movimenti as pn_list_movimenti,
    create_movimento as pn_create_movimento,
    update_movimento as pn_update_movimento,
    delete_movimento as pn_delete_movimento,
    conferma_movimento as pn_conferma_movimento,
    get_documenti_aperti as pn_get_documenti_aperti,
    movimento_to_response,
    create_categoria as pn_create_categoria,
    update_categoria as pn_update_categoria,
    delete_categoria as pn_delete_categoria,
    list_categorie as pn_list_categorie,
)
from app.services.amministrazione.prima_nota_automation import (
    ensure_prima_nota_for_soccida_acconto,
    sync_prima_nota_fatture,
)
from app.models.amministrazione.partita_animale_movimento_finanziario import PartitaMovimentoFinanziario
from app.schemas.amministrazione.partita_animale import PartitaMovimentoFinanziarioResponse

router = APIRouter()


@router.get("/prima-nota/setup", response_model=PNSetupResponse)
async def prima_nota_setup(
    azienda_id: int = Query(..., description="ID azienda"),
    only_financial: bool = Query(False, description="Mostra solo conti finanziari (Cassa/Banca) per operazioni manuali"),
    db: Session = Depends(get_db),
):
    """Get Prima Nota setup (conti, categorie, etc.)"""
    try:
        response = pn_get_setup(db, azienda_id, only_financial=only_financial)
        db.commit()
        return response
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/prima-nota/sync-fatture", response_model=SyncFattureResponse)
async def prima_nota_sync_fatture(
    azienda_id: Optional[int] = Query(None, description="Se specificato, sincronizza solo le fatture di questa azienda; altrimenti tutte"),
    db: Session = Depends(get_db),
):
    """
    Sincronizza tutte le fatture con la Prima Nota.

    Per ogni fattura (non eliminata) crea o aggiorna i movimenti di Prima Nota
    con la corretta divisione: imponibile (Vendite/Acquisti), IVA (IVA vendite/acquisti),
    crediti vs clienti o debiti vs fornitori. Le fatture inserite o modificate
    in seguito continueranno a essere gestite automaticamente dai hook esistenti.
    """
    try:
        response = sync_prima_nota_fatture(db, azienda_id=azienda_id)
        db.commit()
        return response
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/prima-nota/conti", response_model=PNContoResponse, status_code=status.HTTP_201_CREATED)
async def prima_nota_create_conto_api(
    conto: PNContoCreate,
    db: Session = Depends(get_db),
):
    """Create a new conto"""
    try:
        entity = pn_create_conto(db, conto)
        db.commit()
        db.refresh(entity)
        return PNContoResponse.model_validate(entity, from_attributes=True)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.put("/prima-nota/conti/{conto_id}", response_model=PNContoResponse)
async def prima_nota_update_conto_api(
    conto_id: int,
    conto: PNContoUpdate,
    db: Session = Depends(get_db),
):
    """Update a conto"""
    try:
        entity = pn_update_conto(db, conto_id, conto)
        db.commit()
        db.refresh(entity)
        return PNContoResponse.model_validate(entity, from_attributes=True)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(exc))


@router.delete("/prima-nota/conti/{conto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def prima_nota_delete_conto_api(
    conto_id: int,
    db: Session = Depends(get_db),
):
    """Delete a conto"""
    try:
        pn_delete_conto(db, conto_id)
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


@router.post(
    "/prima-nota/conti/{conto_id}/iban",
    response_model=PNContoIbanResponse,
    status_code=status.HTTP_201_CREATED,
)
async def prima_nota_create_iban(
    conto_id: int,
    iban: PNContoIbanCreate,
    db: Session = Depends(get_db),
):
    """Create a new IBAN for a conto"""
    payload = iban.model_copy(update={"conto_id": conto_id})
    try:
        entity = pn_add_conto_iban(db, conto_id, payload)
        db.commit()
        db.refresh(entity)
        return PNContoIbanResponse.model_validate(entity, from_attributes=True)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


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


@router.put("/prima-nota/conti/iban/{iban_id}", response_model=PNContoIbanResponse)
async def prima_nota_update_iban(
    iban_id: int,
    iban: PNContoIbanUpdate,
    db: Session = Depends(get_db),
):
    """Update an IBAN"""
    try:
        entity = pn_update_conto_iban(db, iban_id, iban)
        db.commit()
        db.refresh(entity)
        return PNContoIbanResponse.model_validate(entity, from_attributes=True)
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


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


@router.delete("/prima-nota/conti/iban/{iban_id}", status_code=status.HTTP_204_NO_CONTENT)
async def prima_nota_delete_iban(
    iban_id: int,
    db: Session = Depends(get_db),
):
    """Delete an IBAN"""
    try:
        pn_delete_conto_iban(db, iban_id)
        db.commit()
    except LookupError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return None


@router.get("/prima-nota/movimenti", response_model=PNMovimentiListResponse)
async def prima_nota_movimenti(
    azienda_id: int = Query(..., description="ID azienda"),
    conto_id: Optional[int] = Query(None),
    tipo_operazione: Optional[PNTipoOperazione] = Query(None),
    stato: Optional[PNStatoMovimento] = Query(None),
    categoria_id: Optional[int] = Query(None),
    attrezzatura_id: Optional[int] = Query(None),
    partita_id: Optional[int] = Query(None, description="Filtra per partita animale"),
    contratto_soccida_id: Optional[int] = Query(None, description="Filtra per contratto soccida"),
    search: Optional[str] = Query(None),
    data_da: Optional[date] = Query(None),
    data_a: Optional[date] = Query(None),
    db: Session = Depends(get_db),
):
    """Get all movimenti con filtri"""
    return pn_list_movimenti(
        db,
        azienda_id,
        conto_id=conto_id,
        tipo_operazione=tipo_operazione,
        stato=stato,
        categoria_id=categoria_id,
        attrezzatura_id=attrezzatura_id,
        partita_id=partita_id,
        contratto_soccida_id=contratto_soccida_id,
        search=search,
        data_da=data_da,
        data_a=data_a,
    )


@router.post("/prima-nota/movimenti", response_model=PNMovimentoResponse, status_code=status.HTTP_201_CREATED)
async def prima_nota_create_movimento_api(
    movimento: PNMovimentoCreate,
    db: Session = Depends(get_db),
):
    """Create a new movimento"""
    try:
        entity = pn_create_movimento(db, movimento)
        db.commit()
        db.refresh(entity)
        return movimento_to_response(entity)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/prima-nota/movimenti/{movimento_id}", response_model=PNMovimentoResponse)
async def prima_nota_update_movimento_api(
    movimento_id: int,
    movimento: PNMovimentoUpdate,
    db: Session = Depends(get_db),
):
    """Update a movimento"""
    try:
        entity = pn_update_movimento(db, movimento_id, movimento)
        db.commit()
        db.refresh(entity)
        return movimento_to_response(entity)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.get("/prima-nota/movimenti/{movimento_id}", response_model=PNMovimentoResponse)
async def prima_nota_get_movimento_api(
    movimento_id: int,
    db: Session = Depends(get_db),
):
    """Get a single movimento by ID"""
    try:
        movimento = (
            db.query(PNMovimento)
            .options(
                joinedload(PNMovimento.documenti),
                joinedload(PNMovimento.conto),
                joinedload(PNMovimento.conto_destinazione),
                joinedload(PNMovimento.categoria),
                joinedload(PNMovimento.attrezzatura),
                joinedload(PNMovimento.movimenti_partita).joinedload(PartitaMovimentoFinanziario.partita),
            )
            .filter(PNMovimento.id == movimento_id, PNMovimento.deleted_at.is_(None))
            .first()
        )
        if not movimento:
            raise HTTPException(status_code=404, detail="Movimento non trovato")
        return movimento_to_response(movimento)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/prima-nota/movimenti/{movimento_id}/conferma", response_model=PNMovimentoResponse)
async def prima_nota_conferma_movimento_api(
    movimento_id: int,
    db: Session = Depends(get_db),
):
    """Conferma a movimento"""
    try:
        entity = pn_conferma_movimento(db, movimento_id)
        db.commit()
        db.refresh(entity)
        return movimento_to_response(entity)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))


@router.delete("/prima-nota/movimenti/{movimento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def prima_nota_delete_movimento_api(
    movimento_id: int,
    db: Session = Depends(get_db),
):
    """Delete a movimento"""
    try:
        pn_delete_movimento(db, movimento_id)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(exc))
    return None


@router.get("/prima-nota/documenti-aperti", response_model=List[PNDocumentoApertoResponse])
async def prima_nota_documenti_aperti(
    azienda_id: int = Query(..., description="ID azienda"),
    db: Session = Depends(get_db),
):
    """Get all documenti aperti (fatture non pagate, etc.)"""
    return pn_get_documenti_aperti(db, azienda_id)


@router.post("/prima-nota/soccida-acconto", response_model=SoccidaAccontoResponse, status_code=status.HTTP_201_CREATED)
async def registra_acconto_soccida_monetizzata(
    payload: SoccidaAccontoCreate,
    db: Session = Depends(get_db),
):
    """
    Registra acconto per soccida monetizzata.
    Crea movimento Prima Nota e PartitaMovimentoFinanziario.
    """
    try:
        # Recupera azienda_id dal contratto
        from app.models.amministrazione.contratto_soccida import ContrattoSoccida
        contratto = (
            db.query(ContrattoSoccida)
            .filter(
                ContrattoSoccida.id == payload.contratto_id,
                ContrattoSoccida.deleted_at.is_(None),
            )
            .first()
        )
        if not contratto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contratto soccida {payload.contratto_id} non trovato"
            )
        
        if not contratto.monetizzata:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Il contratto non è di tipo monetizzato"
            )
        
        # Crea movimento Prima Nota e PartitaMovimentoFinanziario (acconto o saldo a chiusura)
        movimento = ensure_prima_nota_for_soccida_acconto(
            db=db,
            contratto_id=payload.contratto_id,
            importo=payload.importo,
            data=payload.data,
            partita_ids=payload.partita_ids,
            azienda_id=contratto.azienda_id,
            note=payload.note,
            tipo=payload.tipo or "acconto",
        )
        
        db.commit()
        db.refresh(movimento)
        
        # Recupera PartitaMovimentoFinanziario creati
        partita_movimenti = []
        acconto_per_capo = {}
        
        if payload.partita_ids:
            from app.models.amministrazione.partita_animale import PartitaAnimale
            partite = (
                db.query(PartitaAnimale)
                .filter(PartitaAnimale.id.in_(payload.partita_ids))
                .all()
            )
            
            for partita in partite:
                movimento_finanziario = (
                    db.query(PartitaMovimentoFinanziario)
                    .filter(
                        PartitaMovimentoFinanziario.partita_id == partita.id,
                        PartitaMovimentoFinanziario.pn_movimento_id == movimento.id,
                    )
                    .first()
                )
                
                if movimento_finanziario:
                    partita_movimenti.append(
                        PartitaMovimentoFinanziarioResponse.model_validate(
                            movimento_finanziario, from_attributes=True
                        ).model_dump()
                    )
                    
                    # Calcola acconto per capo
                    if partita.numero_capi and partita.numero_capi > 0:
                        acconto_per_capo[partita.id] = float(movimento_finanziario.importo / partita.numero_capi)
        
        movimento_response = movimento_to_response(movimento)
        
        return SoccidaAccontoResponse(
            movimento_id=movimento.id,
            movimento=movimento_response,
            partita_movimenti=partita_movimenti,
            acconto_per_capo=acconto_per_capo,
        )
    except HTTPException:
        db.rollback()
        raise
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc))


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

