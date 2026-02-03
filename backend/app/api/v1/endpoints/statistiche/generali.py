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


@router.get("/somministrazioni")
def get_somministrazioni(
    periodo: str = Query('totali', description="totali, settimana, mese, anno o sempre"),
    solo_presenti: bool = Query(False, description="Solo animali presenti"),
    aggregazione: str = Query('azienda', description="sede o azienda"),
    azienda_id: Optional[int] = None,
    sede_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Numero di somministrazioni per sede o azienda - OTTIMIZZATO con query aggregata"""
    oggi = datetime.now().date()
    
    # OTTIMIZZATO: Usa query aggregata invece di caricare tutti gli oggetti
    base_query = db.query(
        Animale.azienda_id,
        func.count(Somministrazione.id)
    ).join(Animale).filter(
        Somministrazione.deleted_at.is_(None),
        Animale.deleted_at.is_(None)
    )
    
    if solo_presenti:
        base_query = base_query.filter(Animale.stato == 'presente')
    
    if periodo == "settimana":
        data_inizio = oggi - timedelta(days=7)
        base_query = base_query.filter(func.date(Somministrazione.data_ora) >= data_inizio)
    elif periodo == "mese":
        data_inizio = oggi - timedelta(days=30)
        base_query = base_query.filter(func.date(Somministrazione.data_ora) >= data_inizio)
    elif periodo == "anno":
        data_inizio = date(oggi.year, 1, 1)
        base_query = base_query.filter(func.date(Somministrazione.data_ora) >= data_inizio)
    # "totali" e "sempre" non aggiungono filtri di data
    
    if azienda_id:
        base_query = base_query.filter(Animale.azienda_id == azienda_id)
    
    if aggregazione == "azienda":
        results = base_query.group_by(Animale.azienda_id).all()
        result = {az_id: count for az_id, count in results}
        return {"aggregazione": "azienda", "periodo": periodo, "solo_presenti": solo_presenti, "dati": result}
    else:  # sede - richiede logica più complessa
        # Per sede, pre-carichiamo la mappatura box -> sede
        box_to_sede = build_box_to_sede_map(db, azienda_id)
        
        # Query con box_id per mappatura
        query = db.query(
            Animale.box_id,
            Animale.codice_azienda_anagrafe,
            func.count(Somministrazione.id)
        ).join(Animale).filter(
            Somministrazione.deleted_at.is_(None),
            Animale.deleted_at.is_(None)
        )
        
        if solo_presenti:
            query = query.filter(Animale.stato == 'presente')
        
        if periodo == "settimana":
            query = query.filter(func.date(Somministrazione.data_ora) >= oggi - timedelta(days=7))
        elif periodo == "mese":
            query = query.filter(func.date(Somministrazione.data_ora) >= oggi - timedelta(days=30))
        elif periodo == "anno":
            query = query.filter(func.date(Somministrazione.data_ora) >= date(oggi.year, 1, 1))
        
        if azienda_id:
            query = query.filter(Animale.azienda_id == azienda_id)
        
        results = query.group_by(Animale.box_id, Animale.codice_azienda_anagrafe).all()
        
        # Pre-carica mappatura codice_stalla -> sede_id
        if azienda_id:
            sedi = db.query(Sede).filter(Sede.azienda_id == azienda_id, Sede.deleted_at.is_(None)).all()
        else:
            sedi = db.query(Sede).filter(Sede.deleted_at.is_(None)).all()
        codice_to_sede = {s.codice_stalla: s.id for s in sedi}
        
        result = {}
        for box_id, codice_anagrafe, count in results:
            sede_id_animale = None
            
            # 1. Prova con codice_azienda_anagrafe
            if codice_anagrafe and codice_anagrafe in codice_to_sede:
                sede_id_animale = codice_to_sede[codice_anagrafe]
            
            # 2. Usa mappatura box -> sede
            if not sede_id_animale and box_id:
                sede_id_animale = box_to_sede.get(box_id)
            
            if sede_id_animale:
                if sede_id_animale not in result:
                    result[sede_id_animale] = 0
                result[sede_id_animale] += count
        
        return {"aggregazione": "sede", "periodo": periodo, "solo_presenti": solo_presenti, "dati": result}


@router.get("/terreni")
def get_terreni_stats(
    aggregazione: str = Query('totali', description="totali o azienda"),
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """Statistiche terreni"""
    query = db.query(TerrenoModel).filter(TerrenoModel.deleted_at.is_(None))
    
    if azienda_id:
        query = query.filter(TerrenoModel.azienda_id == azienda_id)
    
    terreni = query.all()
    
    if aggregazione == "totali":
        superficie_totale = sum(float(t.superficie or 0) for t in terreni if t.superficie and t.unita_misura == 'ha')
        return {
            "aggregazione": "totali",
            "numero_terreni": len(terreni),
            "superficie_totale": round(superficie_totale, 2)
        }
    else:  # azienda
        result = {}
        for terreno in terreni:
            azienda_id_terreno = terreno.azienda_id
            if azienda_id_terreno not in result:
                result[azienda_id_terreno] = {"numero": 0, "superficie": 0}
            result[azienda_id_terreno]["numero"] += 1
            if terreno.superficie and terreno.unita_misura == 'ha':
                result[azienda_id_terreno]["superficie"] += float(terreno.superficie)
        return {"aggregazione": "azienda", "dati": result}


@router.get("/terreni-coltivati")
def get_terreni_coltivati(
    db: Session = Depends(get_db)
):
    """Terreni attualmente coltivati (con cicli attivi)"""
    oggi = date.today()
    
    # Trova cicli attivi (non completati o in corso)
    # LavorazioneTerreno ha solo 'data' (singola data), non data_fine
    # Usiamo CicloTerreno che ha data_inizio e data_fine
    from app.models.terreni.ciclo import CicloTerreno
    
    cicli_attivi = db.query(CicloTerreno).filter(
        CicloTerreno.deleted_at.is_(None),
        or_(
            CicloTerreno.data_fine.is_(None),
            CicloTerreno.data_fine >= oggi
        )
    ).all()
    
    terreni_coltivati = set(c.terreno_id for c in cicli_attivi if c.terreno_id)
    
    # Calcola superficie totale (ettari) e in campi (2.5 campi = 1 ettaro, 0 decimali)
    superficie_ettari = 0
    for terreno_id in terreni_coltivati:
        terreno = db.query(TerrenoModel).filter(TerrenoModel.id == terreno_id).first()
        if terreno and terreno.superficie and terreno.unita_misura == 'ha':
            superficie_ettari += float(terreno.superficie)
    
    superficie_campi = int(superficie_ettari * 2.5)
    
    # Coltivazioni attualmente in essere (basate sui cicli)
    coltivazioni = {}
    for ciclo in cicli_attivi:
        if ciclo.coltura:
            if ciclo.coltura not in coltivazioni:
                coltivazioni[ciclo.coltura] = 0
            coltivazioni[ciclo.coltura] += 1
    
    return {
        "numero_terreni_coltivati": len(terreni_coltivati),
        "superficie_ettari": round(superficie_ettari, 2),
        "superficie_campi": superficie_campi,
        "coltivazioni": coltivazioni
    }


@router.get("/fatture-emesse")
def get_fatture_emesse_stats(
    periodo: str = Query('mese', description="mese, anno o sempre"),
    db: Session = Depends(get_db)
):
    """Fatture emesse e totale incassato"""
    oggi = date.today()
    
    query = db.query(FatturaAmministrazione).filter(FatturaAmministrazione.deleted_at.is_(None))
    
    if periodo == "mese":
        data_inizio = date(oggi.year, oggi.month, 1)
        data_fine = oggi
        query = query.filter(
            FatturaAmministrazione.data_fattura >= data_inizio,
            FatturaAmministrazione.data_fattura <= data_fine
        )
    elif periodo == "anno":
        data_inizio = date(oggi.year, 1, 1)
        data_fine = oggi
        query = query.filter(
            FatturaAmministrazione.data_fattura >= data_inizio,
            FatturaAmministrazione.data_fattura <= data_fine
        )
    # se "sempre", nessun filtro sulla data
    
    fatture = query.all()
    
    totale_incassato = sum(float(f.importo_totale or 0) for f in fatture if f.importo_totale)
    
    return {
        "periodo": periodo,
        "numero_fatture": len(fatture),
        "totale_incassato": round(totale_incassato, 2)
    }


@router.get("/costi")
def get_costi_stats(
    periodo: str = Query('mese', description="mese, anno o sempre"),
    per_categoria: bool = Query(False, description="Raggruppa per categoria"),
    db: Session = Depends(get_db)
):
    """Costi totali mensili, annuali o sempre, opzionalmente per categoria"""
    oggi = date.today()
    
    query = db.query(FatturaAmministrazione).filter(FatturaAmministrazione.deleted_at.is_(None))
    
    if periodo == "mese":
        data_inizio = date(oggi.year, oggi.month, 1)
        data_fine = oggi
        query = query.filter(
            FatturaAmministrazione.data_fattura >= data_inizio,
            FatturaAmministrazione.data_fattura <= data_fine
        )
    elif periodo == "anno":
        data_inizio = date(oggi.year, 1, 1)
        data_fine = oggi
        query = query.filter(
            FatturaAmministrazione.data_fattura >= data_inizio,
            FatturaAmministrazione.data_fattura <= data_fine
        )
    # se "sempre", nessun filtro sulla data
    
    fatture = query.all()
    
    if per_categoria:
        result = {}
        for fattura in fatture:
            categoria = fattura.categoria_costo or "altro"
            if categoria not in result:
                result[categoria] = 0
            if fattura.importo_totale:
                result[categoria] += float(fattura.importo_totale)
        return {
            "periodo": periodo,
            "per_categoria": True,
            "dati": {k: round(v, 2) for k, v in result.items()}
        }
    else:
        totale = sum(float(f.importo_totale or 0) for f in fatture if f.importo_totale)
        return {
            "periodo": periodo,
            "per_categoria": False,
            "totale": round(totale, 2)
        }


@router.get("/fatture-scadute")
def get_fatture_scadute(
    db: Session = Depends(get_db)
):
    """Fatture scadute da pagare"""
    oggi = date.today()
    
    fatture = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza < oggi,
        FatturaAmministrazione.deleted_at.is_(None)
    ).all()
    
    totale = sum(float(f.importo_totale or 0) for f in fatture if f.importo_totale)
    
    return {
        "numero_fatture": len(fatture),
        "totale": round(totale, 2)
    }


@router.get("/ultima-sync-anagrafe")
def get_ultima_sync_anagrafe(
    db: Session = Depends(get_db)
):
    """Ultima data di sincronizzazione con l'anagrafe"""
    ultima_sync = db.query(func.max(Animale.ultima_sync_anagrafe)).filter(
        Animale.ultima_sync_anagrafe.isnot(None)
    ).scalar()
    
    return {
        "ultima_sync": ultima_sync.isoformat() if ultima_sync else None
    }


@router.get("/assicurazioni-scadenze")
def get_assicurazioni_scadenze(
    db: Session = Depends(get_db)
):
    """Assicurazioni in scadenza e scadute"""
    oggi = date.today()
    scadenza_prossima = oggi + timedelta(days=30)
    
    scadute = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.data_scadenza < oggi,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).all()
    
    in_scadenza = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.data_scadenza >= oggi,
        AssicurazioneAziendale.data_scadenza <= scadenza_prossima,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).all()
    
    return {
        "scadute": len(scadute),
        "in_scadenza": len(in_scadenza)
    }


@router.get("/revisioni-scadenze")
def get_revisioni_scadenze(
    db: Session = Depends(get_db)
):
    """Revisioni in scadenza e scadute"""
    oggi = date.today()
    scadenza_prossima = oggi + timedelta(days=30)
    
    scadute = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.tipo == "revisione",
        ScadenzaAttrezzatura.data_scadenza < oggi,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).all()
    
    in_scadenza = db.query(ScadenzaAttrezzatura).filter(
        ScadenzaAttrezzatura.tipo == "revisione",
        ScadenzaAttrezzatura.data_scadenza >= oggi,
        ScadenzaAttrezzatura.data_scadenza <= scadenza_prossima,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).all()
    
    return {
        "scadute": len(scadute),
        "in_scadenza": len(in_scadenza)
    }

