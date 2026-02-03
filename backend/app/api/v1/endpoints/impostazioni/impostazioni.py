from copy import deepcopy
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Dict, Any, Iterable, Optional
from app.core.database import get_db
from app.models.impostazioni import Impostazioni as ImpostazioniModel
from app.schemas.impostazioni import (
    ImpostazioniCompletaResponse,
    ImpostazioniUpdate,
)

router = APIRouter(prefix="", tags=["Impostazioni"])


DEFAULT_CATEGORIE_COSTI = [
    {"value": "energia", "label": "Energia", "macrocategoria": "utilities"},
    {"value": "acqua", "label": "Acqua", "macrocategoria": "utilities"},
    {"value": "luce", "label": "Luce", "macrocategoria": "utilities"},
    {"value": "gas", "label": "Gas", "macrocategoria": "utilities"},
    {"value": "mangimi", "label": "Mangimi", "macrocategoria": "alimento"},
    {"value": "farmaci", "label": "Farmaci", "macrocategoria": "sanitario"},
    {"value": "lettiera", "label": "Lettiera (segatura, paglia)", "macrocategoria": "sanitario"},
    {"value": "lavorazione_terreni", "label": "Lavorazione terreni", "macrocategoria": "terreno"},
    {"value": "prodotti_agricoli", "label": "Prodotti agricoli", "macrocategoria": "terreno"},
    {"value": "sementi", "label": "Sementi", "macrocategoria": "terreno"},
    {"value": "concimi", "label": "Concimi", "macrocategoria": "terreno"},
    {"value": "fitofarmaci", "label": "Fitofarmaci", "macrocategoria": "terreno"},
    {"value": "smaltimento_medicinali", "label": "Smaltimento Medicinali", "macrocategoria": "sanitario"},
    {"value": "smaltimento_bovini_morti", "label": "Smaltimento Bovini Morti", "macrocategoria": "sanitario"},
    {"value": "smaltimento_letame", "label": "Smaltimento Letame", "macrocategoria": "sanitario"},
    {"value": "smaltimento_scarti", "label": "Smaltimento Scarti Allevamento", "macrocategoria": "sanitario"},
    {"value": "manutenzioni", "label": "Manutenzioni generali", "macrocategoria": "nessuna"},
    {"value": "leasing_attrezzature", "label": "Leasing attrezzature", "macrocategoria": "attrezzatura"},
    {"value": "manutenzione_attrezzature", "label": "Manutenzione attrezzature", "macrocategoria": "attrezzatura"},
    {"value": "riparazioni", "label": "Riparazioni", "macrocategoria": "attrezzatura"},
    {"value": "carburante", "label": "Carburante", "macrocategoria": "attrezzatura"},
    {"value": "ricambi", "label": "Ricambi", "macrocategoria": "attrezzatura"},
    # Personale
    {"value": "stipendi", "label": "Stipendi", "macrocategoria": "personale"},
    {"value": "contributi", "label": "Contributi", "macrocategoria": "personale"},
    {"value": "formazione", "label": "Formazione", "macrocategoria": "personale"},
    {"value": "consulenti_lavoro", "label": "Consulenti lavoro", "macrocategoria": "personale"},
    # Servizi
    {"value": "commercialista", "label": "Commercialista", "macrocategoria": "servizi"},
    {"value": "trasporti", "label": "Trasporti", "macrocategoria": "servizi"},
    {"value": "noleggi", "label": "Noleggi", "macrocategoria": "servizi"},
    {"value": "consulenze_tecniche", "label": "Consulenze tecniche", "macrocategoria": "servizi"},
    {"value": "manutenzioni_extra", "label": "Manutenzioni extra", "macrocategoria": "servizi"},
    {"value": "pulizie_professionali", "label": "Pulizie professionali", "macrocategoria": "servizi"},
    {"value": "manutenzione_strutture", "label": "Manutenzione strutture", "macrocategoria": "servizi"},
    # Assicurazioni
    {"value": "rc_aziendale", "label": "RC Aziendale", "macrocategoria": "assicurazioni"},
    {"value": "polizza_animali", "label": "Polizza animali", "macrocategoria": "assicurazioni"},
    {"value": "polizza_colture", "label": "Polizza colture", "macrocategoria": "assicurazioni"},
    {"value": "polizza_mezzi", "label": "Polizza mezzi", "macrocategoria": "assicurazioni"},
    # Finanziario
    {"value": "interessi_bancari", "label": "Interessi bancari", "macrocategoria": "finanziario"},
    {"value": "interessi_passivi", "label": "Interessi passivi", "macrocategoria": "finanziario"},
    {"value": "commissioni_bancarie", "label": "Commissioni bancarie", "macrocategoria": "finanziario"},
    {"value": "spese_bancarie", "label": "Spese bancarie", "macrocategoria": "finanziario"},
    {"value": "mutui", "label": "Mutui", "macrocategoria": "finanziario"},
    {"value": "prestiti", "label": "Prestiti", "macrocategoria": "finanziario"},
    {"value": "leasing_finanziario", "label": "Leasing finanziario", "macrocategoria": "finanziario"},
    {"value": "oneri_finanziari", "label": "Oneri finanziari", "macrocategoria": "finanziario"},
    # Amministrativo
    {"value": "tasse", "label": "Tasse", "macrocategoria": "amministrativo"},
    {"value": "imposte", "label": "Imposte", "macrocategoria": "amministrativo"},
    {"value": "versamenti_fiscali", "label": "Versamenti fiscali", "macrocategoria": "amministrativo"},
    {"value": "bolli", "label": "Bolli", "macrocategoria": "amministrativo"},
    {"value": "cancelleria", "label": "Cancelleria", "macrocategoria": "amministrativo"},
    {"value": "materiali_ufficio", "label": "Materiali ufficio", "macrocategoria": "amministrativo"},
    {"value": "telefonia", "label": "Telefonia", "macrocategoria": "amministrativo"},
    {"value": "internet", "label": "Internet", "macrocategoria": "amministrativo"},
    {"value": "software", "label": "Software", "macrocategoria": "amministrativo"},
    {"value": "abbonamenti", "label": "Abbonamenti", "macrocategoria": "amministrativo"},
    {"value": "spese_burocratiche", "label": "Spese burocratiche", "macrocategoria": "amministrativo"},
    {"value": "altro", "label": "Altro", "macrocategoria": "nessuna"},
]

DEFAULT_CATEGORIE_COSTI_LOOKUP = {item["value"]: item for item in DEFAULT_CATEGORIE_COSTI}


def _slugify(value: str) -> str:
    slug = (
        value.strip()
        .lower()
        .replace(" ", "_")
        .replace("/", "_")
        .replace("-", "_")
    )
    while "__" in slug:
        slug = slug.replace("__", "_")
    return slug


def _title_from_value(value: str) -> str:
    return value.replace("_", " ").strip().title()


def _normalize_categorie_costi(raw: Iterable[Any]) -> list[dict]:
    normalized = []
    seen = set()

    items = list(raw) if isinstance(raw, (list, tuple)) else list(DEFAULT_CATEGORIE_COSTI)
    if not items:
        items = list(DEFAULT_CATEGORIE_COSTI)

    for item in items:
        if isinstance(item, str):
            base = DEFAULT_CATEGORIE_COSTI_LOOKUP.get(item) or DEFAULT_CATEGORIE_COSTI_LOOKUP.get(item.lower())
            if base:
                entry = deepcopy(base)
            else:
                value = _slugify(item) or "categoria"
                entry = {
                    "value": value,
                    "label": _title_from_value(item),
                    "macrocategoria": "nessuna",
                }
        elif isinstance(item, dict):
            value = item.get("value") or item.get("id") or item.get("codice") or ""
            label = item.get("label") or item.get("nome") or ""
            if not value and label:
                value = _slugify(label)
            if not value:
                continue
            
            # Migrazione da vecchia struttura (associa_terreno/associa_attrezzatura -> macrocategoria)
            macrocategoria = item.get("macrocategoria", "nessuna")
            if macrocategoria not in ["nessuna", "alimento", "terreno", "attrezzatura", "sanitario", "utilities", "personale", "servizi", "assicurazioni", "finanziario", "amministrativo"]:
                # Migrazione da vecchia struttura
                if item.get("associa_terreno") and item.get("associa_attrezzatura"):
                    macrocategoria = "terreno"
                elif item.get("associa_terreno"):
                    macrocategoria = "terreno"
                elif item.get("associa_attrezzatura"):
                    macrocategoria = "attrezzatura"
                elif item.get("associazione"):
                    if item.get("associazione") == "terreno":
                        macrocategoria = "terreno"
                    elif item.get("associazione") == "attrezzatura":
                        macrocategoria = "attrezzatura"
                    else:
                        macrocategoria = "nessuna"
                else:
                    macrocategoria = "nessuna"
            
            entry = {
                "value": value,
                "label": label or _title_from_value(value),
                "macrocategoria": macrocategoria,
            }
        else:
            continue

        entry["value"] = _slugify(entry["value"])
        if not entry["label"]:
            entry["label"] = _title_from_value(entry["value"])

        if entry["value"] in seen:
            continue
        seen.add(entry["value"])
        normalized.append(entry)

    return normalized or deepcopy(DEFAULT_CATEGORIE_COSTI)

@router.get("/", response_model=ImpostazioniCompletaResponse)
def get_impostazioni(
    azienda_id: int = Query(..., description="ID dell'azienda"),
    db: Session = Depends(get_db)
):
    """
    Recupera tutte le impostazioni di tutti i moduli per l'azienda specificata
    """
    if not azienda_id:
        raise HTTPException(
            status_code=400,
            detail="azienda_id è obbligatorio"
        )
    
    moduli = ['moduli', 'amministrazione', 'attrezzature', 'prima_nota', 'ddt_emessi']
    result = {}
    
    for modulo in moduli:
        imp = db.query(ImpostazioniModel).filter(
            ImpostazioniModel.azienda_id == azienda_id,
            ImpostazioniModel.modulo == modulo
        ).first()
        if imp:
            config = deepcopy(imp.configurazione) if isinstance(imp.configurazione, dict) else {}
            if modulo == 'amministrazione':
                costi = config.get('categorie_costi', [])
                config['categorie_costi'] = _normalize_categorie_costi(costi)
            result[modulo] = config
        else:
            # Valori di default
            if modulo == 'moduli':
                result[modulo] = {
                    'moduli_abilitati': ['home', 'allevamento', 'sanitario', 'alimentazione', 'terreni', 'amministrazione', 'attrezzatura'],
                }
            elif modulo == 'amministrazione':
                result[modulo] = {
                    'categorie_costi': deepcopy(DEFAULT_CATEGORIE_COSTI),
                    'categorie_ricavi': [
                        {"value": "carne", "label": "Carne", "macrocategoria": "alimento"},
                        {"value": "latte", "label": "Latte", "macrocategoria": "alimento"},
                        {"value": "formaggi", "label": "Formaggi", "macrocategoria": "alimento"},
                        {"value": "animali", "label": "Animali", "macrocategoria": "alimento"},
                        {"value": "prodotti_agricoli", "label": "Prodotti agricoli", "macrocategoria": "terreno"},
                        {"value": "rivendita_usato", "label": "Rivendita usato", "macrocategoria": "attrezzatura"},
                        {"value": "altro", "label": "Altro", "macrocategoria": "nessuna"},
                    ],
                }
            elif modulo == 'attrezzature':
                result[modulo] = {
                    'tipi': ['veicolo', 'macchinario', 'strumento', 'attrezzatura', 'altro'],
                }
            elif modulo == 'prima_nota':
                result[modulo] = {
                    'categorie': ['vendita', 'acquisto', 'stipendio', 'affitto', 'utilita', 'manutenzione', 'ammortamento', 'assicurazione', 'tasse', 'altro'],
                }
            elif modulo == 'ddt_emessi':
                result[modulo] = {
                    'formato_numero': '{progressivo}/{anno}',
                    'numero_partenza': 1,
                }
    
    return ImpostazioniCompletaResponse(**result)

@router.put("/", response_model=ImpostazioniCompletaResponse)
def save_impostazioni(
    impostazioni: ImpostazioniCompletaResponse,
    azienda_id: int = Query(..., description="ID dell'azienda"),
    db: Session = Depends(get_db)
):
    """
    Salva le impostazioni per tutti i moduli per l'azienda specificata
    """
    if not azienda_id:
        raise HTTPException(
            status_code=400,
            detail="azienda_id è obbligatorio"
        )
    
    moduli = ['moduli', 'amministrazione', 'attrezzature', 'prima_nota', 'ddt_emessi']
    
    for modulo in moduli:
        config = getattr(impostazioni, modulo, {})
        
        imp = db.query(ImpostazioniModel).filter(
            ImpostazioniModel.azienda_id == azienda_id,
            ImpostazioniModel.modulo == modulo
        ).first()
        
        if imp:
            if modulo == 'amministrazione':
                updated = dict(config or {})
                updated['categorie_costi'] = _normalize_categorie_costi(updated.get('categorie_costi', []))
                imp.configurazione = updated
            else:
                imp.configurazione = config
        else:
            if modulo == 'amministrazione':
                updated = dict(config or {})
                updated['categorie_costi'] = _normalize_categorie_costi(updated.get('categorie_costi', []))
                imp = ImpostazioniModel(azienda_id=azienda_id, modulo=modulo, configurazione=updated)
            else:
                imp = ImpostazioniModel(azienda_id=azienda_id, modulo=modulo, configurazione=config)
            db.add(imp)
    
    db.commit()
    
    # Ritorna le impostazioni aggiornate
    return get_impostazioni(azienda_id=azienda_id, db=db)

