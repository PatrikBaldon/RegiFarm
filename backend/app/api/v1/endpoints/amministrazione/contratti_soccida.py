"""
Contratti Soccida endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional, Dict
from datetime import datetime, date
from pydantic import BaseModel

from app.core.database import get_db
from app.models.amministrazione import ContrattoSoccida, PartitaAnimale, PartitaAnimaleAnimale
from app.models.allevamento.azienda import Azienda
from app.models.allevamento.animale import Animale
from app.schemas.amministrazione import (
    ContrattoSoccidaCreate,
    ContrattoSoccidaUpdate,
    ContrattoSoccidaResponse,
    ContrattoSoccidaWithRelations,
    PartitaAnimaleResponse,
)
from app.services.amministrazione.contratto_soccida_service import (
    get_contratti_soccida,
    get_contratto_soccida,
    create_contratto_soccida,
    update_contratto_soccida,
    delete_contratto_soccida,
    get_contratti_soccida_with_stats,
    get_soccidanti_disponibili,
    get_animali_by_contratto,
)

router = APIRouter()

@router.get("/contratti-soccida", response_model=List[ContrattoSoccidaResponse])
async def get_contratti_soccida_api(
    azienda_id: Optional[int] = Query(None, description="Filtra per azienda"),
    soccidante_id: Optional[int] = Query(None, description="Filtra per soccidante"),
    attivo: Optional[bool] = Query(None, description="Filtra per stato attivo"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db),
):
    """Recupera tutti i contratti di soccida con filtri opzionali"""
    contratti = get_contratti_soccida(
        db=db,
        azienda_id=azienda_id,
        soccidante_id=soccidante_id,
        attivo=attivo,
        skip=skip,
        limit=limit
    )
    return contratti


@router.get("/contratti-soccida/riepilogo", response_model=List[dict])
async def get_contratti_soccida_riepilogo_api(
    azienda_id: Optional[int] = Query(None, description="Filtra per azienda"),
    db: Session = Depends(get_db),
):
    """Recupera i contratti di soccida con statistiche (numero animali)"""
    return get_contratti_soccida_with_stats(db=db, azienda_id=azienda_id)


@router.get("/contratti-soccida/{contratto_id}", response_model=ContrattoSoccidaWithRelations)
async def get_contratto_soccida_api(
    contratto_id: int,
    include_relations: bool = Query(False, description="Include soccidante e azienda collegati"),
    db: Session = Depends(get_db),
):
    """Recupera un contratto di soccida per ID"""
    contratto = get_contratto_soccida(
        db=db,
        contratto_id=contratto_id,
        include_relations=include_relations,
    )
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    return contratto


@router.post("/contratti-soccida", response_model=ContrattoSoccidaResponse, status_code=status.HTTP_201_CREATED)
async def create_contratto_soccida_api(
    contratto: ContrattoSoccidaCreate,
    db: Session = Depends(get_db),
):
    """Crea un nuovo contratto di soccida"""
    try:
        db_contratto = create_contratto_soccida(db=db, contratto=contratto)
        return db_contratto
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante la creazione del contratto: {str(e)}"
        )


@router.put("/contratti-soccida/{contratto_id}", response_model=ContrattoSoccidaResponse)
async def update_contratto_soccida_api(
    contratto_id: int,
    contratto_update: ContrattoSoccidaUpdate,
    db: Session = Depends(get_db),
):
    """Aggiorna un contratto di soccida esistente"""
    try:
        db_contratto = update_contratto_soccida(
            db=db,
            contratto_id=contratto_id,
            contratto_update=contratto_update
        )
        if not db_contratto:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contratto soccida con ID {contratto_id} non trovato"
            )
        return db_contratto
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante l'aggiornamento del contratto: {str(e)}"
        )


@router.delete("/contratti-soccida/{contratto_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contratto_soccida_api(
    contratto_id: int,
    db: Session = Depends(get_db),
):
    """Elimina (soft delete) un contratto di soccida"""
    try:
        success = delete_contratto_soccida(db=db, contratto_id=contratto_id)
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Contratto soccida con ID {contratto_id} non trovato"
            )
        return None
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore durante l'eliminazione del contratto: {str(e)}"
        )


@router.get("/soccidanti", response_model=List[dict])
async def get_soccidanti_api(
    db: Session = Depends(get_db),
):
    """Recupera tutti i clienti (soccidanti) disponibili"""
    from app.schemas.amministrazione.fornitore import FornitoreResponse
    
    soccidanti = get_soccidanti_disponibili(db=db)
    return [FornitoreResponse.from_orm(s).dict() for s in soccidanti]


@router.get("/contratti-soccida/{contratto_id}/animali", response_model=List[dict])
async def get_animali_contratto_api(
    contratto_id: int,
    db: Session = Depends(get_db),
):
    """Recupera tutti gli animali associati a un contratto di soccida"""
    from app.schemas.allevamento.animale import AnimaleResponse
    
    # Verifica che il contratto esista
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    
    animali = get_animali_by_contratto(db=db, contratto_id=contratto_id)
    return [AnimaleResponse.from_orm(a).dict() for a in animali]


class AssociaAnimaliRequest(BaseModel):
    animale_ids: List[int]
    # Pesi opzionali: può essere un dizionario animale_id -> peso, o peso_totale/peso_medio per multipli
    pesi_animali: Optional[Dict[int, float]] = None  # Dizionario animale_id -> peso
    peso_totale: Optional[float] = None  # Peso totale da dividere tra tutti gli animali
    peso_medio: Optional[float] = None  # Peso medio da applicare a tutti gli animali
    data_cambio: Optional[date] = None  # Data del cambio (default: oggi)
    note: Optional[str] = None  # Note per il log


class AssociaPartiteRequest(BaseModel):
    partita_ids: List[int]
    cascade_animali: bool = True


@router.get("/contratti-soccida/{contratto_id}/partite", response_model=List[PartitaAnimaleResponse])
async def get_partite_contratto_api(
    contratto_id: int,
    db: Session = Depends(get_db),
):
    """Restituisce tutte le partite già collegate al contratto di soccida"""
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    
    # Escludi partite chiuse (data_chiusura valorizzata) così non compaiono in acconti/saldi
    partite = (
        db.query(PartitaAnimale)
        .filter(
            PartitaAnimale.contratto_soccida_id == contratto_id,
            PartitaAnimale.deleted_at.is_(None),
            PartitaAnimale.data_chiusura.is_(None),
        )
        .order_by(PartitaAnimale.data.desc())
        .all()
    )
    
    return [PartitaAnimaleResponse.from_orm(p) for p in partite]


@router.post("/contratti-soccida/{contratto_id}/partite", response_model=dict)
async def associa_partite_contratto_api(
    contratto_id: int,
    request: AssociaPartiteRequest,
    db: Session = Depends(get_db),
):
    """Collega una o più partite al contratto di soccida e aggiorna a cascata gli animali"""
    if not request.partita_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nessuna partita selezionata"
        )
    
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    if not contratto.attivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossibile associare partite a un contratto non attivo"
        )
    
    partite = db.query(PartitaAnimale).filter(
        PartitaAnimale.id.in_(request.partita_ids),
        PartitaAnimale.deleted_at.is_(None)
    ).all()
    
    trovate_ids = {p.id for p in partite}
    mancanti = set(request.partita_ids) - trovate_ids
    if mancanti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Partite non trovate: {sorted(mancanti)}"
        )
    
    conflitti = [
        p.id for p in partite
        if p.contratto_soccida_id and p.contratto_soccida_id != contratto_id
    ]
    if conflitti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le partite {conflitti} risultano già collegate ad altri contratti"
        )
    
    # Verifica che nessuna partita provenga da allevamenti gestiti (trasferimenti interni)
    # Controlla codice_stalla (provenienza esterna), non codice_stalla_azienda
    # Per ingressi esterni: codice_stalla = provenienza NON gestita, codice_stalla_azienda = destinazione gestita
    # Per trasferimenti interni: codice_stalla = provenienza gestita
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    partite_allevamenti_gestiti = [
        p.id for p in partite
        if p.codice_stalla and is_codice_stalla_gestito(p.codice_stalla, db, contratto.azienda_id)
    ]
    if partite_allevamenti_gestiti:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Le partite {partite_allevamenti_gestiti} provengono da allevamenti gestiti (trasferimenti interni) e non possono essere associate a contratti di soccida"
        )
    
    # Determina la modalità di gestione in base al contratto
    from app.models.amministrazione.partita_animale import ModalitaGestionePartita
    modalita_gestione = (
        ModalitaGestionePartita.SOCCIDA_MONETIZZATA.value
        if contratto.monetizzata
        else ModalitaGestionePartita.SOCCIDA_FATTURATA.value
    )
    
    for partita in partite:
        if partita.azienda_id != contratto.azienda_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"La partita {partita.id} appartiene a un'azienda differente dal contratto"
            )
        partita.contratto_soccida_id = contratto_id
        # Aggiorna la modalità di gestione della partita in base al contratto
        # Solo se la modalità attuale non è NULL (trasferimenti interni o uscite verso non gestiti)
        if partita.modalita_gestione is not None:
            partita.modalita_gestione = modalita_gestione
    
    animali_aggiornati = 0
    if request.cascade_animali:
        animale_ids = [
            row[0]
            for row in db.query(PartitaAnimaleAnimale.animale_id)
            .filter(PartitaAnimaleAnimale.partita_animale_id.in_(request.partita_ids))
            .distinct()
            .all()
        ]
        if animale_ids:
            animali_conflitto = db.query(Animale).filter(
                Animale.id.in_(animale_ids),
                Animale.deleted_at.is_(None),
                Animale.contratto_soccida_id.isnot(None),
                Animale.contratto_soccida_id != contratto_id
            ).all()
            if animali_conflitto:
                auricolari = [a.auricolare for a in animali_conflitto[:10] if a.auricolare]
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        "Alcuni animali risultano già collegati ad altri contratti "
                        f"(es. {', '.join(auricolari)})"
                    )
                )
            
            # Determina il tipo_allevamento da applicare in base al contratto
            # Il contratto ha un solo tipo_allevamento
            tipo_allevamento_da_applicare = contratto.tipo_allevamento
            
            # Aggiorna contratto_soccida_id e tipo_allevamento se necessario
            update_dict = {Animale.contratto_soccida_id: contratto_id}
            if tipo_allevamento_da_applicare:
                update_dict[Animale.tipo_allevamento] = tipo_allevamento_da_applicare
            
            animali_aggiornati = db.query(Animale).filter(
                Animale.id.in_(animale_ids),
                Animale.deleted_at.is_(None)
            ).update(
                update_dict,
                synchronize_session=False
            )
    
    db.commit()
    
    return {
        "message": f"Associate {len(partite)} partite al contratto",
        "contratto_id": contratto_id,
        "partite_associate": len(partite),
        "animali_aggiornati": animali_aggiornati,
    }


@router.delete("/contratti-soccida/{contratto_id}/partite/{partita_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disassocia_partita_contratto_api(
    contratto_id: int,
    partita_id: int,
    db: Session = Depends(get_db),
):
    """Rimuove l'associazione di una partita dal contratto e aggiorna gli animali coinvolti"""
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    
    partita = db.query(PartitaAnimale).filter(
        PartitaAnimale.id == partita_id,
        PartitaAnimale.deleted_at.is_(None)
    ).first()
    
    if not partita or partita.contratto_soccida_id != contratto_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Partita non trovata o non associata al contratto indicato"
        )
    
    # Ripristina la modalità di gestione a "proprietà" quando si disassocia dal contratto
    from app.models.amministrazione.partita_animale import ModalitaGestionePartita
    partita.contratto_soccida_id = None
    partita.modalita_gestione = ModalitaGestionePartita.PROPRIETA.value
    
    # Aggiorna gli animali associati alla partita solo se non collegati ad altre partite dello stesso contratto
    animale_ids = [
        row[0]
        for row in db.query(PartitaAnimaleAnimale.animale_id)
        .filter(PartitaAnimaleAnimale.partita_animale_id == partita_id)
        .distinct()
        .all()
    ]
    
    if animale_ids:
        ancora_collegati = {
            row[0]
            for row in db.query(PartitaAnimaleAnimale.animale_id)
            .join(PartitaAnimale, PartitaAnimale.id == PartitaAnimaleAnimale.partita_animale_id)
            .filter(
                PartitaAnimaleAnimale.animale_id.in_(animale_ids),
                PartitaAnimale.contratto_soccida_id == contratto_id,
                PartitaAnimale.deleted_at.is_(None)
            )
            .distinct()
            .all()
        }
        da_scollegare = set(animale_ids) - ancora_collegati
        if da_scollegare:
            db.query(Animale).filter(
                Animale.id.in_(list(da_scollegare)),
                Animale.contratto_soccida_id == contratto_id
            ).update(
                {Animale.contratto_soccida_id: None},
                synchronize_session=False
            )
    
    db.commit()
    return None


@router.post("/contratti-soccida/{contratto_id}/animali", response_model=dict)
async def associa_animali_contratto_api(
    contratto_id: int,
    request: AssociaAnimaliRequest,
    db: Session = Depends(get_db),
):
    """Associa animali a un contratto di soccida"""
    animale_ids = request.animale_ids
    
    # Verifica che il contratto esista
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    
    # Verifica che il contratto sia attivo
    if not contratto.attivo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Impossibile associare animali a un contratto non attivo"
        )
    
    # Verifica e aggiorna gli animali
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    from datetime import date as date_type
    from decimal import Decimal
    
    animali_aggiornati = 0
    animali_non_trovati = []
    log_creati = 0
    
    # Calcola i pesi per ogni animale in base ai parametri forniti
    pesi_per_animale = {}
    num_animali = len(animale_ids)
    
    if request.pesi_animali:
        # Usa i pesi specifici per animale
        pesi_per_animale = {int(k): float(v) for k, v in request.pesi_animali.items()}
    elif request.peso_totale is not None and num_animali > 0:
        # Dividi il peso totale tra tutti gli animali
        peso_per_capo = float(request.peso_totale) / num_animali
        pesi_per_animale = {animale_id: peso_per_capo for animale_id in animale_ids}
    elif request.peso_medio is not None:
        # Applica il peso medio a tutti gli animali
        pesi_per_animale = {animale_id: float(request.peso_medio) for animale_id in animale_ids}
    
    data_cambio = request.data_cambio or date_type.today()
    
    for animale_id in animale_ids:
        animale = db.query(Animale).filter(
            Animale.id == animale_id,
            Animale.deleted_at.is_(None)
        ).first()
        
        if not animale:
            animali_non_trovati.append(animale_id)
            continue
        
        # Verifica che l'animale appartenga alla stessa azienda del contratto
        if animale.azienda_id != contratto.azienda_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"L'animale {animale_id} appartiene a un'azienda diversa dal contratto"
            )
        
        # Se il contratto è chiuso, permettere solo animali usciti (venduto, trasferito, macellato)
        if not contratto.attivo:
            stati_usciti = ['venduto', 'trasferito', 'macellato']
            if animale.stato not in stati_usciti:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Un contratto chiuso può avere associati solo animali usciti. L'animale {animale.auricolare or animale_id} ha stato '{animale.stato}'"
                )
        
        # Determina il tipo_allevamento da applicare in base al contratto
        tipo_allevamento_da_applicare = contratto.tipo_allevamento
        
        # Salva i valori precedenti per il log
        contratto_precedente_id = animale.contratto_soccida_id
        tipo_allevamento_precedente = animale.tipo_allevamento
        peso_attuale_animale = animale.peso_attuale
        
        # Verifica se è un cambio di gestione (non prima associazione)
        is_cambio_gestione = (
            contratto_precedente_id is not None and 
            contratto_precedente_id != contratto_id
        ) or (
            tipo_allevamento_precedente is not None and 
            tipo_allevamento_precedente != tipo_allevamento_da_applicare
        )
        
        # Determina il peso da usare per il log
        peso_ingresso_log = None
        if animale_id in pesi_per_animale:
            peso_ingresso_log = pesi_per_animale[animale_id]
        elif peso_attuale_animale is not None:
            peso_ingresso_log = float(peso_attuale_animale)
        
        # Aggiorna contratto e tipo_allevamento
        animale.contratto_soccida_id = contratto_id
        if tipo_allevamento_da_applicare:
            animale.tipo_allevamento = tipo_allevamento_da_applicare
        
        # Se è stato fornito un peso, aggiorna anche peso_attuale e data_ultima_pesata
        if peso_ingresso_log is not None:
            animale.peso_attuale = Decimal(str(peso_ingresso_log))
            animale.data_ultima_pesata = data_cambio
        
        # Crea log se è un cambio di gestione (sempre, anche se è prima associazione se c'è un peso)
        if is_cambio_gestione or peso_ingresso_log is not None:
            note_parts = []
            if contratto_precedente_id:
                note_parts.append(f"Contratto {contratto_precedente_id} → {contratto_id}")
            elif contratto_precedente_id is None and contratto_id:
                note_parts.append(f"Associazione a contratto {contratto_id}")
            if request.note:
                note_parts.append(request.note)
            note_finale = " | ".join(note_parts) if note_parts else None
            
            storico = StoricoTipoAllevamento(
                animale_id=animale_id,
                contratto_soccida_id=contratto_id,
                tipo_allevamento_precedente=tipo_allevamento_precedente,
                tipo_allevamento_nuovo=tipo_allevamento_da_applicare or None,
                peso_ingresso=Decimal(str(peso_ingresso_log)) if peso_ingresso_log is not None else None,
                data_cambio=data_cambio,
                note=note_finale
            )
            db.add(storico)
            log_creati += 1
        
        animali_aggiornati += 1
    
    if animali_non_trovati:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Animali non trovati: {animali_non_trovati}"
        )
    
    db.commit()
    
    return {
        "message": f"Associati {animali_aggiornati} animali al contratto",
        "contratto_id": contratto_id,
        "animali_associati": animali_aggiornati,
        "log_creati": log_creati
    }


@router.delete("/contratti-soccida/{contratto_id}/animali/{animale_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disassocia_animale_contratto_api(
    contratto_id: int,
    animale_id: int,
    peso_ingresso: Optional[float] = Query(None, description="Peso di riferimento per l'inizio del nuovo conteggio"),
    data_cambio: Optional[date] = Query(None, description="Data del cambio (default: oggi)"),
    note: Optional[str] = Query(None, description="Note per il log"),
    db: Session = Depends(get_db),
):
    """Disassocia un animale da un contratto di soccida e crea log del cambio gestione"""
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    from datetime import date as date_type
    from decimal import Decimal
    
    # Verifica che il contratto esista
    contratto = get_contratto_soccida(db=db, contratto_id=contratto_id)
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida con ID {contratto_id} non trovato"
        )
    
    # Verifica che l'animale esista e sia associato al contratto
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.contratto_soccida_id == contratto_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Animale {animale_id} non trovato o non associato al contratto {contratto_id}"
        )
    
    # Salva i valori precedenti per il log
    tipo_allevamento_precedente = animale.tipo_allevamento
    peso_attuale_animale = animale.peso_attuale
    
    # Determina il peso da usare per il log
    peso_ingresso_log = None
    if peso_ingresso is not None:
        peso_ingresso_log = float(peso_ingresso)
    elif peso_attuale_animale is not None:
        peso_ingresso_log = float(peso_attuale_animale)
    
    # Rimuovi l'associazione al contratto (passa a proprietà)
    animale.contratto_soccida_id = None
    # Il tipo_allevamento rimane invariato quando si passa a proprietà
    
    # Se è stato fornito un peso, aggiorna anche peso_attuale e data_ultima_pesata
    data_cambio_finale = data_cambio or date_type.today()
    if peso_ingresso_log is not None:
        animale.peso_attuale = Decimal(str(peso_ingresso_log))
        animale.data_ultima_pesata = data_cambio_finale
    
    # Crea log del cambio gestione (da contratto a proprietà)
    note_parts = [f"Passaggio da contratto {contratto_id} a proprietà"]
    if note:
        note_parts.append(note)
    note_finale = " | ".join(note_parts)
    
    storico = StoricoTipoAllevamento(
        animale_id=animale_id,
        contratto_soccida_id=None,  # Ora è in proprietà
        tipo_allevamento_precedente=tipo_allevamento_precedente,
        tipo_allevamento_nuovo=tipo_allevamento_precedente,  # Mantiene lo stesso tipo
        peso_ingresso=Decimal(str(peso_ingresso_log)) if peso_ingresso_log is not None else None,
        data_cambio=data_cambio_finale,
        note=note_finale
    )
    db.add(storico)
    
    db.commit()
    
    return None


@router.post("/contratti-soccida/sincronizza-modalita-gestione", response_model=dict)
async def sincronizza_modalita_gestione_partite_api(
    azienda_id: Optional[int] = Query(None, description="ID azienda (opzionale, filtra per azienda)"),
    db: Session = Depends(get_db),
):
    """
    Sincronizza la modalità di gestione di tutte le partite associate a contratti di soccida.
    Aggiorna le partite esistenti che hanno ancora modalità_gestione = 'proprieta' 
    ma sono associate a un contratto di soccida.
    """
    from app.models.amministrazione.partita_animale import ModalitaGestionePartita
    from app.models.amministrazione.contratto_soccida import ContrattoSoccida
    
    # Trova tutte le partite associate a contratti di soccida
    query = db.query(PartitaAnimale).filter(
        PartitaAnimale.contratto_soccida_id.isnot(None),
        PartitaAnimale.deleted_at.is_(None)
    )
    
    if azienda_id:
        query = query.filter(PartitaAnimale.azienda_id == azienda_id)
    
    partite = query.all()
    
    if not partite:
        return {
            "message": "Nessuna partita associata a contratti di soccida trovata",
            "partite_aggiornate": 0,
            "dettagli": []
        }
    
    partite_aggiornate = []
    partite_non_aggiornate = []
    
    for partita in partite:
        # Carica il contratto associato
        contratto = db.query(ContrattoSoccida).filter(
            ContrattoSoccida.id == partita.contratto_soccida_id,
            ContrattoSoccida.deleted_at.is_(None)
        ).first()
        
        if not contratto:
            partite_non_aggiornate.append({
                "partita_id": partita.id,
                "numero_partita": partita.numero_partita,
                "motivo": "Contratto associato non trovato o eliminato"
            })
            continue
        
        # Determina la modalità di gestione corretta
        modalita_corretta = (
            ModalitaGestionePartita.SOCCIDA_MONETIZZATA.value
            if contratto.monetizzata
            else ModalitaGestionePartita.SOCCIDA_FATTURATA.value
        )
        
        # Aggiorna solo se la modalità è diversa
        if partita.modalita_gestione != modalita_corretta:
            modalita_precedente = partita.modalita_gestione
            partita.modalita_gestione = modalita_corretta
            partite_aggiornate.append({
                "partita_id": partita.id,
                "numero_partita": partita.numero_partita,
                "modalita_precedente": modalita_precedente,
                "modalita_aggiornata": modalita_corretta,
                "contratto_id": contratto.id,
                "contratto_numero": contratto.numero_contratto,
                "monetizzata": contratto.monetizzata
            })
    
    db.commit()
    
    return {
        "message": f"Sincronizzazione completata: {len(partite_aggiornate)} partite aggiornate su {len(partite)} totali",
        "partite_totali": len(partite),
        "partite_aggiornate": len(partite_aggiornate),
        "partite_non_aggiornate": len(partite_non_aggiornate),
        "dettagli_aggiornate": partite_aggiornate,
        "dettagli_non_aggiornate": partite_non_aggiornate
    }

