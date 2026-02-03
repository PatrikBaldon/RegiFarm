"""Somministrazioni endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_, and_
from typing import List, Optional, Dict
from datetime import datetime, date
from decimal import Decimal, ROUND_HALF_UP
from collections import defaultdict
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.sanitario import Farmaco, LottoFarmaco, Somministrazione
from app.models.allevamento import Animale, Box, Stabilimento, Sede
from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
from app.models.amministrazione.partita_animale import PartitaAnimale
from app.schemas.sanitario.somministrazione import (
    SomministrazioneCreate, 
    SomministrazioneUpdate, 
    SomministrazioneResponse,
    SomministrazioneGruppoCreate,
    SomministrazioneGruppoResponse
)

router = APIRouter()

# ============ SOMMINISTRAZIONI ============
@router.get("/somministrazioni", response_model=List[SomministrazioneResponse])
async def get_somministrazioni(
    animale_id: Optional[int] = None,
    farmaco_id: Optional[int] = None,
    azienda_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all somministrazioni"""
    query = db.query(Somministrazione).options(
        joinedload(Somministrazione.animale),
        joinedload(Somministrazione.farmaco),
        joinedload(Somministrazione.lotto_farmaco)
    ).filter(Somministrazione.deleted_at.is_(None))
    
    if animale_id is not None:
        query = query.filter(Somministrazione.animale_id == animale_id)
    if farmaco_id is not None:
        query = query.filter(Somministrazione.farmaco_id == farmaco_id)
    if azienda_id is not None:
        # Filtra per azienda tramite animale - usa subquery per evitare problemi con joinedload
        animale_ids = db.query(Animale.id).filter(
            Animale.azienda_id == azienda_id,
            Animale.deleted_at.is_(None)
        ).all()
        animale_id_list = [row[0] for row in animale_ids]
        if animale_id_list:
            query = query.filter(Somministrazione.animale_id.in_(animale_id_list))
        else:
            # Se non ci sono animali, restituisce lista vuota
            return []
    
    return query.order_by(Somministrazione.data_ora.desc()).offset(skip).limit(limit).all()


@router.get("/somministrazioni/{somministrazione_id}", response_model=SomministrazioneResponse)
async def get_somministrazione(somministrazione_id: int, db: Session = Depends(get_db)):
    """Get a specific somministrazione"""
    somministrazione = db.query(Somministrazione).options(
        joinedload(Somministrazione.animale),
        joinedload(Somministrazione.farmaco),
        joinedload(Somministrazione.lotto_farmaco)
    ).filter(
        Somministrazione.id == somministrazione_id,
        Somministrazione.deleted_at.is_(None)
    ).first()
    if not somministrazione:
        raise HTTPException(status_code=404, detail="Somministrazione not found")
    return somministrazione


@router.post("/somministrazioni", response_model=SomministrazioneResponse, status_code=status.HTTP_201_CREATED)
async def create_somministrazione(
    somministrazione: SomministrazioneCreate,
    db: Session = Depends(get_db)
):
    """Create a new somministrazione (scala quantità dal lotto)"""
    # Verifica che l'animale esista
    animale = db.query(Animale).filter(
        Animale.id == somministrazione.animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Verifica che il farmaco esista
    farmaco = db.query(Farmaco).filter(
        Farmaco.id == somministrazione.farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not farmaco:
        raise HTTPException(status_code=404, detail="Farmaco not found")
    
    # Se è specificato un lotto, verifica e scala quantità
    if somministrazione.lotto_farmaco_id:
        lotto = db.query(LottoFarmaco).filter(
            LottoFarmaco.id == somministrazione.lotto_farmaco_id,
            LottoFarmaco.deleted_at.is_(None)
        ).first()
        
        if not lotto:
            raise HTTPException(status_code=404, detail="Lotto farmaco not found")
        
        if lotto.azienda_id != animale.azienda_id:
            raise HTTPException(
                status_code=400,
                detail="Il lotto farmaco non appartiene all'azienda dell'animale"
            )
        
        if lotto.quantita_rimanente < somministrazione.quantita:
            raise HTTPException(
                status_code=400,
                detail=f"Quantità insufficiente. Disponibile: {lotto.quantita_rimanente}"
            )
        
        # Scala la quantità
        lotto.quantita_rimanente -= somministrazione.quantita
        db.add(lotto)
    
    # Crea somministrazione
    if not somministrazione.data_ora:
        somministrazione.data_ora = datetime.now()
    
    db_somministrazione = Somministrazione(**somministrazione.dict())
    db.add(db_somministrazione)
    db.commit()
    db.refresh(db_somministrazione)
    return db_somministrazione


@router.put("/somministrazioni/{somministrazione_id}", response_model=SomministrazioneResponse)
async def update_somministrazione(
    somministrazione_id: int,
    somministrazione: SomministrazioneUpdate,
    db: Session = Depends(get_db)
):
    """Update a somministrazione"""
    db_somministrazione = db.query(Somministrazione).filter(
        Somministrazione.id == somministrazione_id,
        Somministrazione.deleted_at.is_(None)
    ).first()
    if not db_somministrazione:
        raise HTTPException(status_code=404, detail="Somministrazione not found")
    
    # Determina animale finale (nuovo o esistente)
    new_animale_id = somministrazione.animale_id if somministrazione.animale_id is not None else db_somministrazione.animale_id
    new_farmaco_id = somministrazione.farmaco_id if somministrazione.farmaco_id is not None else db_somministrazione.farmaco_id
    new_quantita = somministrazione.quantita if somministrazione.quantita is not None else db_somministrazione.quantita
    
    # Verifica che animale esista se viene cambiato
    if somministrazione.animale_id is not None and somministrazione.animale_id != db_somministrazione.animale_id:
        animale = db.query(Animale).filter(
            Animale.id == somministrazione.animale_id,
            Animale.deleted_at.is_(None)
        ).first()
        if not animale:
            raise HTTPException(status_code=404, detail="Animale not found")
    
    # Verifica che farmaco esista se viene cambiato
    if somministrazione.farmaco_id is not None and somministrazione.farmaco_id != db_somministrazione.farmaco_id:
        farmaco = db.query(Farmaco).filter(
            Farmaco.id == somministrazione.farmaco_id,
            Farmaco.deleted_at.is_(None)
        ).first()
        if not farmaco:
            raise HTTPException(status_code=404, detail="Farmaco not found")
    
    # Gestione lotto farmaco
    old_lotto_id = db_somministrazione.lotto_farmaco_id
    
    # Se cambia farmaco senza specificare lotto, rimuovi il riferimento al lotto
    if somministrazione.farmaco_id is not None and somministrazione.farmaco_id != db_somministrazione.farmaco_id:
        if somministrazione.lotto_farmaco_id is None:
            # Ripristina quantità nel vecchio lotto
            if old_lotto_id:
                old_lotto = db.query(LottoFarmaco).filter(LottoFarmaco.id == old_lotto_id).first()
                if old_lotto:
                    old_lotto.quantita_rimanente += db_somministrazione.quantita
    
    # Gestione cambiamento lotto o quantità
    if somministrazione.lotto_farmaco_id is not None or somministrazione.quantita is not None or old_lotto_id:
        old_quantita = db_somministrazione.quantita
        new_lotto_id = somministrazione.lotto_farmaco_id if somministrazione.lotto_farmaco_id is not None else old_lotto_id
        
        # Se stesso lotto ma cambia quantità
        if old_lotto_id and new_lotto_id == old_lotto_id and somministrazione.quantita is not None:
            lotto = db.query(LottoFarmaco).filter(LottoFarmaco.id == old_lotto_id).first()
            if lotto:
                diff = new_quantita - old_quantita
                if lotto.quantita_rimanente + diff < 0:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Quantità insufficiente nel lotto. Disponibile: {lotto.quantita_rimanente + old_quantita}"
                    )
                lotto.quantita_rimanente += diff
        
        # Se cambia lotto
        elif new_lotto_id != old_lotto_id:
            # Ripristina nel vecchio lotto
            if old_lotto_id:
                old_lotto = db.query(LottoFarmaco).filter(LottoFarmaco.id == old_lotto_id).first()
                if old_lotto:
                    old_lotto.quantita_rimanente += old_quantita
            
            # Scala dal nuovo lotto (se specificato)
            if new_lotto_id:
                new_lotto = db.query(LottoFarmaco).filter(
                    LottoFarmaco.id == new_lotto_id,
                    LottoFarmaco.deleted_at.is_(None)
                ).first()
                
                if not new_lotto:
                    raise HTTPException(status_code=404, detail="Lotto farmaco not found")
                
                # Verifica che il lotto appartenga all'azienda dell'animale
                animale = db.query(Animale).filter(
                    Animale.id == new_animale_id,
                    Animale.deleted_at.is_(None)
                ).first()
                
                if animale and new_lotto.azienda_id != animale.azienda_id:
                    raise HTTPException(
                        status_code=400,
                        detail="Il lotto farmaco non appartiene all'azienda dell'animale"
                    )
                
                # Verifica quantità disponibile
                if new_lotto.quantita_rimanente < new_quantita:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Quantità insufficiente nel lotto. Disponibile: {new_lotto.quantita_rimanente}"
                    )
                
                # Scala la quantità dal nuovo lotto
                new_lotto.quantita_rimanente -= new_quantita
    
    update_data = somministrazione.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_somministrazione, field, value)
    
    db.commit()
    db.refresh(db_somministrazione)
    return db_somministrazione


@router.delete("/somministrazioni/{somministrazione_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_somministrazione(somministrazione_id: int, db: Session = Depends(get_db)):
    """Delete a somministrazione (ripristina quantità nel lotto)"""
    db_somministrazione = db.query(Somministrazione).filter(
        Somministrazione.id == somministrazione_id,
        Somministrazione.deleted_at.is_(None)
    ).first()
    if not db_somministrazione:
        raise HTTPException(status_code=404, detail="Somministrazione not found")
    
    # Ripristina quantità nel lotto se presente
    if db_somministrazione.lotto_farmaco_id:
        lotto = db.query(LottoFarmaco).filter(
            LottoFarmaco.id == db_somministrazione.lotto_farmaco_id
        ).first()
        if lotto:
            lotto.quantita_rimanente += db_somministrazione.quantita
    
    db_somministrazione.deleted_at = datetime.now()
    db.commit()
    return None


# ============ SOMMINISTRAZIONI DI GRUPPO ============
def _resolve_target_context_somministrazione(db: Session, target_tipo: str, target_id: int) -> dict:
    """Risolve il contesto target per somministrazioni di gruppo (simile ad alimentazione)"""
    target_tipo = (target_tipo or "").lower()
    if target_tipo not in {"box", "stabilimento", "sede"}:
        raise HTTPException(status_code=400, detail="Tipo di target non valido. Deve essere: box, stabilimento o sede")

    if target_tipo == "box":
        box = (
            db.query(Box)
            .options(joinedload(Box.stabilimento).joinedload(Stabilimento.sede))
            .filter(Box.id == target_id, Box.deleted_at.is_(None))
            .first()
        )
        if not box or not box.stabilimento or box.stabilimento.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Box non trovato o disattivato")
        sede = box.stabilimento.sede
        if not sede or sede.deleted_at is not None:
            raise HTTPException(status_code=400, detail="La sede associata al box non è valida")
        return {
            "target_tipo": target_tipo,
            "target_id": target_id,
            "boxes": [box],
            "box_ids": [box.id],
            "boxes_map": {box.id: box},
            "stabilimento_ids": [box.stabilimento_id],
            "sede_id": sede.id,
            "sede_codice_stalla": sede.codice_stalla,
            "azienda_id": sede.azienda_id,
            "target_label": box.nome,
        }

    if target_tipo == "stabilimento":
        stabilimento = (
            db.query(Stabilimento)
            .options(joinedload(Stabilimento.sede))
            .filter(Stabilimento.id == target_id, Stabilimento.deleted_at.is_(None))
            .first()
        )
        if not stabilimento or not stabilimento.sede or stabilimento.sede.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Stabilimento non trovato")
        boxes = (
            db.query(Box)
            .filter(Box.stabilimento_id == stabilimento.id, Box.deleted_at.is_(None))
            .all()
        )
        boxes_map = {b.id: b for b in boxes}
        return {
            "target_tipo": target_tipo,
            "target_id": target_id,
            "boxes": boxes,
            "box_ids": list(boxes_map.keys()),
            "boxes_map": boxes_map,
            "stabilimento_ids": [stabilimento.id],
            "sede_id": stabilimento.sede.id,
            "sede_codice_stalla": stabilimento.sede.codice_stalla,
            "azienda_id": stabilimento.sede.azienda_id,
            "target_label": f"{stabilimento.nome} ({stabilimento.sede.nome})",
        }

    # target_tipo == "sede"
    sede = (
        db.query(Sede)
        .options(joinedload(Sede.stabilimenti).joinedload(Stabilimento.box))
        .filter(Sede.id == target_id, Sede.deleted_at.is_(None))
        .first()
    )
    if not sede:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    boxes: list[Box] = []
    for stabilimento in sede.stabilimenti:
        if getattr(stabilimento, "deleted_at", None) is not None:
            continue
        boxes.extend([b for b in stabilimento.box if getattr(b, "deleted_at", None) is None])
    boxes_map = {b.id: b for b in boxes}
    return {
        "target_tipo": target_tipo,
        "target_id": target_id,
        "boxes": boxes,
        "box_ids": list(boxes_map.keys()),
        "boxes_map": boxes_map,
        "stabilimento_ids": [st.id for st in sede.stabilimenti if getattr(st, "deleted_at", None) is None],
        "sede_id": sede.id,
        "sede_codice_stalla": sede.codice_stalla,
        "azienda_id": sede.azienda_id,
        "target_label": sede.nome,
    }


def _fetch_animals_for_somministrazione(db: Session, context: dict, data_riferimento: date) -> List[Animale]:
    """Recupera animali presenti nel target per somministrazione (esclude automaticamente deceduti)"""
    query = (
        db.query(Animale)
        .options(joinedload(Animale.box).joinedload(Box.stabilimento))
        .filter(
            Animale.deleted_at.is_(None),
            Animale.stato != 'deceduto',  # Esclude automaticamente deceduti
            Animale.data_arrivo <= data_riferimento,
            or_(Animale.data_uscita.is_(None), Animale.data_uscita > data_riferimento),
        )
    )

    if context["target_tipo"] == "box":
        return query.filter(Animale.box_id == context["target_id"]).all()

    filters = []
    if context["box_ids"]:
        filters.append(Animale.box_id.in_(context["box_ids"]))
    if context["target_tipo"] == "sede" and context.get("sede_codice_stalla"):
        filters.append(
            and_(
                Animale.box_id.is_(None),
                Animale.codice_azienda_anagrafe == context["sede_codice_stalla"],
            )
        )

    if filters:
        return query.filter(or_(*filters)).all()

    return []


@router.get("/somministrazioni-gruppo/animali-candidati", response_model=Dict)
async def get_animali_candidati_somministrazione(
    target_tipo: str = Query(..., description="box, stabilimento o sede"),
    target_id: int = Query(..., description="ID del target"),
    data_riferimento: Optional[date] = Query(None, description="Data di riferimento (default: oggi)"),
    db: Session = Depends(get_db)
):
    """
    Ottiene la lista di animali candidati per somministrazione di gruppo,
    raggruppati per partita di ingresso.
    Esclude automaticamente i deceduti.
    """
    if not data_riferimento:
        data_riferimento = date.today()
    
    context = _resolve_target_context_somministrazione(db, target_tipo, target_id)
    animali = _fetch_animals_for_somministrazione(db, context, data_riferimento)
    
    if not animali:
        return {
            "target_tipo": context["target_tipo"],
            "target_id": context["target_id"],
            "target_label": context["target_label"],
            "totale_animali": 0,
            "partite": [],
            "animali_senza_partita": []
        }
    
    # Recupera partite di ingresso per ogni animale
    animale_ids = [a.id for a in animali]
    partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale, Animale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id.in_(animale_ids),
            PartitaAnimale.tipo == 'ingresso',
            PartitaAnimale.deleted_at.is_(None)
        )
        .order_by(PartitaAnimale.data.desc())
        .all()
    )
    
    # Mappa animale_id -> partita di ingresso
    animale_to_partita = {}
    for join_rec, partita, animale in partite_join:
        if animale.id not in animale_to_partita:
            animale_to_partita[animale.id] = partita
    
    # Raggruppa animali per partita
    partite_map: Dict[int, Dict] = {}
    animali_senza_partita = []
    
    for animale in animali:
        partita = animale_to_partita.get(animale.id)
        if partita:
            if partita.id not in partite_map:
                partite_map[partita.id] = {
                    "partita_id": partita.id,
                    "numero_partita": partita.numero_partita,
                    "data": partita.data,
                    "numero_capi": partita.numero_capi,
                    "animali": []
                }
            box_nome = None
            if animale.box_id and animale.box_id in context["boxes_map"]:
                box_nome = context["boxes_map"][animale.box_id].nome
            partite_map[partita.id]["animali"].append({
                "animale_id": animale.id,
                "auricolare": animale.auricolare,
                "stato": animale.stato,
                "partita_ingresso_id": partita.id,
                "partita_ingresso_numero": partita.numero_partita,
                "partita_ingresso_data": partita.data,
                "box_id": animale.box_id,
                "box_nome": box_nome
            })
        else:
            box_nome = None
            if animale.box_id and animale.box_id in context["boxes_map"]:
                box_nome = context["boxes_map"][animale.box_id].nome
            animali_senza_partita.append({
                "animale_id": animale.id,
                "auricolare": animale.auricolare,
                "stato": animale.stato,
                "partita_ingresso_id": None,
                "partita_ingresso_numero": None,
                "partita_ingresso_data": None,
                "box_id": animale.box_id,
                "box_nome": box_nome
            })
    
    return {
        "target_tipo": context["target_tipo"],
        "target_id": context["target_id"],
        "target_label": context["target_label"],
        "totale_animali": len(animali),
        "partite": list(partite_map.values()),
        "animali_senza_partita": animali_senza_partita
    }


@router.post("/somministrazioni-gruppo", response_model=SomministrazioneGruppoResponse, status_code=status.HTTP_201_CREATED)
async def create_somministrazioni_gruppo(
    data: SomministrazioneGruppoCreate,
    db: Session = Depends(get_db)
):
    """
    Crea somministrazioni di gruppo per tutti gli animali presenti nel target,
    escludendo quelli specificati.
    Divide equamente la quantità totale per numero di animali inclusi.
    """
    if not data.data_ora:
        data_riferimento = datetime.now().date()
    else:
        data_riferimento = data.data_ora.date()
    
    # Risolvi target e recupera animali
    context = _resolve_target_context_somministrazione(db, data.target_tipo, data.target_id)
    animali_candidati = _fetch_animals_for_somministrazione(db, context, data_riferimento)
    
    if not animali_candidati:
        raise HTTPException(status_code=400, detail="Nessun animale presente per il target selezionato")
    
    # Applica esclusioni
    animali_esclusi_set = set(data.animali_esclusi)
    partite_escluse_set = set(data.partite_escluse)
    animali_reinclusi_set = set(data.animali_reinclusi)
    
    # Recupera partite di ingresso per determinare esclusioni per partita
    animale_ids = [a.id for a in animali_candidati]
    partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id.in_(animale_ids),
            PartitaAnimale.tipo == 'ingresso',
            PartitaAnimale.deleted_at.is_(None)
        )
        .all()
    )
    
    animale_to_partita = {}
    for join_rec, partita in partite_join:
        if join_rec.animale_id not in animale_to_partita:
            animale_to_partita[join_rec.animale_id] = partita.id
    
    # Filtra animali inclusi
    animali_inclusi = []
    for animale in animali_candidati:
        # Escludi se nella lista esplicita
        if animale.id in animali_esclusi_set:
            continue
        
        # Escludi se la partita è esclusa (a meno che non sia reincluso)
        partita_id = animale_to_partita.get(animale.id)
        if partita_id and partita_id in partite_escluse_set:
            if animale.id not in animali_reinclusi_set:
                continue
        
        animali_inclusi.append(animale)
    
    if not animali_inclusi:
        raise HTTPException(status_code=400, detail="Nessun animale incluso dopo le esclusioni")
    
    # Calcola quota per capo
    quantita_totale = Decimal(str(data.quantita_totale))
    numero_capi = len(animali_inclusi)
    quota_per_capo = (quantita_totale / Decimal(numero_capi)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    
    # Verifica farmaco e lotto
    farmaco = db.query(Farmaco).filter(
        Farmaco.id == data.farmaco_id,
        Farmaco.deleted_at.is_(None)
    ).first()
    if not farmaco:
        raise HTTPException(status_code=404, detail="Farmaco non trovato")
    
    lotto = None
    if data.lotto_farmaco_id:
        lotto = db.query(LottoFarmaco).filter(
            LottoFarmaco.id == data.lotto_farmaco_id,
            LottoFarmaco.deleted_at.is_(None)
        ).first()
        if not lotto:
            raise HTTPException(status_code=404, detail="Lotto farmaco non trovato")
        
        # Verifica quantità disponibile nel lotto
        quantita_totale_necessaria = quota_per_capo * numero_capi
        if lotto.quantita_rimanente < quantita_totale_necessaria:
            raise HTTPException(
                status_code=400,
                detail=f"Quantità insufficiente nel lotto. Disponibile: {lotto.quantita_rimanente}, Necessaria: {quantita_totale_necessaria}"
            )
        
        # Verifica che il lotto appartenga all'azienda
        if lotto.azienda_id != context["azienda_id"]:
            raise HTTPException(
                status_code=400,
                detail="Il lotto farmaco non appartiene all'azienda del target"
            )
    
    # Crea somministrazioni
    data_ora = data.data_ora or datetime.now()
    somministrazioni_creates = []
    somma_quantita = Decimal("0")
    
    for i, animale in enumerate(animali_inclusi):
        # Aggiusta l'ultima somministrazione per compensare arrotondamenti
        if i == len(animali_inclusi) - 1:
            quantita_animale = quantita_totale - somma_quantita
        else:
            quantita_animale = quota_per_capo
        
        somma_quantita += quantita_animale
        
        somministrazione = Somministrazione(
            animale_id=animale.id,
            farmaco_id=data.farmaco_id,
            lotto_farmaco_id=data.lotto_farmaco_id,
            data_ora=data_ora,
            quantita=quantita_animale,
            operatore_id=data.operatore_id,
            operatore_nome=data.operatore_nome,
            veterinario=data.veterinario,
            note=data.note,
            periodo_sospensione=data.periodo_sospensione
        )
        db.add(somministrazione)
        somministrazioni_creates.append(somministrazione)
    
    # Scala quantità dal lotto se presente
    if lotto:
        lotto.quantita_rimanente -= quantita_totale
        db.add(lotto)
    
    db.commit()
    
    # Refresh per ottenere gli ID
    for som in somministrazioni_creates:
        db.refresh(som)
    
    return {
        "somministrazioni_creates": len(somministrazioni_creates),
        "animali_inclusi": numero_capi,
        "animali_esclusi": len(animali_candidati) - numero_capi,
        "quota_per_capo": float(quota_per_capo),
        "somministrazioni": [SomministrazioneResponse.model_validate(s) for s in somministrazioni_creates]
    }

