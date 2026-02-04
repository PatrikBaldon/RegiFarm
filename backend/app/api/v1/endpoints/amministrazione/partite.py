"""
Partite Animali e Sincronizzazione Anagrafe endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from typing import List, Optional, Dict
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel
import json

from app.core.database import get_db
from app.models.amministrazione import (
    PartitaAnimale,
    ModalitaGestionePartita,
    PartitaAnimaleAnimale,
    PartitaMovimentoFinanziario,
)
from app.models.amministrazione.pn import PNMovimento
from app.models.allevamento.azienda import Azienda
from app.models.allevamento.animale import Animale
from app.models.allevamento.sede import Sede
from app.models.allevamento.box import Box
from app.models.allevamento.stabilimento import Stabilimento
from app.schemas.amministrazione import (
    PartitaAnimaleConfirm,
    PartitaAnimaleCreate,
    PartitaAnimaleResponse,
    PartitaAnimaleUpdate,
    PartitaMovimentoFinanziarioCreate,
    PartitaMovimentoFinanziarioUpdate,
    PartitaMovimentoFinanziarioResponse,
)

router = APIRouter()

def _attach_pn_movimento_to_partita(db: Session, partita_id: int, pn_movimento_id: Optional[int]) -> Optional[PNMovimento]:
    if pn_movimento_id is None:
        return None
    movimento = db.query(PNMovimento).filter(PNMovimento.id == pn_movimento_id).first()
    if not movimento:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimento prima nota non trovato")
    if movimento.partita_id and movimento.partita_id != partita_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il movimento prima nota è già associato a un'altra partita",
        )
    movimento.partita_id = partita_id
    return movimento


def _determina_modalita_gestione_partita(
    tipo: str,
    is_trasferimento_interno: bool,
    codice_stalla: str,
    codice_stalla_azienda: Optional[str],
    azienda_id: int,
    db: Session
) -> Optional[str]:
    """
    Determina la modalità di gestione di una partita.
    Restituisce None (NULL) per:
    - Trasferimenti interni tra allevamenti gestiti
    - Uscite verso allevamenti non gestiti
    
    Restituisce 'proprieta' per tutti gli altri casi.
    
    Args:
        tipo: 'ingresso' o 'uscita'
        is_trasferimento_interno: Se è un trasferimento interno
        codice_stalla: Codice stalla esterno (provenienza/destinazione)
        codice_stalla_azienda: Codice stalla dell'allevamento dell'utente
        azienda_id: ID azienda
        db: Database session
    
    Returns:
        Modalità di gestione (string) o None per NULL nel database
    """
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from app.models.amministrazione.partita_animale import ModalitaGestionePartita
    
    # Trasferimento interno tra allevamenti gestiti
    if is_trasferimento_interno:
        # Verifica che entrambi i codici stalla siano gestiti
        codice_stalla_gestito = is_codice_stalla_gestito(codice_stalla, db, azienda_id)
        codice_stalla_azienda_gestito = (
            codice_stalla_azienda and 
            is_codice_stalla_gestito(codice_stalla_azienda, db, azienda_id)
        )
        if codice_stalla_gestito and codice_stalla_azienda_gestito:
            return None  # Trasferimento interno tra allevamenti gestiti → NULL
    
    # Uscita verso allevamento non gestito
    if tipo == 'uscita' and not is_trasferimento_interno:
        codice_stalla_gestito = is_codice_stalla_gestito(codice_stalla, db, azienda_id)
        if not codice_stalla_gestito:
            return None  # Uscita verso allevamento non gestito → NULL
    
    # Per tutti gli altri casi, usa 'proprieta' come default
    return ModalitaGestionePartita.PROPRIETA.value


def _detach_pn_movimento(db: Session, pn_movimento_id: Optional[int]) -> None:
    if pn_movimento_id is None:
        return
    movimento = db.query(PNMovimento).filter(PNMovimento.id == pn_movimento_id).first()
    if movimento:
        movimento.partita_id = None


@router.get("/partite", response_model=List[PartitaAnimaleResponse])
async def get_partite(
    tipo: Optional[str] = None,
    azienda_id: Optional[int] = None,
    codice_stalla: Optional[str] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    """Get all partite animali with filters"""
    query = (
        db.query(PartitaAnimale)
        .options(
            selectinload(PartitaAnimale.movimenti_finanziari),
            selectinload(PartitaAnimale.movimenti_prima_nota),
        )
        .filter(PartitaAnimale.deleted_at.is_(None))
    )
    
    if tipo:
        # Se filtriamo per 'ingresso', includiamo anche le partite senza tipo
        # (potrebbero essere partite appena create che non hanno ancora il tipo impostato)
        if tipo == 'ingresso':
            query = query.filter(
                (PartitaAnimale.tipo == tipo) | (PartitaAnimale.tipo.is_(None))
            )
        else:
            query = query.filter(PartitaAnimale.tipo == tipo)
    if azienda_id:
        query = query.filter(PartitaAnimale.azienda_id == azienda_id)
    if codice_stalla:
        query = query.filter(PartitaAnimale.codice_stalla == codice_stalla)
    if data_da:
        query = query.filter(PartitaAnimale.data >= data_da)
    if data_a:
        query = query.filter(PartitaAnimale.data <= data_a)
    
    partite = query.order_by(PartitaAnimale.data.desc()).offset(skip).limit(limit).all()
    
    # Deserializza pesi_individuali da JSON string per ogni partita
    for partita in partite:
        if partita.pesi_individuali and isinstance(partita.pesi_individuali, str):
            try:
                partita.pesi_individuali = json.loads(partita.pesi_individuali)
            except (json.JSONDecodeError, TypeError):
                partita.pesi_individuali = None
        # Normalizza: assicurati che ogni elemento abbia un 'peso' numerico
        if partita.pesi_individuali and isinstance(partita.pesi_individuali, list):
            peso_medio_fallback = None
            try:
                if getattr(partita, "peso_medio", None) is not None:
                    peso_medio_fallback = float(partita.peso_medio)
            except Exception:
                peso_medio_fallback = None
            norm = []
            for it in partita.pesi_individuali:
                if isinstance(it, dict):
                    aur = it.get("auricolare")
                    raw_peso = it.get("peso")
                else:
                    aur = str(it)
                    raw_peso = None
                if not aur:
                    continue
                if raw_peso is not None:
                    try:
                        peso_val = float(raw_peso)
                    except (TypeError, ValueError):
                        peso_val = peso_medio_fallback if peso_medio_fallback is not None else 0.0
                else:
                    peso_val = peso_medio_fallback if peso_medio_fallback is not None else 0.0
                norm.append({"auricolare": aur, "peso": peso_val})
            partita.pesi_individuali = norm if norm else None
        # Fallback: se non ci sono pesi_individuali serializzati, prova a ricostruirli dalla join
        if not partita.pesi_individuali:
            try:
                from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
                from app.models.allevamento.animale import Animale
                join_rows = (
                    db.query(PartitaAnimaleAnimale, Animale)
                    .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
                    .filter(PartitaAnimaleAnimale.partita_animale_id == partita.id)
                    .all()
                )
                if join_rows:
                    ricostruiti = []
                    # Peso medio di fallback se il join non ha peso
                    peso_medio_fallback = None
                    try:
                        if getattr(partita, "peso_medio", None) is not None:
                            peso_medio_fallback = float(partita.peso_medio)
                    except Exception:
                        peso_medio_fallback = None
                    for join_rec, animale in join_rows:
                        aur = animale.auricolare if animale and getattr(animale, "auricolare", None) else None
                        if aur:
                            if getattr(join_rec, "peso", None) is not None:
                                peso_val = float(join_rec.peso)
                            elif peso_medio_fallback is not None:
                                peso_val = peso_medio_fallback
                            else:
                                peso_val = 0.0
                            ricostruiti.append({"auricolare": aur, "peso": peso_val})
                    partita.pesi_individuali = ricostruiti if ricostruiti else None
            except Exception:
                # silenzioso: non bloccare la lista
                pass
    
    return partite


@router.get("/animali/{auricolare}/partite")
async def get_partite_animale(
    auricolare: str,
    db: Session = Depends(get_db)
):
    """
    Ottiene lo storico completo delle partite per un animale specifico.
    Permette di tracciare tutto il percorso dell'animale attraverso ingressi, trasferimenti e uscite.
    """
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.models.allevamento.animale import Animale
    
    # Trova l'animale
    animale = db.query(Animale).filter(
        Animale.auricolare == auricolare,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Animale con auricolare {auricolare} non trovato"
        )
    
    # Trova tutte le partite associate all'animale
    from app.models.amministrazione.partita_animale import PartitaAnimale as PartitaAnimaleModel
    
    partite_join = db.query(PartitaAnimaleAnimale).filter(
        PartitaAnimaleAnimale.animale_id == animale.id
    ).join(PartitaAnimaleModel).filter(
        PartitaAnimaleModel.deleted_at.is_(None)
    ).order_by(PartitaAnimaleModel.data.asc()).all()
    
    # Costruisci la risposta con i dettagli delle partite
    storico = []
    for join in partite_join:
        partita = join.partita
        storico.append({
            'partita_id': partita.id,
            'tipo': partita.tipo.value,
            'data': partita.data.isoformat() if partita.data else None,
            'numero_partita': partita.numero_partita,
            'codice_stalla': partita.codice_stalla,
            'codice_stalla_azienda': partita.codice_stalla_azienda,
            'is_trasferimento_interno': partita.is_trasferimento_interno,
            'peso_animale': float(join.peso) if join.peso else None,
            'peso_totale_partita': float(partita.peso_totale) if partita.peso_totale else None,
            'numero_capi': partita.numero_capi,
            'motivo': partita.motivo,
            'numero_modello': partita.numero_modello,
            'created_at': partita.created_at.isoformat() if partita.created_at else None
        })
    
    return {
        'animale': {
            'id': animale.id,
            'auricolare': animale.auricolare,
            'codice_azienda_anagrafe': animale.codice_azienda_anagrafe,
            'stato': animale.stato
        },
        'numero_partite': len(storico),
        'storico_partite': storico
    }


@router.get("/partite/{partita_id}", response_model=PartitaAnimaleResponse)
async def get_partita(partita_id: int, db: Session = Depends(get_db)):
    """Get a specific partita"""
    partita = (
        db.query(PartitaAnimale)
        .options(
            selectinload(PartitaAnimale.movimenti_finanziari),
            selectinload(PartitaAnimale.movimenti_prima_nota),
        )
        .filter(PartitaAnimale.id == partita_id)
        .first()
    )
    if not partita:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    
    # Parse pesi_individuali da JSON string se presente
    if partita.pesi_individuali:
        try:
            partita.pesi_individuali = json.loads(partita.pesi_individuali)
        except:
            pass
    # Normalizza: assicurati che ogni elemento abbia un 'peso' numerico
    if partita.pesi_individuali and isinstance(partita.pesi_individuali, list):
        peso_medio_fallback = None
        try:
            if getattr(partita, "peso_medio", None) is not None:
                peso_medio_fallback = float(partita.peso_medio)
        except Exception:
            peso_medio_fallback = None
        norm = []
        for it in partita.pesi_individuali:
            if isinstance(it, dict):
                aur = it.get("auricolare")
                raw_peso = it.get("peso")
            else:
                aur = str(it)
                raw_peso = None
            if not aur:
                continue
            if raw_peso is not None:
                try:
                    peso_val = float(raw_peso)
                except (TypeError, ValueError):
                    peso_val = peso_medio_fallback if peso_medio_fallback is not None else 0.0
            else:
                peso_val = peso_medio_fallback if peso_medio_fallback is not None else 0.0
            norm.append({"auricolare": aur, "peso": peso_val})
        partita.pesi_individuali = norm if norm else None
    # Fallback: se non sono presenti, ricostruisci dai link
    if not partita.pesi_individuali:
        try:
            from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
            from app.models.allevamento.animale import Animale
            join_rows = (
                db.query(PartitaAnimaleAnimale, Animale)
                .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
                .filter(PartitaAnimaleAnimale.partita_animale_id == partita.id)
                .all()
            )
            if join_rows:
                ricostruiti = []
                # Peso medio di fallback se il join non ha peso
                peso_medio_fallback = None
                try:
                    if getattr(partita, "peso_medio", None) is not None:
                        peso_medio_fallback = float(partita.peso_medio)
                except Exception:
                    peso_medio_fallback = None
                for join_rec, animale in join_rows:
                    aur = animale.auricolare if animale and getattr(animale, "auricolare", None) else None
                    if aur:
                        if getattr(join_rec, "peso", None) is not None:
                            peso_val = float(join_rec.peso)
                        elif peso_medio_fallback is not None:
                            peso_val = peso_medio_fallback
                        else:
                            peso_val = 0.0
                        ricostruiti.append({"auricolare": aur, "peso": peso_val})
                partita.pesi_individuali = ricostruiti if ricostruiti else None
        except Exception:
            pass
    
    return partita


@router.get("/partite/{partita_id}/animali", response_model=dict)
async def get_partita_animali(partita_id: int, db: Session = Depends(get_db)):
    """Get animali associati a una partita"""
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.models.allevamento.animale import Animale
    from app.schemas.allevamento.animale import AnimaleResponse
    
    # Verifica che la partita esista
    partita = db.query(PartitaAnimale).filter(
        PartitaAnimale.id == partita_id,
        PartitaAnimale.deleted_at.is_(None)
    ).first()
    
    if not partita:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    
    # Trova tutti gli animali associati alla partita tramite la join table
    join_records = (
        db.query(PartitaAnimaleAnimale, Animale)
        .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
        .filter(
            PartitaAnimaleAnimale.partita_animale_id == partita_id,
            Animale.deleted_at.is_(None)
        )
        .all()
    )
    
    animali_list = []
    for join_rec, animale in join_records:
        animale_dict = AnimaleResponse.from_orm(animale).dict()
        # Aggiungi il peso specifico della partita se disponibile
        if join_rec.peso is not None:
            animale_dict['peso_partita'] = float(join_rec.peso)
        animali_list.append(animale_dict)
    
    return {
        "partita_id": partita_id,
        "animali": animali_list,
        "numero_animali": len(animali_list)
    }


@router.post("/partite", response_model=PartitaAnimaleResponse, status_code=status.HTTP_201_CREATED)
async def create_partita(partita: PartitaAnimaleCreate, db: Session = Depends(get_db)):
    """Create a new partita"""
    # Valida peso per trasferimenti esterni
    if not partita.is_trasferimento_interno and not partita.peso_totale:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il peso è obbligatorio per trasferimenti esterni"
        )
    
    partita_dict = partita.dict()
    
    # Determina modalità di gestione se non fornita esplicitamente
    if partita_dict.get('modalita_gestione') is None:
        modalita_determinata = _determina_modalita_gestione_partita(
            tipo=partita.tipo,
            is_trasferimento_interno=partita.is_trasferimento_interno,
            codice_stalla=partita.codice_stalla,
            codice_stalla_azienda=partita.codice_stalla_azienda,
            azienda_id=partita.azienda_id,
            db=db
        )
        partita_dict['modalita_gestione'] = modalita_determinata
    
    # Converti pesi_individuali a JSON string se presente
    if partita_dict.get('pesi_individuali'):
        partita_dict['pesi_individuali'] = json.dumps([
            p.dict() if hasattr(p, 'dict') else p 
            for p in partita_dict['pesi_individuali']
        ])
        
        # Calcola peso_totale e peso_medio se pesi individuali forniti
        pesi = partita_dict['pesi_individuali']
        if isinstance(pesi, str):
            pesi = json.loads(pesi)
        if pesi and len(pesi) > 0:
            peso_totale = sum(Decimal(str(p.get('peso', 0))) for p in pesi)
            partita_dict['peso_totale'] = peso_totale
            partita_dict['peso_medio'] = peso_totale / len(pesi)
    
    db_partita = PartitaAnimale(**partita_dict)
    db.add(db_partita)
    db.commit()
    db.refresh(db_partita)
    return db_partita


def _update_partita_from_animale(animale_id: int, update_data: dict, db: Session):
    """
    Aggiorna partita da modifica animale.
    Protegge i report aggiornando join.peso e ricalcolando aggregati.
    """
    from app.models.allevamento.animale import Animale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from decimal import Decimal, InvalidOperation
    import json
    
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        return
    
    # Trova tutte le partite dell'animale
    all_partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id == animale_id,
            PartitaAnimale.deleted_at.is_(None)
        )
        .order_by(PartitaAnimale.data.desc())
        .all()
    )
    
    # Identifica partite specifiche
    partita_ingresso_esterno = None
    partita_uscita_esterna = None
    partita_trasferimento_recente = None
    
    for join_rec, partita in all_partite_join:
        if partita.tipo == 'ingresso':
            is_interno = (
                partita.is_trasferimento_interno and
                partita.codice_stalla and
                is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
            )
            if not is_interno and not partita_ingresso_esterno:
                partita_ingresso_esterno = (join_rec, partita)
            elif is_interno and not partita_trasferimento_recente:
                partita_trasferimento_recente = (join_rec, partita)
        elif partita.tipo == 'uscita':
            is_interno = (
                partita.is_trasferimento_interno and
                partita.codice_stalla and
                is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
            )
            if not is_interno and not partita_uscita_esterna:
                partita_uscita_esterna = (join_rec, partita)
    
    # Gestisci peso_arrivo
    if 'peso_arrivo' in update_data and partita_ingresso_esterno:
        join_rec, partita = partita_ingresso_esterno
        nuovo_peso = update_data['peso_arrivo']
        if nuovo_peso is not None:
            try:
                nuovo_peso_decimal = Decimal(str(nuovo_peso))
                _update_partita_from_animale_peso(partita.id, animale_id, nuovo_peso_decimal, db)
            except (InvalidOperation, TypeError, ValueError):
                pass
    
    # Gestisci peso_attuale
    if 'peso_attuale' in update_data:
        nuovo_peso = update_data['peso_attuale']
        if nuovo_peso is not None:
            try:
                nuovo_peso_decimal = Decimal(str(nuovo_peso))
                # Determina partita corretta: prima uscita, poi trasferimento, poi ingresso
                partita_selezionata = None
                if partita_uscita_esterna:
                    partita_selezionata = partita_uscita_esterna
                elif partita_trasferimento_recente:
                    partita_selezionata = partita_trasferimento_recente
                elif partita_ingresso_esterno:
                    partita_selezionata = partita_ingresso_esterno
                
                if partita_selezionata:
                    join_rec, partita = partita_selezionata
                    _update_partita_from_animale_peso(partita.id, animale_id, nuovo_peso_decimal, db)
            except (InvalidOperation, TypeError, ValueError):
                pass
    
    # Gestisci valore
    if 'valore' in update_data and partita_ingresso_esterno:
        join_rec, partita = partita_ingresso_esterno
        nuovo_valore = update_data['valore']
        if nuovo_valore is not None and not partita.fattura_amministrazione_id and not partita.fattura_emessa_id:
            try:
                nuovo_valore_decimal = Decimal(str(nuovo_valore))
                # Aggiorna costo_unitario e valore_totale
                if partita.numero_capi > 0:
                    partita.costo_unitario = nuovo_valore_decimal
                    partita.valore_totale = nuovo_valore_decimal * partita.numero_capi
                    
                    # Estendi valore a tutti gli animali della partita
                    join_records = (
                        db.query(PartitaAnimaleAnimale, Animale)
                        .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
                        .filter(PartitaAnimaleAnimale.partita_animale_id == partita.id)
                        .all()
                    )
                    
                    for join_animale, animale_partita in join_records:
                        animale_partita.valore = nuovo_valore_decimal
                    
                    db.commit()
            except (InvalidOperation, TypeError, ValueError):
                pass
    
    # Gestisci data_arrivo
    if 'data_arrivo' in update_data and partita_ingresso_esterno:
        join_rec, partita = partita_ingresso_esterno
        nuova_data = update_data['data_arrivo']
        if nuova_data:
            partita.data = nuova_data
            db.commit()
    
    # Gestisci data_uscita
    if 'data_uscita' in update_data:
        nuova_data = update_data['data_uscita']
        if nuova_data:
            partita_selezionata = None
            if partita_uscita_esterna:
                partita_selezionata = partita_uscita_esterna
            elif partita_trasferimento_recente:
                partita_selezionata = partita_trasferimento_recente
            
            if partita_selezionata:
                join_rec, partita = partita_selezionata
                partita.data = nuova_data
                db.commit()
    
    # Gestisci motivo_ingresso
    if 'motivo_ingresso' in update_data and partita_ingresso_esterno:
        join_rec, partita = partita_ingresso_esterno
        nuovo_motivo = update_data['motivo_ingresso']
        partita.motivo = nuovo_motivo
        db.commit()
    
    # Gestisci motivo_uscita
    if 'motivo_uscita' in update_data and partita_uscita_esterna:
        join_rec, partita = partita_uscita_esterna
        nuovo_motivo = update_data['motivo_uscita']
        partita.motivo = nuovo_motivo
        db.commit()
    
    # Gestisci numero_modello_ingresso
    if 'numero_modello_ingresso' in update_data and partita_ingresso_esterno:
        join_rec, partita = partita_ingresso_esterno
        nuovo_modello = update_data['numero_modello_ingresso']
        partita.numero_modello = nuovo_modello
        db.commit()
    
    # Gestisci numero_modello_uscita
    if 'numero_modello_uscita' in update_data and partita_uscita_esterna:
        join_rec, partita = partita_uscita_esterna
        nuovo_modello = update_data['numero_modello_uscita']
        partita.numero_modello = nuovo_modello
        db.commit()


def _update_partita_from_animale_peso(partita_id: int, animale_id: int, nuovo_peso: Decimal, db: Session):
    """
    Aggiorna peso nella partita da modifica animale.
    Protegge i report aggiornando join.peso e ricalcolando aggregati.
    """
    from app.models.allevamento.animale import Animale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from decimal import Decimal, InvalidOperation
    import json
    
    partita = db.query(PartitaAnimale).filter(PartitaAnimale.id == partita_id).first()
    if not partita:
        return
    
    # 1. Aggiorna peso nel join PartitaAnimaleAnimale
    join_record = db.query(PartitaAnimaleAnimale).filter(
        PartitaAnimaleAnimale.partita_animale_id == partita_id,
        PartitaAnimaleAnimale.animale_id == animale_id
    ).first()
    
    if join_record:
        join_record.peso = nuovo_peso
    else:
        # Crea join se non esiste
        nuovo_join = PartitaAnimaleAnimale(
            partita_animale_id=partita_id,
            animale_id=animale_id,
            peso=nuovo_peso
        )
        db.add(nuovo_join)
    
    db.flush()
    
    # 2. Ricalcola peso_totale e peso_medio della partita
    # Recupera tutti i join della partita con pesi
    join_records = (
        db.query(PartitaAnimaleAnimale)
        .filter(PartitaAnimaleAnimale.partita_animale_id == partita_id)
        .all()
    )
    
    # Calcola peso totale dalla somma dei pesi nei join
    peso_totale_calcolato = Decimal(0)
    pesi_validi = 0
    
    for join_rec in join_records:
        if join_rec.peso is not None:
            try:
                peso_totale_calcolato += Decimal(str(join_rec.peso))
                pesi_validi += 1
            except (InvalidOperation, TypeError, ValueError):
                pass
    
    # Se abbiamo pesi validi, aggiorna aggregati
    if pesi_validi > 0:
        partita.peso_totale = peso_totale_calcolato
        partita.peso_medio = peso_totale_calcolato / pesi_validi
    elif partita.numero_capi > 0 and nuovo_peso:
        # Se non ci sono altri pesi, usa il nuovo peso per ricalcolare
        # (approssimazione: assume che tutti abbiano lo stesso peso)
        partita.peso_totale = nuovo_peso * partita.numero_capi
        partita.peso_medio = nuovo_peso
    
    db.flush()
    
    # 3. Sincronizza tutti gli animali della partita (usa logica da update_partita)
    join_records_completi = (
        db.query(PartitaAnimaleAnimale, Animale)
        .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
        .filter(PartitaAnimaleAnimale.partita_animale_id == partita_id)
        .all()
    )
    
    data_partita = partita.data
    peso_medio_final = partita.peso_medio
    
    for join_rec, animale_partita in join_records_completi:
        # Usa peso specifico dal join se disponibile, altrimenti peso medio
        peso_specifico = None
        if join_rec.peso is not None:
            try:
                peso_specifico = Decimal(str(join_rec.peso))
            except (InvalidOperation, TypeError, ValueError):
                peso_specifico = peso_medio_final
        else:
            peso_specifico = peso_medio_final
        
        # Aggiorna peso attuale animale e data ultima pesata
        if peso_specifico is not None:
            try:
                animale_partita.peso_attuale = Decimal(str(peso_specifico))
                if data_partita:
                    animale_partita.data_ultima_pesata = data_partita
            except (InvalidOperation, TypeError, ValueError):
                pass
    
    db.commit()


@router.put("/partite/{partita_id}", response_model=PartitaAnimaleResponse)
async def update_partita(
    partita_id: int,
    update: PartitaAnimaleUpdate,
    db: Session = Depends(get_db)
):
    """Update a partita"""
    from app.models.allevamento.animale import Animale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    db_partita = db.query(PartitaAnimale).filter(PartitaAnimale.id == partita_id).first()
    if not db_partita:
        raise HTTPException(status_code=404, detail="Partita non trovata")
    
    update_dict = update.dict(exclude_unset=True)
    
    # Verifica se is_trasferimento_interno viene aggiornato
    is_interno = update_dict.get('is_trasferimento_interno', db_partita.is_trasferimento_interno)
    
    # Valida peso per trasferimenti esterni
    peso_totale = update_dict.get('peso_totale', db_partita.peso_totale)
    if not is_interno and not peso_totale:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il peso è obbligatorio per trasferimenti esterni"
        )
    
    # Converti pesi_individuali a JSON string se presente
    if 'pesi_individuali' in update_dict and update_dict['pesi_individuali']:
        update_dict['pesi_individuali'] = json.dumps([
            p.dict() if hasattr(p, 'dict') else p 
            for p in update_dict['pesi_individuali']
        ])
        
        # Ricalcola pesi totali
        pesi = json.loads(update_dict['pesi_individuali'])
        if pesi and len(pesi) > 0:
            peso_totale = sum(Decimal(str(p.get('peso', 0))) for p in pesi)
            update_dict['peso_totale'] = peso_totale
            update_dict['peso_medio'] = peso_totale / len(pesi)
    
    # Ricalcola peso_medio se peso_totale o numero_capi vengono aggiornati
    if 'peso_totale' in update_dict or 'numero_capi' in update_dict:
        peso_totale_final = update_dict.get('peso_totale', db_partita.peso_totale)
        numero_capi_final = update_dict.get('numero_capi', db_partita.numero_capi)
        if peso_totale_final and numero_capi_final and numero_capi_final > 0:
            update_dict['peso_medio'] = peso_totale_final / numero_capi_final
    
    # Ricalcola modalità di gestione se cambiano parametri rilevanti
    # Solo se modalità_gestione non è esplicitamente fornita nell'update
    if 'modalita_gestione' not in update_dict:
        # Verifica se sono cambiati parametri che influenzano la modalità
        tipo_attuale = update_dict.get('tipo', db_partita.tipo)
        is_interno_attuale = update_dict.get('is_trasferimento_interno', db_partita.is_trasferimento_interno)
        codice_stalla_attuale = update_dict.get('codice_stalla', db_partita.codice_stalla)
        codice_stalla_azienda_attuale = update_dict.get('codice_stalla_azienda', db_partita.codice_stalla_azienda)
        
        # Ricalcola modalità solo se non è associata a un contratto soccida
        if not db_partita.contratto_soccida_id:
            modalita_determinata = _determina_modalita_gestione_partita(
                tipo=tipo_attuale,
                is_trasferimento_interno=is_interno_attuale,
                codice_stalla=codice_stalla_attuale,
                codice_stalla_azienda=codice_stalla_azienda_attuale,
                azienda_id=db_partita.azienda_id,
                db=db
            )
            update_dict['modalita_gestione'] = modalita_determinata
    
    for field, value in update_dict.items():
        setattr(db_partita, field, value)
    
    db.commit()
    db.refresh(db_partita)
    
    # SINCRONIZZAZIONE PESI: mantieni gli animali allineati alla partita
    try:
        # Prepara mappa pesi individuali se presente nell'update o nella partita
        pesi_map = {}
        pesi_json_str = None
        if 'pesi_individuali' in update_dict and isinstance(update_dict.get('pesi_individuali'), str):
            pesi_json_str = update_dict['pesi_individuali']
        elif isinstance(db_partita.pesi_individuali, str):
            pesi_json_str = db_partita.pesi_individuali
        if pesi_json_str:
            try:
                for item in json.loads(pesi_json_str) or []:
                    aur = str(item.get('auricolare') or '').strip()
                    if not aur:
                        continue
                    try:
                        pesi_map[aur] = Decimal(str(item.get('peso'))) if item.get('peso') is not None else None
                    except (InvalidOperation, TypeError, ValueError):
                        pesi_map[aur] = None
            except (json.JSONDecodeError, TypeError):
                pesi_map = {}
        
        # Calcola peso medio se non ci sono pesi individuali validi
        numero_capi = int(db_partita.numero_capi or 0)
        peso_totale_final = db_partita.peso_totale
        peso_medio_final = None
        if peso_totale_final and numero_capi > 0:
            try:
                peso_medio_final = Decimal(str(peso_totale_final)) / Decimal(str(numero_capi))
            except (InvalidOperation, TypeError, ValueError):
                peso_medio_final = None
        
        # Recupera animali collegati alla partita
        join_records = (
            db.query(PartitaAnimaleAnimale, Animale)
            .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
            .filter(PartitaAnimaleAnimale.partita_animale_id == db_partita.id)
            .all()
        )
        # Se non esistono link (partite storiche), prova a crearli
        if not join_records:
            candidati = []
            if pesi_map:
                # Link per auricolare da pesi_individuali
                auricolari = list(pesi_map.keys())
                if auricolari:
                    candidati = db.query(Animale).filter(
                        Animale.auricolare.in_(auricolari),
                        Animale.azienda_id == db_partita.azienda_id,
                        Animale.deleted_at.is_(None)
                    ).all()
            # Se ancora vuoto, link per data (euristica)
            if not candidati and db_partita.data:
                if str(getattr(db_partita, "tipo", "")) in ("ingresso", "TipoPartita.INGRESSO"):
                    candidati = db.query(Animale).filter(
                        Animale.azienda_id == db_partita.azienda_id,
                        Animale.data_arrivo == db_partita.data,
                        Animale.deleted_at.is_(None)
                    ).all()
                else:
                    candidati = db.query(Animale).filter(
                        Animale.azienda_id == db_partita.azienda_id,
                        Animale.data_uscita == db_partita.data,
                        Animale.deleted_at.is_(None)
                    ).all()
            # Crea join con peso medio o specifico
            for animale in candidati:
                peso_specifico = None
                if animale.auricolare and pesi_map:
                    peso_specifico = pesi_map.get(str(animale.auricolare).strip())
                if peso_specifico is None:
                    peso_specifico = peso_medio_final
                nuovo_join = PartitaAnimaleAnimale(
                    partita_animale_id=db_partita.id,
                    animale_id=animale.id,
                    peso=peso_specifico if peso_specifico is not None else None,
                )
                db.add(nuovo_join)
            db.commit()
            join_records = (
                db.query(PartitaAnimaleAnimale, Animale)
                .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
                .filter(PartitaAnimaleAnimale.partita_animale_id == db_partita.id)
                .all()
            )
        
        # Data della partita usata come data_ultima_pesata
        data_partita = db_partita.data
        
        for join_rec, animale in join_records:
            # Peso specifico: se presente in mappa usa quello, altrimenti usa peso medio (se disponibile)
            peso_specifico = None
            if animale.auricolare and pesi_map:
                peso_specifico = pesi_map.get(str(animale.auricolare).strip())
            if peso_specifico is None:
                peso_specifico = peso_medio_final
            
            # Aggiorna peso del join (se disponibile)
            if peso_specifico is not None:
                try:
                    join_rec.peso = Decimal(str(peso_specifico))
                except (InvalidOperation, TypeError, ValueError):
                    pass
            
            # Aggiorna peso attuale animale e data ultima pesata
            if peso_specifico is not None:
                try:
                    animale.peso_attuale = Decimal(str(peso_specifico))
                    if data_partita:
                        animale.data_ultima_pesata = data_partita
                except (InvalidOperation, TypeError, ValueError):
                    pass
        
        db.commit()
    except Exception:
        # Non bloccare l'update partita se la sync pesi fallisce
        db.rollback()
    
    # Deserializza pesi_individuali se presente
    if db_partita.pesi_individuali and isinstance(db_partita.pesi_individuali, str):
        try:
            db_partita.pesi_individuali = json.loads(db_partita.pesi_individuali)
        except (json.JSONDecodeError, TypeError):
            db_partita.pesi_individuali = None
    
    return db_partita


@router.post(
    "/partite/{partita_id}/movimenti-finanziari",
    response_model=PartitaMovimentoFinanziarioResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_partita_movimento_finanziario(
    partita_id: int,
    movimento: PartitaMovimentoFinanziarioCreate,
    db: Session = Depends(get_db),
):
    partita = (
        db.query(PartitaAnimale)
        .filter(PartitaAnimale.id == partita_id, PartitaAnimale.deleted_at.is_(None))
        .first()
    )
    if not partita:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Partita non trovata")

    modalita = movimento.modalita or partita.modalita_gestione

    record = PartitaMovimentoFinanziario(
        partita_id=partita.id,
        direzione=movimento.direzione,
        tipo=movimento.tipo,
        modalita=modalita,
        data=movimento.data,
        importo=movimento.importo,
        note=movimento.note.strip() if movimento.note else None,
        fattura_amministrazione_id=movimento.fattura_amministrazione_id,
        fattura_emessa_id=movimento.fattura_emessa_id,
        pn_movimento_id=movimento.pn_movimento_id,
        riferimento_documento=movimento.riferimento_documento.strip()
        if movimento.riferimento_documento
        else None,
        attivo=True,
    )

    _attach_pn_movimento_to_partita(db, partita.id, movimento.pn_movimento_id)
    # Nota: ora più partite possono condividere lo stesso pn_movimento_id
    # quindi non verifichiamo più l'esistenza di collegamenti esistenti

    db.add(record)
    db.commit()
    db.refresh(record)
    return PartitaMovimentoFinanziarioResponse.model_validate(record, from_attributes=True)


@router.put(
    "/partite/movimenti-finanziari/{movimento_id}",
    response_model=PartitaMovimentoFinanziarioResponse,
)
async def update_partita_movimento_finanziario(
    movimento_id: int,
    update: PartitaMovimentoFinanziarioUpdate,
    db: Session = Depends(get_db),
):
    record = (
        db.query(PartitaMovimentoFinanziario)
        .options(joinedload(PartitaMovimentoFinanziario.partita))
        .filter(PartitaMovimentoFinanziario.id == movimento_id)
        .first()
    )
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimento finanziario non trovato")

    data = update.dict(exclude_unset=True)

    if "direzione" in data:
        record.direzione = data["direzione"]
    if "tipo" in data:
        record.tipo = data["tipo"]
    if "modalita" in data:
        record.modalita = data["modalita"] or (record.partita.modalita_gestione if record.partita else None)
    if "data" in data:
        record.data = data["data"]
    if "importo" in data:
        record.importo = data["importo"]
    if "note" in data:
        record.note = data["note"].strip() if data["note"] else None
    if "riferimento_documento" in data:
        record.riferimento_documento = data["riferimento_documento"].strip() if data["riferimento_documento"] else None
    if "fattura_amministrazione_id" in data:
        record.fattura_amministrazione_id = data["fattura_amministrazione_id"]
    if "fattura_emessa_id" in data:
        record.fattura_emessa_id = data["fattura_emessa_id"]
    if "attivo" in data and data["attivo"] is not None:
        record.attivo = data["attivo"]

    if "pn_movimento_id" in data:
        new_pn_id = data["pn_movimento_id"]
        if new_pn_id and new_pn_id != record.pn_movimento_id:
            _attach_pn_movimento_to_partita(db, record.partita_id, new_pn_id)
            if record.pn_movimento_id and record.pn_movimento_id != new_pn_id:
                _detach_pn_movimento(db, record.pn_movimento_id)
            # Nota: ora più partite possono condividere lo stesso pn_movimento_id
            # quindi non verifichiamo più l'esistenza di collegamenti esistenti
            record.pn_movimento_id = new_pn_id
        elif new_pn_id is None:
            _detach_pn_movimento(db, record.pn_movimento_id)
            record.pn_movimento_id = None

    db.commit()
    db.refresh(record)
    return PartitaMovimentoFinanziarioResponse.model_validate(record, from_attributes=True)


@router.delete("/partite/movimenti-finanziari/{movimento_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partita_movimento_finanziario(
    movimento_id: int,
    db: Session = Depends(get_db),
):
    record = db.query(PartitaMovimentoFinanziario).filter(PartitaMovimentoFinanziario.id == movimento_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Movimento finanziario non trovato")

    _detach_pn_movimento(db, record.pn_movimento_id)
    db.delete(record)
    db.commit()
    return None


@router.delete("/partite/{partita_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_partita(partita_id: int, db: Session = Depends(get_db)):
    """
    Soft delete a partita.
    Rimuove correttamente tutti i collegamenti prima del soft delete:
    - PartitaAnimaleAnimale (link partita-animale)
    - PNMovimento.partita_id (riferimento dai movimenti prima nota)
    - PartitaMovimentoFinanziario (cascade delete-orphan, ma esplicitiamo per chiarezza)
    Così il numero_partita può essere riutilizzato (indice UNIQUE parziale WHERE deleted_at IS NULL).
    """
    db_partita = db.query(PartitaAnimale).filter(PartitaAnimale.id == partita_id).first()
    if not db_partita:
        raise HTTPException(status_code=404, detail="Partita non trovata")

    # 1. Rimuovi collegamenti partita-animale (PartitaAnimaleAnimale)
    db.query(PartitaAnimaleAnimale).filter(
        PartitaAnimaleAnimale.partita_animale_id == partita_id
    ).delete(synchronize_session=False)

    # 2. Scollega movimenti prima nota dalla partita (SET NULL)
    db.query(PNMovimento).filter(PNMovimento.partita_id == partita_id).update(
        {PNMovimento.partita_id: None}, synchronize_session=False
    )

    # 3. Elimina movimenti finanziari collegati alla partita
    db.query(PartitaMovimentoFinanziario).filter(
        PartitaMovimentoFinanziario.partita_id == partita_id
    ).delete(synchronize_session=False)

    # 4. Soft delete della partita
    db_partita.deleted_at = datetime.utcnow()
    db.commit()
    return None


# ============ SINCRONIZZAZIONE ANAGRAFE ============
@router.post("/sincronizza-anagrafe", status_code=status.HTTP_200_OK)
async def sincronizza_anagrafe(
    file: UploadFile = File(...),
    azienda_id: int = Query(..., description="ID azienda"),
    db: Session = Depends(get_db)
):
    """
    Upload e processamento file .gz anagrafe nazionale
    Restituisce le partite identificate senza crearle nel database.
    L'utente le confermerà una ad una tramite il modale.
    Parsing con BeautifulSoup/openpyxl/csv (senza pandas) per ridurre uso memoria.
    """
    from app.services.amministrazione.sincronizzazione_anagrafe import (
        process_anagrafe_file
    )
    
    # Verifica che sia un file .gz
    if not file.filename.endswith('.gz'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il file deve essere un file .gz"
        )
    
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
    if not azienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Azienda non trovata"
        )
    
    # Salva il file su disco temporaneo per evitare di caricarlo tutto in RAM
    import tempfile
    import os
    import shutil
    import logging
    
    logger = logging.getLogger(__name__)
    
    # Crea un file temporaneo sicuro
    fd, temp_path = tempfile.mkstemp(suffix=".gz")
    
    try:
        # Chiudi il file descriptor aperto da mkstemp, lo useremo tramite open o shutil
        os.close(fd)
        
        logger.info(f"Sincronizzazione anagrafe: Inizio processamento per azienda {azienda_id}")
        
        # Scrivi il contenuto del file caricato sul file temporaneo in chunk
        # Questo usa pochissima RAM (solo la dimensione del chunk)
        with open(temp_path, "wb") as buffer:
            # Usa il metodo spooled di FastAPI/Starlette se disponibile per efficienza
            # Se file.file è un oggetto file reale o SpooledTemporaryFile, possiamo copiare direttamente
            if hasattr(file.file, "read"):
                # Copia a blocchi
                chunk_size = 1024 * 1024  # 1MB
                while True:
                    chunk = await file.read(chunk_size)
                    if not chunk:
                        break
                    buffer.write(chunk)
            else:
                # Fallback (non dovrebbe accadere con UploadFile)
                content = await file.read()
                buffer.write(content)
        
        # Forza garbage collection dopo la scrittura
        import gc
        gc.collect()
        
        # Estrai codice azienda (potrebbe essere nel nome file o nel contenuto)
        # Per ora usiamo il codice fiscale o partita iva se disponibile
        azienda_codice = azienda.partita_iva or azienda.codice_fiscale
        
        # Processa il file passando il PERCORSO, non il contenuto
        try:
            from app.models.allevamento.sede import Sede
            from app.services.amministrazione.sincronizzazione_anagrafe import verify_codice_stalla_exists
            
            # Esegui il processamento leggendo dal file su disco
            partite_ingresso, partite_uscita, decessi, codice_stalla_file = process_anagrafe_file(
                gz_content=temp_path,  # Passa il percorso file
                azienda_id=azienda_id,
                azienda_codice=azienda_codice,
                db=db
            )
            
            logger.info(f"Sincronizzazione anagrafe: Completata. Trovate {len(partite_ingresso)} partite ingresso, {len(partite_uscita)} partite uscita, {len(decessi)} gruppi decessi")
            
        except Exception as e:
            logger.error(f"Sincronizzazione anagrafe: Errore - {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Errore nel processamento del file: {str(e)}"
            )
            
    finally:
        # Assicura che il file temporaneo venga rimosso
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass
        # Forza pulizia memoria
        import gc
        gc.collect()
    
    # Verifica se il codice stalla estratto dal file esiste
    codice_stalla_richiesto = None
    codice_stalla_esistente = False
    if codice_stalla_file:
        codice_stalla_richiesto = codice_stalla_file
        sede_exists, sede_id, sede_azienda_id = verify_codice_stalla_exists(codice_stalla_file, db)
        codice_stalla_esistente = sede_exists
        
        # Se il codice stalla non esiste, restituisci un errore che richiede la creazione
        if not sede_exists:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Codice stalla '{codice_stalla_file}' non trovato nel database. È necessario creare una nuova sede con questo codice stalla.",
                headers={"X-Codice-Stalla": codice_stalla_file, "X-Azione-Richiesta": "crea_sede"}
            )
    
    # Salva il nome del file per riferimento futuro
    filename = file.filename or "anagrafe.gz"
    file_path = f"anagrafe/{azienda_id}/{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{filename}"
    
    # Aggiungi file_path a ogni partita per riferimento futuro
    for partita in partite_ingresso + partite_uscita:
        partita['file_anagrafe_origine'] = file_path
        partita['data_importazione'] = datetime.utcnow().isoformat()
    
    # Aggiungi file_path a ogni gruppo decessi per riferimento futuro
    for gruppo in decessi:
        gruppo['file_anagrafe_origine'] = file_path
        gruppo['data_importazione'] = datetime.utcnow().isoformat()
    
    # Restituisci solo i dati senza creare le partite nel database
    # L'utente le confermerà una ad una tramite il modale
    return {
        'message': 'File processato correttamente. Seleziona le partite da confermare.',
        'partite_trovate': {
            'ingresso': len(partite_ingresso),
            'uscita': len(partite_uscita)
        },
        'partite': {
            'ingresso': partite_ingresso,
            'uscita': partite_uscita
        },
        'gruppi_decessi_trovati': len(decessi),
        'gruppi_decessi': decessi,  # Ora sono gruppi raggruppati per data
        'codice_stalla_file': codice_stalla_richiesto,
        'codice_stalla_esistente': codice_stalla_esistente,
        'file_origine': file_path
    }


@router.post("/partite/confirm", response_model=PartitaAnimaleResponse, status_code=status.HTTP_201_CREATED)
async def confirm_partita_anagrafe(
    partita_data: PartitaAnimaleConfirm,
    db: Session = Depends(get_db)
):
    """
    Conferma una partita identificata dall'anagrafe e crea la partita nel database.
    Aggiorna anche i pesi degli animali coinvolti.
    """
    from app.models.amministrazione.partita_animale import TipoPartita
    from decimal import Decimal, InvalidOperation
    
    # Estrai dati dalla richiesta
    azienda_id = partita_data.azienda_id
    tipo = partita_data.tipo  # 'ingresso' o 'uscita'
    data_str = partita_data.data
    codice_stalla = partita_data.codice_stalla  # Provenienza/destinazione esterna
    codice_stalla_azienda = partita_data.codice_stalla_azienda  # Codice stalla dell'allevamento dell'utente
    numero_capi = partita_data.numero_capi
    peso_totale = partita_data.peso_totale
    is_trasferimento_interno = partita_data.is_trasferimento_interno
    codici_capi = partita_data.codici_capi or []
    motivo = partita_data.motivo
    # Normalizza i codici motivo decesso ('02', '2') a 'D' (mantiene coerenza nei dati salvati)
    # L'anagrafe è passata da D a 2, supportiamo entrambi
    if motivo and str(motivo).strip().upper() in ('02', '2'):
        motivo = 'D'
    numero_modello = partita_data.numero_modello
    file_anagrafe_origine = partita_data.file_anagrafe_origine
    # Determina modalita_gestione se non fornita esplicitamente
    modalita_gestione_input = partita_data.modalita_gestione
    if modalita_gestione_input is None:
        # Determina automaticamente in base ai parametri
        modalita_determinata = _determina_modalita_gestione_partita(
            tipo=tipo,
            is_trasferimento_interno=is_trasferimento_interno,
            codice_stalla=codice_stalla,
            codice_stalla_azienda=codice_stalla_azienda,
            azienda_id=azienda_id,
            db=db
        )
        if modalita_determinata is None:
            modalita_gestione = None
        else:
            modalita_gestione = ModalitaGestionePartita(modalita_determinata)
    elif isinstance(modalita_gestione_input, str):
        try:
            modalita_gestione = ModalitaGestionePartita(modalita_gestione_input)
        except ValueError:
            # Se la stringa non corrisponde a un valore enum valido, determina automaticamente
            modalita_determinata = _determina_modalita_gestione_partita(
                tipo=tipo,
                is_trasferimento_interno=is_trasferimento_interno,
                codice_stalla=codice_stalla,
                codice_stalla_azienda=codice_stalla_azienda,
                azienda_id=azienda_id,
                db=db
            )
            if modalita_determinata is None:
                modalita_gestione = None
            else:
                modalita_gestione = ModalitaGestionePartita(modalita_determinata)
    elif isinstance(modalita_gestione_input, ModalitaGestionePartita):
        modalita_gestione = modalita_gestione_input
    else:
        # Default: determina automaticamente
        modalita_determinata = _determina_modalita_gestione_partita(
            tipo=tipo,
            is_trasferimento_interno=is_trasferimento_interno,
            codice_stalla=codice_stalla,
            codice_stalla_azienda=codice_stalla_azienda,
            azienda_id=azienda_id,
            db=db
        )
        if modalita_determinata is None:
            modalita_gestione = None
        else:
            modalita_gestione = ModalitaGestionePartita(modalita_determinata)
    costo_unitario = partita_data.costo_unitario
    valore_totale = partita_data.valore_totale
    fattura_amministrazione_id = getattr(partita_data, "fattura_amministrazione_id", None)
    fattura_emessa_id = getattr(partita_data, "fattura_emessa_id", None)
    pesi_individuali_payload = getattr(partita_data, "pesi_individuali", None)
    animali_dati = partita_data.animali_dati or {}
    
    # Importa il service per determinare automaticamente codice_stalla_azienda se non fornito
    from app.services.allevamento.codici_stalla_service import (
        determina_codice_stalla_azienda,
        is_codice_stalla_gestito
    )
    
    # Se codice_stalla_azienda non è fornito, determinalo automaticamente
    if not codice_stalla_azienda:
        codice_stalla_azienda = determina_codice_stalla_azienda(
            codice_stalla_provenienza=codice_stalla,
            tipo=tipo,
            is_trasferimento_interno=is_trasferimento_interno,
            db=db,
            azienda_id=azienda_id
        )
        
        # Se ancora non determinato, verifica is_trasferimento_interno dinamicamente
        if not codice_stalla_azienda:
            # Ricontrolla se è trasferimento interno (potrebbe non essere stato impostato correttamente)
            is_trasferimento_interno = is_codice_stalla_gestito(codice_stalla, db, azienda_id)
            
            # Riprova a determinare
            codice_stalla_azienda = determina_codice_stalla_azienda(
                codice_stalla_provenienza=codice_stalla,
                tipo=tipo,
                is_trasferimento_interno=is_trasferimento_interno,
                db=db,
                azienda_id=azienda_id
            )
    
    # Aggiorna is_trasferimento_interno se necessario (potrebbe non essere stato impostato correttamente)
    if not is_trasferimento_interno:
        is_trasferimento_interno = is_codice_stalla_gestito(codice_stalla, db, azienda_id)
    
    # Validazione
    if not azienda_id or not tipo or not data_str or not codice_stalla or not numero_capi:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Dati mancanti obbligatori"
        )
    
    # Converti data
    if isinstance(data_str, str):
        from datetime import datetime
        try:
            data = datetime.fromisoformat(data_str.replace('Z', '+00:00')).date()
        except:
            data = datetime.strptime(data_str, '%Y-%m-%d').date()
    else:
        data = data_str
    
    if numero_capi <= 0 and codici_capi:
        numero_capi = len(codici_capi)

    pesi_individuali_list: List[dict] = []
    if pesi_individuali_payload:
        for entry in pesi_individuali_payload:
            try:
                peso_entry = Decimal(str(entry.peso))
            except (InvalidOperation, ValueError, TypeError, NameError):
                peso_entry = None
            pesi_individuali_list.append(
                {"auricolare": entry.auricolare, "peso": peso_entry}
            )
        if not codici_capi:
            codici_capi = [
                item["auricolare"] for item in pesi_individuali_list if item["auricolare"]
            ]

    if not pesi_individuali_list and animali_dati:
        for codice, dati in animali_dati.items():
            peso_raw = dati.get("peso")
            if peso_raw is None:
                continue
            try:
                peso_entry = Decimal(str(peso_raw))
            except (InvalidOperation, ValueError, TypeError, NameError):
                continue
            pesi_individuali_list.append({"auricolare": codice, "peso": peso_entry})
    if pesi_individuali_list and not codici_capi:
        codici_capi = [
            item["auricolare"] for item in pesi_individuali_list if item["auricolare"]
        ]

    if codici_capi:
        codici_capi = list(dict.fromkeys([codice for codice in codici_capi if codice]))

    if numero_capi <= 0 and codici_capi:
        numero_capi = len(codici_capi)

    peso_totale_decimal: Optional[Decimal] = None
    if peso_totale is not None:
        try:
            peso_totale_decimal = Decimal(str(peso_totale))
        except (InvalidOperation, ValueError, TypeError, NameError):
            peso_totale_decimal = None

    if (peso_totale_decimal is None or peso_totale_decimal <= 0) and pesi_individuali_list:
        somma_pesi = sum(
            item["peso"] for item in pesi_individuali_list if item["peso"] is not None
        )
        if somma_pesi:
            peso_totale_decimal = somma_pesi

    if peso_totale_decimal and peso_totale_decimal <= 0:
        peso_totale_decimal = None

    if not is_trasferimento_interno and not peso_totale_decimal:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il peso è obbligatorio per trasferimenti esterni"
        )

    peso_medio = None
    if peso_totale_decimal and numero_capi > 0:
        peso_medio = peso_totale_decimal / numero_capi

    peso_per_animale_map = {
        item["auricolare"]: item["peso"]
        for item in pesi_individuali_list
        if item.get("auricolare") and item.get("peso") is not None
    }
    serialized_pesi_individuali = None
    if pesi_individuali_list:
        serialized_pesi_individuali = json.dumps(
            [
                {
                    "auricolare": item.get("auricolare"),
                    "peso": float(item["peso"]) if item.get("peso") is not None else None,
                }
                for item in pesi_individuali_list
            ]
        )

    animali_by_auricolare: dict[str, Animale] = {}
    if codici_capi:
        existing_animali = (
            db.query(Animale)
            .filter(
                Animale.azienda_id == azienda_id,
                Animale.deleted_at.is_(None),
                Animale.auricolare.in_(codici_capi)
            )
            .all()
        )
        animali_by_auricolare = {animale.auricolare: animale for animale in existing_animali}

    class _BoxAllocator:
        def __init__(self, session: Session):
            self.session = session
            self.cache: dict[str, Optional[dict]] = {}

        def _load_context(self, codice_stalla_value: Optional[str]):
            if not codice_stalla_value:
                return None
            if codice_stalla_value in self.cache:
                return self.cache[codice_stalla_value]

            sede = self.session.query(Sede).filter(
                Sede.codice_stalla == codice_stalla_value,
                Sede.deleted_at.is_(None)
            ).first()
            if not sede:
                self.cache[codice_stalla_value] = None
                return None

            stabilimento = self.session.query(Stabilimento).filter(
                Stabilimento.sede_id == sede.id,
                Stabilimento.deleted_at.is_(None)
            ).first()
            if not stabilimento:
                self.cache[codice_stalla_value] = None
                return None

            boxes = self.session.query(Box).filter(
                Box.stabilimento_id == stabilimento.id,
                Box.deleted_at.is_(None),
                Box.stato.in_(['libero', 'occupato'])
            ).all()
            if not boxes:
                self.cache[codice_stalla_value] = None
                return None

            box_ids = [box.id for box in boxes]
            occupancy_rows = (
                self.session.query(Animale.box_id, func.count(Animale.id))
                .filter(
                    Animale.box_id.in_(box_ids),
                    Animale.stato == 'presente',
                    Animale.deleted_at.is_(None)
                )
                .group_by(Animale.box_id)
                .all()
            ) if box_ids else []
            occupancy = {box_id: count for box_id, count in occupancy_rows}
            context = {"boxes": boxes, "occupancy": occupancy}
            self.cache[codice_stalla_value] = context
            return context

        def assign(self, codice_stalla_value: Optional[str]):
            context = self._load_context(codice_stalla_value)
            if not context:
                return None

            for box in context["boxes"]:
                capacita = box.capacita or 0
                if capacita <= 0:
                    continue
                current = context["occupancy"].get(box.id, 0)
                if current < capacita:
                    context["occupancy"][box.id] = current + 1
                    return box

            fallback_box = context["boxes"][0] if context["boxes"] else None
            if fallback_box:
                context["occupancy"][fallback_box.id] = context["occupancy"].get(fallback_box.id, 0) + 1
            return fallback_box

    box_allocator = _BoxAllocator(db)
    
    # Verifica se esiste già una partita con gli stessi parametri
    # Questo evita duplicati se si conferma di nuovo la stessa partita
    existing_partita = db.query(PartitaAnimale).filter(
        PartitaAnimale.azienda_id == azienda_id,
        PartitaAnimale.tipo == (TipoPartita.INGRESSO if tipo == 'ingresso' else TipoPartita.USCITA),
        PartitaAnimale.data == data,
        PartitaAnimale.codice_stalla == codice_stalla,
        PartitaAnimale.numero_capi == numero_capi,
        PartitaAnimale.deleted_at.is_(None)
    ).first()
    
    if existing_partita:
        # Usa la partita esistente invece di crearne una nuova
        db_partita = existing_partita
        # Imposta modalita_gestione (può essere None per trasferimenti interni o uscite verso non gestiti)
        if modalita_gestione is None:
            db_partita.modalita_gestione = None
        else:
            db_partita.modalita_gestione = (
                modalita_gestione.value if isinstance(modalita_gestione, ModalitaGestionePartita) else modalita_gestione
            )
        
        # Aggiorna i dati della partita esistente se necessario
        if codice_stalla_azienda and not db_partita.codice_stalla_azienda:
            db_partita.codice_stalla_azienda = codice_stalla_azienda
        if peso_totale_decimal and not db_partita.peso_totale:
            db_partita.peso_totale = peso_totale_decimal
            db_partita.peso_medio = peso_medio
        if file_anagrafe_origine and not db_partita.file_anagrafe_origine:
            db_partita.file_anagrafe_origine = file_anagrafe_origine
        if not db_partita.data_importazione and file_anagrafe_origine:
            db_partita.data_importazione = datetime.utcnow()
        if costo_unitario is not None:
            db_partita.costo_unitario = Decimal(str(costo_unitario))
        if valore_totale is not None:
            db_partita.valore_totale = Decimal(str(valore_totale))
        if fattura_amministrazione_id is not None:
            db_partita.fattura_amministrazione_id = fattura_amministrazione_id
        if fattura_emessa_id is not None:
            db_partita.fattura_emessa_id = fattura_emessa_id
        if serialized_pesi_individuali is not None:
            db_partita.pesi_individuali = serialized_pesi_individuali
        
        db.flush()  # Salva le modifiche
    else:
        # Genera numero partita con numero progressivo per (data, tipo, codice_stalla)
        # Include codice_stalla nel conteggio per evitare collisioni tra partite verso stalle diverse
        tipo_prefix = "ING" if tipo == 'ingresso' else "USC"
        data_str_format = data.strftime('%Y%m%d')
        tipo_partita = TipoPartita.INGRESSO if tipo == 'ingresso' else TipoPartita.USCITA

        count = db.query(func.count(PartitaAnimale.id)).filter(
            PartitaAnimale.data == data,
            PartitaAnimale.tipo == tipo_partita,
            PartitaAnimale.codice_stalla == codice_stalla,
            PartitaAnimale.deleted_at.is_(None)
        ).scalar() or 0

        numero_progressivo = f"{(count + 1):03d}"
        numero_partita = f"{tipo_prefix}-{data_str_format}-{codice_stalla}-{numero_progressivo}"

        db_partita = PartitaAnimale(
            azienda_id=azienda_id,
            tipo=TipoPartita.INGRESSO if tipo == 'ingresso' else TipoPartita.USCITA,
            data=data,
            numero_partita=numero_partita,
            codice_stalla=codice_stalla,
            codice_stalla_azienda=codice_stalla_azienda,
            numero_capi=numero_capi,
            peso_totale=peso_totale_decimal,
            peso_medio=peso_medio,
            is_trasferimento_interno=is_trasferimento_interno,
            motivo=motivo,
            numero_modello=numero_modello,
            file_anagrafe_origine=file_anagrafe_origine,
            data_importazione=datetime.utcnow() if file_anagrafe_origine else None,
            modalita_gestione=(
                modalita_gestione.value
                if isinstance(modalita_gestione, ModalitaGestionePartita)
                else (modalita_gestione if modalita_gestione is not None else None)
            ),
            costo_unitario=Decimal(str(costo_unitario)) if costo_unitario is not None else None,
            valore_totale=Decimal(str(valore_totale)) if valore_totale is not None else None,
            fattura_amministrazione_id=fattura_amministrazione_id,
            fattura_emessa_id=fattura_emessa_id,
            pesi_individuali=serialized_pesi_individuali,
        )

        db.add(db_partita)
        try:
            db.flush()
        except IntegrityError as e:
            err_msg = str(e.orig) if hasattr(e, 'orig') else str(e)
            if "numero_partita" in err_msg or "UniqueViolation" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Questa partita risulta già confermata. Ricarica la pagina per aggiornare l'elenco."
                ) from e
            raise

    # Aggiorna o crea gli animali
    animali_aggiornati = 0
    animali_non_trovati = []
    
    if codici_capi:
        peso_per_capo = (
            (peso_totale_decimal / Decimal(len(codici_capi)))
            if peso_totale_decimal and len(codici_capi) > 0
            else None
        )
        
        # Calcola valore per animale dividendo valore_totale equamente (solo per ingressi)
        valore_per_animale = None
        if tipo == 'ingresso' and valore_totale is not None and len(codici_capi) > 0:
            try:
                valore_totale_decimal = Decimal(str(valore_totale))
                valore_per_animale = valore_totale_decimal / Decimal(len(codici_capi))
            except (InvalidOperation, ValueError, TypeError):
                valore_per_animale = None

        for codice_capo in codici_capi:
            animale = animali_by_auricolare.get(codice_capo)
            peso_specifico = peso_per_animale_map.get(codice_capo, peso_per_capo)
            animale_dati_entry = animali_dati.get(codice_capo, {})

            if animale:
                if tipo == 'ingresso':
                    # Per trasferimenti interni, NON sovrascrivere dati sensibili esistenti
                    # Aggiorna solo peso e data se necessario
                    if peso_specifico:
                        # Aggiorna peso_attuale e data_ultima_pesata per riflettere il trasferimento
                        animale.peso_attuale = peso_specifico
                        animale.data_ultima_pesata = data
                        # NON sovrascrivere peso_arrivo per trasferimenti interni (mantiene il peso originale di ingresso)
                        if not is_trasferimento_interno:
                            animale.peso_arrivo = peso_specifico
                    
                    # Aggiorna data_arrivo solo se non è un trasferimento interno
                    # (per trasferimenti interni, mantiene la data_arrivo originale)
                    if not is_trasferimento_interno:
                        animale.data_arrivo = data
                        # Aggiorna codice_provenienza solo per ingressi esterni
                        if codice_stalla:
                            animale.codice_provenienza = codice_stalla

                    codice_stalla_destinazione_finale = codice_stalla_azienda
                    if not codice_stalla_destinazione_finale:
                        codice_stalla_destinazione_finale = determina_codice_stalla_azienda(
                            codice_stalla_provenienza=codice_stalla,
                            tipo=tipo,
                            is_trasferimento_interno=is_trasferimento_interno,
                            db=db,
                            azienda_id=azienda_id
                        )

                    if codice_stalla_destinazione_finale:
                        # Aggiorna codice_azienda_anagrafe con la nuova sede (corretto per trasferimenti interni)
                        animale.codice_azienda_anagrafe = codice_stalla_destinazione_finale

                    # Se è un trasferimento interno, l'animale torna ad essere presente
                    # Pulisce SOLO i campi di uscita perché l'animale è tornato presente
                    # NON toccare altri dati sensibili (provenienza, ingresso, anagrafici, etc.)
                    if is_trasferimento_interno:
                        animale.stato = 'presente'
                        # Pulisce SOLO i campi di uscita
                        animale.data_uscita = None
                        animale.motivo_uscita = None
                        animale.numero_modello_uscita = None
                        animale.data_modello_uscita = None
                        # Pulisce tutti i campi di destinazione uscita
                        animale.codice_azienda_destinazione = None
                        animale.codice_fiera_destinazione = None
                        animale.codice_stato_destinazione = None
                        animale.regione_macello_destinazione = None
                        animale.codice_macello_destinazione = None
                        animale.codice_pascolo_destinazione = None
                        animale.codice_circo_destinazione = None
                        animale.data_macellazione = None
                        animale.abbattimento = None
                        animale.data_provvvedimento = None
                        # NOTA: NON vengono toccati:
                        # - codice_provenienza (mantiene la provenienza originale esterna)
                        # - identificativo_fiscale_provenienza
                        # - specie_allevata_provenienza
                        # - codice_elettronico, codice_madre, codice_assegnato_precedenza
                        # - motivo_ingresso, numero_modello_ingresso, data_modello_ingresso
                        # - peso_arrivo, data_arrivo (mantiene i valori originali)
                        # - tipo_allevamento
                        # - origine_dati

                    if not animale.box_id and codice_stalla_destinazione_finale:
                        assigned_box = box_allocator.assign(codice_stalla_destinazione_finale)
                        if assigned_box:
                            animale.box_id = assigned_box.id
                            if assigned_box.stato == 'libero':
                                assigned_box.stato = 'occupato'
                            db.add(assigned_box)
                    
                    # Assegna valore all'animale se disponibile (solo per ingressi esterni)
                    if tipo == 'ingresso' and not is_trasferimento_interno and valore_per_animale is not None:
                        animale.valore = valore_per_animale
                else:
                    if peso_specifico:
                        animale.peso_attuale = peso_specifico
                    animale.data_ultima_pesata = data

                    animale_dati_uscita = animale_dati_entry or None

                    if animale_dati_uscita:
                        if animale_dati_uscita.get('data_modello_uscita'):
                            animale.data_modello_uscita = animale_dati_uscita['data_modello_uscita']
                        # codice_azienda_destinazione viene preso da animale_dati_uscita se presente
                        if animale_dati_uscita.get('codice_azienda_destinazione'):
                            animale.codice_azienda_destinazione = animale_dati_uscita['codice_azienda_destinazione']
                        if animale_dati_uscita.get('codice_fiera_destinazione'):
                            animale.codice_fiera_destinazione = animale_dati_uscita['codice_fiera_destinazione']
                        if animale_dati_uscita.get('codice_stato_destinazione'):
                            animale.codice_stato_destinazione = animale_dati_uscita['codice_stato_destinazione']
                        if animale_dati_uscita.get('regione_macello_destinazione'):
                            animale.regione_macello_destinazione = animale_dati_uscita['regione_macello_destinazione']
                        if animale_dati_uscita.get('codice_macello_destinazione'):
                            animale.codice_macello_destinazione = animale_dati_uscita['codice_macello_destinazione']
                        if animale_dati_uscita.get('codice_pascolo_destinazione'):
                            animale.codice_pascolo_destinazione = animale_dati_uscita['codice_pascolo_destinazione']
                        if animale_dati_uscita.get('codice_circo_destinazione'):
                            animale.codice_circo_destinazione = animale_dati_uscita['codice_circo_destinazione']
                        if animale_dati_uscita.get('data_macellazione'):
                            animale.data_macellazione = animale_dati_uscita['data_macellazione']
                        if animale_dati_uscita.get('abbattimento'):
                            animale.abbattimento = animale_dati_uscita['abbattimento']
                        if animale_dati_uscita.get('data_provvvedimento'):
                            animale.data_provvvedimento = animale_dati_uscita['data_provvvedimento']

                    if not animale.data_uscita:
                        animale.data_uscita = data
                        animale.motivo_uscita = motivo
                        if numero_modello:
                            animale.numero_modello_uscita = numero_modello
                        
                        # Popola codice_azienda_destinazione se non è già stato popolato da animale_dati_uscita
                        # Usa codice_stalla come fallback (solo se non è trasferimento interno)
                        if not animale.codice_azienda_destinazione and codice_stalla and not is_trasferimento_interno:
                            animale.codice_azienda_destinazione = codice_stalla
                        
                        # I campi di destinazione specifici vengono popolati da animale_dati_uscita
                        # se presenti. Questi campi si escludono a vicenda logicamente:
                        # - codice_fiera_destinazione: se va a una fiera
                        # - codice_stato_destinazione: se va in uno stato estero
                        # - codice_macello_destinazione + regione_macello_destinazione: se va al macello
                        # - codice_pascolo_destinazione: se va a pascolo
                        # - codice_circo_destinazione: se va a un circo
                        # - data_macellazione + abbattimento: se viene macellato
                        # - data_provvvedimento: se c'è un provvedimento
                        # Nota: questi campi vengono già popolati sopra da animale_dati_uscita se presenti
                        if animale.stato == 'presente':
                            # Se è un trasferimento interno, usa 'trasferito' (tornerà 'presente' quando entra nella nuova sede)
                            # Se è un'uscita esterna, imposta stato in base al motivo
                            if is_trasferimento_interno:
                                animale.stato = 'trasferito'
                            elif motivo in ('V', 'v'):  # Vendita
                                animale.stato = 'venduto'
                            elif motivo in ('M', 'm'):  # Macellazione
                                animale.stato = 'macellato'
                            elif motivo in ('D', 'd', '02', '2'):  # Deceduto (D, 02 o 2 - codici anagrafe)
                                animale.stato = 'deceduto'
                            else:
                                # Per altre uscite esterne (non vendita, non macellazione, non deceduto), usa 'venduto' come default
                                animale.stato = 'venduto'  # Default per uscite esterne non specificate

                        if animale.box_id:
                            box_uscita = db.query(Box).filter(Box.id == animale.box_id).first()
                            if box_uscita:
                                altri_animali = db.query(Animale).filter(
                                    Animale.box_id == box_uscita.id,
                                    Animale.id != animale.id,
                                    Animale.stato == 'presente',
                                    Animale.deleted_at.is_(None)
                                ).count()

                                if altri_animali == 0:
                                    box_uscita.stato = 'libero'
                                    db.add(box_uscita)
                            animale.box_id = None
                animali_aggiornati += 1
                continue

            if tipo == 'ingresso':
                codice_azienda_anagrafe_valore = codice_stalla_azienda
                if not codice_azienda_anagrafe_valore:
                    codice_azienda_anagrafe_valore = determina_codice_stalla_azienda(
                        codice_stalla_provenienza=codice_stalla,
                        tipo=tipo,
                        is_trasferimento_interno=is_trasferimento_interno,
                        db=db,
                        azienda_id=azienda_id
                    ) or codice_stalla

                if not peso_specifico and animale_dati_entry.get("peso") is not None:
                    try:
                        peso_specifico = Decimal(str(animale_dati_entry.get("peso")))
                    except (InvalidOperation, ValueError, TypeError, NameError):
                        peso_specifico = None

                nuovo_animale = Animale(
                    auricolare=codice_capo,
                    azienda_id=azienda_id,
                    data_arrivo=data,
                    peso_arrivo=peso_specifico,
                    peso_attuale=peso_specifico,
                    data_ultima_pesata=data,
                    stato='presente',
                    origine_dati='anagrafe' if file_anagrafe_origine else 'manuale',
                    motivo_ingresso=motivo,
                    numero_modello_ingresso=numero_modello,
                    codice_azienda_anagrafe=codice_azienda_anagrafe_valore,
                    codice_provenienza=codice_stalla,
                    sesso=animale_dati_entry.get('sesso'),
                    razza=animale_dati_entry.get('razza'),
                    data_nascita=animale_dati_entry.get('data_nascita'),
                    codice_elettronico=animale_dati_entry.get('codice_elettronico'),
                    codice_madre=animale_dati_entry.get('codice_madre'),
                    identificativo_fiscale_provenienza=animale_dati_entry.get('identificativo_fiscale_provenienza'),
                    specie_allevata_provenienza=animale_dati_entry.get('specie_allevata_provenienza'),
                    data_modello_ingresso=animale_dati_entry.get('data_modello_ingresso'),
                    codice_assegnato_precedenza=animale_dati_entry.get('codice_assegnato_precedenza'),
                    data_estrazione_dati_anagrafe=animale_dati_entry.get('data_estrazione_dati'),
                    valore=valore_per_animale if valore_per_animale is not None else None
                )

                if nuovo_animale.codice_azienda_anagrafe:
                    assigned_box = box_allocator.assign(nuovo_animale.codice_azienda_anagrafe)
                    if assigned_box:
                        nuovo_animale.box_id = assigned_box.id
                        if assigned_box.stato == 'libero':
                            assigned_box.stato = 'occupato'
                        db.add(assigned_box)

                db.add(nuovo_animale)
                db.flush()
                animali_by_auricolare[codice_capo] = nuovo_animale
                animali_aggiornati += 1
            else:
                animali_non_trovati.append(codice_capo)
    
    # Crea i record di join tra partita e animali per tracciare i movimenti
    # Questo permette di tracciare lo storico completo dei movimenti di ogni animale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    
    existing_join_animali = {
        row[0]
        for row in db.query(PartitaAnimaleAnimale.animale_id).filter(
            PartitaAnimaleAnimale.partita_animale_id == db_partita.id
        )
    }
    
    for codice_capo in codici_capi:
        animale = animali_by_auricolare.get(codice_capo)
        if not animale or animale.id in existing_join_animali:
            continue
        
        peso_animale = peso_per_animale_map.get(codice_capo, peso_per_capo)
        if db_partita.pesi_individuali and isinstance(db_partita.pesi_individuali, str):
            try:
                pesi_individuali_json = json.loads(db_partita.pesi_individuali)
                for peso_item in pesi_individuali_json:
                    if peso_item.get('auricolare') == codice_capo:
                        try:
                            peso_animale = Decimal(str(peso_item.get('peso', peso_per_capo or 0)))
                        except:
                            peso_animale = peso_per_capo
                        break
            except:
                pass
        
        join_record = PartitaAnimaleAnimale(
            partita_animale_id=db_partita.id,
            animale_id=animale.id,
            peso=peso_animale
        )
        db.add(join_record)
        existing_join_animali.add(animale.id)
    
    db.commit()
    db.refresh(db_partita)
    
    # Parse pesi_individuali per la risposta
    if db_partita.pesi_individuali and isinstance(db_partita.pesi_individuali, str):
        try:
            db_partita.pesi_individuali = json.loads(db_partita.pesi_individuali)
        except:
            pass
    
    # Crea risposta con informazioni aggiuntive
    response_partita = PartitaAnimaleResponse.model_validate(db_partita)
    
    # Aggiungi informazioni sugli animali aggiornati
    # Nota: fastapi può restituire dict anche se il response_model è PartitaAnimaleResponse
    return {
        **response_partita.model_dump(),
        'animali_aggiornati': animali_aggiornati,
        'animali_non_trovati': animali_non_trovati if animali_non_trovati else None
    }


@router.post("/gruppi-decessi/confirm", status_code=status.HTTP_201_CREATED)
async def confirm_gruppo_decessi_anagrafe(
    gruppo_data: dict,
    db: Session = Depends(get_db)
):
    """
    Conferma un gruppo di decessi identificato dall'anagrafe e crea il gruppo nel database.
    Crea anche i singoli decessi e aggiorna lo stato degli animali.
    """
    from app.models.allevamento.gruppo_decessi import GruppoDecessi
    from app.models.allevamento.decesso import Decesso
    from app.models.allevamento.animale import Animale
    from app.schemas.allevamento.gruppo_decessi import GruppoDecessiConfirm, GruppoDecessiResponse
    from decimal import Decimal
    from datetime import datetime
    
    # Valida i dati usando lo schema
    try:
        gruppo_confirm = GruppoDecessiConfirm(**gruppo_data)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Dati non validi: {str(e)}"
        )
    
    # Estrai dati dalla richiesta
    azienda_id = gruppo_confirm.azienda_id
    data_uscita_str = gruppo_confirm.data_uscita
    codice_stalla_decesso = (gruppo_confirm.codice_stalla_decesso or "").strip() or None
    numero_certificato_smaltimento = gruppo_confirm.numero_certificato_smaltimento
    fattura_smaltimento_id = gruppo_confirm.fattura_smaltimento_id
    valore_economico_totale = gruppo_confirm.valore_economico_totale
    a_carico = gruppo_confirm.a_carico
    note = gruppo_confirm.note
    file_anagrafe_origine = gruppo_confirm.file_anagrafe_origine
    codici_capi = gruppo_confirm.codici_capi
    
    # Converti data
    if isinstance(data_uscita_str, str):
        try:
            data_uscita = datetime.fromisoformat(data_uscita_str.replace('Z', '+00:00')).date()
        except:
            data_uscita = datetime.strptime(data_uscita_str, '%Y-%m-%d').date()
    else:
        data_uscita = data_uscita_str
    
    # Verifica se esiste già un gruppo per questa data, codice_stalla e azienda
    # (più gruppi stesso giorno in stalle diverse sono consentiti)
    existing_q = db.query(GruppoDecessi).filter(
        GruppoDecessi.azienda_id == azienda_id,
        GruppoDecessi.data_uscita == data_uscita,
        GruppoDecessi.deleted_at.is_(None)
    )
    if codice_stalla_decesso:
        existing_q = existing_q.filter(GruppoDecessi.codice_stalla_decesso == codice_stalla_decesso)
    else:
        existing_q = existing_q.filter(
            (GruppoDecessi.codice_stalla_decesso.is_(None)) | (GruppoDecessi.codice_stalla_decesso == "")
        )
    existing_gruppo = existing_q.first()
    
    if existing_gruppo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Gruppo decessi già esistente per questa data e stalla"
        )
    
    # Crea il gruppo decessi
    db_gruppo = GruppoDecessi(
        azienda_id=azienda_id,
        data_uscita=data_uscita,
        codice_stalla_decesso=codice_stalla_decesso,
        numero_certificato_smaltimento=numero_certificato_smaltimento,
        fattura_smaltimento_id=fattura_smaltimento_id,
        valore_economico_totale=Decimal(str(valore_economico_totale)) if valore_economico_totale else None,
        a_carico=a_carico,
        file_anagrafe_origine=file_anagrafe_origine,
        data_importazione=datetime.utcnow() if file_anagrafe_origine else None,
        note=note
    )
    
    db.add(db_gruppo)
    db.flush()  # Per ottenere l'ID del gruppo
    
    # Crea i decessi per ogni capo e collega al gruppo
    animali_aggiornati = 0
    animali_non_trovati = []
    decessi_creati = []
    
    for codice_capo in codici_capi:
        # Cerca l'animale
        animale = db.query(Animale).filter(
            Animale.auricolare == codice_capo,
            Animale.azienda_id == azienda_id,
            Animale.deleted_at.is_(None)
        ).first()
        
        if animale:
            # Verifica se esiste già un decesso per questo animale
            existing_decesso = db.query(Decesso).filter(
                Decesso.animale_id == animale.id
            ).first()
            
            if not existing_decesso:
                # Estrai dati completi per questo animale (se disponibili)
                animale_dati = None
                if gruppo_confirm.animali_dati and codice_capo in gruppo_confirm.animali_dati:
                    animale_dati = gruppo_confirm.animali_dati[codice_capo]
                
                # Estrai valore_capo se disponibile
                valore_capo = None
                if animale_dati and 'valore_capo' in animale_dati:
                    valore_capo_val = animale_dati['valore_capo']
                    if valore_capo_val is not None:
                        try:
                            valore_capo = Decimal(str(valore_capo_val))
                        except (ValueError, TypeError):
                            valore_capo = None
                
                # Estrai note se disponibili
                note_decesso = None
                if animale_dati and 'note' in animale_dati:
                    note_decesso = animale_dati['note']
                
                # Determina a_carico per questo animale: se presente in animali_dati usa quello, altrimenti usa il valore globale
                a_carico_capo = a_carico  # Default al valore globale
                if animale_dati and 'a_carico' in animale_dati:
                    a_carico_capo = bool(animale_dati['a_carico'])
                
                # Determina responsabile basandosi su a_carico del capo
                # a_carico=True -> responsabile='soccidario' (a carico dell'azienda)
                # a_carico=False -> responsabile='soccidante' (a carico del cliente)
                responsabile = 'soccidario' if a_carico_capo else 'soccidante'
                
                # Crea il decesso
                db_decesso = Decesso(
                    animale_id=animale.id,
                    gruppo_decessi_id=db_gruppo.id,
                    data_ora=datetime.combine(data_uscita, datetime.min.time()),
                    valore_capo=valore_capo,
                    note=note_decesso,
                    responsabile=responsabile,
                )
                
                db.add(db_decesso)
                decessi_creati.append(animale.id)
                
                # Aggiorna lo stato dell'animale e tutti i campi disponibili
                animale.stato = 'deceduto'
                animale.data_uscita = data_uscita
                animale.motivo_uscita = 'D'  # Decesso (standard interno; anagrafe usa D, 02 o 2)
                animale.data_ultima_pesata = data_uscita  # Aggiorna con data di decesso
                
                # Aggiorna tutti i campi di uscita disponibili dal file
                if animale_dati:
                    # Imposta codice_azienda_anagrafe dalla prima colonna del file (AZIENDA_CODICE)
                    if animale_dati.get('codice_stalla_decesso'):
                        animale.codice_azienda_anagrafe = animale_dati['codice_stalla_decesso']
                    
                    if animale_dati.get('numero_modello_uscita'):
                        animale.numero_modello_uscita = animale_dati['numero_modello_uscita']
                    if animale_dati.get('data_modello_uscita'):
                        animale.data_modello_uscita = animale_dati['data_modello_uscita']
                    if animale_dati.get('codice_fiera_destinazione'):
                        animale.codice_fiera_destinazione = animale_dati['codice_fiera_destinazione']
                    if animale_dati.get('codice_stato_destinazione'):
                        animale.codice_stato_destinazione = animale_dati['codice_stato_destinazione']
                    if animale_dati.get('regione_macello_destinazione'):
                        animale.regione_macello_destinazione = animale_dati['regione_macello_destinazione']
                    if animale_dati.get('codice_macello_destinazione'):
                        animale.codice_macello_destinazione = animale_dati['codice_macello_destinazione']
                    if animale_dati.get('codice_pascolo_destinazione'):
                        animale.codice_pascolo_destinazione = animale_dati['codice_pascolo_destinazione']
                    if animale_dati.get('codice_circo_destinazione'):
                        animale.codice_circo_destinazione = animale_dati['codice_circo_destinazione']
                    if animale_dati.get('data_macellazione'):
                        animale.data_macellazione = animale_dati['data_macellazione']
                    if animale_dati.get('abbattimento'):
                        animale.abbattimento = animale_dati['abbattimento']
                    if animale_dati.get('data_provvvedimento'):
                        animale.data_provvvedimento = animale_dati['data_provvvedimento']
                
                animali_aggiornati += 1
        else:
            animali_non_trovati.append(codice_capo)
    
    db.commit()
    db.refresh(db_gruppo)
    
    # Crea risposta
    response_gruppo = GruppoDecessiResponse.model_validate(db_gruppo)
    
    return {
        **response_gruppo.model_dump(),
        'animali_aggiornati': animali_aggiornati,
        'animali_non_trovati': animali_non_trovati if animali_non_trovati else None,
        'decessi_creati': len(decessi_creati)
    }


