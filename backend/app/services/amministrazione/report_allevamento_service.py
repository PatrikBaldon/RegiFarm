"""
Servizio per calcolare i dati del report allevamento
"""
from collections import defaultdict
from decimal import Decimal
from datetime import date
from typing import Dict, List, Optional, Tuple
import json
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, or_

from app.models.allevamento.animale import Animale
from app.models.allevamento.decesso import Decesso
from app.models.amministrazione.partita_animale import PartitaAnimale, TipoPartita, ModalitaGestionePartita
from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
from app.models.amministrazione.partita_animale_movimento_finanziario import (
    PartitaMovimentoFinanziario,
    PartitaMovimentoTipo,
    PartitaMovimentoDirezione,
)
from app.models.amministrazione.contratto_soccida import ContrattoSoccida
from app.models.amministrazione.pagamento import Pagamento
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione, TipoFattura
from app.models.amministrazione.pn import PNMovimento, PNConto
from app.models.amministrazione.report_allevamento_fatture import ReportAllevamentoFattureUtilizzate
from app.services.amministrazione.prima_nota_service import get_conto_soccida_monetizzata


def to_decimal(value) -> Decimal:
    """Helper function to convert values to Decimal safely"""
    if value is None:
        return Decimal(0)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(0)


def get_movimenti_pn_per_contratto(
    db: Session,
    contratto: ContrattoSoccida,
    data_inizio: Optional[date] = None,
    data_fine: Optional[date] = None,
) -> List[PNMovimento]:
    """
    Recupera i movimenti dalla prima nota per un contratto soccida.
    """
    movimenti = []

    if contratto.monetizzata:
        # Per soccida monetizzata: cerca movimenti sul conto "Soccida monetizzata - Acconti"
        conto_soccida = get_conto_soccida_monetizzata(db, contratto.azienda_id)

        query = (
            db.query(PNMovimento)
            .filter(
                PNMovimento.conto_id == conto_soccida.id,
                PNMovimento.contratto_soccida_id == contratto.id,
                PNMovimento.deleted_at.is_(None),
                # Solo entrate (acconti ricevuti)
                PNMovimento.tipo_operazione == 'entrata',
            )
        )

        if data_inizio:
            query = query.filter(PNMovimento.data >= data_inizio)
        if data_fine:
            query = query.filter(PNMovimento.data <= data_fine)

        movimenti = query.all()
    else:
        # Per soccida fatturata: cerca movimenti sul conto "Crediti verso clienti"
        conto_crediti = (
            db.query(PNConto)
            .filter(
                PNConto.azienda_id == contratto.azienda_id,
                func.lower(PNConto.nome) == 'crediti verso clienti',
                PNConto.attivo,
            )
            .first()
        )

        if conto_crediti:
            # Cerca movimenti collegati a fatture del soccidante
            query = (
                db.query(PNMovimento)
                .join(FatturaAmministrazione, PNMovimento.fattura_amministrazione_id == FatturaAmministrazione.id)
                .filter(
                    PNMovimento.conto_id == conto_crediti.id,
                    FatturaAmministrazione.contratto_soccida_id == contratto.id,
                    FatturaAmministrazione.soccidante_id == contratto.soccidante_id,
                    FatturaAmministrazione.tipo == TipoFattura.ACCONTO,
                    PNMovimento.deleted_at.is_(None),
                    PNMovimento.tipo_operazione == 'entrata',
                )
            )

            if data_inizio:
                query = query.filter(PNMovimento.data >= data_inizio)
            if data_fine:
                query = query.filter(PNMovimento.data <= data_fine)

            movimenti = query.all()

    return movimenti


def calculate_report_allevamento_data(
    db: Session,
    data_uscita: Optional[date],
    azienda_id: Optional[int] = None,
    contratto_soccida_id: Optional[int] = None,
    data_inizio: Optional[date] = None,
    data_fine: Optional[date] = None,
    tipo_gestione_acconti: Optional[str] = 'nessuno',
    acconto_manuale: Optional[Decimal] = None,
    movimenti_pn_ids: Optional[List[int]] = None,
    fatture_acconto_selezionate: Optional[List[Dict]] = None,
    include_riepilogo_per_partita: bool = False,
) -> Dict:
    """
    Calcola i dati per il report allevamento su una data o intervallo di date.
    """
    if not data_uscita and not (data_inizio and data_fine):
        raise ValueError("Deve essere specificata una data di uscita o un intervallo (data_inizio + data_fine)")

    if data_inizio and data_fine:
        if data_fine < data_inizio:
            raise ValueError("data_fine non può essere precedente a data_inizio")
        date_start = data_inizio
        date_end = data_fine
    else:
        date_start = data_uscita
        date_end = data_uscita

    if not azienda_id and not contratto_soccida_id:
        raise ValueError("Deve essere specificato azienda_id o contratto_soccida_id")

    periodo_label = (
        date_start.strftime("%d/%m/%Y")
        if date_start == date_end
        else f"{date_start.strftime('%d/%m/%Y')} - {date_end.strftime('%d/%m/%Y')}"
    )

    # Query ottimizzata: carica tutte le uscite con joinedload
    uscita_entries = (
        db.query(PartitaAnimaleAnimale)
        .join(PartitaAnimaleAnimale.partita)
        .join(PartitaAnimaleAnimale.animale)
        .options(
            joinedload(PartitaAnimaleAnimale.animale),
            joinedload(PartitaAnimaleAnimale.partita)
            .joinedload(PartitaAnimale.fattura_amministrazione),
        )
        .filter(
            Animale.deleted_at.is_(None),
            PartitaAnimale.tipo == TipoPartita.USCITA,
            PartitaAnimale.data >= date_start,
            PartitaAnimale.data <= date_end,
            PartitaAnimale.is_trasferimento_interno == False,
            PartitaAnimale.deleted_at.is_(None),
        )
    )

    if contratto_soccida_id:
        uscita_entries = uscita_entries.filter(Animale.contratto_soccida_id == contratto_soccida_id)
    elif azienda_id:
        uscita_entries = uscita_entries.filter(Animale.azienda_id == azienda_id)

    uscita_entries = uscita_entries.all()

    if not uscita_entries:
        return {
            "data_uscita": periodo_label,
            "periodo_label": periodo_label,
            "date_range": {
                "dal": date_start.isoformat() if date_start else None,
                "al": date_end.isoformat() if date_end else None,
            },
            "azienda_id": azienda_id,
            "contratto_soccida_id": contratto_soccida_id,
            "totale_capi": 0,
            "peso_arrivo_totale": 0.0,
            "valore_acquisto_totale": 0.0,
            "peso_uscita_totale": 0.0,
            "valore_vendita_totale": 0.0,
            "differenza_peso_totale": 0.0,
            "differenza_valore_totale": 0.0,
            "dettaglio_animali": [],
            "riepilogo_proprieta": {},
            "riepilogo_soccida": {},
            "riepilogo_per_partita": [],
        }

    # Precarica tutte le partite di ingresso per gli animali coinvolti (VENDUTI)
    animale_ids = {entry.animale_id for entry in uscita_entries}
    ingressi_entries = (
        db.query(PartitaAnimaleAnimale)
        .join(PartitaAnimaleAnimale.partita)
        .filter(
            PartitaAnimaleAnimale.animale_id.in_(animale_ids),
            PartitaAnimale.tipo == TipoPartita.INGRESSO,
            PartitaAnimale.deleted_at.is_(None),
        )
        .options(
            joinedload(PartitaAnimaleAnimale.partita)
            .joinedload(PartitaAnimale.fattura_amministrazione),
        )
        .all()
    )

    ingressi_per_animale: Dict[int, List[PartitaAnimaleAnimale]] = defaultdict(list)
    for record in ingressi_entries:
        ingressi_per_animale[record.animale_id].append(record)

    for records in ingressi_per_animale.values():
        records.sort(key=lambda rec: rec.partita.data or date.min)

    # Precarica contratti
    contratti_ids = {
        entry.animale.contratto_soccida_id
        for entry in uscita_entries
        if entry.animale.contratto_soccida_id
    }
    contratti_map = {}
    if contratti_ids:
        contratti = (
            db.query(ContrattoSoccida)
            .filter(ContrattoSoccida.id.in_(contratti_ids))
            .options(joinedload(ContrattoSoccida.soccidante))
            .all()
        )
        contratti_map = {contratto.id: contratto for contratto in contratti}

    peso_cache: Dict[int, Dict[str, Decimal]] = {}

    def get_peso_individuale(partita: PartitaAnimale, auricolare: Optional[str]) -> Optional[Decimal]:
        if not partita or not partita.pesi_individuali or not auricolare:
            return None
        if partita.id not in peso_cache:
            try:
                data = json.loads(partita.pesi_individuali)
                peso_cache[partita.id] = {
                    item.get("auricolare"): to_decimal(item.get("peso"))
                    for item in data
                    if item.get("auricolare") is not None and item.get("peso") is not None
                }
            except Exception:
                peso_cache[partita.id] = {}
        return peso_cache[partita.id].get(auricolare)

    def get_peso(record: Optional[PartitaAnimaleAnimale], animale: Animale, fallback_attr: str) -> Decimal:
        if not record:
            return Decimal(0)
        if record.peso is not None:
            return to_decimal(record.peso)
        partita = record.partita
        peso = get_peso_individuale(partita, animale.auricolare)
        if peso is not None:
            return peso
        if partita and partita.peso_medio is not None:
            return to_decimal(partita.peso_medio)
        fallback_value = getattr(animale, fallback_attr, None)
        return to_decimal(fallback_value)

    def get_partita_ingresso_pair(animale_id: int) -> Tuple[Optional[PartitaAnimaleAnimale], Optional[PartitaAnimaleAnimale]]:
        records = ingressi_per_animale.get(animale_id)
        if not records:
            return None, None
        return records[0], records[-1]

    # Contenitori per risultati
    animali_proprieta_entries: List[Tuple[Animale, PartitaAnimaleAnimale]] = []
    animali_per_contratto: Dict[int, List[Tuple[Animale, PartitaAnimaleAnimale]]] = defaultdict(list)
    dettaglio_animali = []
    dettaglio_proprieta = []
    dettaglio_soccida = []

    for entry in uscita_entries:
        animale = entry.animale
        if animale.contratto_soccida_id:
            animali_per_contratto[animale.contratto_soccida_id].append((animale, entry))
        else:
            animali_proprieta_entries.append((animale, entry))

    totale_peso_arrivo_proprieta = Decimal(0)
    totale_valore_acquisto_proprieta = Decimal(0)
    totale_peso_uscita_proprieta = Decimal(0)
    totale_valore_vendita_proprieta = Decimal(0)

    def get_valore_da_partita(partita: PartitaAnimale, per_capo: bool = True) -> Decimal:
        if not partita:
            return Decimal(0)
        if partita.valore_totale:
            valore_totale = to_decimal(partita.valore_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        fattura = partita.fattura_amministrazione
        if fattura and getattr(fattura, "importo_totale", None):
            valore_totale = to_decimal(fattura.importo_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        return Decimal(0)

    # --- Animali di proprietà ---
    for animale, uscita_record in animali_proprieta_entries:
        ingresso_originale, ingresso_recente = get_partita_ingresso_pair(animale.id)
        if not ingresso_recente:
            continue

        peso_arrivo = get_peso(ingresso_recente, animale, "peso_arrivo")
        peso_arrivo_originale = get_peso(ingresso_originale, animale, "peso_arrivo") if ingresso_originale else peso_arrivo
        peso_uscita = get_peso(uscita_record, animale, "peso_attuale")
        peso_uscita_originale = peso_uscita

        valore_acquisto = Decimal(0)
        if ingresso_recente and ingresso_recente.partita:
            valore_acquisto = get_valore_da_partita(ingresso_recente.partita, per_capo=True)

        valore_vendita = Decimal(0)
        if uscita_record and uscita_record.partita:
            valore_vendita = get_valore_da_partita(uscita_record.partita, per_capo=True)

        totale_peso_arrivo_proprieta += peso_arrivo
        totale_valore_acquisto_proprieta += valore_acquisto
        totale_peso_uscita_proprieta += peso_uscita
        totale_valore_vendita_proprieta += valore_vendita

        data_arrivo_originale = ingresso_originale.partita.data if ingresso_originale and ingresso_originale.partita.data else animale.data_arrivo
        azienda_provenienza_originale = ingresso_originale.partita.nome_stalla if ingresso_originale and ingresso_originale.partita.nome_stalla else ingresso_originale.partita.codice_stalla if ingresso_originale and ingresso_originale.partita.codice_stalla else animale.codice_provenienza
        azienda_provenienza = ingresso_recente.partita.nome_stalla if ingresso_recente and ingresso_recente.partita.nome_stalla else animale.codice_provenienza
        azienda_destinazione = uscita_record.partita.nome_stalla if uscita_record.partita and uscita_record.partita.nome_stalla else animale.codice_azienda_destinazione

        data_uscita_animale = (
            uscita_record.partita.data.isoformat()
            if uscita_record.partita and uscita_record.partita.data
            else animale.data_uscita.isoformat() if animale.data_uscita else date_end.isoformat()
        )

        dettaglio_proprieta.append({
            "auricolare": animale.auricolare,
            "peso_arrivo": round(float(peso_arrivo), 2),
            "peso_uscita": round(float(peso_uscita), 2),
            "valore_acquisto": round(float(valore_acquisto), 2),
            "valore_vendita": round(float(valore_vendita), 2),
            "differenza_peso": round(float(peso_uscita - peso_arrivo), 2),
            "differenza_valore": round(float(valore_vendita - valore_acquisto), 2),
        })

        partita_ingresso_originale_id = ingresso_originale.partita_animale_id if ingresso_originale else None
        numero_capi_partita_originale = ingresso_originale.partita.numero_capi if ingresso_originale and ingresso_originale.partita else None

        dettaglio_animali.append({
            "auricolare": animale.auricolare,
            "data_arrivo": animale.data_arrivo.isoformat() if animale.data_arrivo else None,
            "azienda_provenienza": azienda_provenienza or "N/A",
            "azienda_provenienza_originale": azienda_provenienza_originale or "N/A",
            "data_arrivo_originale": data_arrivo_originale.isoformat() if data_arrivo_originale else None,
            "peso_arrivo_originale": round(float(peso_arrivo_originale), 2),
            "peso_arrivo": round(float(peso_arrivo), 2),
            "data_uscita": data_uscita_animale,
            "peso_uscita_originale": round(float(peso_uscita_originale), 2),
            "peso_uscita": round(float(peso_uscita), 2),
            "azienda_destinazione": azienda_destinazione or "N/A",
            "tipo": "proprieta",
            "partita_ingresso_originale_id": partita_ingresso_originale_id,
            "numero_capi_partita_originale": numero_capi_partita_originale,
        })

    # --- Animali in soccida ---
    totale_peso_arrivo_soccida = Decimal(0)
    totale_peso_uscita_soccida = Decimal(0)
    totale_differenza_peso_soccida = Decimal(0)
    totale_valore_soccida = Decimal(0)

    # ========== CALCOLO DECESSI PER PARTITA (GLOBALE) ==========
    # Calcola animali deceduti per partita di ingresso per TUTTI i contratti
    animali_deceduti_per_partita_ingresso_globale = defaultdict(int)

    # Query per recuperare TUTTI i decessi
    decessi_query = (
        db.query(Decesso)
        .join(Animale, Decesso.animale_id == Animale.id)
        .filter(
            Animale.deleted_at.is_(None),
            Animale.stato == 'deceduto',
            Decesso.animale_id.isnot(None)
        )
    )

    if contratto_soccida_id:
        decessi_query = decessi_query.filter(Animale.contratto_soccida_id == contratto_soccida_id)
    elif azienda_id:
        decessi_query = decessi_query.filter(Animale.azienda_id == azienda_id)

    decessi_list_globale = decessi_query.all()

    # === FIX START: Recupero partite ingresso per animali deceduti ===
    # Siccome i deceduti non sono in 'uscita_entries', non abbiamo caricato le loro partite di ingresso.
    # Dobbiamo farlo ora per sapere a quale partita appartenevano e spalmare gli acconti.
    ids_animali_deceduti = [d.animale_id for d in decessi_list_globale]
    map_ingressi_decessi = {}

    if ids_animali_deceduti:
        ingressi_decessi = (
            db.query(PartitaAnimaleAnimale)
            .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
            .filter(
                PartitaAnimaleAnimale.animale_id.in_(ids_animali_deceduti),
                PartitaAnimale.tipo == TipoPartita.INGRESSO,
                PartitaAnimale.deleted_at.is_(None)
            )
            .all()
        )
        # Mappa animale_id -> partita_animale_id
        for rec in ingressi_decessi:
            if rec.animale_id not in map_ingressi_decessi:
                map_ingressi_decessi[rec.animale_id] = rec.partita_animale_id

    # Per ogni decesso, trova la partita di ingresso originale
    for decesso in decessi_list_globale:
        animale_id = decesso.animale_id
        
        # 1. Cerca nella mappa specifica dei decessi caricata ora
        partita_ingresso_id = map_ingressi_decessi.get(animale_id)
        
        # 2. Fallback su ingressi_per_animale (nel caso l'animale fosse sia venduto che segnato morto per errore)
        if not partita_ingresso_id:
            ingressi_animale = ingressi_per_animale.get(animale_id, [])
            if ingressi_animale:
                partita_ingresso_id = ingressi_animale[0].partita_animale_id
        
        if partita_ingresso_id:
            animali_deceduti_per_partita_ingresso_globale[partita_ingresso_id] += 1
    # === FIX END ===

    for contratto_id, entries in animali_per_contratto.items():
        contratto = contratti_map.get(contratto_id)
        if not contratto:
            continue

        peso_arrivo_contratto = Decimal(0)
        peso_uscita_contratto = Decimal(0)
        dettaglio_contratto = []

        for animale, uscita_record in entries:
            ingresso_originale, ingresso_recente = get_partita_ingresso_pair(animale.id)
            if not ingresso_originale:
                continue

            peso_arrivo_originale = get_peso(ingresso_originale, animale, "peso_arrivo")
            peso_arrivo = peso_arrivo_originale
            if contratto.percentuale_aggiunta_arrivo:
                peso_arrivo = peso_arrivo_originale * (Decimal(1) + to_decimal(contratto.percentuale_aggiunta_arrivo) / 100)

            peso_uscita_originale = get_peso(uscita_record, animale, "peso_attuale")
            peso_uscita = peso_uscita_originale
            if contratto.percentuale_sottrazione_uscita:
                peso_uscita = peso_uscita_originale * (Decimal(1) - to_decimal(contratto.percentuale_sottrazione_uscita) / 100)

            differenza_peso = peso_uscita - peso_arrivo

            peso_arrivo_contratto += peso_arrivo
            peso_uscita_contratto += peso_uscita

            data_arrivo_originale = ingresso_originale.partita.data if ingresso_originale.partita and ingresso_originale.partita.data else animale.data_arrivo
            azienda_provenienza_originale = ingresso_originale.partita.nome_stalla if ingresso_originale.partita and ingresso_originale.partita.nome_stalla else ingresso_originale.partita.codice_stalla if ingresso_originale.partita and ingresso_originale.partita.codice_stalla else animale.codice_provenienza
            azienda_provenienza = ingresso_recente.partita.nome_stalla if ingresso_recente and ingresso_recente.partita.nome_stalla else animale.codice_provenienza
            azienda_destinazione = uscita_record.partita.nome_stalla if uscita_record.partita and uscita_record.partita.nome_stalla else animale.codice_azienda_destinazione
            data_uscita_animale = (
                uscita_record.partita.data.isoformat()
                if uscita_record.partita and uscita_record.partita.data
                else animale.data_uscita.isoformat() if animale.data_uscita else date_end.isoformat()
            )

            dettaglio_contratto.append({
                "auricolare": animale.auricolare,
                "peso_arrivo_originale": round(float(peso_arrivo_originale), 2),
                "peso_arrivo": round(float(peso_arrivo), 2),
                "peso_uscita_originale": round(float(peso_uscita_originale), 2),
                "peso_uscita": round(float(peso_uscita), 2),
                "differenza_peso": round(float(differenza_peso), 2),
                "data_arrivo_originale": data_arrivo_originale.isoformat() if data_arrivo_originale else None,
                "azienda_provenienza_originale": azienda_provenienza_originale or "N/A",
                "azienda_provenienza": azienda_provenienza or "N/A",
                "data_uscita": data_uscita_animale,
                "azienda_destinazione": azienda_destinazione or "N/A",
            })

            partita_ingresso_originale_id = ingresso_originale.partita_animale_id if ingresso_originale else None
            numero_capi_partita_originale = ingresso_originale.partita.numero_capi if ingresso_originale and ingresso_originale.partita else None

            dettaglio_animali.append({
                "auricolare": animale.auricolare,
                "data_arrivo": animale.data_arrivo.isoformat() if animale.data_arrivo else None,
                "azienda_provenienza": azienda_provenienza or "N/A",
                "azienda_provenienza_originale": azienda_provenienza_originale or "N/A",
                "data_arrivo_originale": data_arrivo_originale.isoformat() if data_arrivo_originale else None,
                "peso_arrivo_originale": round(float(peso_arrivo_originale), 2),
                "peso_arrivo": round(float(peso_arrivo), 2),
                "data_uscita": data_uscita_animale,
                "peso_uscita_originale": round(float(peso_uscita_originale), 2),
                "peso_uscita": round(float(peso_uscita), 2),
                "azienda_destinazione": azienda_destinazione or "N/A",
                "tipo": "soccida",
                "contratto_id": contratto_id,
                "partita_ingresso_originale_id": partita_ingresso_originale_id,
                "numero_capi_partita_originale": numero_capi_partita_originale,
            })

        peso_arrivo_originale_contratto = sum(to_decimal(item.get("peso_arrivo_originale", 0)) for item in dettaglio_contratto)
        peso_uscita_originale_contratto = sum(to_decimal(item.get("peso_uscita_originale", 0)) for item in dettaglio_contratto)
        differenza_peso_contratto = peso_uscita_contratto - peso_arrivo_contratto
        valore_contratto = Decimal(0)

        date_arrivo = [animale.data_arrivo for animale, _ in entries if animale.data_arrivo]
        giorni_gestione = 0
        if date_arrivo:
            giorni_gestione = (date_end - min(date_arrivo)).days
            if giorni_gestione < 0:
                giorni_gestione = 0

        prezzo_vendita_medio = Decimal(0)
        if differenza_peso_contratto > 0:
            for animale, uscita_record in entries:
                partita = uscita_record.partita
                if not partita:
                    continue
                if partita.peso_totale and partita.valore_totale:
                    prezzo_vendita_medio = to_decimal(partita.valore_totale) / to_decimal(partita.peso_totale)
                    break
                if partita.numero_capi and partita.valore_totale and partita.peso_medio:
                    prezzo_vendita_medio = (to_decimal(partita.valore_totale) / partita.numero_capi) / to_decimal(partita.peso_medio)
                    break
        if prezzo_vendita_medio == 0 and contratto.prezzo_per_kg:
            prezzo_vendita_medio = to_decimal(contratto.prezzo_per_kg)

        # Modalità remunerazione
        if contratto.modalita_remunerazione == 'prezzo_kg' and contratto.prezzo_per_kg:
            valore_contratto = differenza_peso_contratto * to_decimal(contratto.prezzo_per_kg)
        elif contratto.modalita_remunerazione == 'quota_giornaliera' and contratto.quota_giornaliera:
            valore_contratto = to_decimal(contratto.quota_giornaliera) * len(entries) * giorni_gestione
        elif contratto.modalita_remunerazione == 'percentuale' and contratto.percentuale_remunerazione:
            if prezzo_vendita_medio > 0 and differenza_peso_contratto > 0:
                valore_totale = differenza_peso_contratto * prezzo_vendita_medio
                valore_contratto = valore_totale * to_decimal(contratto.percentuale_remunerazione) / 100
        elif contratto.modalita_remunerazione == 'ripartizione_utili':
            if prezzo_vendita_medio > 0 and differenza_peso_contratto > 0:
                valore_totale = differenza_peso_contratto * prezzo_vendita_medio
                if contratto.percentuale_soccidante:
                    percentuale_soccidario = Decimal(100) - to_decimal(contratto.percentuale_soccidante)
                elif contratto.percentuale_riparto_base:
                    percentuale_soccidario = to_decimal(contratto.percentuale_riparto_base)
                else:
                    percentuale_soccidario = Decimal(50)
                valore_contratto = valore_totale * percentuale_soccidario / 100

        if (
            contratto.bonus_incremento_attivo
            and contratto.bonus_incremento_kg_soglia
            and contratto.bonus_incremento_percentuale
            and len(entries) > 0
        ):
            peso_medio_per_capo = differenza_peso_contratto / len(entries)
            soglia = to_decimal(contratto.bonus_incremento_kg_soglia)
            if peso_medio_per_capo > soglia:
                valore_contratto += valore_contratto * to_decimal(contratto.bonus_incremento_percentuale) / 100

        totale_peso_arrivo_soccida += peso_arrivo_contratto
        totale_peso_uscita_soccida += peso_uscita_contratto
        totale_differenza_peso_soccida += differenza_peso_contratto
        totale_valore_soccida += valore_contratto

        movimenti_finanziari = None
        if tipo_gestione_acconti != 'nessuno':
            # Raccogli le partite di ingresso degli animali usciti per questo contratto
            partite_ingresso_animali_usciti = set()
            animali_usciti_per_partita_ingresso = defaultdict(int)

            for animale, uscita_record in entries:
                ingressi_animale = ingressi_per_animale.get(animale.id, [])
                for ingresso in ingressi_animale:
                    partita_ingresso_id = ingresso.partita_animale_id
                    partite_ingresso_animali_usciti.add(partita_ingresso_id)
                    animali_usciti_per_partita_ingresso[partita_ingresso_id] += 1

            # Filtra i decessi relativi alle partite di questo contratto usando il conteggio globale corretto
            animali_deceduti_per_partita_contratto = {
                pid: animali_deceduti_per_partita_ingresso_globale.get(pid, 0)
                for pid in partite_ingresso_animali_usciti
            }

            movimenti_finanziari = calculate_movimenti_finanziari_per_contratto(
                db=db,
                contratto_id=contratto_id,
                tipo_gestione=tipo_gestione_acconti,
                acconto_manuale=acconto_manuale,
                movimenti_pn_ids=movimenti_pn_ids,
                fatture_acconto_selezionate=fatture_acconto_selezionate,
                partite_ingresso_animali_usciti=list(partite_ingresso_animali_usciti),
                animali_usciti_per_partita=dict(animali_usciti_per_partita_ingresso),
                animali_deceduti_per_partita=animali_deceduti_per_partita_contratto,
                data_inizio=data_inizio,
                data_fine=data_fine,
            )
        else:
            movimenti_finanziari = {
                "acconti_totali": Decimal(0),
                "fatture_acconto": [],
                "fattura_saldo": None,
                "totale_fatture": Decimal(0),
                "acconto_per_capo_per_partita": {},
                "acconti_per_partita": {},
            }

        dettaglio_contratto_dict = {
            "contratto_id": contratto_id,
            "numero_contratto": contratto.numero_contratto,
            "soccidante": contratto.soccidante.nome if contratto.soccidante else "N/A",
            "modalita_remunerazione": contratto.modalita_remunerazione,
            "prezzo_per_kg": round(float(contratto.prezzo_per_kg), 2) if contratto.prezzo_per_kg else None,
            "quota_giornaliera": round(float(contratto.quota_giornaliera), 2) if contratto.quota_giornaliera else None,
            "percentuale_remunerazione": round(float(contratto.percentuale_remunerazione), 2) if contratto.percentuale_remunerazione else None,
            "percentuale_soccidante": float(contratto.percentuale_soccidante) if contratto.percentuale_soccidante else None,
            "percentuale_riparto_base": round(float(contratto.percentuale_riparto_base), 2) if contratto.percentuale_riparto_base else None,
            "percentuale_aggiunta_arrivo": round(float(contratto.percentuale_aggiunta_arrivo), 2) if contratto.percentuale_aggiunta_arrivo else None,
            "percentuale_sottrazione_uscita": round(float(contratto.percentuale_sottrazione_uscita), 2) if contratto.percentuale_sottrazione_uscita else None,
            "giorni_gestione": giorni_gestione,
            "numero_capi": len(entries),
            "peso_arrivo_originale_totale": round(float(peso_arrivo_originale_contratto), 2),
            "peso_arrivo_totale": round(float(peso_arrivo_contratto), 2),   
            "peso_uscita_originale_totale": round(float(peso_uscita_originale_contratto), 2),
            "peso_uscita_totale": round(float(peso_uscita_contratto), 2),
            "differenza_peso_totale": round(float(differenza_peso_contratto), 2),
            "valore_totale": round(float(valore_contratto), 2),
            "animali": dettaglio_contratto,
        }

        if contratto.monetizzata:
            dettaglio_contratto_dict["acconti_ricevuti"] = {
                "totale_acconti": movimenti_finanziari["acconti_totali"],
                "acconto_per_capo_per_partita": movimenti_finanziari["acconto_per_capo_per_partita"],
                "acconti_per_partita": movimenti_finanziari.get("acconti_per_partita", {}),
                "saldo_finale": float(valore_contratto) - float(movimenti_finanziari["acconti_totali"]),
            }
        else:
            dettaglio_contratto_dict["fatture_emesse"] = {
                "fatture_acconto": movimenti_finanziari["fatture_acconto"],
                "fattura_saldo": movimenti_finanziari["fattura_saldo"],
                "totale_fatture": movimenti_finanziari["totale_fatture"],
                "verifica_coerenza": abs(float(movimenti_finanziari["totale_fatture"]) - float(valore_contratto)) < 0.01,
            }

        if contratto.modalita_remunerazione == 'ripartizione_utili':
            kg_accrescimento_totale = round(float(differenza_peso_contratto), 2)
            prezzo_medio = round(float(prezzo_vendita_medio), 2) if prezzo_vendita_medio > 0 else (round(float(contratto.prezzo_per_kg), 2) if contratto.prezzo_per_kg else 0.0)
            valore_totale = kg_accrescimento_totale * prezzo_medio
            quota_soccidante = round(float(contratto.percentuale_soccidante), 2) if contratto.percentuale_soccidante else 0.0
            quota_soccidario = round(100.0 - quota_soccidante, 2) if quota_soccidante > 0 else (round(float(contratto.percentuale_riparto_base), 2) if contratto.percentuale_riparto_base else 50.0)

            dettaglio_contratto_dict["ripartizione_utili"] = {
                "kg_accrescimento_totale": kg_accrescimento_totale,
                "valore_totale": valore_totale,
                "quota_soccidario": quota_soccidario,
                "scenario": contratto.scenario_ripartizione,
            }

            if contratto.scenario_ripartizione == 'vendita_diretta':
                fattura_vendita = (
                    db.query(FatturaAmministrazione)
                    .filter(
                        FatturaAmministrazione.contratto_soccida_id == contratto_id,
                        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
                        FatturaAmministrazione.deleted_at.is_(None),
                    )
                    .order_by(FatturaAmministrazione.data_fattura.desc())
                    .first()
                )

                if fattura_vendita:
                    dettaglio_contratto_dict["ripartizione_utili"]["fattura_emessa"] = {
                        "id": fattura_vendita.id,
                        "numero": fattura_vendita.numero,
                        "data": fattura_vendita.data_fattura.isoformat() if fattura_vendita.data_fattura else None,
                        "importo": round(float(to_decimal(fattura_vendita.importo_netto or fattura_vendita.importo_totale)), 2),
                    }
                    if fattura_vendita.data_incasso:
                        dettaglio_contratto_dict["ripartizione_utili"]["incasso_ricevuto"] = {
                            "data": fattura_vendita.data_incasso.isoformat(),
                            "importo": round(float(to_decimal(fattura_vendita.importo_incassato or fattura_vendita.importo_netto or fattura_vendita.importo_totale)), 2),
                        }

            elif contratto.scenario_ripartizione == 'diventano_proprieta':
                partite_contratto = (
                    db.query(PartitaAnimale)
                    .filter(
                        PartitaAnimale.contratto_soccida_id == contratto_id,
                        PartitaAnimale.deleted_at.is_(None),
                    )
                    .all()
                )
                partite_cambio = [
                    {
                        "id": p.id,
                        "numero_partita": p.numero_partita,
                        "numero_capi": p.numero_capi,
                        "data": p.data.isoformat() if p.data else None,
                    }
                    for p in partite_contratto
                    if p.modalita_gestione == ModalitaGestionePartita.PROPRIETA
                ]
                if partite_cambio:
                    dettaglio_contratto_dict["ripartizione_utili"]["capi_diventati_proprieta"] = partite_cambio

        dettaglio_soccida.append(dettaglio_contratto_dict)

    totale_capi = len(uscita_entries)
    totale_peso_arrivo = round(float(totale_peso_arrivo_proprieta + totale_peso_arrivo_soccida), 2)
    totale_peso_uscita = round(float(totale_peso_uscita_proprieta + totale_peso_uscita_soccida), 2)
    totale_differenza_peso = round(float(totale_peso_uscita - totale_peso_arrivo), 2)
    totale_differenza_valore = round(float(totale_valore_vendita_proprieta - totale_valore_acquisto_proprieta), 2)

    # ========== CALCOLO DECESSI PER REPORT (DETTAGLIATO) ==========
    partite_ingresso_ids = set()
    for entry in uscita_entries:
        animale = entry.animale
        ingressi = ingressi_per_animale.get(animale.id, [])
        if ingressi:
            partita_ingresso_id = ingressi[0].partita_animale_id
            partite_ingresso_ids.add(partita_ingresso_id)

    decessi_da_includere = []
    totale_valore_decessi_a_carico = Decimal(0)
    totale_pagamenti_ricevuti = Decimal(0)

    for partita_ingresso_id in partite_ingresso_ids:
        partita_ingresso = db.query(PartitaAnimale).filter(PartitaAnimale.id == partita_ingresso_id).first()
        if not partita_ingresso:
            continue

        animali_ingresso = (
            db.query(PartitaAnimaleAnimale)
            .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
            .all()
        )
        numero_arrivi = len(animali_ingresso)

        animali_ingresso_ids = {a.animale_id for a in animali_ingresso}
        animali_usciti = [entry for entry in uscita_entries if entry.animale_id in animali_ingresso_ids]
        numero_usciti = len(animali_usciti)

        animali_deceduti = (
            db.query(Decesso)
            .join(Animale, Decesso.animale_id == Animale.id)
            .filter(
                Animale.id.in_(animali_ingresso_ids),
                Animale.stato == 'deceduto',
                Animale.deleted_at.is_(None),
                Decesso.animale_id.isnot(None)
            )
            .options(joinedload(Decesso.animale))
            .all()
        )
        numero_decessi = len(animali_deceduti)

        # Se tutti i capi sono contabilizzati (usciti + morti = arrivati), includi i morti
        if numero_arrivi - numero_decessi - numero_usciti == 0:
            for decesso in animali_deceduti:
                animale = decesso.animale
                
                # Cerchiamo i dati di ingresso (usando la mappa o ingressi_per_animale o query diretta se serve)
                # Qui usiamo un approccio difensivo per il dettaglio
                peso_arrivo = to_decimal(animale.peso_arrivo)
                azienda_provenienza = animale.codice_provenienza or "N/A"
                data_arrivo = animale.data_arrivo

                # Tentativo di recuperare dati più precisi dalla partita
                if partita_ingresso:
                    if partita_ingresso.data:
                        data_arrivo = partita_ingresso.data
                    if partita_ingresso.nome_stalla:
                        azienda_provenienza = partita_ingresso.nome_stalla

                data_decesso = decesso.data_ora.date() if hasattr(decesso.data_ora, 'date') else date.today()
                giorni_da_arrivo = (data_decesso - data_arrivo).days if data_arrivo else 0
                valore_capo = to_decimal(decesso.valore_capo) if decesso.valore_capo else Decimal(0)

                if animale.contratto_soccida_id is None:
                    a_carico = True
                else:
                    a_carico = decesso.responsabile == 'soccidario'

                if a_carico:
                    totale_valore_decessi_a_carico += valore_capo

                decessi_da_includere.append({
                    "auricolare": animale.auricolare or "N/A",
                    "data_arrivo": data_arrivo.isoformat() if data_arrivo else None,
                    "azienda_provenienza": azienda_provenienza,
                    "peso_arrivo": round(float(peso_arrivo), 2),
                    "data_decesso": data_decesso.isoformat(),
                    "giorni_da_arrivo": giorni_da_arrivo,
                    "valore_capo": round(float(valore_capo), 2),
                    "responsabile": decesso.responsabile or 'soccidario',
                    "a_carico": a_carico,
                    "causa": decesso.causa or None,
                })

    fatture_uscita_ids = set()
    for entry in uscita_entries:
        partita_uscita = entry.partita
        if partita_uscita and partita_uscita.fattura_amministrazione_id:
            fatture_uscita_ids.add(partita_uscita.fattura_amministrazione_id)

    if fatture_uscita_ids:
        pagamenti = (
            db.query(Pagamento)
            .filter(
                Pagamento.fattura_amministrazione_id.in_(fatture_uscita_ids),
                Pagamento.tipo == 'entrata',
                Pagamento.deleted_at.is_(None)
            )
            .all()
        )
        for pagamento in pagamenti:
            totale_pagamenti_ricevuti += to_decimal(pagamento.importo)

    totale_differenza_valore = totale_valore_vendita_proprieta - totale_valore_acquisto_proprieta - totale_valore_decessi_a_carico - totale_pagamenti_ricevuti

    ha_acconti = tipo_gestione_acconti != 'nessuno'
    gestione_acconti_info = {
        "tipo": tipo_gestione_acconti or 'nessuno',
        "importo_totale": 0.0,
        "dettaglio": None,
    }

    if ha_acconti and dettaglio_soccida:
        totale_acconti_report = Decimal(0)
        for dettaglio_contratto in dettaglio_soccida:
            contratto_id_temp = dettaglio_contratto.get('contratto_id')
            if contratto_id_temp:
                contratto_temp = db.query(ContrattoSoccida).filter(
                    ContrattoSoccida.id == contratto_id_temp,
                    ContrattoSoccida.deleted_at.is_(None),
                ).first()
                if contratto_temp:
                    if contratto_temp.monetizzata and 'acconti_ricevuti' in dettaglio_contratto:
                        totale_acconti_report += to_decimal(dettaglio_contratto['acconti_ricevuti'].get('totale_acconti', 0))
                    elif not contratto_temp.monetizzata and 'fatture_emesse' in dettaglio_contratto:
                        totale_acconti_report += to_decimal(dettaglio_contratto['fatture_emesse'].get('totale_fatture', 0))

        gestione_acconti_info["importo_totale"] = float(totale_acconti_report)

        if tipo_gestione_acconti == 'movimenti_interi' and movimenti_pn_ids:
            gestione_acconti_info["dettaglio"] = {"movimenti_selezionati": movimenti_pn_ids}
        elif tipo_gestione_acconti == 'fatture_soccida' and fatture_acconto_selezionate:
            gestione_acconti_info["dettaglio"] = {
                "fatture_selezionate": [
                    {"fattura_id": f.get('fattura_id'), "importo_utilizzato": f.get('importo_utilizzato')}
                    for f in fatture_acconto_selezionate
                ],
            }
        elif tipo_gestione_acconti == 'manuale' and acconto_manuale is not None:
            gestione_acconti_info["dettaglio"] = {"acconto_manuale": float(acconto_manuale)}

    # ========== RIEPILOGO PER PARTITA DI INGRESSO (stessa struttura per ogni partita) ==========
    riepilogo_per_partita: List[Dict] = []
    if include_riepilogo_per_partita and partite_ingresso_ids:
        # Mappa acconto percepito per partita (da dettaglio_soccida)
        acconto_per_partita_id: Dict[int, float] = {}
        for det in dettaglio_soccida:
            acconti = det.get("acconti_ricevuti") or {}
            for pid, pdata in (acconti.get("acconti_per_partita") or {}).items():
                tot = pdata.get("totale") or 0
                acconto_per_partita_id[pid] = acconto_per_partita_id.get(pid, 0) + float(to_decimal(tot))

        # Per ogni animale uscito (anche fuori periodo) recupera ultima partita uscita e peso
        all_animale_ids_partite = set()
        partita_animale_ids_map: Dict[int, List[int]] = {}  # partita_ingresso_id -> [animale_id]
        for partita_ingresso_id in partite_ingresso_ids:
            entries_p = (
                db.query(PartitaAnimaleAnimale.animale_id)
                .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
                .all()
            )
            ids_p = [e.animale_id for e in entries_p]
            partita_animale_ids_map[partita_ingresso_id] = ids_p
            all_animale_ids_partite.update(ids_p)

        # Ultima partita uscita per animale (per tutti gli animali delle partite)
        uscite_per_animale: Dict[int, Tuple[PartitaAnimaleAnimale, PartitaAnimale]] = {}
        if all_animale_ids_partite:
            subq = (
                db.query(
                    PartitaAnimaleAnimale.animale_id,
                    PartitaAnimaleAnimale.id.label("paa_id"),
                    func.row_number()
                    .over(
                        partition_by=PartitaAnimaleAnimale.animale_id,
                        order_by=PartitaAnimale.data.desc(),
                    )
                    .label("rn"),
                )
                .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
                .filter(
                    PartitaAnimaleAnimale.animale_id.in_(all_animale_ids_partite),
                    PartitaAnimale.tipo == TipoPartita.USCITA,
                    PartitaAnimale.deleted_at.is_(None),
                )
            )
            subq = subq.subquery()
            last_uscita_ids = db.query(subq.c.paa_id).filter(subq.c.rn == 1).all()
            last_uscita_ids = [r[0] for r in last_uscita_ids]
            if last_uscita_ids:
                last_uscita_entries = (
                    db.query(PartitaAnimaleAnimale)
                    .filter(PartitaAnimaleAnimale.id.in_(last_uscita_ids))
                    .options(
                        joinedload(PartitaAnimaleAnimale.partita).joinedload(PartitaAnimale.fattura_amministrazione),
                        joinedload(PartitaAnimaleAnimale.animale),
                    )
                    .all()
                )
                for entry in last_uscita_entries:
                    uscite_per_animale[entry.animale_id] = (entry, entry.partita)

        # Ordine partite: per data arrivo, poi id
        partite_objs_ord = (
            db.query(PartitaAnimale)
            .filter(PartitaAnimale.id.in_(partite_ingresso_ids))
            .options(joinedload(PartitaAnimale.fattura_amministrazione))
            .all()
        )
        partite_data_map = {p.id: (p.data or date.min) for p in partite_objs_ord}
        partita_by_id = {p.id: p for p in partite_objs_ord}
        partite_ingresso_ord = sorted(
            partite_ingresso_ids,
            key=lambda pid: (partite_data_map.get(pid, date.min), pid),
        )

        for partita_ingresso_id in partite_ingresso_ord:
            partita = partita_by_id.get(partita_ingresso_id)
            if not partita:
                continue

            entries_ing = (
                db.query(PartitaAnimaleAnimale)
                .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
                .options(joinedload(PartitaAnimaleAnimale.animale))
                .all()
            )

            auricolari_presenti: List[str] = []
            auricolari_usciti: List[str] = []
            auricolari_deceduti: List[str] = []
            peso_arrivo_tot = Decimal(0)
            peso_uscita_tot = Decimal(0)
            valore_ingresso_tot = get_valore_da_partita(partita, per_capo=False)
            valore_uscita_tot = Decimal(0)
            destinazioni_agg: Dict[str, Dict[str, float]] = defaultdict(lambda: {"numero_capi": 0, "peso_totale": 0.0})

            for rec in entries_ing:
                animale = rec.animale
                if not animale or animale.deleted_at:
                    continue
                aur = (animale.auricolare or "N/A").strip()
                peso_arrivo_animale = get_peso(rec, animale, "peso_arrivo")
                # Peso arrivo: solo per capi non deceduti (presenti + usciti)
                if animale.stato != "deceduto":
                    peso_arrivo_tot += peso_arrivo_animale

                if animale.stato == "deceduto":
                    auricolari_deceduti.append(aur)
                elif animale.stato in ("presente",):
                    auricolari_presenti.append(aur)
                else:
                    auricolari_usciti.append(aur)
                    tup = uscite_per_animale.get(animale.id)
                    if tup:
                        entry_uscita, partita_uscita = tup
                        peso_u = get_peso(entry_uscita, animale, "peso_attuale")
                        peso_uscita_tot += peso_u
                        valore_uscita_tot += get_valore_da_partita(partita_uscita, per_capo=True)
                        dest = (partita_uscita.nome_stalla or partita_uscita.codice_stalla or "N/A").strip()
                        destinazioni_agg[dest]["numero_capi"] += 1
                        destinazioni_agg[dest]["peso_totale"] += float(peso_u)

            numero_arrivati = len(entries_ing)
            numero_usciti = len(auricolari_usciti)
            numero_deceduti = len(auricolari_deceduti)
            numero_presenti = len(auricolari_presenti)

            acconto = acconto_per_partita_id.get(partita_ingresso_id, 0.0)

            destinazioni_list = [
                {"destinazione": k, "numero_capi": v["numero_capi"], "peso_totale": round(v["peso_totale"], 2)}
                for k, v in sorted(destinazioni_agg.items())
            ]

            data_arrivo_str = partita.data.isoformat() if partita.data else None
            riepilogo_per_partita.append({
                "partita_id": partita_ingresso_id,
                "numero_partita": partita.numero_partita or f"Partita {partita_ingresso_id}",
                "data_arrivo": data_arrivo_str,
                "codice_stalla": partita.codice_stalla or "N/A",
                "nome_stalla": (partita.nome_stalla or "").strip() or None,
                "numero_capi_arrivati": numero_arrivati,
                "numero_usciti": numero_usciti,
                "numero_deceduti": numero_deceduti,
                "numero_presenti": numero_presenti,
                "auricolari_presenti": sorted(auricolari_presenti),
                "auricolari_usciti": sorted(auricolari_usciti),
                "auricolari_deceduti": sorted(auricolari_deceduti),
                "peso_arrivo_totale": round(float(peso_arrivo_tot), 2),
                "valore_ingresso_totale": round(float(valore_ingresso_tot), 2),
                "acconto_percepito": round(float(acconto), 2),
                "peso_uscita_totale": round(float(peso_uscita_tot), 2),
                "valore_uscita_totale": round(float(valore_uscita_tot), 2),
                "destinazioni": destinazioni_list,
            })

    result = {
        "data_uscita": periodo_label,
        "periodo_label": periodo_label,
        "date_range": {
            "dal": date_start.isoformat() if date_start else None,
            "al": date_end.isoformat() if date_end else None,
        },
        "azienda_id": azienda_id,
        "contratto_soccida_id": contratto_soccida_id,
        "totale_capi": totale_capi,
        "peso_arrivo_totale": round(float(totale_peso_arrivo), 2),
        "valore_acquisto_totale": float(totale_valore_acquisto_proprieta),
        "peso_uscita_totale": round(float(totale_peso_uscita), 2),
        "valore_vendita_totale": round(float(totale_valore_vendita_proprieta), 2),
        "differenza_peso_totale": round(float(totale_differenza_peso), 2),
        "differenza_valore_totale": float(totale_differenza_valore),
        "dettaglio_animali": dettaglio_animali,
        "riepilogo_proprieta": {
            "numero_capi": len(animali_proprieta_entries),
            "peso_arrivo": round(float(totale_peso_arrivo_proprieta), 2),
            "valore_acquisto": float(totale_valore_acquisto_proprieta),
            "peso_uscita": round(float(totale_peso_uscita_proprieta), 2),
            "valore_vendita": round(float(totale_valore_vendita_proprieta), 2),
            "differenza_peso": round(float(totale_peso_uscita_proprieta - totale_peso_arrivo_proprieta), 2),
            "differenza_valore": round(float(totale_differenza_valore), 2),
            "dettaglio": dettaglio_proprieta,
        },
        "riepilogo_soccida": {
            "numero_contratti": len(animali_per_contratto),
            "numero_capi": sum(len(entries) for entries in animali_per_contratto.values()),
            "peso_arrivo": round(float(totale_peso_arrivo_soccida), 2),
            "peso_uscita": round(float(totale_peso_uscita_soccida), 2),
            "differenza_peso": round(float(totale_differenza_peso_soccida), 2),
            "valore_totale": round(float(totale_valore_soccida), 2),
            "dettaglio_contratti": dettaglio_soccida,
        },
        "decessi": {
            "numero_capi": len(decessi_da_includere),
            "valore_totale_a_carico": round(float(totale_valore_decessi_a_carico), 2),
            "pagamenti_ricevuti": round(float(totale_pagamenti_ricevuti), 2),
            "dettaglio": decessi_da_includere,
        },
        "gestione_acconti": gestione_acconti_info,
        "ha_acconti": ha_acconti,
        "riepilogo_per_partita": riepilogo_per_partita,
    }
    return result


def calculate_riepilogo_per_partita_by_ids(
    db: Session,
    partita_ids: List[int],
    azienda_id: Optional[int] = None,
    contratto_soccida_id: Optional[int] = None,
) -> List[Dict]:
    """
    Calcola il riepilogo per partita (stesso formato di riepilogo_per_partita) per le partite
    di ingresso indicate da partita_ids. Usato per il report "per partita / insiemi di partite"
    senza filtro su data di uscita.
    """
    if not partita_ids:
        return []

    partite_ingresso_ids = list(set(partita_ids))
    peso_cache: Dict[int, Dict[str, Decimal]] = {}

    def get_peso_individuale(partita: PartitaAnimale, auricolare: Optional[str]) -> Optional[Decimal]:
        if not partita or not partita.pesi_individuali or not auricolare:
            return None
        if partita.id not in peso_cache:
            try:
                data = json.loads(partita.pesi_individuali)
                peso_cache[partita.id] = {
                    item.get("auricolare"): to_decimal(item.get("peso"))
                    for item in data
                    if item.get("auricolare") is not None and item.get("peso") is not None
                }
            except Exception:
                peso_cache[partita.id] = {}
        return peso_cache[partita.id].get(auricolare)

    def get_peso(record: Optional[PartitaAnimaleAnimale], animale: Animale, fallback_attr: str) -> Decimal:
        if not record:
            return Decimal(0)
        if record.peso is not None:
            return to_decimal(record.peso)
        partita = record.partita
        peso = get_peso_individuale(partita, animale.auricolare)
        if peso is not None:
            return peso
        # Preferire il peso del singolo animale (fallback_attr) rispetto a partita.peso_medio,
        # così il peso uscita è "solo per i capi conteggiati" anche se la partita include capi di altre partite
        fallback_value = getattr(animale, fallback_attr, None)
        if fallback_value is not None:
            return to_decimal(fallback_value)
        if partita and partita.peso_medio is not None:
            return to_decimal(partita.peso_medio)
        return Decimal(0)

    def get_valore_da_partita(partita: Optional[PartitaAnimale], per_capo: bool = True) -> Decimal:
        if not partita:
            return Decimal(0)
        if partita.valore_totale:
            valore_totale = to_decimal(partita.valore_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        fattura = partita.fattura_amministrazione if hasattr(partita, "fattura_amministrazione") else None
        if fattura and getattr(fattura, "importo_totale", None):
            valore_totale = to_decimal(fattura.importo_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        return Decimal(0)

    # Acconto per partita da PartitaMovimentoFinanziario
    acconto_per_partita_id: Dict[int, float] = {}
    movimenti = (
        db.query(PartitaMovimentoFinanziario)
        .filter(
            PartitaMovimentoFinanziario.partita_id.in_(partite_ingresso_ids),
            PartitaMovimentoFinanziario.tipo == PartitaMovimentoTipo.ACCONTO,
            PartitaMovimentoFinanziario.direzione == PartitaMovimentoDirezione.ENTRATA,
            PartitaMovimentoFinanziario.attivo,
        )
        .all()
    )
    for m in movimenti:
        acconto_per_partita_id[m.partita_id] = acconto_per_partita_id.get(m.partita_id, 0) + float(to_decimal(m.importo))

    all_animale_ids_partite = set()
    for partita_ingresso_id in partite_ingresso_ids:
        entries_p = (
            db.query(PartitaAnimaleAnimale.animale_id)
            .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
            .all()
        )
        all_animale_ids_partite.update(e.animale_id for e in entries_p)

    uscite_per_animale: Dict[int, Tuple[PartitaAnimaleAnimale, PartitaAnimale]] = {}
    if all_animale_ids_partite:
        subq = (
            db.query(
                PartitaAnimaleAnimale.animale_id,
                PartitaAnimaleAnimale.id.label("paa_id"),
                func.row_number()
                .over(
                    partition_by=PartitaAnimaleAnimale.animale_id,
                    order_by=PartitaAnimale.data.desc(),
                )
                .label("rn"),
            )
            .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
            .filter(
                PartitaAnimaleAnimale.animale_id.in_(all_animale_ids_partite),
                PartitaAnimale.tipo == TipoPartita.USCITA,
                PartitaAnimale.deleted_at.is_(None),
            )
        )
        subq = subq.subquery()
        last_uscita_ids = [r[0] for r in db.query(subq.c.paa_id).filter(subq.c.rn == 1).all()]
        if last_uscita_ids:
            last_uscita_entries = (
                db.query(PartitaAnimaleAnimale)
                .filter(PartitaAnimaleAnimale.id.in_(last_uscita_ids))
                .options(
                    joinedload(PartitaAnimaleAnimale.partita).joinedload(PartitaAnimale.fattura_amministrazione),
                    joinedload(PartitaAnimaleAnimale.animale),
                )
                .all()
            )
            for entry in last_uscita_entries:
                uscite_per_animale[entry.animale_id] = (entry, entry.partita)

    partite_objs = (
        db.query(PartitaAnimale)
        .filter(PartitaAnimale.id.in_(partite_ingresso_ids))
        .options(joinedload(PartitaAnimale.fattura_amministrazione))
        .all()
    )
    partita_by_id = {p.id: p for p in partite_objs}
    partite_ingresso_ord = sorted(
        partite_ingresso_ids,
        key=lambda pid: (
            (partita_by_id.get(pid).data or date.min) if partita_by_id.get(pid) else date.min,
            pid,
        ),
    )

    riepilogo: List[Dict] = []
    for partita_ingresso_id in partite_ingresso_ord:
        partita = partita_by_id.get(partita_ingresso_id)
        if not partita:
            continue
        entries_ing = (
            db.query(PartitaAnimaleAnimale)
            .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
            .options(joinedload(PartitaAnimaleAnimale.animale))
            .all()
        )
        auricolari_presenti = []
        auricolari_usciti = []
        auricolari_deceduti = []
        peso_arrivo_tot = Decimal(0)
        peso_arrivo_totale_iniziale = Decimal(0)  # tutti i capi (inclusi deceduti)
        peso_deceduti = Decimal(0)
        peso_uscita_tot = Decimal(0)
        valore_ingresso_tot = Decimal(0)
        valore_uscita_tot = Decimal(0)
        destinazioni_agg = defaultdict(lambda: {"numero_capi": 0, "peso_totale": 0.0})

        valore_ingresso_tot = get_valore_da_partita(partita, per_capo=False)

        for rec in entries_ing:
            animale = rec.animale
            if not animale or animale.deleted_at:
                continue
            aur = (animale.auricolare or "N/A").strip()
            peso_arrivo_animale = get_peso(rec, animale, "peso_arrivo")
            peso_arrivo_totale_iniziale += peso_arrivo_animale
            # Peso arrivo: solo per capi non deceduti (presenti + usciti), come da richiesta
            if animale.stato != "deceduto":
                peso_arrivo_tot += peso_arrivo_animale
            if animale.stato == "deceduto":
                auricolari_deceduti.append(aur)
                peso_deceduti += peso_arrivo_animale
            elif animale.stato == "presente":
                auricolari_presenti.append(aur)
            else:
                auricolari_usciti.append(aur)
                tup = uscite_per_animale.get(animale.id)
                if tup:
                    entry_uscita, partita_uscita = tup
                    # Peso uscita: solo del singolo capo conteggiato (record/auricolare/animale), non il totale partita
                    peso_u = get_peso(entry_uscita, animale, "peso_attuale")
                    peso_uscita_tot += peso_u
                    valore_uscita_tot += get_valore_da_partita(partita_uscita, per_capo=True)
                    dest = (partita_uscita.nome_stalla or partita_uscita.codice_stalla or "N/A").strip()
                    destinazioni_agg[dest]["numero_capi"] += 1
                    destinazioni_agg[dest]["peso_totale"] += float(peso_u)

        numero_arrivati = len(entries_ing)
        numero_usciti = len(auricolari_usciti)
        numero_deceduti = len(auricolari_deceduti)
        numero_presenti = len(auricolari_presenti)
        acconto = acconto_per_partita_id.get(partita_ingresso_id, 0.0)
        destinazioni_list = [
            {"destinazione": k, "numero_capi": v["numero_capi"], "peso_totale": round(v["peso_totale"], 2)}
            for k, v in sorted(destinazioni_agg.items())
        ]
        data_arrivo_str = partita.data.isoformat() if partita.data else None
        riepilogo.append({
            "partita_id": partita_ingresso_id,
            "numero_partita": partita.numero_partita or f"Partita {partita_ingresso_id}",
            "data_arrivo": data_arrivo_str,
            "codice_stalla": partita.codice_stalla or "N/A",
            "nome_stalla": (partita.nome_stalla or "").strip() or None,
            "numero_capi_arrivati": numero_arrivati,
            "numero_usciti": numero_usciti,
            "numero_deceduti": numero_deceduti,
            "numero_presenti": numero_presenti,
            "auricolari_presenti": sorted(auricolari_presenti),
            "auricolari_usciti": sorted(auricolari_usciti),
            "auricolari_deceduti": sorted(auricolari_deceduti),
            "peso_arrivo_totale": round(float(peso_arrivo_tot), 2),
            "peso_arrivo_totale_iniziale": round(float(peso_arrivo_totale_iniziale), 2),
            "peso_deceduti": round(float(peso_deceduti), 2),
            "valore_ingresso_totale": round(float(valore_ingresso_tot), 2),
            "acconto_percepito": round(float(acconto), 2),
            "peso_uscita_totale": round(float(peso_uscita_tot), 2),
            "valore_uscita_totale": round(float(valore_uscita_tot), 2),
            "destinazioni": destinazioni_list,
        })

    return riepilogo


def calculate_riepilogo_valore_per_partite_ids(
    db: Session,
    partita_ids: List[int],
    azienda_id: Optional[int] = None,
    contratto_soccida_id: Optional[int] = None,
) -> Dict:
    """
    Calcola il riepilogo del valore (come nel report per data di uscita) per le partite di ingresso
    indicate, usando la tipologia e le proprietà del contratto soccida collegato.
    Restituisce riepilogo_proprieta e riepilogo_soccida con dettaglio_contratti.
    """
    if not partita_ids:
        return {"riepilogo_proprieta": {}, "riepilogo_soccida": {}}

    partite_ingresso_ids = list(set(partita_ids))
    peso_cache: Dict[int, Dict[str, Decimal]] = {}

    def get_peso_individuale(partita: PartitaAnimale, auricolare: Optional[str]) -> Optional[Decimal]:
        if not partita or not partita.pesi_individuali or not auricolare:
            return None
        if partita.id not in peso_cache:
            try:
                data = json.loads(partita.pesi_individuali)
                peso_cache[partita.id] = {
                    item.get("auricolare"): to_decimal(item.get("peso"))
                    for item in data
                    if item.get("auricolare") is not None and item.get("peso") is not None
                }
            except Exception:
                peso_cache[partita.id] = {}
        return peso_cache[partita.id].get(auricolare)

    def get_peso(record: Optional[PartitaAnimaleAnimale], animale: Animale, fallback_attr: str) -> Decimal:
        if not record:
            return Decimal(0)
        if record.peso is not None:
            return to_decimal(record.peso)
        partita = record.partita
        peso = get_peso_individuale(partita, animale.auricolare) if partita and animale else None
        if peso is not None:
            return peso
        # Preferire il peso del singolo animale rispetto a partita.peso_medio (peso uscita = solo capi conteggiati)
        fallback_value = getattr(animale, fallback_attr, None)
        if fallback_value is not None:
            return to_decimal(fallback_value)
        if partita and partita.peso_medio is not None:
            return to_decimal(partita.peso_medio)
        return Decimal(0)

    def get_valore_da_partita(partita: Optional[PartitaAnimale], per_capo: bool = True) -> Decimal:
        if not partita:
            return Decimal(0)
        if partita.valore_totale:
            valore_totale = to_decimal(partita.valore_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        fattura = getattr(partita, "fattura_amministrazione", None)
        if fattura and getattr(fattura, "importo_totale", None):
            valore_totale = to_decimal(fattura.importo_totale)
            if per_capo and partita.numero_capi and partita.numero_capi > 0:
                return valore_totale / partita.numero_capi
            return valore_totale
        return Decimal(0)

    # Carica partite di ingresso con fattura
    partite_objs = (
        db.query(PartitaAnimale)
        .filter(PartitaAnimale.id.in_(partite_ingresso_ids))
        .options(joinedload(PartitaAnimale.fattura_amministrazione))
        .all()
    )
    partita_by_id = {p.id: p for p in partite_objs}

    # Tutti gli animale_id che appartengono alle partite
    all_animale_ids = set()
    for partita_ingresso_id in partite_ingresso_ids:
        for e in db.query(PartitaAnimaleAnimale.animale_id).filter(
            PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id
        ).all():
            all_animale_ids.add(e.animale_id)

    # Ultima uscita per animale
    uscite_per_animale: Dict[int, Tuple[PartitaAnimaleAnimale, PartitaAnimale]] = {}
    if all_animale_ids:
        subq = (
            db.query(
                PartitaAnimaleAnimale.animale_id,
                PartitaAnimaleAnimale.id.label("paa_id"),
                func.row_number()
                .over(
                    partition_by=PartitaAnimaleAnimale.animale_id,
                    order_by=PartitaAnimale.data.desc(),
                )
                .label("rn"),
            )
            .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
            .filter(
                PartitaAnimaleAnimale.animale_id.in_(all_animale_ids),
                PartitaAnimale.tipo == TipoPartita.USCITA,
                PartitaAnimale.deleted_at.is_(None),
            )
        )
        subq = subq.subquery()
        last_uscita_ids = [r[0] for r in db.query(subq.c.paa_id).filter(subq.c.rn == 1).all()]
        if last_uscita_ids:
            last_uscita_entries = (
                db.query(PartitaAnimaleAnimale)
                .filter(PartitaAnimaleAnimale.id.in_(last_uscita_ids))
                .options(
                    joinedload(PartitaAnimaleAnimale.partita).joinedload(PartitaAnimale.fattura_amministrazione),
                    joinedload(PartitaAnimaleAnimale.animale),
                )
                .all()
            )
            for entry in last_uscita_entries:
                uscite_per_animale[entry.animale_id] = (entry, entry.partita)

    # Uscita entries: (animale, uscita_record) per animali usciti che appartengono alle nostre partite
    uscita_entries: List[Tuple[Animale, PartitaAnimaleAnimale]] = []
    ingressi_per_animale: Dict[int, List[PartitaAnimaleAnimale]] = defaultdict(list)

    for partita_ingresso_id in partite_ingresso_ids:
        entries_ing = (
            db.query(PartitaAnimaleAnimale)
            .filter(PartitaAnimaleAnimale.partita_animale_id == partita_ingresso_id)
            .options(
                joinedload(PartitaAnimaleAnimale.animale),
                joinedload(PartitaAnimaleAnimale.partita),
            )
            .all()
        )
        for rec in entries_ing:
            animale = rec.animale
            if not animale or animale.deleted_at:
                continue
            if animale.id not in uscite_per_animale:
                continue
            uscita_entry, _ = uscite_per_animale[animale.id]
            uscita_entries.append((animale, uscita_entry))
            ingressi_per_animale[animale.id].append(rec)

    for animale_id in ingressi_per_animale:
        ingressi_per_animale[animale_id].sort(
            key=lambda r: (r.partita.data if r.partita and r.partita.data else date.min)
        )

    def get_partita_ingresso_pair(animale_id: int) -> Tuple[Optional[PartitaAnimaleAnimale], Optional[PartitaAnimaleAnimale]]:
        recs = ingressi_per_animale.get(animale_id)
        if not recs:
            return None, None
        return recs[0], recs[-1]

    # Split proprietà / soccida
    animali_proprieta_entries: List[Tuple[Animale, PartitaAnimaleAnimale]] = []
    animali_per_contratto: Dict[int, List[Tuple[Animale, PartitaAnimaleAnimale]]] = defaultdict(list)
    for animale, uscita_record in uscita_entries:
        if animale.contratto_soccida_id:
            animali_per_contratto[animale.contratto_soccida_id].append((animale, uscita_record))
        else:
            animali_proprieta_entries.append((animale, uscita_record))

    # --- Riepilogo proprietà ---
    totale_peso_arrivo_proprieta = Decimal(0)
    totale_valore_acquisto_proprieta = Decimal(0)
    totale_peso_uscita_proprieta = Decimal(0)
    totale_valore_vendita_proprieta = Decimal(0)
    for animale, uscita_record in animali_proprieta_entries:
        ingresso_originale, ingresso_recente = get_partita_ingresso_pair(animale.id)
        if not ingresso_recente:
            continue
        peso_arrivo = get_peso(ingresso_recente, animale, "peso_arrivo")
        peso_uscita = get_peso(uscita_record, animale, "peso_attuale")
        valore_acquisto = get_valore_da_partita(ingresso_recente.partita, per_capo=True)
        valore_vendita = get_valore_da_partita(uscita_record.partita, per_capo=True) if uscita_record.partita else Decimal(0)
        totale_peso_arrivo_proprieta += peso_arrivo
        totale_valore_acquisto_proprieta += valore_acquisto
        totale_peso_uscita_proprieta += peso_uscita
        totale_valore_vendita_proprieta += valore_vendita

    riepilogo_proprieta = {
        "numero_capi": len(animali_proprieta_entries),
        "peso_arrivo": round(float(totale_peso_arrivo_proprieta), 2),
        "valore_acquisto": round(float(totale_valore_acquisto_proprieta), 2),
        "peso_uscita": round(float(totale_peso_uscita_proprieta), 2),
        "valore_vendita": round(float(totale_valore_vendita_proprieta), 2),
        "differenza_peso": round(float(totale_peso_uscita_proprieta - totale_peso_arrivo_proprieta), 2),
        "differenza_valore": round(float(totale_valore_vendita_proprieta - totale_valore_acquisto_proprieta), 2),
    }

    # --- Riepilogo soccida (per contratto, con valore come nel report per data) ---
    contratti_ids = list(animali_per_contratto.keys())
    contratti_map = {}
    if contratti_ids:
        contratti_map = {
            c.id: c
            for c in db.query(ContrattoSoccida)
            .filter(ContrattoSoccida.id.in_(contratti_ids))
            .options(joinedload(ContrattoSoccida.soccidante))
            .all()
        }

    totale_peso_arrivo_soccida = Decimal(0)
    totale_peso_uscita_soccida = Decimal(0)
    totale_differenza_peso_soccida = Decimal(0)
    totale_valore_soccida = Decimal(0)
    dettaglio_soccida: List[Dict] = []

    for contratto_id, entries in animali_per_contratto.items():
        contratto = contratti_map.get(contratto_id)
        if not contratto:
            continue

        peso_arrivo_contratto = Decimal(0)
        peso_uscita_contratto = Decimal(0)
        for animale, uscita_record in entries:
            ingresso_originale, ingresso_recente = get_partita_ingresso_pair(animale.id)
            if not ingresso_originale:
                continue
            peso_arrivo_originale = get_peso(ingresso_originale, animale, "peso_arrivo")
            peso_arrivo = peso_arrivo_originale
            if contratto.percentuale_aggiunta_arrivo:
                peso_arrivo = peso_arrivo_originale * (Decimal(1) + to_decimal(contratto.percentuale_aggiunta_arrivo) / 100)
            peso_uscita_originale = get_peso(uscita_record, animale, "peso_attuale")
            peso_uscita = peso_uscita_originale
            if contratto.percentuale_sottrazione_uscita:
                peso_uscita = peso_uscita_originale * (Decimal(1) - to_decimal(contratto.percentuale_sottrazione_uscita) / 100)
            peso_arrivo_contratto += peso_arrivo
            peso_uscita_contratto += peso_uscita

        peso_arrivo_originale_contratto = Decimal(0)
        peso_uscita_originale_contratto = Decimal(0)
        for animale, uscita_record in entries:
            ingresso_originale, _ = get_partita_ingresso_pair(animale.id)
            if not ingresso_originale:
                continue
            peso_arrivo_originale_contratto += get_peso(ingresso_originale, animale, "peso_arrivo")
            peso_uscita_originale_contratto += get_peso(uscita_record, animale, "peso_attuale")

        differenza_peso_contratto = peso_uscita_contratto - peso_arrivo_contratto
        valore_contratto = Decimal(0)

        date_arrivo = [animale.data_arrivo for animale, _ in entries if animale.data_arrivo]
        date_end_contratto = date.today()
        if entries:
            date_uscite = []
            for animale, uscita_record in entries:
                if uscita_record.partita and uscita_record.partita.data:
                    date_uscite.append(uscita_record.partita.data)
            if date_uscite:
                date_end_contratto = max(date_uscite)
        giorni_gestione = 0
        if date_arrivo:
            giorni_gestione = (date_end_contratto - min(date_arrivo)).days
            if giorni_gestione < 0:
                giorni_gestione = 0

        prezzo_vendita_medio = Decimal(0)
        if differenza_peso_contratto > 0:
            for animale, uscita_record in entries:
                partita = uscita_record.partita
                if not partita:
                    continue
                if partita.peso_totale and partita.valore_totale:
                    prezzo_vendita_medio = to_decimal(partita.valore_totale) / to_decimal(partita.peso_totale)
                    break
                if partita.numero_capi and partita.valore_totale and partita.peso_medio:
                    prezzo_vendita_medio = (to_decimal(partita.valore_totale) / partita.numero_capi) / to_decimal(partita.peso_medio)
                    break
        if prezzo_vendita_medio == 0 and contratto.prezzo_per_kg:
            prezzo_vendita_medio = to_decimal(contratto.prezzo_per_kg)

        if contratto.modalita_remunerazione == 'prezzo_kg' and contratto.prezzo_per_kg:
            valore_contratto = differenza_peso_contratto * to_decimal(contratto.prezzo_per_kg)
        elif contratto.modalita_remunerazione == 'quota_giornaliera' and contratto.quota_giornaliera:
            valore_contratto = to_decimal(contratto.quota_giornaliera) * len(entries) * giorni_gestione
        elif contratto.modalita_remunerazione == 'percentuale' and contratto.percentuale_remunerazione:
            if prezzo_vendita_medio > 0 and differenza_peso_contratto > 0:
                valore_totale = differenza_peso_contratto * prezzo_vendita_medio
                valore_contratto = valore_totale * to_decimal(contratto.percentuale_remunerazione) / 100
        elif contratto.modalita_remunerazione == 'ripartizione_utili':
            if prezzo_vendita_medio > 0 and differenza_peso_contratto > 0:
                valore_totale = differenza_peso_contratto * prezzo_vendita_medio
                if contratto.percentuale_soccidante:
                    percentuale_soccidario = Decimal(100) - to_decimal(contratto.percentuale_soccidante)
                elif contratto.percentuale_riparto_base:
                    percentuale_soccidario = to_decimal(contratto.percentuale_riparto_base)
                else:
                    percentuale_soccidario = Decimal(50)
                valore_contratto = valore_totale * percentuale_soccidario / 100

        if (
            contratto.bonus_incremento_attivo
            and contratto.bonus_incremento_kg_soglia
            and contratto.bonus_incremento_percentuale
            and len(entries) > 0
        ):
            peso_medio_per_capo = differenza_peso_contratto / len(entries)
            soglia = to_decimal(contratto.bonus_incremento_kg_soglia)
            if peso_medio_per_capo > soglia:
                valore_contratto += valore_contratto * to_decimal(contratto.bonus_incremento_percentuale) / 100

        totale_peso_arrivo_soccida += peso_arrivo_contratto
        totale_peso_uscita_soccida += peso_uscita_contratto
        totale_differenza_peso_soccida += differenza_peso_contratto
        totale_valore_soccida += valore_contratto

        dettaglio_soccida.append({
            "contratto_id": contratto_id,
            "numero_contratto": contratto.numero_contratto,
            "soccidante": contratto.soccidante.nome if contratto.soccidante else "N/A",
            "modalita_remunerazione": contratto.modalita_remunerazione,
            "prezzo_per_kg": round(float(contratto.prezzo_per_kg), 2) if contratto.prezzo_per_kg else None,
            "quota_giornaliera": round(float(contratto.quota_giornaliera), 2) if contratto.quota_giornaliera else None,
            "percentuale_remunerazione": round(float(contratto.percentuale_remunerazione), 2) if contratto.percentuale_remunerazione else None,
            "percentuale_soccidante": float(contratto.percentuale_soccidante) if contratto.percentuale_soccidante else None,
            "percentuale_riparto_base": round(float(contratto.percentuale_riparto_base), 2) if contratto.percentuale_riparto_base else None,
            "percentuale_aggiunta_arrivo": round(float(contratto.percentuale_aggiunta_arrivo), 2) if contratto.percentuale_aggiunta_arrivo else None,
            "percentuale_sottrazione_uscita": round(float(contratto.percentuale_sottrazione_uscita), 2) if contratto.percentuale_sottrazione_uscita else None,
            "giorni_gestione": giorni_gestione,
            "numero_capi": len(entries),
            "peso_arrivo_originale_totale": round(float(peso_arrivo_originale_contratto), 2),
            "peso_arrivo_totale": round(float(peso_arrivo_contratto), 2),
            "peso_uscita_originale_totale": round(float(peso_uscita_originale_contratto), 2),
            "peso_uscita_totale": round(float(peso_uscita_contratto), 2),
            "differenza_peso_totale": round(float(differenza_peso_contratto), 2),
            "valore_totale": round(float(valore_contratto), 2),
        })

    riepilogo_soccida = {
        "numero_contratti": len(dettaglio_soccida),
        "numero_capi": sum(len(e) for e in animali_per_contratto.values()),
        "peso_arrivo": round(float(totale_peso_arrivo_soccida), 2),
        "peso_uscita": round(float(totale_peso_uscita_soccida), 2),
        "differenza_peso": round(float(totale_differenza_peso_soccida), 2),
        "valore_totale": round(float(totale_valore_soccida), 2),
        "dettaglio_contratti": dettaglio_soccida,
    }

    return {
        "riepilogo_proprieta": riepilogo_proprieta,
        "riepilogo_soccida": riepilogo_soccida,
    }


def calculate_movimenti_finanziari_per_contratto(
    db: Session,
    contratto_id: int,
    tipo_gestione: str = 'automatico',
    acconto_manuale: Optional[Decimal] = None,
    movimenti_pn_ids: Optional[List[int]] = None,
    fatture_acconto_selezionate: Optional[List[Dict]] = None,
    partite_ingresso_animali_usciti: Optional[List[int]] = None,
    animali_usciti_per_partita: Optional[Dict[int, int]] = None,
    animali_deceduti_per_partita: Optional[Dict[int, int]] = None,
    data_inizio: Optional[date] = None,
    data_fine: Optional[date] = None,
) -> Dict:
    """
    Calcola acconti e fatture per un contratto soccida.
    """
    contratto = db.query(ContrattoSoccida).filter(
        ContrattoSoccida.id == contratto_id,
        ContrattoSoccida.deleted_at.is_(None),
    ).first()

    if not contratto:
        raise ValueError(f"Contratto soccida {contratto_id} non trovato")

    result = {
        "contratto_id": contratto_id,
        "modalita_remunerazione": contratto.modalita_remunerazione,
        "monetizzata": contratto.monetizzata,
        "acconti_totali": Decimal(0),
        "fatture_acconto": [],
        "fattura_saldo": None,
        "totale_fatture": Decimal(0),
        "acconto_per_capo_per_partita": {},
    }

    partite = (
        db.query(PartitaAnimale)
        .filter(
            PartitaAnimale.contratto_soccida_id == contratto_id,
            PartitaAnimale.deleted_at.is_(None),
        )
        .all()
    )

    if contratto.monetizzata:
        if tipo_gestione == 'automatico':
            acconti_per_partita = {}

            if not partite_ingresso_animali_usciti:
                result["acconti_per_partita"] = {}
                result["acconto_per_capo_per_partita"] = {}
            else:
                partite_da_considerare = [
                    p for p in partite
                    if p.id in partite_ingresso_animali_usciti and p.tipo == TipoPartita.INGRESSO
                ]

                for partita in partite_da_considerare:
                    movimenti_acconto = (
                        db.query(PartitaMovimentoFinanziario)
                        .filter(
                            PartitaMovimentoFinanziario.partita_id == partita.id,
                            PartitaMovimentoFinanziario.tipo == PartitaMovimentoTipo.ACCONTO,
                            PartitaMovimentoFinanziario.direzione == PartitaMovimentoDirezione.ENTRATA,
                            PartitaMovimentoFinanziario.attivo,
                        )
                        .all()
                    )

                    totale_acconti_partita = sum(to_decimal(m.importo) for m in movimenti_acconto)

                    numero_animali_usciti = animali_usciti_per_partita.get(partita.id, 0)
                    numero_animali_deceduti = animali_deceduti_per_partita.get(partita.id, 0) if animali_deceduti_per_partita else 0
                    numero_animali_totali_da_considerare = numero_animali_usciti + numero_animali_deceduti

                    if numero_animali_totali_da_considerare > 0 and totale_acconti_partita > 0:
                        numero_totale_capi_partita = partita.numero_capi or 1
                        acconto_per_capo = totale_acconti_partita / numero_totale_capi_partita
                        acconto_totale_animali = acconto_per_capo * numero_animali_totali_da_considerare

                        acconti_per_partita[partita.id] = {
                            "totale": acconto_totale_animali,
                            "movimenti": [
                                {
                                    "id": m.id,
                                    "data": m.data.isoformat(),
                                    "importo": float(m.importo),
                                    "note": m.note,
                                }
                                for m in movimenti_acconto
                            ],
                            "numero_animali_usciti": numero_animali_usciti,
                            "numero_animali_deceduti": numero_animali_deceduti,
                            "numero_animali_totali": numero_animali_totali_da_considerare,
                            "numero_capi_partita": partita.numero_capi or 0,
                        }

                        result["acconti_totali"] += acconto_totale_animali
                        result["acconto_per_capo_per_partita"][partita.id] = round(float(acconto_per_capo),2)
                    else:
                        acconti_per_partita[partita.id] = {
                            "totale": Decimal(0),
                            "movimenti": [],
                            "numero_animali_usciti": 0,
                            "numero_animali_deceduti": 0,
                            "numero_animali_totali": 0,
                            "numero_capi_partita": partita.numero_capi or 0,
                        }
                        result["acconto_per_capo_per_partita"][partita.id] = 0.0

            result["acconti_per_partita"] = {
                pid: {
                    "totale": float(data["totale"]),
                    "movimenti": data["movimenti"],
                    "numero_animali_usciti": data.get("numero_animali_usciti", 0),
                    "numero_animali_deceduti": data.get("numero_animali_deceduti", 0),
                    "numero_animali_totali": data.get("numero_animali_totali", 0),
                    "numero_capi_partita": data.get("numero_capi_partita", 0),
                }
                for pid, data in acconti_per_partita.items()
            }

        elif tipo_gestione == 'manuale':
            if acconto_manuale is not None and acconto_manuale > 0:
                result["acconti_totali"] = acconto_manuale
                result["acconti_per_partita"] = {}
                result["acconto_per_capo_per_partita"] = {}
            else:
                result["acconti_totali"] = Decimal(0)
                result["acconti_per_partita"] = {}
                result["acconto_per_capo_per_partita"] = {}

        elif tipo_gestione == 'movimenti_interi':
            movimenti_pn = []
            if movimenti_pn_ids:
                movimenti_pn = (
                    db.query(PNMovimento)
                    .filter(
                        PNMovimento.id.in_(movimenti_pn_ids),
                        PNMovimento.deleted_at.is_(None),
                    )
                    .all()
                )
            else:
                movimenti_pn = get_movimenti_pn_per_contratto(
                    db=db,
                    contratto=contratto,
                    data_inizio=data_inizio,
                    data_fine=data_fine,
                )

            if movimenti_pn:
                result["acconti_totali"] = sum(to_decimal(m.importo) for m in movimenti_pn)
                for partita in partite:
                    result["acconto_per_capo_per_partita"][partita.id] = 0.0
                result["acconti_per_partita"] = {
                    partita.id: {
                        "totale": 0.0,
                        "movimenti": [
                            {
                                "id": m.id,
                                "data": m.data.isoformat() if m.data else None,
                                "importo": round(float(m.importo), 2),
                                "note": m.descrizione or "",
                            }
                            for m in movimenti_pn
                        ],
                    }
                    for partita in partite
                }
            else:
                result["acconti_totali"] = Decimal(0)
                for partita in partite:
                    result["acconto_per_capo_per_partita"][partita.id] = 0.0
                result["acconti_per_partita"] = {}
        else:
            result["acconti_totali"] = Decimal(0)
            for partita in partite:
                result["acconto_per_capo_per_partita"][partita.id] = 0.0
            result["acconti_per_partita"] = {}

    else:
        # Soccida fatturata
        if tipo_gestione == 'fatture_soccida' and fatture_acconto_selezionate:
            totale_importi_utilizzati = Decimal(0)
            fatture_acconto = []

            for fattura_data in fatture_acconto_selezionate:
                fattura_id = fattura_data.get('fattura_id')
                importo_utilizzato = to_decimal(fattura_data.get('importo_utilizzato', 0))

                fattura = (
                    db.query(FatturaAmministrazione)
                    .filter(
                        FatturaAmministrazione.id == fattura_id,
                        FatturaAmministrazione.contratto_soccida_id == contratto_id,
                        FatturaAmministrazione.deleted_at.is_(None),
                    )
                    .first()
                )

                if fattura:
                    totale_importi_utilizzati += importo_utilizzato
                    fatture_acconto.append({
                        "id": fattura.id,
                        "numero": fattura.numero,
                        "data": fattura.data_fattura.isoformat() if fattura.data_fattura else None,
                        "importo_totale": round(float(to_decimal(fattura.importo_netto or fattura.importo_totale)), 2),
                        "importo_utilizzato": round(float(importo_utilizzato), 2),
                    })

            result["fatture_acconto"] = fatture_acconto
            result["totale_fatture"] = totale_importi_utilizzati
            result["fattura_saldo"] = None

        else:
            if tipo_gestione != 'fatture_soccida':
                fatture = (
                    db.query(FatturaAmministrazione)
                    .filter(
                        FatturaAmministrazione.contratto_soccida_id == contratto_id,
                        FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
                        FatturaAmministrazione.deleted_at.is_(None),
                    )
                    .order_by(FatturaAmministrazione.data_fattura.asc())
                    .all()
                )

                fatture_acconto = []
                fattura_saldo = None

                for fattura in fatture:
                    movimenti_finanziari = (
                        db.query(PartitaMovimentoFinanziario)
                        .filter(
                            PartitaMovimentoFinanziario.fattura_amministrazione_id == fattura.id,
                            PartitaMovimentoFinanziario.attivo,
                        )
                        .all()
                    )

                    tipo_fattura = None
                    for mf in movimenti_finanziari:
                        if mf.tipo == PartitaMovimentoTipo.ACCONTO:
                            tipo_fattura = "acconto"
                            break
                        elif mf.tipo == PartitaMovimentoTipo.SALDO:
                            tipo_fattura = "saldo"
                            break

                    if not tipo_fattura:
                        if fattura == fatture[-1] and len(fatture) > 1:
                            tipo_fattura = "saldo"
                        else:
                            tipo_fattura = "acconto"

                    fattura_data = {
                        "id": fattura.id,
                        "numero": fattura.numero,
                        "data": fattura.data_fattura.isoformat() if fattura.data_fattura else None,
                        "importo": float(to_decimal(fattura.importo_netto or fattura.importo_totale)),
                    }

                    if tipo_fattura == "acconto":
                        fatture_acconto.append(fattura_data)
                    else:
                        fattura_saldo = fattura_data

                result["fatture_acconto"] = fatture_acconto
                result["fattura_saldo"] = fattura_saldo
                result["totale_fatture"] = sum(to_decimal(f.importo_netto or f.importo_totale) for f in fatture)

    result["acconti_totali"] = round(float(result["acconti_totali"]), 2)
    result["totale_fatture"] = round(float(result["totale_fatture"]), 2)    

    return result