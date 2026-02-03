"""
Endpoint per notifiche e alert della dashboard
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import Optional, List, Dict, Any
from datetime import date, timedelta

from app.core.database import get_db
from app.models.amministrazione.attrezzatura import ScadenzaAttrezzatura, Attrezzatura
from app.models.amministrazione.assicurazione_aziendale import AssicurazioneAziendale
from app.models.amministrazione.polizza_attrezzatura import PolizzaAttrezzatura
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.terreni.ciclo import CicloTerreno
from app.models.terreni.terreno import Terreno as TerrenoModel

router = APIRouter()


@router.get("/notifiche")
def get_notifiche(
    azienda_id: Optional[int] = Query(None, description="ID azienda"),
    db: Session = Depends(get_db)
):
    """
    Endpoint per ottenere tutte le notifiche importanti per la dashboard.
    Restituisce lista dettagliata di notifiche con record specifici che richiedono attenzione.
    """
    oggi = date.today()
    scadenza_30g = oggi + timedelta(days=30)
    notifiche: List[Dict[str, Any]] = []
    
    # ============ POLIZZE ATTREZZATURE ============
    # Include sia ScadenzaAttrezzatura (legacy) che PolizzaAttrezzatura (nuovo sistema)
    
    # Polizze attrezzature scadute (legacy: ScadenzaAttrezzatura con tipo='assicurazione')
    polizze_attrezzature_scadute_legacy_query = db.query(ScadenzaAttrezzatura).join(
        Attrezzatura, ScadenzaAttrezzatura.attrezzatura_id == Attrezzatura.id
    ).options(
        joinedload(ScadenzaAttrezzatura.attrezzatura)
    ).filter(
        ScadenzaAttrezzatura.tipo == "assicurazione",
        ScadenzaAttrezzatura.data_scadenza < oggi,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_attrezzature_scadute_legacy_query = polizze_attrezzature_scadute_legacy_query.filter(
            Attrezzatura.azienda_id == azienda_id
        )
    for scadenza in polizze_attrezzature_scadute_legacy_query.all():
        giorni_scaduti = (oggi - scadenza.data_scadenza).days
        notifiche.append({
            "tipo": "polizza_attrezzatura",
            "id": scadenza.id,
            "tipo_record": "scadenza_legacy",
            "titolo": f"Assicurazione {scadenza.attrezzatura.nome if scadenza.attrezzatura else 'Attrezzatura'} scaduta",
            "descrizione": f"Polizza {scadenza.numero_polizza or 'N/A'} scaduta da {giorni_scaduti} giorni",
            "data_scadenza": scadenza.data_scadenza.isoformat(),
            "urgenza": "scaduta",
            "link": {
                "modulo": "attrezzatura",
                "tipo": "scadenza",
                "id": scadenza.id,
                "attrezzatura_id": scadenza.attrezzatura_id
            }
        })
    
    # Polizze attrezzature scadute (nuovo sistema: PolizzaAttrezzatura)
    polizze_attrezzature_scadute_nuovo_query = db.query(PolizzaAttrezzatura).options(
        joinedload(PolizzaAttrezzatura.attrezzatura)
    ).filter(
        PolizzaAttrezzatura.data_scadenza < oggi,
        PolizzaAttrezzatura.attiva == True,
        PolizzaAttrezzatura.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_attrezzature_scadute_nuovo_query = polizze_attrezzature_scadute_nuovo_query.filter(
            PolizzaAttrezzatura.azienda_id == azienda_id
        )
    for polizza in polizze_attrezzature_scadute_nuovo_query.all():
        giorni_scaduti = (oggi - polizza.data_scadenza).days
        attrezzatura_nome = polizza.attrezzatura.nome if polizza.attrezzatura else 'Attrezzatura'
        notifiche.append({
            "tipo": "polizza_attrezzatura",
            "id": polizza.id,
            "tipo_record": "polizza",
            "titolo": f"Polizza {attrezzatura_nome} scaduta",
            "descrizione": f"{polizza.tipo_polizza} - {polizza.numero_polizza} scaduta da {giorni_scaduti} giorni",
            "data_scadenza": polizza.data_scadenza.isoformat(),
            "urgenza": "scaduta",
            "link": {
                "modulo": "attrezzatura",
                "tipo": "polizza",
                "id": polizza.id,
                "attrezzatura_id": polizza.attrezzatura_id
            }
        })
    
    # Polizze attrezzature in scadenza (30 giorni) - legacy
    polizze_attrezzature_in_scadenza_legacy_query = db.query(ScadenzaAttrezzatura).join(
        Attrezzatura, ScadenzaAttrezzatura.attrezzatura_id == Attrezzatura.id
    ).options(
        joinedload(ScadenzaAttrezzatura.attrezzatura)
    ).filter(
        ScadenzaAttrezzatura.tipo == "assicurazione",
        ScadenzaAttrezzatura.data_scadenza >= oggi,
        ScadenzaAttrezzatura.data_scadenza <= scadenza_30g,
        ScadenzaAttrezzatura.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_attrezzature_in_scadenza_legacy_query = polizze_attrezzature_in_scadenza_legacy_query.filter(
            Attrezzatura.azienda_id == azienda_id
        )
    for scadenza in polizze_attrezzature_in_scadenza_legacy_query.all():
        giorni_alla_scadenza = (scadenza.data_scadenza - oggi).days
        notifiche.append({
            "tipo": "polizza_attrezzatura",
            "id": scadenza.id,
            "tipo_record": "scadenza_legacy",
            "titolo": f"Assicurazione {scadenza.attrezzatura.nome if scadenza.attrezzatura else 'Attrezzatura'} in scadenza",
            "descrizione": f"Polizza {scadenza.numero_polizza or 'N/A'} scade tra {giorni_alla_scadenza} giorni",
            "data_scadenza": scadenza.data_scadenza.isoformat(),
            "urgenza": "in_scadenza",
            "link": {
                "modulo": "attrezzatura",
                "tipo": "scadenza",
                "id": scadenza.id,
                "attrezzatura_id": scadenza.attrezzatura_id
            }
        })
    
    # Polizze attrezzature in scadenza (30 giorni) - nuovo sistema
    polizze_attrezzature_in_scadenza_nuovo_query = db.query(PolizzaAttrezzatura).options(
        joinedload(PolizzaAttrezzatura.attrezzatura)
    ).filter(
        PolizzaAttrezzatura.data_scadenza >= oggi,
        PolizzaAttrezzatura.data_scadenza <= scadenza_30g,
        PolizzaAttrezzatura.attiva == True,
        PolizzaAttrezzatura.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_attrezzature_in_scadenza_nuovo_query = polizze_attrezzature_in_scadenza_nuovo_query.filter(
            PolizzaAttrezzatura.azienda_id == azienda_id
        )
    for polizza in polizze_attrezzature_in_scadenza_nuovo_query.all():
        giorni_alla_scadenza = (polizza.data_scadenza - oggi).days
        attrezzatura_nome = polizza.attrezzatura.nome if polizza.attrezzatura else 'Attrezzatura'
        notifiche.append({
            "tipo": "polizza_attrezzatura",
            "id": polizza.id,
            "tipo_record": "polizza",
            "titolo": f"Polizza {attrezzatura_nome} in scadenza",
            "descrizione": f"{polizza.tipo_polizza} - {polizza.numero_polizza} scade tra {giorni_alla_scadenza} giorni",
            "data_scadenza": polizza.data_scadenza.isoformat(),
            "urgenza": "in_scadenza",
            "link": {
                "modulo": "attrezzatura",
                "tipo": "polizza",
                "id": polizza.id,
                "attrezzatura_id": polizza.attrezzatura_id
            }
        })
    
    # ============ POLIZZE AZIENDALI ============
    # Polizze aziendali scadute
    polizze_aziendali_scadute_query = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.data_scadenza < oggi,
        AssicurazioneAziendale.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_aziendali_scadute_query = polizze_aziendali_scadute_query.filter(
            AssicurazioneAziendale.azienda_id == azienda_id
        )
    for polizza in polizze_aziendali_scadute_query.all():
        giorni_scaduti = (oggi - polizza.data_scadenza).days
        notifiche.append({
            "tipo": "polizza_aziendale",
            "id": polizza.id,
            "tipo_record": "assicurazione_aziendale",
            "titolo": f"Polizza aziendale {polizza.tipo} scaduta",
            "descrizione": f"{polizza.numero_polizza} - {polizza.compagnia} scaduta da {giorni_scaduti} giorni",
            "data_scadenza": polizza.data_scadenza.isoformat(),
            "urgenza": "scaduta",
            "link": {
                "modulo": "allevamento",
                "tipo": "assicurazione_aziendale",
                "id": polizza.id
            }
        })
    
    # Polizze aziendali in scadenza (30 giorni)
    polizze_aziendali_in_scadenza_query = db.query(AssicurazioneAziendale).filter(
        AssicurazioneAziendale.data_scadenza >= oggi,
        AssicurazioneAziendale.data_scadenza <= scadenza_30g,
        AssicurazioneAziendale.deleted_at.is_(None)
    )
    if azienda_id:
        polizze_aziendali_in_scadenza_query = polizze_aziendali_in_scadenza_query.filter(
            AssicurazioneAziendale.azienda_id == azienda_id
        )
    for polizza in polizze_aziendali_in_scadenza_query.all():
        giorni_alla_scadenza = (polizza.data_scadenza - oggi).days
        notifiche.append({
            "tipo": "polizza_aziendale",
            "id": polizza.id,
            "tipo_record": "assicurazione_aziendale",
            "titolo": f"Polizza aziendale {polizza.tipo} in scadenza",
            "descrizione": f"{polizza.numero_polizza} - {polizza.compagnia} scade tra {giorni_alla_scadenza} giorni",
            "data_scadenza": polizza.data_scadenza.isoformat(),
            "urgenza": "in_scadenza",
            "link": {
                "modulo": "allevamento",
                "tipo": "assicurazione_aziendale",
                "id": polizza.id
            }
        })
    
    # ============ FATTURE ============
    # Fatture scadute
    fatture_scadute_query = db.query(FatturaAmministrazione).options(
        joinedload(FatturaAmministrazione.fornitore)
    ).filter(
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza < oggi,
        FatturaAmministrazione.deleted_at.is_(None)
    )
    if azienda_id:
        fatture_scadute_query = fatture_scadute_query.filter(
            FatturaAmministrazione.azienda_id == azienda_id
        )
    for fattura in fatture_scadute_query.all():
        giorni_scaduti = (oggi - fattura.data_scadenza).days
        fornitore_nome = fattura.fornitore.nome if fattura.fornitore else 'N/A'
        notifiche.append({
            "tipo": "fattura",
            "id": fattura.id,
            "tipo_record": "fattura_scaduta",
            "titolo": f"Fattura {fattura.numero or 'N/A'} scaduta",
            "descrizione": f"Fattura da {fornitore_nome} scaduta da {giorni_scaduti} giorni - €{float(fattura.totale or 0):.2f}",
            "data_scadenza": fattura.data_scadenza.isoformat(),
            "urgenza": "scaduta",
            "link": {
                "modulo": "amministrazione",
                "tipo": "fattura",
                "id": fattura.id
            }
        })
    
    # Fatture in scadenza (30 giorni) - solo quelle da pagare o parziali
    fatture_in_scadenza_query = db.query(FatturaAmministrazione).options(
        joinedload(FatturaAmministrazione.fornitore)
    ).filter(
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza >= oggi,
        FatturaAmministrazione.data_scadenza <= scadenza_30g,
        FatturaAmministrazione.deleted_at.is_(None),
        FatturaAmministrazione.stato_pagamento.in_(['da_pagare', 'parziale'])
    )
    if azienda_id:
        fatture_in_scadenza_query = fatture_in_scadenza_query.filter(
            FatturaAmministrazione.azienda_id == azienda_id
        )
    for fattura in fatture_in_scadenza_query.all():
        giorni_alla_scadenza = (fattura.data_scadenza - oggi).days
        fornitore_nome = fattura.fornitore.nome if fattura.fornitore else 'N/A'
        notifiche.append({
            "tipo": "fattura",
            "id": fattura.id,
            "tipo_record": "fattura_in_scadenza",
            "titolo": f"Fattura {fattura.numero or 'N/A'} in scadenza",
            "descrizione": f"Fattura da {fornitore_nome} scade tra {giorni_alla_scadenza} giorni - €{float(fattura.totale or 0):.2f}",
            "data_scadenza": fattura.data_scadenza.isoformat(),
            "urgenza": "in_scadenza",
            "link": {
                "modulo": "amministrazione",
                "tipo": "fattura",
                "id": fattura.id
            }
        })
    
    # Fatture senza categoria
    fatture_senza_categoria_query = db.query(FatturaAmministrazione).options(
        joinedload(FatturaAmministrazione.fornitore)
    ).filter(
        FatturaAmministrazione.deleted_at.is_(None),
        or_(
            FatturaAmministrazione.categoria.is_(None),
            FatturaAmministrazione.categoria == ''
        ),
        FatturaAmministrazione.categoria_id.is_(None)
    )
    if azienda_id:
        fatture_senza_categoria_query = fatture_senza_categoria_query.filter(
            FatturaAmministrazione.azienda_id == azienda_id
        )
    for fattura in fatture_senza_categoria_query.all():
        fornitore_nome = fattura.fornitore.nome if fattura.fornitore else 'N/A'
        notifiche.append({
            "tipo": "fattura",
            "id": fattura.id,
            "tipo_record": "fattura_senza_categoria",
            "titolo": f"Fattura {fattura.numero or 'N/A'} senza categoria",
            "descrizione": f"Fattura da {fornitore_nome} richiede classificazione - €{float(fattura.totale or 0):.2f}",
            "data_scadenza": None,
            "urgenza": "info",
            "link": {
                "modulo": "amministrazione",
                "tipo": "fattura",
                "id": fattura.id
            }
        })
    
    # Ordina notifiche per urgenza (scaduta > in_scadenza > info) e data (più recenti prima)
    urgenza_order = {"scaduta": 0, "in_scadenza": 1, "info": 2}
    # Per ordinare per data decrescente, convertiamo la data in un formato numerico invertito
    # Usiamo una data molto lontana nel futuro per quelle senza data, così vanno in fondo
    def sort_key(x):
        urgenza_val = urgenza_order.get(x["urgenza"], 99)
        # Per la data: convertiamo YYYY-MM-DD in un numero e lo invertiamo
        # così le date più recenti (più grandi) vengono prima
        if x["data_scadenza"]:
            # Invertiamo l'ordine usando una data molto lontana nel futuro come base
            # e sottraiamo la data attuale
            date_str = x["data_scadenza"].replace("-", "")
            date_num = int(date_str) if date_str.isdigit() else 0
            # Usiamo il negativo per invertire l'ordine (più recenti = numeri più grandi = vengono prima)
            date_sort = -date_num
        else:
            # Notifiche senza data vanno in fondo (valore molto grande)
            date_sort = 0
        return (urgenza_val, date_sort)
    
    notifiche.sort(key=sort_key)
    
    return {
        "notifiche": notifiche,
        "total": len(notifiche)
    }

