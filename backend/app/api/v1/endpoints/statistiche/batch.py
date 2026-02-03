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


@router.get("/home-batch")
def get_home_stats_batch(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint ottimizzato per caricare tutte le statistiche della home in una singola chiamata.
    Riduce drasticamente la latenza evitando multiple roundtrip al database.
    """
    oggi = date.today()
    
    # Animali per stato (presente, venduto, macellato, deceduto, ecc.)
    query_stati = db.query(Animale.stato, func.count(Animale.id)).filter(
        Animale.deleted_at.is_(None)
    )
    if azienda_id:
        query_stati = query_stati.filter(Animale.azienda_id == azienda_id)
    stati_results = query_stati.group_by(Animale.stato).all()
    animali_stato = {stato or 'sconosciuto': int(count) for stato, count in stati_results}
    
    # Animali presenti totale
    animali_presenti = animali_stato.get('presente', 0)
    
    # Somministrazioni totali (tutti i periodi in una query)
    query_somm = db.query(func.count(Somministrazione.id)).filter(
        Somministrazione.deleted_at.is_(None)
    )
    if azienda_id:
        query_somm = query_somm.join(Animale).filter(Animale.azienda_id == azienda_id)
    somministrazioni_totali = query_somm.scalar() or 0
    
    # Terreni
    query_terreni = db.query(
        func.count(TerrenoModel.id),
        func.coalesce(func.sum(case((TerrenoModel.unita_misura == 'ha', TerrenoModel.superficie), else_=0)), 0)
    ).filter(TerrenoModel.deleted_at.is_(None))
    if azienda_id:
        query_terreni = query_terreni.filter(TerrenoModel.azienda_id == azienda_id)
    terreni_count, terreni_superficie = query_terreni.first()
    
    # Assicurazioni scadute e in scadenza
    scadenza_30g = oggi + timedelta(days=30)
    assic_scadute = db.query(func.count(AssicurazioneAziendale.id)).filter(
        AssicurazioneAziendale.data_scadenza < oggi,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).scalar() or 0
    assic_in_scadenza = db.query(func.count(AssicurazioneAziendale.id)).filter(
        AssicurazioneAziendale.data_scadenza >= oggi,
        AssicurazioneAziendale.data_scadenza <= scadenza_30g,
        AssicurazioneAziendale.deleted_at.is_(None)
    ).scalar() or 0
    
    # Revisioni scadute e in scadenza
    rev_scadute = db.query(func.count(ScadenzaAttrezzatura.id)).filter(
        ScadenzaAttrezzatura.tipo == "revisione",
        ScadenzaAttrezzatura.data_scadenza < oggi,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).scalar() or 0
    rev_in_scadenza = db.query(func.count(ScadenzaAttrezzatura.id)).filter(
        ScadenzaAttrezzatura.tipo == "revisione",
        ScadenzaAttrezzatura.data_scadenza >= oggi,
        ScadenzaAttrezzatura.data_scadenza <= scadenza_30g,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    ).scalar() or 0
    
    # Attrezzature totali
    attrezzature_count = db.query(func.count(Attrezzatura.id)).filter(
        Attrezzatura.deleted_at.is_(None)
    ).scalar() or 0
    
    # Fatture scadute
    fatture_scadute_count = db.query(func.count(FatturaAmministrazione.id)).filter(
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza < oggi,
        FatturaAmministrazione.deleted_at.is_(None)
    ).scalar() or 0
    
    return {
        "animali_stato": animali_stato,
        "animali_presenti": animali_presenti,
        "somministrazioni_totali": somministrazioni_totali,
        "terreni": {
            "numero": terreni_count or 0,
            "superficie_ha": float(terreni_superficie or 0)
        },
        "assicurazioni": {
            "scadute": assic_scadute,
            "in_scadenza": assic_in_scadenza
        },
        "revisioni": {
            "scadute": rev_scadute,
            "in_scadenza": rev_in_scadenza
        },
        "attrezzature": attrezzature_count,
        "fatture_scadute": fatture_scadute_count
    }


def get_sede_from_animale(db: Session, animale: Animale) -> Optional[int]:
    """Ottiene la sede_id di un animale tramite box -> stabilimento -> sede"""
    if animale.box_id:
        box = db.query(Box).filter(Box.id == animale.box_id).first()
        if box and box.stabilimento_id:
            stabilimento = db.query(Stabilimento).filter(Stabilimento.id == box.stabilimento_id).first()
            if stabilimento:
                return stabilimento.sede_id
    return None


def build_box_to_sede_map(db: Session, azienda_id: Optional[int] = None) -> Dict[int, int]:
    """
    Pre-carica la mappatura box_id -> sede_id per evitare N+1 queries.
    Restituisce un dizionario {box_id: sede_id}
    """
    query = db.query(Box.id, Sede.id).join(
        Stabilimento, Box.stabilimento_id == Stabilimento.id
    ).join(
        Sede, Stabilimento.sede_id == Sede.id
    ).filter(
        Box.deleted_at.is_(None),
        Stabilimento.deleted_at.is_(None),
        Sede.deleted_at.is_(None)
    )
    
    if azienda_id:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    results = query.all()
    return {box_id: sede_id for box_id, sede_id in results}


@router.get("/allevamento-batch")
def get_allevamento_stats_batch(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per statistiche allevamento - sedi, stabilimenti, box in una sola chiamata.
    """
    from app.models.allevamento.sede import Sede
    from app.models.allevamento.stabilimento import Stabilimento
    from app.models.allevamento.box import Box
    
    # Sedi count
    sedi_query = db.query(func.count(Sede.id)).filter(Sede.deleted_at.is_(None))
    if azienda_id:
        sedi_query = sedi_query.filter(Sede.azienda_id == azienda_id)
    sedi_count = sedi_query.scalar() or 0
    
    # Stabilimenti count
    stab_query = db.query(func.count(Stabilimento.id)).filter(Stabilimento.deleted_at.is_(None))
    if azienda_id:
        stab_query = stab_query.join(Sede).filter(Sede.azienda_id == azienda_id)
    stab_count = stab_query.scalar() or 0
    
    # Box count
    box_query = db.query(func.count(Box.id)).filter(Box.deleted_at.is_(None))
    if azienda_id:
        box_query = box_query.join(Stabilimento).join(Sede).filter(Sede.azienda_id == azienda_id)
    box_count = box_query.scalar() or 0
    
    # Animali per stato
    animali_query = db.query(Animale.stato, func.count(Animale.id)).filter(
        Animale.deleted_at.is_(None)
    )
    if azienda_id:
        animali_query = animali_query.filter(Animale.azienda_id == azienda_id)
    animali_results = animali_query.group_by(Animale.stato).all()
    animali_stato = {stato or 'sconosciuto': int(count) for stato, count in animali_results}
    
    return {
        "sedi": sedi_count,
        "stabilimenti": stab_count,
        "box": box_count,
        "animali_stato": animali_stato,
        "animali_presenti": animali_stato.get('presente', 0)
    }


@router.get("/alimentazione-batch")
def get_alimentazione_stats_batch(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per statistiche alimentazione - componenti, mangimi, piani, fornitori in una sola chiamata.
    """
    from app.models.alimentazione.componente_alimentare import ComponenteAlimentare
    from app.models.alimentazione.mangime_confezionato import MangimeConfezionato
    from app.models.alimentazione.piano_alimentazione import PianoAlimentazione
    from app.models.amministrazione.fornitore import Fornitore
    
    # Componenti
    comp_query = db.query(func.count(ComponenteAlimentare.id)).filter(ComponenteAlimentare.deleted_at.is_(None))
    if azienda_id:
        comp_query = comp_query.filter(ComponenteAlimentare.azienda_id == azienda_id)
    componenti_count = comp_query.scalar() or 0
    
    # Mangimi
    mang_query = db.query(func.count(MangimeConfezionato.id)).filter(MangimeConfezionato.deleted_at.is_(None))
    if azienda_id:
        mang_query = mang_query.filter(MangimeConfezionato.azienda_id == azienda_id)
    mangimi_count = mang_query.scalar() or 0
    
    # Piani
    piani_query = db.query(func.count(PianoAlimentazione.id)).filter(PianoAlimentazione.deleted_at.is_(None))
    if azienda_id:
        piani_query = piani_query.filter(PianoAlimentazione.azienda_id == azienda_id)
    piani_count = piani_query.scalar() or 0
    
    # Fornitori
    forn_query = db.query(func.count(Fornitore.id)).filter(Fornitore.deleted_at.is_(None))
    if azienda_id:
        forn_query = forn_query.filter(Fornitore.azienda_id == azienda_id)
    fornitori_count = forn_query.scalar() or 0
    
    return {
        "componenti": componenti_count,
        "mangimi": mangimi_count,
        "piani": piani_count,
        "fornitori": fornitori_count
    }


@router.get("/amministrazione-batch")
def get_amministrazione_stats_batch(
    azienda_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per statistiche amministrazione - fatture, scadenze in una sola chiamata.
    """
    oggi = date.today()
    
    # Fatture totali
    fatture_query = db.query(func.count(FatturaAmministrazione.id)).filter(
        FatturaAmministrazione.deleted_at.is_(None)
    )
    if azienda_id:
        fatture_query = fatture_query.filter(FatturaAmministrazione.azienda_id == azienda_id)
    fatture_totali = fatture_query.scalar() or 0
    
    # Fatture per tipo (entrata/uscita)
    # Usa cast per assicurarsi che il tipo sia trattato come stringa nel GROUP BY
    from sqlalchemy import cast, String
    tipo_query = db.query(
        cast(FatturaAmministrazione.tipo, String).label('tipo'),
        func.count(FatturaAmministrazione.id)
    ).filter(FatturaAmministrazione.deleted_at.is_(None))
    if azienda_id:
        tipo_query = tipo_query.filter(FatturaAmministrazione.azienda_id == azienda_id)
    tipo_results = tipo_query.group_by('tipo').all()
    # Converti a dizionario con chiavi stringa
    fatture_per_tipo = {}
    for tipo, count in tipo_results:
        # tipo è già una stringa grazie al cast
        tipo_str = str(tipo) if tipo else 'altro'
        fatture_per_tipo[tipo_str] = int(count)
    
    # Fatture scadute
    scadute_query = db.query(func.count(FatturaAmministrazione.id)).filter(
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza < oggi,
        FatturaAmministrazione.deleted_at.is_(None)
    )
    if azienda_id:
        scadute_query = scadute_query.filter(FatturaAmministrazione.azienda_id == azienda_id)
    fatture_scadute = scadute_query.scalar() or 0
    
    # Assicurazioni scadute e in scadenza
    scadenza_30g = oggi + timedelta(days=30)
    assic_scadute_query = db.query(func.count(AssicurazioneAziendale.id)).filter(
        AssicurazioneAziendale.data_scadenza < oggi,
        AssicurazioneAziendale.deleted_at.is_(None)
    )
    if azienda_id:
        assic_scadute_query = assic_scadute_query.filter(AssicurazioneAziendale.azienda_id == azienda_id)
    assic_scadute = assic_scadute_query.scalar() or 0
    
    assic_in_scadenza_query = db.query(func.count(AssicurazioneAziendale.id)).filter(
        AssicurazioneAziendale.data_scadenza >= oggi,
        AssicurazioneAziendale.data_scadenza <= scadenza_30g,
        AssicurazioneAziendale.deleted_at.is_(None)
    )
    if azienda_id:
        assic_in_scadenza_query = assic_in_scadenza_query.filter(AssicurazioneAziendale.azienda_id == azienda_id)
    assic_in_scadenza = assic_in_scadenza_query.scalar() or 0
    
    return {
        "fatture_totali": fatture_totali,
        "fatture_per_tipo": fatture_per_tipo,
        "fatture_scadute": fatture_scadute,
        "assicurazioni": {
            "scadute": assic_scadute,
            "in_scadenza": assic_in_scadenza
        }
    }


