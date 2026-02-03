"""
Animali endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel, Field
from datetime import datetime, date
from decimal import Decimal

from app.core.database import get_db
from app.models.allevamento import Azienda, Sede, Stabilimento, Box, Animale
from app.schemas.allevamento.animale import AnimaleCreate, AnimaleUpdate, AnimaleResponse
from app.schemas.allevamento.storico_tipo_allevamento import (
    StoricoTipoAllevamentoCreate,
    StoricoTipoAllevamentoUpdate,
    StoricoTipoAllevamentoResponse
)

router = APIRouter()


class AssegnaAnimaliRequest(BaseModel):
    azienda_id: int
    codice_stalla: Optional[str] = None
    distribuzione_uniforme: bool = True


class RiassegnaAnimaliRequest(BaseModel):
    azienda_id: int
    codice_stalla: Optional[str] = None
    rimuovi_assegnazioni_esistenti: bool = True

@router.post("/animali/assegna-da-partite", status_code=status.HTTP_200_OK)
async def assegna_animali_da_partite(
    request: AssegnaAnimaliRequest,
    db: Session = Depends(get_db)
):
    """
    Assegna automaticamente animali senza box alle strutture basandosi sulle partite.
    Raggruppa per codice_stalla_azienda e distribuisce uniformemente sui box disponibili.
    """
    from app.models.amministrazione.partita_animale import PartitaAnimale, TipoPartita
    from sqlalchemy import func
    from datetime import datetime
    
    azienda_id = request.azienda_id
    codice_stalla = request.codice_stalla
    distribuzione_uniforme = request.distribuzione_uniforme
    
    # Filtra animali senza box, presenti, dell'azienda
    query_animali = db.query(Animale).filter(
        Animale.azienda_id == azienda_id,
        Animale.stato == 'presente',
        Animale.box_id.is_(None),
        Animale.deleted_at.is_(None)
    )
    
    # Filtra per codice_azienda_anagrafe se specificato
    if codice_stalla:
        query_animali = query_animali.filter(
            Animale.codice_azienda_anagrafe == codice_stalla
        )
    
    animali_senza_box = query_animali.all()
    
    if not animali_senza_box:
        return {
            'message': 'Nessun animale senza box da assegnare',
            'animali_assegnati': 0,
            'dettagli': []
        }
    
    # Raggruppa animali per codice_azienda_anagrafe E data_arrivo
    # Questo permette di mantenere insieme gli animali della stessa partita/data
    animali_per_stalla_data = {}
    for animale in animali_senza_box:
        codice_stalla_dest = animale.codice_azienda_anagrafe or 'SENZA_CODICE'
        data_arrivo = animale.data_arrivo or datetime.utcnow().date()
        
        key = (codice_stalla_dest, data_arrivo)
        if key not in animali_per_stalla_data:
            animali_per_stalla_data[key] = []
        animali_per_stalla_data[key].append(animale)
    
    risultati = []
    totali_assegnati = 0
    
    # Ordina per data_arrivo (più vecchie prima) per mantenere coerenza
    sorted_keys = sorted(animali_per_stalla_data.keys(), key=lambda x: (x[0], x[1]))
    
    for codice_stalla_dest, data_arrivo in sorted_keys:
        animali_list = animali_per_stalla_data[(codice_stalla_dest, data_arrivo)]
        # Trova la sede corrispondente
        sede = db.query(Sede).filter(
            Sede.codice_stalla == codice_stalla_dest,
            Sede.azienda_id == azienda_id,
            Sede.deleted_at.is_(None)
        ).first()
        
        if not sede:
            risultati.append({
                'codice_stalla': codice_stalla_dest,
                'animali': len(animali_list),
                'assegnati': 0,
                'errore': f'Sede con codice stalla {codice_stalla_dest} non trovata'
            })
            continue
        
        # Trova il primo stabilimento disponibile nella sede
        stabilimento = db.query(Stabilimento).filter(
            Stabilimento.sede_id == sede.id,
            Stabilimento.deleted_at.is_(None)
        ).first()
        
        if not stabilimento:
            risultati.append({
                'codice_stalla': codice_stalla_dest,
                'animali': len(animali_list),
                'assegnati': 0,
                'errore': f'Nessuno stabilimento trovato per la sede {sede.nome}'
            })
            continue
        
        # Trova tutti i box disponibili nello stabilimento
        boxes = db.query(Box).filter(
            Box.stabilimento_id == stabilimento.id,
            Box.deleted_at.is_(None),
            Box.stato.in_(['libero', 'occupato'])
        ).order_by(Box.nome.asc()).all()
        
        if not boxes:
            risultati.append({
                'codice_stalla': codice_stalla_dest,
                'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                'animali': len(animali_list),
                'assegnati': 0,
                'errore': f'Nessun box disponibile nello stabilimento {stabilimento.nome}'
            })
            continue
        
        # Calcola occupazione corrente di ogni box (OTTIMIZZATO: 1 query invece di N)
        box_ids = [box.id for box in boxes]
        occupazione_query = db.query(
            Animale.box_id,
            func.count(Animale.id).label('count')
        ).filter(
            Animale.box_id.in_(box_ids),
            Animale.stato == 'presente',
            Animale.deleted_at.is_(None)
        ).group_by(Animale.box_id).all()
        
        occupazione_map = {row[0]: row[1] for row in occupazione_query}
        
        box_occupazione = {}
        for box in boxes:
            num_animali = occupazione_map.get(box.id, 0)
            box_occupazione[box.id] = {
                'box': box,
                'occupazione': num_animali,
                'spazio_libero': box.capacita - num_animali
            }
        
        # Distribuisci gli animali nel minor numero di box possibile
        # Strategia: riempi completamente i box prima di passare al successivo
        assegnati = 0
        num_animali_da_assegnare = len(animali_list)
        
        # Ordina i box per spazio libero (da più spazio a meno spazio)
        boxes_ordinati = sorted(
            box_occupazione.values(),
            key=lambda x: x['spazio_libero'],
            reverse=True
        )
        
        animale_index = 0
        box_utilizzati_set = set()  # Traccia quali box sono stati utilizzati
        
        for box_info in boxes_ordinati:
            if animale_index >= num_animali_da_assegnare:
                break
            
            box = box_info['box']
            spazio_libero = box_info['spazio_libero']
            
            # Salta box senza spazio
            if spazio_libero <= 0:
                continue
            
            # Assegna quanti più animali possibile a questo box
            animali_per_box = min(spazio_libero, num_animali_da_assegnare - animale_index)
            
            for i in range(animali_per_box):
                if animale_index >= num_animali_da_assegnare:
                    break
                
                animale = animali_list[animale_index]
                animale.box_id = box.id
                animale.data_inserimento_box = datetime.utcnow()
                
                # Aggiorna stato box
                if box.stato == 'libero':
                    box.stato = 'occupato'
                
                box_utilizzati_set.add(box.id)
                assegnati += 1
                animale_index += 1
            
            # Aggiorna l'occupazione del box per i prossimi calcoli (se ci sono ancora animali da assegnare)
            if animali_per_box > 0:
                box_occupazione[box.id]['occupazione'] += animali_per_box
                box_occupazione[box.id]['spazio_libero'] -= animali_per_box
        
        db.commit()
        
        risultati.append({
            'codice_stalla': codice_stalla_dest,
            'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
            'sede': sede.nome,
            'stabilimento': stabilimento.nome,
            'animali': len(animali_list),
            'assegnati': assegnati,
            'box_utilizzati': len(box_utilizzati_set)
        })
        
        totali_assegnati += assegnati
    
    return {
        'message': f'Assegnati {totali_assegnati} animali alle strutture',
        'animali_assegnati': totali_assegnati,
        'dettagli': risultati
    }


@router.post("/animali/riassegna-box", status_code=status.HTTP_200_OK)
async def riassegna_animali_box(
    request: RiassegnaAnimaliRequest,
    db: Session = Depends(get_db)
):
    """
    Riassegna tutti gli animali presenti ai box, raggruppandoli per data_arrivo
    e distribuendoli nel minor numero di box possibile rispettando la capacità massima.
    Rimuove le assegnazioni esistenti prima di riassegnare.
    """
    from sqlalchemy import func
    from datetime import datetime
    
    azienda_id = request.azienda_id
    codice_stalla = request.codice_stalla
    rimuovi_esistenti = request.rimuovi_assegnazioni_esistenti
    
    # Filtra animali presenti dell'azienda
    query_animali = db.query(Animale).filter(
        Animale.azienda_id == azienda_id,
        Animale.stato == 'presente',
        Animale.deleted_at.is_(None)
    )
    
    # Filtra per codice_azienda_anagrafe se specificato
    if codice_stalla:
        query_animali = query_animali.filter(
            Animale.codice_azienda_anagrafe == codice_stalla
        )
    
    animali_presenti = query_animali.all()
    
    if not animali_presenti:
        return {
            'message': 'Nessun animale presente da riassegnare',
            'animali_riassegnati': 0,
            'dettagli': []
        }
    
    # Se richiesto, rimuovi tutte le assegnazioni esistenti
    # IMPORTANTE: Se rimuovi_esistenti=True, rimuoviamo TUTTE le assegnazioni di TUTTI gli animali presenti dell'azienda
    # per avere un calcolo corretto dello spazio disponibile
    if rimuovi_esistenti:
        # Rimuovi assegnazioni di TUTTI gli animali presenti dell'azienda (non solo quelli filtrati)
        animali_da_rimuovere = db.query(Animale).filter(
            Animale.azienda_id == azienda_id,
            Animale.stato == 'presente',
            Animale.box_id.isnot(None),
            Animale.deleted_at.is_(None)
        ).all()
        
        for animale in animali_da_rimuovere:
            animale.box_id = None
            animale.data_inserimento_box = None
        
        # Aggiorna lo stato di tutti i box a 'libero' se necessario
        boxes_da_aggiornare = db.query(Box).join(Stabilimento).join(Sede).filter(
            Sede.azienda_id == azienda_id,
            Box.deleted_at.is_(None)
        ).all()
        
        for box in boxes_da_aggiornare:
            box.stato = 'libero'
        
        db.commit()
        print(f"Rimossi box_id da {len(animali_da_rimuovere)} animali e resettati {len(boxes_da_aggiornare)} box")
    
    # Trova la prima sede disponibile come fallback per animali senza codice_stalla
    prima_sede_fallback = db.query(Sede).filter(
        Sede.azienda_id == azienda_id,
        Sede.deleted_at.is_(None)
    ).order_by(Sede.id.asc()).first()
    
    # Ora riassegna usando la stessa logica migliorata
    # Raggruppa animali per codice_azienda_anagrafe E data_arrivo
    animali_per_stalla_data = {}
    for animale in animali_presenti:
        codice_stalla_dest = animale.codice_azienda_anagrafe or None
        data_arrivo = animale.data_arrivo or datetime.utcnow().date()
        
        # Se non ha codice_stalla, usa un placeholder per raggrupparli
        if not codice_stalla_dest:
            codice_stalla_dest = '__SENZA_CODICE__'
        
        key = (codice_stalla_dest, data_arrivo)
        if key not in animali_per_stalla_data:
            animali_per_stalla_data[key] = []
        animali_per_stalla_data[key].append(animale)
    
    risultati = []
    totali_riassegnati = 0
    
    # Ordina per data_arrivo (più vecchie prima) per mantenere coerenza
    sorted_keys = sorted(animali_per_stalla_data.keys(), key=lambda x: (x[0], x[1]))
    
    for codice_stalla_dest, data_arrivo in sorted_keys:
        animali_list = animali_per_stalla_data[(codice_stalla_dest, data_arrivo)]
        
        # Gestisci animali senza codice_stalla
        if codice_stalla_dest == '__SENZA_CODICE__':
            if not prima_sede_fallback:
                risultati.append({
                    'codice_stalla': 'N/A',
                    'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                    'animali': len(animali_list),
                    'riassegnati': 0,
                    'errore': 'Nessuna sede disponibile per animali senza codice_stalla'
                })
                continue
            sede = prima_sede_fallback
            codice_stalla_dest_display = f'{prima_sede_fallback.codice_stalla} (fallback)'
            # Aggiorna codice_azienda_anagrafe per gli animali senza codice
            for animale_senza_codice in animali_list:
                if not animale_senza_codice.codice_azienda_anagrafe:
                    animale_senza_codice.codice_azienda_anagrafe = prima_sede_fallback.codice_stalla
        else:
            # Trova la sede corrispondente
            sede = db.query(Sede).filter(
                Sede.codice_stalla == codice_stalla_dest,
                Sede.azienda_id == azienda_id,
                Sede.deleted_at.is_(None)
            ).first()
            
            codice_stalla_dest_display = codice_stalla_dest
        
        if not sede:
            risultati.append({
                'codice_stalla': codice_stalla_dest_display,
                'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                'animali': len(animali_list),
                'riassegnati': 0,
                'errore': f'Sede con codice stalla {codice_stalla_dest} non trovata'
            })
            continue
        
        # Trova tutti gli stabilimenti nella sede (non solo il primo)
        stabilimenti = db.query(Stabilimento).filter(
            Stabilimento.sede_id == sede.id,
            Stabilimento.deleted_at.is_(None)
        ).all()
        
        if not stabilimenti:
            risultati.append({
                'codice_stalla': codice_stalla_dest,
                'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                'animali': len(animali_list),
                'riassegnati': 0,
                'errore': f'Nessuno stabilimento trovato per la sede {sede.nome}'
            })
            continue
        
        # Trova tutti i box disponibili in tutti gli stabilimenti della sede (OTTIMIZZATO: 1 query)
        stabilimento_ids = [s.id for s in stabilimenti]
        boxes = db.query(Box).filter(
            Box.stabilimento_id.in_(stabilimento_ids),
            Box.deleted_at.is_(None),
            Box.stato.in_(['libero', 'occupato'])
        ).order_by(Box.nome.asc()).all()
        
        if not boxes:
            risultati.append({
                'codice_stalla': codice_stalla_dest_display,
                'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                'sede': sede.nome,
                'stabilimento': 'N/A',
                'animali': len(animali_list),
                'riassegnati': 0,
                'animali_non_assegnati': len(animali_list),
                'spazio_disponibile': 0,
                'box_utilizzati': 0,
                'errore': f'Nessun box disponibile nella sede {sede.nome}'
            })
            continue
        
        # Calcola occupazione corrente di ogni box (OTTIMIZZATO: 1 query invece di N)
        box_ids = [box.id for box in boxes]
        occupazione_query = db.query(
            Animale.box_id,
            func.count(Animale.id).label('count')
        ).filter(
            Animale.box_id.in_(box_ids),
            Animale.stato == 'presente',
            Animale.deleted_at.is_(None)
        ).group_by(Animale.box_id).all()
        
        occupazione_map = {row[0]: row[1] for row in occupazione_query}
        
        box_occupazione = {}
        for box in boxes:
            num_animali = occupazione_map.get(box.id, 0)
            spazio_libero = max(0, box.capacita - num_animali)
            box_occupazione[box.id] = {
                'box': box,
                'occupazione': num_animali,
                'spazio_libero': spazio_libero
            }
        
        # Distribuisci gli animali nel minor numero di box possibile
        # Strategia: riempi completamente i box prima di passare al successivo
        riassegnati = 0
        num_animali_da_assegnare = len(animali_list)
        
        # Ordina i box per spazio libero (da più spazio a meno spazio)
        boxes_ordinati = sorted(
            box_occupazione.values(),
            key=lambda x: x['spazio_libero'],
            reverse=True
        )
        
        animale_index = 0
        box_utilizzati_set = set()  # Traccia quali box sono stati utilizzati
        
        # Calcola spazio totale disponibile
        spazio_totale_disponibile = sum(box_info['spazio_libero'] for box_info in box_occupazione.values() if box_info['spazio_libero'] > 0)
        
        # Debug: log per capire il problema
        if spazio_totale_disponibile == 0 and num_animali_da_assegnare > 0:
            print(f"ATTENZIONE: {num_animali_da_assegnare} animali da assegnare ma 0 spazio disponibile per {codice_stalla_dest_display}")
            print(f"  Sede: {sede.nome}, Stabilimenti: {len(stabilimenti)}")
            print(f"  Box trovati: {len(boxes)}")
            for box_id, box_info in box_occupazione.items():
                print(f"  Box {box_info['box'].nome} (ID: {box_info['box'].id}): capacità={box_info['box'].capacita}, occupazione={box_info['occupazione']}, spazio_libero={box_info['spazio_libero']}, stato={box_info['box'].stato}")
        
        # Se spazio totale è 0 ma ci sono box, significa che tutti i box sono pieni
        if spazio_totale_disponibile == 0 and len(boxes) > 0 and num_animali_da_assegnare > 0:
            errore_assegnazione = f'Tutti i {len(boxes)} box sono pieni. Spazio disponibile: 0, animali da assegnare: {num_animali_da_assegnare}.'
            risultati.append({
                'codice_stalla': codice_stalla_dest_display,
                'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
                'sede': sede.nome,
                'stabilimento': stabilimenti[0].nome if stabilimenti else 'N/A',
                'animali': len(animali_list),
                'riassegnati': 0,
                'animali_non_assegnati': len(animali_list),
                'spazio_disponibile': 0,
                'box_utilizzati': 0,
                'errore': errore_assegnazione
            })
            continue
        
        for box_info in boxes_ordinati:
            if animale_index >= num_animali_da_assegnare:
                break
            
            box = box_info['box']
            spazio_libero = box_info['spazio_libero']
            
            # Salta box senza spazio
            if spazio_libero <= 0:
                continue
            
            # Assegna quanti più animali possibile a questo box
            animali_per_box = min(spazio_libero, num_animali_da_assegnare - animale_index)
            
            for i in range(animali_per_box):
                if animale_index >= num_animali_da_assegnare:
                    break
                
                animale = animali_list[animale_index]
                animale.box_id = box.id
                animale.data_inserimento_box = datetime.utcnow()
                
                # Aggiorna stato box
                if box.stato == 'libero':
                    box.stato = 'occupato'
                
                box_utilizzati_set.add(box.id)
                riassegnati += 1
                animale_index += 1
            
            # Aggiorna l'occupazione del box per i prossimi calcoli
            if animali_per_box > 0:
                box_occupazione[box.id]['occupazione'] += animali_per_box
                box_occupazione[box.id]['spazio_libero'] -= animali_per_box
        
        db.commit()
        
        # Controlla se ci sono animali non assegnati
        animali_non_assegnati = num_animali_da_assegnare - riassegnati
        errore_assegnazione = None
        if animali_non_assegnati > 0:
            errore_assegnazione = f'Spazio insufficiente: {animali_non_assegnati} animali non assegnati (spazio disponibile: {spazio_totale_disponibile}, animali da assegnare: {num_animali_da_assegnare})'
        
        # Trova lo stabilimento principale utilizzato (quello con più box utilizzati)
        stabilimento_principale = None
        for stabilimento in stabilimenti:
            box_stab = [b for b in boxes_ordinati if b['box'].stabilimento_id == stabilimento.id and b['box'].id in box_utilizzati_set]
            if box_stab:
                stabilimento_principale = stabilimento
                break
        
        risultati.append({
            'codice_stalla': codice_stalla_dest_display,
            'data_arrivo': data_arrivo.isoformat() if data_arrivo else None,
            'sede': sede.nome,
            'stabilimento': stabilimento_principale.nome if stabilimento_principale else 'N/A',
            'animali': len(animali_list),
            'riassegnati': riassegnati,
            'animali_non_assegnati': animali_non_assegnati,
            'spazio_disponibile': spazio_totale_disponibile,
            'box_utilizzati': len(box_utilizzati_set),
            'errore': errore_assegnazione
        })
        
        totali_riassegnati += riassegnati
    
    return {
        'message': f'Riassegnati {totali_riassegnati} animali ai box',
        'animali_riassegnati': totali_riassegnati,
        'dettagli': risultati
    }



# ============ ANIMALI CRUD ============
@router.get("/animali", response_model=List[AnimaleResponse])
async def get_animali(
    azienda_id: Optional[int] = None,
    stato: Optional[str] = None,
    box_id: Optional[int] = None,
    stabilimento_id: Optional[int] = None,
    codice_azienda_anagrafe: Optional[str] = None,
    sede_id: Optional[int] = None,
    include_box: bool = False,
    include_contratto: bool = False,
    skip: int = 0,
    limit: Optional[int] = None,  # Aumentato da 1000 a 10000 per supportare aziende più grandi
    db: Session = Depends(get_db)
):
    """Get all animali with optional filters
    
    Filtri gerarchici:
    - sede_id: include animali con codice_azienda_anagrafe corrispondente al codice_stalla della sede
      E animali con box_id che appartengono a stabilimenti della sede.
    - stabilimento_id: include animali con box_id che appartengono allo stabilimento.
    - box_id: include animali assegnati al box specifico.
    
    Args:
        include_box: If True, loads box relationship for each animale
        include_contratto: If True, loads contratto_soccida relationship for each animale
    """
    from sqlalchemy.orm import joinedload
    
    query = db.query(Animale).filter(Animale.deleted_at.is_(None))
    
    # Aggiungi joinedload opzionali per evitare N+1 queries
    if include_box:
        query = query.options(joinedload(Animale.box))
    
    if include_contratto:
        query = query.options(joinedload(Animale.contratto_soccida))
    
    if azienda_id is not None:
        query = query.filter(Animale.azienda_id == azienda_id)
    if stato:
        query = query.filter(Animale.stato == stato)
    if box_id is not None:
        query = query.filter(Animale.box_id == box_id)
    if stabilimento_id is not None:
        # Ottieni tutti i box_id dello stabilimento
        box_ids_stabilimento = db.query(Box.id).filter(
            Box.stabilimento_id == stabilimento_id,
            Box.deleted_at.is_(None)
        ).all()
        box_ids_list_stab = [box_id[0] for box_id in box_ids_stabilimento] if box_ids_stabilimento else []
        if box_ids_list_stab:
            query = query.filter(Animale.box_id.in_(box_ids_list_stab))
        else:
            # Se lo stabilimento non ha box, ritorna lista vuota
            return []
    if codice_azienda_anagrafe:
        query = query.filter(Animale.codice_azienda_anagrafe == codice_azienda_anagrafe)
    
    if sede_id is not None:
        # Ottieni la sede per recuperare il codice_stalla
        sede = db.query(Sede).filter(
            Sede.id == sede_id,
            Sede.deleted_at.is_(None)
        ).first()
        
        if not sede:
            # Se la sede non esiste, ritorna lista vuota
            return []
        
        # Ottieni tutti i box_id degli stabilimenti della sede
        stabilimenti_ids = db.query(Stabilimento.id).filter(
            Stabilimento.sede_id == sede_id,
            Stabilimento.deleted_at.is_(None)
        ).subquery()
        
        box_ids_sede = db.query(Box.id).filter(
            Box.stabilimento_id.in_(stabilimenti_ids),
            Box.deleted_at.is_(None)
        ).all()
        box_ids_list = [box_id[0] for box_id in box_ids_sede] if box_ids_sede else []
        
        # Filtra animali che appartengono alla sede:
        # 1. codice_azienda_anagrafe corrisponde al codice_stalla della sede
        # 2. Oppure box_id appartiene a uno dei box della sede (solo se ci sono box)
        from sqlalchemy import or_
        sede_conditions = []
        if sede.codice_stalla:
            sede_conditions.append(Animale.codice_azienda_anagrafe == sede.codice_stalla)
        if box_ids_list:
            sede_conditions.append(Animale.box_id.in_(box_ids_list))
        
        # Se non ci sono condizioni valide (sede senza codice_stalla e senza box),
        # ritorna lista vuota invece di tutti gli animali
        if not sede_conditions:
            return []
        
        # Applica il filtro OR se ci sono condizioni
        query = query.filter(or_(*sede_conditions))

    query = query.offset(skip)
    if limit is not None:
        query = query.limit(limit)
    animali = query.all()
    
    # Calcola data_arrivo_originale per ogni animale (dalla prima partita di ingresso esterno)
    if animali:
        from app.models.amministrazione.partita_animale import PartitaAnimale
        from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
        from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
        
        animali_ids = [a.id for a in animali]
        
        # Query batch per trovare la prima partita di ingresso esterno per ogni animale
        partite_join = (
            db.query(PartitaAnimaleAnimale.animale_id, PartitaAnimale.id.label('partita_id'), PartitaAnimale.data, PartitaAnimale.is_trasferimento_interno, PartitaAnimale.codice_stalla)
            .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
            .filter(
                PartitaAnimaleAnimale.animale_id.in_(animali_ids),
                PartitaAnimale.tipo == 'ingresso',
                PartitaAnimale.deleted_at.is_(None)
            )
            .order_by(PartitaAnimaleAnimale.animale_id, PartitaAnimale.data.asc())
            .all()
        )
        
        # Crea una mappa animale_id -> data_arrivo_originale
        data_arrivo_originale_map = {}
        animali_processed = set()
        
        for row in partite_join:
            animale_id = row.animale_id
            if animale_id in animali_processed:
                continue  # Abbiamo già trovato la prima partita per questo animale
            
            # Trova l'animale per ottenere azienda_id
            animale = next((a for a in animali if a.id == animale_id), None)
            if not animale:
                continue
            
            # Verifica se è un trasferimento interno
            is_interno = (
                row.is_trasferimento_interno and
                row.codice_stalla and
                is_codice_stalla_gestito(row.codice_stalla, db, animale.azienda_id)
            )
            
            if not is_interno:
                # Questa è la partita di ingresso esterno (data originale)
                data_arrivo_originale_map[animale_id] = row.data
                animali_processed.add(animale_id)
        
        # Aggiungi data_arrivo_originale a ogni animale usando setattr per assicurarsi che Pydantic lo riconosca
        for animale in animali:
            if animale.id in data_arrivo_originale_map:
                setattr(animale, 'data_arrivo_originale', data_arrivo_originale_map[animale.id])
            else:
                # Se non c'è una partita di ingresso esterno, usa data_arrivo come fallback
                setattr(animale, 'data_arrivo_originale', animale.data_arrivo)
    
    return animali


@router.get("/animali/{animale_id}", response_model=AnimaleResponse)
async def get_animale(animale_id: int, db: Session = Depends(get_db)):
    """Get a specific animale"""
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    return animale


@router.get("/animali/{animale_id}/detail", response_model=dict)
async def get_animale_detail(animale_id: int, db: Session = Depends(get_db)):
    """Get detailed animale information including decesso and partita ingresso esterno"""
    from app.models.allevamento.decesso import Decesso
    from app.models.amministrazione.partita_animale import PartitaAnimale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.schemas.allevamento.animale import AnimaleResponse
    from app.schemas.allevamento.decesso import DecessoResponse
    from app.schemas.amministrazione.partita_animale import PartitaAnimaleResponse
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Carica decesso se presente
    decesso_data = None
    if animale.stato == 'deceduto':
        decesso = db.query(Decesso).filter(Decesso.animale_id == animale_id).first()
        if decesso:
            decesso_data = DecessoResponse.from_orm(decesso).dict()
    
    # Trova partita di ingresso esterno (non trasferimenti interni)
    partita_ingresso_esterno_data = None
    partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id == animale_id,
            PartitaAnimale.tipo == 'ingresso',
            PartitaAnimale.deleted_at.is_(None)
        )
        .order_by(PartitaAnimale.data.asc())
        .all()
    )
    
    # Cerca la prima partita di ingresso che NON è un trasferimento interno
    for join_rec, partita in partite_join:
        # Verifica se è un trasferimento interno
        is_interno = (
            partita.is_trasferimento_interno and
            partita.codice_stalla and
            is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
        )
        
        if not is_interno:
            # Questa è la partita di ingresso esterno
            partita_dict = PartitaAnimaleResponse.from_orm(partita).dict()
            # Aggiungi il peso dell'animale in questa partita
            if join_rec.peso is not None:
                partita_dict['peso_animale'] = float(join_rec.peso)
            
            # Se c'è una fattura collegata, calcola il valore dalla fattura
            if partita.fattura_amministrazione_id:
                from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
                fattura = db.query(FatturaAmministrazione).filter(
                    FatturaAmministrazione.id == partita.fattura_amministrazione_id
                ).first()
                if fattura:
                    # Calcola valore unitario dalla fattura
                    importo_totale = float(fattura.importo_totale) if fattura.importo_totale else 0
                    numero_capi = partita.numero_capi if partita.numero_capi > 0 else 1
                    valore_da_fattura = importo_totale / numero_capi
                    partita_dict['valore_da_fattura'] = valore_da_fattura
                    partita_dict['fattura_numero'] = fattura.numero if fattura.numero else None
                    partita_dict['fattura_data'] = fattura.data_fattura.isoformat() if fattura.data_fattura else None
            
            partita_ingresso_esterno_data = partita_dict
            break
    
    # Carica storico tipo_allevamento
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    from app.schemas.allevamento.storico_tipo_allevamento import StoricoTipoAllevamentoResponse
    storico_tipo_allevamento = db.query(StoricoTipoAllevamento).filter(
        StoricoTipoAllevamento.animale_id == animale_id,
        StoricoTipoAllevamento.deleted_at.is_(None)
    ).order_by(StoricoTipoAllevamento.data_cambio.desc(), StoricoTipoAllevamento.created_at.desc()).all()
    storico_data = [StoricoTipoAllevamentoResponse.from_orm(s).dict() for s in storico_tipo_allevamento]
    
    # Costruisci la risposta
    animale_dict = AnimaleResponse.from_orm(animale).dict()
    result = {
        **animale_dict,
        'decesso': decesso_data,
        'partita_ingresso_esterno': partita_ingresso_esterno_data,
        'storico_tipo_allevamento': storico_data
    }
    
    return result


class UpdateValoreDecessoRequest(BaseModel):
    valore_capo: Optional[float] = None


@router.put("/animali/{animale_id}/partita/valore", response_model=dict)
async def update_valore_partita(
    animale_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Aggiorna il valore (costo_unitario o valore_totale) della partita di ingresso esterno.
    Funziona solo se la partita NON ha una fattura collegata (proprietà con fattura = non modificabile).
    """
    from app.models.amministrazione.partita_animale import PartitaAnimale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from decimal import Decimal
    
    # Verifica che l'animale esista
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Estrai valori dalla richiesta
    costo_unitario = request.get('costo_unitario')
    valore_totale = request.get('valore_totale')
    
    # Trova la partita di ingresso esterno (non trasferimenti interni)
    partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id == animale_id,
            PartitaAnimale.tipo == 'ingresso',
            PartitaAnimale.deleted_at.is_(None)
        )
        .order_by(PartitaAnimale.data.asc())
        .all()
    )
    
    partita_ingresso_esterno = None
    for join_rec, partita in partite_join:
        # Verifica se è un trasferimento interno
        is_interno = (
            partita.is_trasferimento_interno and
            partita.codice_stalla and
            is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
        )
        
        if not is_interno:
            partita_ingresso_esterno = partita
            break
    
    if not partita_ingresso_esterno:
        raise HTTPException(
            status_code=404,
            detail="Partita di ingresso esterno non trovata per questo animale"
        )
    
    # Verifica che non ci sia una fattura collegata
    if partita_ingresso_esterno.fattura_amministrazione_id:
        raise HTTPException(
            status_code=400,
            detail="La partita ha una fattura collegata. Il valore non può essere modificato manualmente."
        )
    
    # Aggiorna i valori
    if costo_unitario is not None:
        partita_ingresso_esterno.costo_unitario = Decimal(str(costo_unitario))
        # Ricalcola valore_totale se non è stato fornito esplicitamente
        if valore_totale is None and partita_ingresso_esterno.numero_capi > 0:
            partita_ingresso_esterno.valore_totale = partita_ingresso_esterno.costo_unitario * partita_ingresso_esterno.numero_capi
    
    if valore_totale is not None:
        partita_ingresso_esterno.valore_totale = Decimal(str(valore_totale))
        # Ricalcola costo_unitario se non è stato fornito esplicitamente
        if costo_unitario is None and partita_ingresso_esterno.numero_capi > 0:
            partita_ingresso_esterno.costo_unitario = partita_ingresso_esterno.valore_totale / partita_ingresso_esterno.numero_capi
    
    db.commit()
    db.refresh(partita_ingresso_esterno)
    
    return {
        "message": "Valore partita aggiornato con successo",
        "costo_unitario": float(partita_ingresso_esterno.costo_unitario) if partita_ingresso_esterno.costo_unitario else None,
        "valore_totale": float(partita_ingresso_esterno.valore_totale) if partita_ingresso_esterno.valore_totale else None
    }


@router.put("/animali/{animale_id}/valore", response_model=dict)
async def update_valore_animale(
    animale_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Aggiorna il valore specifico dell'animale.
    Se extend_to_partita è True, estende il valore a tutti gli animali della stessa partita di ingresso.
    """
    from app.models.amministrazione.partita_animale import PartitaAnimale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from decimal import Decimal
    
    # Verifica che l'animale esista
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Estrai valori dalla richiesta
    valore = request.get('valore')
    extend_to_partita = request.get('extend_to_partita', False)
    
    # Gestisci valore null (rimozione valore)
    if valore is None:
        valore_decimal = None
    else:
        try:
            valore_decimal = Decimal(str(valore)) if valore else None
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=400,
                detail="Valore non valido"
            )
    
    # Aggiorna il valore dell'animale
    animale.valore = valore_decimal
    
    # Se extend_to_partita è True, trova la partita di ingresso esterno e aggiorna tutti gli animali
    if extend_to_partita:
        # Trova la partita di ingresso esterno (non trasferimenti interni)
        partite_join = (
            db.query(PartitaAnimaleAnimale, PartitaAnimale)
            .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
            .filter(
                PartitaAnimaleAnimale.animale_id == animale_id,
                PartitaAnimale.tipo == 'ingresso',
                PartitaAnimale.deleted_at.is_(None)
            )
            .order_by(PartitaAnimale.data.asc())
            .all()
        )
        
        partita_ingresso_esterno = None
        for join_rec, partita in partite_join:
            # Verifica se è un trasferimento interno
            is_interno = (
                partita.is_trasferimento_interno and
                partita.codice_stalla and
                is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
            )
            
            if not is_interno:
                partita_ingresso_esterno = partita
                break
        
        if partita_ingresso_esterno:
            # Trova tutti gli animali della stessa partita
            animali_partita = (
                db.query(Animale)
                .join(PartitaAnimaleAnimale, PartitaAnimaleAnimale.animale_id == Animale.id)
                .filter(
                    PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_esterno.id,
                    Animale.deleted_at.is_(None)
                )
                .all()
            )
            
            # Aggiorna il valore per tutti gli animali della partita
            for animale_partita in animali_partita:
                animale_partita.valore = valore_decimal
    
    db.commit()
    db.refresh(animale)
    
    return {
        "message": "Valore animale aggiornato con successo",
        "valore": float(animale.valore) if animale.valore else None,
        "extended_to_partita": extend_to_partita
    }


@router.put("/animali/{animale_id}/decesso/valore", response_model=dict)
async def update_valore_decesso(
    animale_id: int,
    request: UpdateValoreDecessoRequest,
    db: Session = Depends(get_db)
):
    """
    Aggiorna il valore_capo di un decesso e ricalcola il valore medio della partita di ingresso esterno.
    Funziona solo se la partita NON ha una fattura collegata.
    """
    from app.models.allevamento.decesso import Decesso
    from app.models.amministrazione.partita_animale import PartitaAnimale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from decimal import Decimal
    
    # Verifica che l'animale esista e sia deceduto
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    if animale.stato != 'deceduto':
        raise HTTPException(
            status_code=400,
            detail="L'animale non è deceduto. Impossibile aggiornare il valore del decesso."
        )
    
    # Trova il decesso
    decesso = db.query(Decesso).filter(Decesso.animale_id == animale_id).first()
    if not decesso:
        raise HTTPException(status_code=404, detail="Decesso non trovato per questo animale")
    
    # Estrai valore_capo dalla richiesta
    valore_capo = request.valore_capo
    valore_capo_decimal = Decimal(str(valore_capo)) if valore_capo is not None else None
    decesso.valore_capo = valore_capo_decimal
    db.flush()
    
    # Trova la partita di ingresso esterno (non trasferimenti interni)
    partite_join = (
        db.query(PartitaAnimaleAnimale, PartitaAnimale)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .filter(
            PartitaAnimaleAnimale.animale_id == animale_id,
            PartitaAnimale.tipo == 'ingresso',
            PartitaAnimale.deleted_at.is_(None)
        )
        .order_by(PartitaAnimale.data.asc())
        .all()
    )
    
    partita_ingresso_esterno = None
    for join_rec, partita in partite_join:
        # Verifica se è un trasferimento interno
        is_interno = (
            partita.is_trasferimento_interno and
            partita.codice_stalla and
            is_codice_stalla_gestito(partita.codice_stalla, db, animale.azienda_id)
        )
        
        if not is_interno:
            partita_ingresso_esterno = partita
            break
    
    # Verifica che non ci sia una fattura collegata
    if partita_ingresso_esterno and partita_ingresso_esterno.fattura_amministrazione_id:
        raise HTTPException(
            status_code=400,
            detail="La partita ha una fattura collegata. Il valore del decesso non può essere modificato manualmente."
        )
    
    # Se esiste la partita di ingresso esterno, ricalcola il valore medio
    if partita_ingresso_esterno:
        # Trova tutti gli animali della partita con decesso
        animali_partita = (
            db.query(PartitaAnimaleAnimale, Animale, Decesso)
            .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
            .outerjoin(Decesso, Decesso.animale_id == Animale.id)
            .filter(
                PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_esterno.id,
                Animale.deleted_at.is_(None)
            )
            .all()
        )
        
        # Calcola la somma dei valori_capo dei decessi e conta i decessi
        somma_valori = Decimal('0')
        numero_decessi = 0
        
        for join_rec, animale_partita, decesso_partita in animali_partita:
            if decesso_partita and decesso_partita.valore_capo is not None:
                somma_valori += decesso_partita.valore_capo
                numero_decessi += 1
        
        # Calcola il valore medio a capo (solo per i decessi con valore)
        # Il valore medio viene salvato in costo_unitario della partita
        if numero_decessi > 0:
            valore_medio_capo = somma_valori / numero_decessi
            # Aggiorna costo_unitario della partita (che rappresenta il valore medio a capo per i decessi)
            partita_ingresso_esterno.costo_unitario = valore_medio_capo
            # Ricalcola valore_totale
            if partita_ingresso_esterno.numero_capi > 0:
                partita_ingresso_esterno.valore_totale = valore_medio_capo * partita_ingresso_esterno.numero_capi
    
    db.commit()
    
    return {
        "message": "Valore decesso aggiornato con successo",
        "valore_capo": float(valore_capo_decimal) if valore_capo_decimal else None,
        "partita_aggiornata": partita_ingresso_esterno.id if partita_ingresso_esterno else None,
        "valore_medio_capo": float(partita_ingresso_esterno.costo_unitario) if partita_ingresso_esterno and partita_ingresso_esterno.costo_unitario else None
    }


@router.put("/animali/{animale_id}/decesso/responsabile", response_model=dict)
async def update_responsabile_decesso(
    animale_id: int,
    request: dict,
    db: Session = Depends(get_db)
):
    """
    Aggiorna il responsabile del decesso (soccidante/soccidario) per un animale deceduto in soccida.
    """
    from app.models.allevamento.decesso import Decesso
    
    # Verifica che l'animale esista e sia deceduto
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    if animale.stato != 'deceduto':
        raise HTTPException(
            status_code=400,
            detail="L'animale non è deceduto. Impossibile aggiornare il responsabile del decesso."
        )
    
    # Trova il decesso
    decesso = db.query(Decesso).filter(Decesso.animale_id == animale_id).first()
    if not decesso:
        raise HTTPException(status_code=404, detail="Decesso non trovato per questo animale")
    
    # Estrai responsabile dalla richiesta
    responsabile = request.get('responsabile')
    if not responsabile:
        raise HTTPException(status_code=400, detail="Campo 'responsabile' mancante")
    
    # Valida il valore del responsabile
    valid_values = ['soccidante', 'soccidario', 'esonero']
    if responsabile not in valid_values:
        raise HTTPException(
            status_code=400,
            detail=f"Valore non valido per 'responsabile'. Valori ammessi: {', '.join(valid_values)}"
        )
    
    # Aggiorna il responsabile
    decesso.responsabile = responsabile
    db.commit()
    
    return {
        "message": "Responsabile decesso aggiornato con successo",
        "responsabile": responsabile
    }


@router.post("/animali", response_model=AnimaleResponse, status_code=status.HTTP_201_CREATED)
async def create_animale(animale: AnimaleCreate, db: Session = Depends(get_db)):
    """Create a new animale"""
    db_animale = Animale(**animale.dict())
    db.add(db_animale)
    db.commit()
    db.refresh(db_animale)
    return db_animale


class CheckAnimaleUpdateImpactRequest(BaseModel):
    """Request per verificare impatto modifiche animale su partite"""
    peso_attuale: Optional[Decimal] = None
    peso_arrivo: Optional[Decimal] = None
    valore: Optional[Decimal] = None
    data_arrivo: Optional[date] = None
    data_uscita: Optional[date] = None
    motivo_ingresso: Optional[str] = None
    motivo_uscita: Optional[str] = None
    numero_modello_ingresso: Optional[str] = None
    numero_modello_uscita: Optional[str] = None


@router.post("/animali/{animale_id}/check-update-impact", response_model=dict)
async def check_animale_update_impact(
    animale_id: int,
    request: CheckAnimaleUpdateImpactRequest,
    db: Session = Depends(get_db)
):
    """
    Verifica impatto modifiche animale su partite.
    Considera anche peso_arrivo per proteggere i report.
    """
    from app.models.amministrazione.partita_animale import PartitaAnimale
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.services.allevamento.codici_stalla_service import is_codice_stalla_gestito
    from decimal import Decimal
    
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    update_data = request.dict(exclude_unset=True)
    if not update_data:
        return {"partite_affected": [], "warning": None}
    
    # Campi sincronizzabili e loro logica
    campi_sincronizzabili = {
        'peso_attuale': {
            'tipi_partita': ('ingresso_esterno', 'trasferimento_recente', 'uscita_esterna'),
            'aggiorna_altri_animali': True,
            'protezione_report': True
        },
        'peso_arrivo': {
            'tipi_partita': ('ingresso_esterno',),
            'aggiorna_altri_animali': True,
            'protezione_report': True
        },
        'valore': {
            'tipi_partita': ('ingresso_esterno',),
            'aggiorna_altri_animali': True,
            'protezione_report': False
        },
        'data_arrivo': {
            'tipi_partita': ('ingresso_esterno',),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
        'data_uscita': {
            'tipi_partita': ('uscita_esterna', 'trasferimento_recente'),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
        'motivo_ingresso': {
            'tipi_partita': ('ingresso_esterno',),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
        'motivo_uscita': {
            'tipi_partita': ('uscita_esterna',),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
        'numero_modello_ingresso': {
            'tipi_partita': ('ingresso_esterno',),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
        'numero_modello_uscita': {
            'tipi_partita': ('uscita_esterna',),
            'aggiorna_altri_animali': False,
            'protezione_report': False
        },
    }
    
    partite_affected = []
    
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
    
    # Per ogni campo modificato, trova la partita impattata
    for campo, valore in update_data.items():
        if campo not in campi_sincronizzabili:
            continue
        
        config = campi_sincronizzabili[campo]
        tipi_partita = config['tipi_partita']
        
        partita_selezionata = None
        partita_tipo = None
        
        if 'ingresso_esterno' in tipi_partita and partita_ingresso_esterno:
            partita_selezionata = partita_ingresso_esterno
            partita_tipo = 'ingresso_esterno'
        elif 'uscita_esterna' in tipi_partita and partita_uscita_esterna:
            partita_selezionata = partita_uscita_esterna
            partita_tipo = 'uscita_esterna'
        elif 'trasferimento_recente' in tipi_partita and partita_trasferimento_recente:
            partita_selezionata = partita_trasferimento_recente
            partita_tipo = 'trasferimento_recente'
        
        if partita_selezionata:
            join_rec, partita = partita_selezionata
            
            # Conta animali nella partita
            animali_count = (
                db.query(PartitaAnimaleAnimale)
                .filter(
                    PartitaAnimaleAnimale.partita_animale_id == partita.id
                )
                .count()
            )
            
            # Verifica se già presente
            partita_già_presente = any(
                p['partita_id'] == partita.id for p in partite_affected
            )
            
            if not partita_già_presente:
                partite_affected.append({
                    'partita_id': partita.id,
                    'partita_tipo': partita_tipo,
                    'partita_data': partita.data.isoformat() if partita.data else None,
                    'animali_count': animali_count,
                    'campi_impattati': [campo],
                    'aggiorna_altri_animali': config['aggiorna_altri_animali'],
                    'protezione_report': config['protezione_report']
                })
            else:
                # Aggiungi campo alla partita già presente
                for p in partite_affected:
                    if p['partita_id'] == partita.id:
                        if campo not in p['campi_impattati']:
                            p['campi_impattati'].append(campo)
                        break
    
    # Genera messaggio di warning
    warning = None
    if partite_affected:
        total_animali = sum(p['animali_count'] for p in partite_affected)
        campi_lista = []
        for p in partite_affected:
            campi_lista.extend(p['campi_impattati'])
        campi_unici = list(set(campi_lista))
        
        tipo_partita_nomi = {
            'ingresso_esterno': 'Ingresso esterno',
            'uscita_esterna': 'Uscita esterna',
            'trasferimento_recente': 'Trasferimento interno'
        }
        
        tipo_partita = tipo_partita_nomi.get(partite_affected[0]['partita_tipo'], 'Partita')
        
        if total_animali > 1:
            warning = f"Modifica impatterà {total_animali} animali nella partita {tipo_partita} #{partite_affected[0]['partita_id']}"
        else:
            warning = f"Modifica impatterà la partita {tipo_partita} #{partite_affected[0]['partita_id']}"
    
    return {
        "partite_affected": partite_affected,
        "warning": warning
    }


@router.put("/animali/{animale_id}", response_model=AnimaleResponse)
async def update_animale(
    animale_id: int,
    animale: AnimaleUpdate,
    update_partita: bool = Query(False, description="Se True, aggiorna anche la partita associata"),
    db: Session = Depends(get_db)
):
    """Update an animale"""
    db_animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    if not db_animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    update_data = animale.dict(exclude_unset=True)
    
    # Se update_partita è True, gestisci sincronizzazione con partite
    if update_partita:
        # Importa helper (sarà creato nel file partite.py)
        try:
            from app.api.v1.endpoints.amministrazione.partite import _update_partita_from_animale
            _update_partita_from_animale(animale_id, update_data, db)
        except ImportError:
            # Helper non ancora creato, salta sincronizzazione
            pass
        except Exception as e:
            # Log errore ma continua con update animale
            print(f"Errore aggiornamento partita da animale: {e}")
    
    # Aggiorna animale
    for field, value in update_data.items():
        setattr(db_animale, field, value)
    
    db.commit()
    db.refresh(db_animale)
    return db_animale


class CambiaTipoAllevamentoRequest(BaseModel):
    """Request per cambiare tipo_allevamento di un animale"""
    tipo_allevamento_nuovo: str  # 'svezzamento', 'ingrasso', 'universale'
    peso_ingresso: Optional[float] = None  # Peso al momento del cambio
    data_cambio: Optional[date] = None  # Data del cambio (default: oggi)
    note: Optional[str] = None


@router.post("/animali/{animale_id}/cambia-tipo-allevamento", response_model=dict)
async def cambia_tipo_allevamento(
    animale_id: int,
    request: CambiaTipoAllevamentoRequest,
    db: Session = Depends(get_db)
):
    """
    Cambia il tipo_allevamento di un animale e registra il cambio nello storico.
    Se l'animale ha un peso_ingresso, aggiorna anche peso_attuale e data_ultima_pesata.
    """
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    from datetime import date as date_type
    from decimal import Decimal
    
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Valida tipo_allevamento_nuovo
    if request.tipo_allevamento_nuovo not in ['svezzamento', 'ingrasso', 'universale']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="tipo_allevamento_nuovo deve essere 'svezzamento', 'ingrasso' o 'universale'"
        )
    
    # Verifica che ci sia un cambio effettivo
    if animale.tipo_allevamento == request.tipo_allevamento_nuovo:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"L'animale ha già tipo_allevamento = '{request.tipo_allevamento_nuovo}'"
        )
    
    # Salva il tipo_allevamento precedente
    tipo_allevamento_precedente = animale.tipo_allevamento
    
    # Aggiorna il tipo_allevamento dell'animale
    animale.tipo_allevamento = request.tipo_allevamento_nuovo
    
    # Se è stato fornito un peso_ingresso, aggiorna anche peso_attuale e data_ultima_pesata
    data_cambio = request.data_cambio or date_type.today()
    if request.peso_ingresso is not None:
        animale.peso_attuale = Decimal(str(request.peso_ingresso))
        animale.data_ultima_pesata = data_cambio
    
    # Crea record nello storico
    storico = StoricoTipoAllevamento(
        animale_id=animale_id,
        contratto_soccida_id=animale.contratto_soccida_id,
        tipo_allevamento_precedente=tipo_allevamento_precedente,
        tipo_allevamento_nuovo=request.tipo_allevamento_nuovo,
        peso_ingresso=Decimal(str(request.peso_ingresso)) if request.peso_ingresso is not None else None,
        data_cambio=data_cambio,
        note=request.note
    )
    db.add(storico)
    
    db.commit()
    db.refresh(animale)
    db.refresh(storico)
    
    return {
        "message": f"Tipo allevamento cambiato da '{tipo_allevamento_precedente}' a '{request.tipo_allevamento_nuovo}'",
        "animale_id": animale_id,
        "tipo_allevamento_precedente": tipo_allevamento_precedente,
        "tipo_allevamento_nuovo": request.tipo_allevamento_nuovo,
        "storico_id": storico.id,
        "peso_ingresso": float(storico.peso_ingresso) if storico.peso_ingresso else None
    }


@router.get("/animali/{animale_id}/storico-tipo-allevamento", response_model=List[StoricoTipoAllevamentoResponse])
async def get_storico_tipo_allevamento(
    animale_id: int,
    db: Session = Depends(get_db)
):
    """Ottieni lo storico dei cambi di tipo_allevamento per un animale"""
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    
    # Verifica che l'animale esista
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Recupera lo storico (solo record non annullati e non eliminati)
    storico = db.query(StoricoTipoAllevamento).filter(
        StoricoTipoAllevamento.animale_id == animale_id,
        StoricoTipoAllevamento.deleted_at.is_(None)
    ).order_by(StoricoTipoAllevamento.data_cambio.desc(), StoricoTipoAllevamento.created_at.desc()).all()
    
    return [StoricoTipoAllevamentoResponse.from_orm(s) for s in storico]


@router.put("/animali/{animale_id}/storico-tipo-allevamento/{storico_id}/annulla", response_model=dict)
async def annulla_cambio_tipo_allevamento(
    animale_id: int,
    storico_id: int,
    request: StoricoTipoAllevamentoUpdate,
    db: Session = Depends(get_db)
):
    """
    Annulla un cambio di tipo_allevamento.
    Ripristina il tipo_allevamento precedente e marca il record storico come annullato.
    """
    from app.models.allevamento.storico_tipo_allevamento import StoricoTipoAllevamento
    from datetime import datetime
    
    # Verifica che l'animale esista
    animale = db.query(Animale).filter(
        Animale.id == animale_id,
        Animale.deleted_at.is_(None)
    ).first()
    
    if not animale:
        raise HTTPException(status_code=404, detail="Animale not found")
    
    # Verifica che il record storico esista e appartenga all'animale
    storico = db.query(StoricoTipoAllevamento).filter(
        StoricoTipoAllevamento.id == storico_id,
        StoricoTipoAllevamento.animale_id == animale_id,
        StoricoTipoAllevamento.deleted_at.is_(None)
    ).first()
    
    if not storico:
        raise HTTPException(status_code=404, detail="Record storico non trovato")
    
    if storico.annullato:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questo cambio è già stato annullato"
        )
    
    # Ripristina il tipo_allevamento precedente
    if storico.tipo_allevamento_precedente:
        animale.tipo_allevamento = storico.tipo_allevamento_precedente
    else:
        # Se non c'era un tipo precedente, imposta a None
        animale.tipo_allevamento = None
    
    # Marca il record storico come annullato
    storico.annullato = True
    storico.data_annullamento = datetime.utcnow()
    storico.motivo_annullamento = request.motivo_annullamento
    
    db.commit()
    db.refresh(animale)
    db.refresh(storico)
    
    return {
        "message": "Cambio tipo allevamento annullato con successo",
        "animale_id": animale_id,
        "storico_id": storico_id,
        "tipo_allevamento_ripristinato": storico.tipo_allevamento_precedente
    }


