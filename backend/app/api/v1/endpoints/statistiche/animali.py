"""
Statistiche endpoint - Dashboard statistics
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_, case, extract
from typing import Optional, List, Dict, Any
from datetime import date, datetime, timedelta
from decimal import Decimal

from app.core.database import get_db
from app.models.allevamento.animale import Animale
from app.models.allevamento.azienda import Azienda
from app.models.allevamento.sede import Sede
from app.models.allevamento.stabilimento import Stabilimento
from app.models.allevamento.box import Box
from app.models.allevamento.decesso import Decesso
from app.models.allevamento.movimentazione import Movimentazione
from app.models.sanitario.somministrazione import Somministrazione
from app.models.terreni.terreno import Terreno as TerrenoModel
from app.models.terreni.lavorazione import LavorazioneTerreno
from app.models.terreni.raccolto import RaccoltoTerreno
# from app.models.amministrazione.fattura_emessa import FatturaEmessa  # DEPRECATO: usa FatturaAmministrazione
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.amministrazione.assicurazione_aziendale import AssicurazioneAziendale
from app.models.amministrazione.attrezzatura import Attrezzatura, ScadenzaAttrezzatura
from app.models.amministrazione.partita_animale import PartitaAnimale, TipoPartita
from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale

router = APIRouter()


@router.get("/animali-arrivati")
def get_animali_arrivati(
    periodo: str = Query('settimana', description="settimana, mese, anno o sempre"),
    aggregazione: str = Query('azienda', description="sede o azienda"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali arrivati da aziende ESTERNE (esclusi trasferimenti interni) nell'ultima settimana, mese, anno o sempre per sede o azienda"""
    oggi = date.today()
    if periodo == "settimana":
        data_inizio = oggi - timedelta(days=7)
    elif periodo == "mese":
        data_inizio = oggi - timedelta(days=30)
    elif periodo == "anno":
        data_inizio = date(oggi.year, 1, 1)
    else:  # sempre
        data_inizio = None
    
    # Query partite di INGRESSO ESTERNE (esclusi trasferimenti interni)
    query_partite = db.query(PartitaAnimale).filter(
        PartitaAnimale.tipo == TipoPartita.INGRESSO,
        PartitaAnimale.is_trasferimento_interno == False,  # ESCLUSI trasferimenti interni
        PartitaAnimale.deleted_at.is_(None)
    )
    
    if data_inizio:
        query_partite = query_partite.filter(
            PartitaAnimale.data >= data_inizio,
            PartitaAnimale.data <= oggi
        )
    
    if azienda_id:
        query_partite = query_partite.filter(PartitaAnimale.azienda_id == azienda_id)
    
    partite = query_partite.all()
    
    # Raccogli animali unici dalle partite (ottimizzato con query batch)
    if not partite:
        return {"aggregazione": aggregazione, "dati": {}, "periodo": periodo}
    
    partite_ids = [p.id for p in partite]
    join_records = db.query(PartitaAnimaleAnimale).filter(
        PartitaAnimaleAnimale.partita_animale_id.in_(partite_ids)
    ).all()
    
    animali_ids_list = [j.animale_id for j in join_records]
    animali_ids_list = list(set(animali_ids_list))  # Rimuovi duplicati
    
    # Query batch per animali
    animali_objs = db.query(Animale).filter(
        Animale.id.in_(animali_ids_list),
        Animale.deleted_at.is_(None)
    ).all()
    
    animali_map = {a.id: a for a in animali_objs}
    partite_map = {p.id: p for p in partite}
    
    # Mappa animale_id -> partita
    partite_animali_map = {}
    animali_ids = set()
    
    for join_rec in join_records:
        if join_rec.animale_id in animali_map and join_rec.partita_animale_id in partite_map:
            animale_id = join_rec.animale_id
            animali_ids.add(animale_id)
            if animale_id not in partite_animali_map:
                partite_animali_map[animale_id] = partite_map[join_rec.partita_animale_id]
    
    if aggregazione == "sede":
        result = {}
        
        # Carica tutte le sedi necessarie in batch
        codici_stalla = list(set([p.codice_stalla_azienda for p in partite_animali_map.values() if p.codice_stalla_azienda]))
        sedi = db.query(Sede).filter(
            Sede.codice_stalla.in_(codici_stalla)
        ).all()
        sedi_map = {s.codice_stalla: s for s in sedi}
        
        for animale_id in animali_ids:
            partita = partite_animali_map[animale_id]
            sede_id_animale = None
            
            # Usa codice_stalla_azienda della partita per determinare la sede di arrivo
            if partita.codice_stalla_azienda and partita.codice_stalla_azienda in sedi_map:
                sede_id_animale = sedi_map[partita.codice_stalla_azienda].id
            
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += 1
        
        return {"aggregazione": "sede", "dati": result, "periodo": periodo}
    else:  # azienda
        result = {}
        for animale_id in animali_ids:
            partita = partite_animali_map[animale_id]
            azienda_id_animale = partita.azienda_id
            if azienda_id_animale not in result:
                result[azienda_id_animale] = 0
            result[azienda_id_animale] += 1
        return {"aggregazione": "azienda", "dati": result, "periodo": periodo}


@router.get("/animali-presenti")
def get_animali_presenti(
    aggregazione: str = Query('azienda', description="sede o azienda"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali presenti per sede o azienda - conta solo animali con stato='presente'"""
    
    if aggregazione == "azienda":
        # OTTIMIZZATO: Usa query aggregata invece di caricare tutti gli animali
        query = db.query(
            Animale.azienda_id, 
            func.count(Animale.id)
        ).filter(
            Animale.stato == 'presente',
            Animale.deleted_at.is_(None)
        )
        
        if azienda_id:
            query = query.filter(Animale.azienda_id == azienda_id)
        
        results = query.group_by(Animale.azienda_id).all()
        result = {az_id: count for az_id, count in results}
        return {"aggregazione": "azienda", "dati": result}
    
    else:  # sede - richiede logica più complessa
        query = db.query(Animale).filter(
            Animale.stato == 'presente',
            Animale.deleted_at.is_(None)
        )
        
        if azienda_id:
            query = query.filter(Animale.azienda_id == azienda_id)
        
        animali = query.all()
        
        # Pre-carica tutte le mappature necessarie in batch
        if azienda_id:
            sedi_all = db.query(Sede).filter(
                Sede.azienda_id == azienda_id,
                Sede.deleted_at.is_(None)
            ).all()
        else:
            sedi_all = db.query(Sede).filter(Sede.deleted_at.is_(None)).all()
        
        sedi_map = {s.codice_stalla: s for s in sedi_all}
        
        # Pre-carica mappatura box -> sede (evita N+1)
        box_to_sede = build_box_to_sede_map(db, azienda_id)
        
        result = {}
        for animale in animali:
            sede_id_animale = None
            
            # 1. Prova con codice_azienda_anagrafe
            if animale.codice_azienda_anagrafe and animale.codice_azienda_anagrafe in sedi_map:
                sede_id_animale = sedi_map[animale.codice_azienda_anagrafe].id
            
            # 2. Se non trovato, usa la mappa box -> sede pre-caricata
            if not sede_id_animale and animale.box_id:
                sede_id_animale = box_to_sede.get(animale.box_id)
            
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += 1
        
        return {"aggregazione": "sede", "dati": result}


@router.get("/animali-uscite")
def get_animali_uscite(
    aggregazione: str = Query('azienda', description="sede o azienda"),
    periodo: Optional[str] = Query(None, description="settimana, mese, anno o sempre (opzionale)"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali usciti per sede o azienda - conta animali con stato='venduto' o 'macellato', opzionalmente filtrati per periodo"""
    query = db.query(Animale).filter(
        or_(Animale.stato == 'venduto', Animale.stato == 'macellato'),
        Animale.deleted_at.is_(None)
    )
    
    # Filtra per periodo se specificato
    if periodo:
        oggi = date.today()
        if periodo == "settimana":
            data_inizio = oggi - timedelta(days=7)
        elif periodo == "mese":
            data_inizio = oggi - timedelta(days=30)
        elif periodo == "anno":
            data_inizio = date(oggi.year, 1, 1)
        else:  # sempre
            data_inizio = None
        
        if data_inizio:
            query = query.filter(
                Animale.data_uscita >= data_inizio,
                Animale.data_uscita <= oggi
            )
        # se "sempre", nessun filtro sulla data
    
    if azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    animali = query.all()
    
    if aggregazione == "sede":
        # Carica tutte le sedi necessarie
        if azienda_id:
            sedi_all = db.query(Sede).filter(
                Sede.azienda_id == azienda_id,
                Sede.deleted_at.is_(None)
            ).all()
        else:
            sedi_all = db.query(Sede).filter(Sede.deleted_at.is_(None)).all()
        sedi_map = {s.codice_stalla: s for s in sedi_all}
        
        result = {}
        for animale in animali:
            sede_id_animale = None
            
            # 1. Prova con codice_azienda_anagrafe
            if animale.codice_azienda_anagrafe and animale.codice_azienda_anagrafe in sedi_map:
                sede_id_animale = sedi_map[animale.codice_azienda_anagrafe].id
            
            # 2. Se non trovato, prova con box_id
            if not sede_id_animale and animale.box_id:
                sede_id_animale = get_sede_from_animale(db, animale)
            
            # 3. Se ancora non trovato, cerca nelle movimentazioni (ultima movimentazione)
            if not sede_id_animale:
                ultima_mov = db.query(Movimentazione).filter(
                    Movimentazione.animale_id == animale.id
                ).order_by(Movimentazione.data_ora.desc()).first()
                
                if ultima_mov and ultima_mov.a_box_id:
                    box = db.query(Box).filter(Box.id == ultima_mov.a_box_id).first()
                    if box and box.stabilimento_id:
                        stabilimento = db.query(Stabilimento).filter(Stabilimento.id == box.stabilimento_id).first()
                        if stabilimento:
                            sede_id_animale = stabilimento.sede_id
            
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += 1
        return {"aggregazione": "sede", "dati": result, "periodo": periodo}
    else:  # azienda
        result = {}
        for animale in animali:
            azienda_id_animale = animale.azienda_id
            if azienda_id_animale not in result:
                result[azienda_id_animale] = 0
            result[azienda_id_animale] += 1
        return {"aggregazione": "azienda", "dati": result, "periodo": periodo}


@router.get("/animali-morti")
def get_animali_morti(
    aggregazione: str = Query('azienda', description="sede o azienda"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali morti per sede o azienda"""
    query = db.query(Animale).join(Decesso).filter(
        Animale.stato == 'deceduto',
        Animale.deleted_at.is_(None)
        # Decesso non ha deleted_at, quindi non serve filtrare
    )
    
    if azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    animali = query.all()
    
    if aggregazione == "sede":
        # Carica tutte le sedi necessarie
        if azienda_id:
            sedi_all = db.query(Sede).filter(
                Sede.azienda_id == azienda_id,
                Sede.deleted_at.is_(None)
            ).all()
        else:
            sedi_all = db.query(Sede).filter(Sede.deleted_at.is_(None)).all()
        sedi_map = {s.codice_stalla: s for s in sedi_all}
        
        result = {}
        for animale in animali:
            sede_id_animale = None
            
            # 1. Prova con codice_azienda_anagrafe (priorità massima per decessi)
            if animale.codice_azienda_anagrafe and animale.codice_azienda_anagrafe in sedi_map:
                sede_id_animale = sedi_map[animale.codice_azienda_anagrafe].id
            
            # 2. Se non trovato, prova con box_id
            if not sede_id_animale:
                sede_id_animale = get_sede_from_animale(db, animale)
            
            # 3. Se ancora non trovato, cerca nelle movimentazioni (ultima movimentazione)
            if not sede_id_animale:
                ultima_mov = db.query(Movimentazione).filter(
                    Movimentazione.animale_id == animale.id
                ).order_by(Movimentazione.data_ora.desc()).first()
                
                if ultima_mov and ultima_mov.a_box_id:
                    box = db.query(Box).filter(Box.id == ultima_mov.a_box_id).first()
                    if box and box.stabilimento_id:
                        stabilimento = db.query(Stabilimento).filter(Stabilimento.id == box.stabilimento_id).first()
                        if stabilimento:
                            sede_id_animale = stabilimento.sede_id
            
            # 4. Se ancora non trovato, usa la prima sede dell'azienda come fallback
            if not sede_id_animale and animale.azienda_id:
                prima_sede = db.query(Sede).filter(
                    Sede.azienda_id == animale.azienda_id,
                    Sede.deleted_at.is_(None)
                ).first()
                if prima_sede:
                    sede_id_animale = prima_sede.id
            
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += 1
        return {"aggregazione": "sede", "dati": result}
    else:  # azienda
        result = {}
        for animale in animali:
            azienda_id_animale = animale.azienda_id
            if azienda_id_animale not in result:
                result[azienda_id_animale] = 0
            result[azienda_id_animale] += 1
        return {"aggregazione": "azienda", "dati": result}


@router.get("/animali-per-sesso")
def get_animali_per_sesso(
    aggregazione: str = Query('azienda', description="sede o azienda"),
    sesso: str = Query('M', description="M o F"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali maschi o femmine per sede o azienda"""
    query = db.query(Animale).filter(
        Animale.sesso == sesso,
        Animale.deleted_at.is_(None)
    )
    
    if azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    animali = query.all()
    
    if aggregazione == "sede":
        result = {}
        for animale in animali:
            sede_id_animale = get_sede_from_animale(db, animale)
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += 1
        return {"aggregazione": "sede", "sesso": sesso, "dati": result}
    else:  # azienda
        result = {}
        for animale in animali:
            azienda_id_animale = animale.azienda_id
            if azienda_id_animale not in result:
                result[azienda_id_animale] = 0
            result[azienda_id_animale] += 1
        return {"aggregazione": "azienda", "sesso": sesso, "dati": result}


@router.get("/animali-per-razza")
def get_animali_per_razza(
    aggregazione: str = Query('azienda', description="sede o azienda"),
    razza: Optional[str] = None,
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Animali divisi per razza per sede o azienda"""
    query = db.query(Animale).filter(
        Animale.razza.isnot(None),
        Animale.deleted_at.is_(None)
    )
    
    if razza:
        query = query.filter(Animale.razza == razza)
    
    if azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    animali = query.all()
    
    if aggregazione == "sede":
        result = {}
        for animale in animali:
            sede_id_animale = get_sede_from_animale(db, animale)
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = {}
                razza_animale = animale.razza or "Non specificata"
                if razza_animale not in result[sede_id_animale]:
                    result[sede_id_animale][razza_animale] = 0
                result[sede_id_animale][razza_animale] += 1
        return {"aggregazione": "sede", "dati": result}
    else:  # azienda
        result = {}
        for animale in animali:
            azienda_id_animale = animale.azienda_id
            if azienda_id_animale not in result:
                result[azienda_id_animale] = {}
            razza_animale = animale.razza or "Non specificata"
            if razza_animale not in result[azienda_id_animale]:
                result[azienda_id_animale][razza_animale] = 0
            result[azienda_id_animale][razza_animale] += 1
        return {"aggregazione": "azienda", "dati": result}


@router.get("/animali-stato")
def get_animali_per_stato(
    aggregazione: str = Query('azienda', description="Aggregazione attuale (default: azienda)"),
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Restituisce il numero di animali per stato per azienda (o globale).
    Utile per popolare le card del modulo Allevamento con i conteggi aggiornati
    per 'presente', 'trasferito', 'venduto', 'macellato', 'deceduto', ecc.
    """
    query = db.query(Animale.stato, func.count(Animale.id)).filter(
        Animale.deleted_at.is_(None)
    )

    if azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)

    risultati = query.group_by(Animale.stato).all()

    dati = {}
    for stato, conteggio in risultati:
        key = stato if stato else 'sconosciuto'
        dati[key] = int(conteggio)

