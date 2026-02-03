"""
Servizio per importare fatture da file XML FatturaPA
"""
import xml.etree.ElementTree as ET
from typing import Dict, Optional, Callable
from datetime import datetime, date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import and_
import os
import zipfile
import tempfile
import shutil

from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione, TipoFattura, StatoPagamento
from app.models.amministrazione.fattura_amministrazione_linea import FatturaAmministrazioneLinea
from app.models.amministrazione.fattura_amministrazione_riepilogo import FatturaAmministrazioneRiepilogo
from app.models.amministrazione.fattura_amministrazione_pagamento import FatturaAmministrazionePagamento
from app.models.amministrazione.fattura_amministrazione_ricezione import FatturaAmministrazioneRicezione
from app.models.amministrazione.fornitore_tipo import FornitoreTipo
from app.models.amministrazione.fornitore import Fornitore
from app.models.allevamento.azienda import Azienda
from app.services.amministrazione.prima_nota_automation import (
    ensure_prima_nota_for_fattura_amministrazione,
)

# Importa funzioni helper dal modulo import_fatture
from app.services.amministrazione.import_fatture import find_fornitore

fornitore_categoria_cache: Dict[int, Optional[str]] = {}


def create_or_update_fornitore(
    db: Session,
    nome: Optional[str],
    piva: Optional[str],
    cf: Optional[str],
    indirizzo: Optional[str] = None,
    indirizzo_cap: Optional[str] = None,
    indirizzo_comune: Optional[str] = None,
    indirizzo_provincia: Optional[str] = None,
    indirizzo_nazione: Optional[str] = None,
    telefono: Optional[str] = None,
    email: Optional[str] = None,
    pec: Optional[str] = None,
    fax: Optional[str] = None,
    regime_fiscale: Optional[str] = None,
    rea_ufficio: Optional[str] = None,
    rea_numero: Optional[str] = None,
    rea_capitale_sociale: Optional[str] = None,
    note: Optional[str] = None,
    azienda_id: Optional[int] = None,
) -> Optional[int]:
    """
    Crea o aggiorna un fornitore con tutti i dati disponibili.
    Cerca prima per P.IVA, poi per CF, infine per nome.
    Se esiste già, aggiorna le informazioni anagrafiche (telefono, email, indirizzo, note).
    """
    if not nome and not piva:
        return None
    
    query = db.query(Fornitore).filter(Fornitore.deleted_at.is_(None))

    def _apply_updates(fornitore_obj: Fornitore) -> int:
        updated = False

        def _set(attr: str, value: Optional[str], limit: Optional[int] = None):
            nonlocal updated
            if not value:
                return
            value_str = value[:limit] if (limit and len(value) > limit) else value
            current = getattr(fornitore_obj, attr)
            if not current or current.strip() != value_str:
                setattr(fornitore_obj, attr, value_str)
                updated = True

        _set("nome", nome, 200)
        _set("partita_iva", piva, 20)
        _set("indirizzo", indirizzo, 250)
        _set("indirizzo_cap", indirizzo_cap, 10)
        _set("indirizzo_comune", indirizzo_comune, 120)
        _set("indirizzo_provincia", indirizzo_provincia, 10)
        _set("indirizzo_nazione", indirizzo_nazione, 5)
        _set("telefono", telefono, 50)
        _set("email", email, 150)
        _set("pec", pec, 150)
        _set("fax", fax, 50)
        _set("regime_fiscale", regime_fiscale, 20)
        _set("rea_ufficio", rea_ufficio, 50)
        _set("rea_numero", rea_numero, 50)
        _set("rea_capitale_sociale", rea_capitale_sociale, 50)

        notes_to_merge = []
        if note:
            notes_to_merge.append(note.strip())

        if notes_to_merge:
            existing_note = (fornitore_obj.note or "").strip()
            new_block = "\n".join(n for n in notes_to_merge if n)
            if new_block and new_block not in existing_note:
                merged = f"{existing_note}\n{new_block}".strip()
                fornitore_obj.note = merged[:5000]
                updated = True

        if updated:
            db.flush()
        return fornitore_obj.id
    
    # Ordine di ricerca: P.IVA -> CF -> Nome
    match = None
    if piva:
        match = query.filter(Fornitore.partita_iva == piva).first()
        if match:
            return _apply_updates(match)

    if cf and not match:
        match = query.filter(Fornitore.partita_iva == cf).first()
        if match:
            return _apply_updates(match)

    if nome and not match:
        match = query.filter(Fornitore.nome.ilike(f"%{nome}%")).first()
        if match:
            return _apply_updates(match)

    # Se non trovato, crea nuovo fornitore
    if nome:
        notes = []
        if note:
            notes.append(note.strip())
        note_value = "\n".join(n for n in notes if n) or None

        # Se azienda_id non è fornito, usa la prima azienda disponibile
        if not azienda_id:
            azienda = db.query(Azienda).filter(Azienda.deleted_at.is_(None)).first()
            azienda_id = azienda.id if azienda else None

        nuovo = Fornitore(
            azienda_id=azienda_id,
            nome=nome[:200],
            partita_iva=piva if piva else (cf if cf else None),
            indirizzo=indirizzo[:250] if indirizzo else None,
            indirizzo_cap=indirizzo_cap[:10] if indirizzo_cap else None,
            indirizzo_comune=indirizzo_comune[:120] if indirizzo_comune else None,
            indirizzo_provincia=indirizzo_provincia[:10] if indirizzo_provincia else None,
            indirizzo_nazione=indirizzo_nazione[:5] if indirizzo_nazione else None,
            telefono=telefono[:50] if telefono else None,
            email=email[:150] if email else None,
            pec=pec[:150] if pec else None,
            fax=fax[:50] if fax else None,
            regime_fiscale=regime_fiscale[:20] if regime_fiscale else None,
            rea_ufficio=rea_ufficio[:50] if rea_ufficio else None,
            rea_numero=rea_numero[:50] if rea_numero else None,
            rea_capitale_sociale=rea_capitale_sociale[:50] if rea_capitale_sociale else None,
            note=note_value[:5000] if note_value else None,
        )
        db.add(nuovo)
        db.flush()
        return nuovo.id
    
    return None


def get_fornitore_categoria_default(db: Session, fornitore_id: Optional[int]) -> Optional[str]:
    """
    Restituisce la categoria predefinita associata a un fornitore (se presente).
    Usa una semplice cache in memoria per ridurre le query ripetute durante l'import.
    """
    if not fornitore_id:
        return None

    if fornitore_id in fornitore_categoria_cache:
        return fornitore_categoria_cache[fornitore_id]

    categoria = (
        db.query(FornitoreTipo.categoria)
        .filter(FornitoreTipo.fornitore_id == fornitore_id)
        .order_by(FornitoreTipo.updated_at.desc().nullslast(), FornitoreTipo.created_at.desc())
        .scalar()
    )

    fornitore_categoria_cache[fornitore_id] = categoria
    return categoria


def find_element(parent, tag_name, recursive=False):
    """Helper per trovare elementi XML ignorando namespace
    
    Args:
        parent: Elemento XML padre
        tag_name: Nome del tag da cercare (senza namespace)
        recursive: Se True, cerca anche nei discendenti (default: False)
    """
    if parent is None:
        return None
    
    # Cerca prima nei figli diretti
    for elem in parent:
        tag_stripped = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
        if tag_stripped == tag_name or elem.tag.endswith(tag_name):
            return elem
    
    # Se recursive=True, cerca anche nei discendenti
    if recursive:
        for elem in parent.iter():
            if elem == parent:  # Salta il parent stesso
                continue
            tag_stripped = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
            if tag_stripped == tag_name or elem.tag.endswith(tag_name):
                return elem
    
    return None


def find_all_elements(parent, tag_name):
    """Restituisce tutti i figli diretti che corrispondono al tag (ignora namespace)."""
    if parent is None:
        return []
    results = []
    for elem in parent:
        if elem.tag.endswith(tag_name) or elem.tag.split('}')[-1] == tag_name:
            results.append(elem)
    return results


def get_text(elem, default=None):
    """Helper per estrarre testo da elemento XML"""
    if elem is None:
        return default
    text = elem.text
    return text.strip() if text else default


def element_to_dict(element, exclude_allegati=True):
    """Converte un elemento XML in un dizionario annidato (ignorando i namespace).
    
    Args:
        element: Elemento XML da convertire
        exclude_allegati: Se True, esclude la sezione Allegati (default: True)
    """
    if element is None:
        return None

    def _strip(tag):
        return tag.split('}')[-1] if '}' in tag else tag

    # Escludi esplicitamente gli Allegati se richiesto
    tag_stripped = _strip(element.tag)
    if exclude_allegati and tag_stripped in ('Allegati', 'Attachment'):
        return None  # Escludi completamente la sezione Allegati

    children = list(element)
    if not children:
        text = element.text.strip() if element.text and element.text.strip() else None
        if element.attrib:
            data = {"@attributes": dict(element.attrib)}
            if text is not None:
                data["@text"] = text
            return data
        return text

    result = {}
    for child in children:
        tag = _strip(child.tag)
        # Escludi Allegati anche dai figli
        if exclude_allegati and tag in ('Allegati', 'Attachment'):
            continue  # Salta gli Allegati
        value = element_to_dict(child, exclude_allegati=exclude_allegati)
        if value is None:  # Se il valore è None (escluso), salta
            continue
        if tag in result:
            if not isinstance(result[tag], list):
                result[tag] = [result[tag]]
            result[tag].append(value)
        else:
            result[tag] = value

    if element.attrib:
        result["@attributes"] = dict(element.attrib)

    text = element.text.strip() if element.text and element.text.strip() else None
    if text is not None:
        result["@text"] = text

    return result


def to_serializable(value):
    """Converte valori (Decimal, date, ecc.) in tipi JSON-serializzabili."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, list):
        return [to_serializable(item) for item in value]
    if isinstance(value, dict):
        serialized = {}
        for key, val in value.items():
            if val is not None:
                serialized[key] = to_serializable(val)
        return serialized
    return value


def build_metadata(dati: Dict) -> Dict:
    """Costruisce un payload JSON serializzabile con tutti i dati della fattura."""
    documento = {
        "numero": dati.get("numero"),
        "data": dati.get("data_fattura"),
        "divisa": dati.get("divisa"),
        "tipo_documento": dati.get("tipo_documento"),
        "importo_totale": dati.get("importo_totale"),
        "imponibile_totale": dati.get("imponibile_totale"),
        "totale_iva": dati.get("totale_iva"),
        "importo_pagamento": dati.get("importo_pagamento"),
        "causale": dati.get("causale"),
        "causali": dati.get("causali"),
    }

    metadata = {
        "dati_trasmissione": dati.get("dati_trasmissione"),
        "contatti_trasmittente": dati.get("contatti_trasmittente"),
        "cedente": dati.get("cedente"),
        "cessionario": dati.get("cessionario"),
        "terzo_intermediario": dati.get("terzo_intermediario"),
        "soggetto_emittente": dati.get("soggetto_emittente"),
        "documento": documento,
        "condizioni_pagamento": dati.get("condizioni_pagamento"),
        "pagamenti": dati.get("dettagli_pagamento"),
        "linee": dati.get("dettaglio_linee"),
        "riepilogo_iva": dati.get("riepilogo_iva"),
        "dati_ricezione": dati.get("dati_ricezione"),
        "raw_tree": dati.get("raw_dict"),
    }

    return to_serializable(metadata)


def build_pagamento_note(pagamento: Dict) -> Optional[str]:
    """Crea una nota testuale con i campi supplementari del dettaglio pagamento."""
    if not pagamento:
        return None

    def _convert(value):
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        if isinstance(value, Decimal):
            return str(value)
        return value

    note_fields = [
        "sconto_pagamento_anticipato",
        "importo_pagamento_anticipato",
        "penalita_pagamenti_ritardati",
        "data_limite_pagamento_anticipato",
        "data_decorrenza_penale",
        "conto_corrente",
        "abi",
        "cab",
        "cin",
        "codice_tributo",
        "numero_assegno",
        "titolo_quietanzante",
        "cup",
        "cig",
    ]
    lines = []
    for key in note_fields:
        value = pagamento.get(key)
        if value not in (None, "", []):
            lines.append(f"{key}: {_convert(value)}")
    return "\n".join(lines) if lines else None


def parse_xml_fattura(xml_content: str) -> Dict:
    """Parsa un file XML FatturaPA e restituisce un dizionario con i dati estratti.
    Esclude esplicitamente la sezione Allegati per evitare di salvare dati binari."""
    try:
        root = ET.fromstring(xml_content)
        # Escludi esplicitamente gli Allegati dal raw_dict
        raw_dict = element_to_dict(root, exclude_allegati=True)

        def _to_decimal(value):
            if value is None:
                return None
            value = str(value).replace(",", ".")
            try:
                return Decimal(value)
            except Exception:
                return None

        def _to_int(value):
            if value is None:
                return None
            try:
                return int(Decimal(str(value)))
            except Exception:
                return None

        def _to_date(value):
            if not value:
                return None
            try:
                return datetime.strptime(value, "%Y-%m-%d").date()
            except Exception:
                try:
                     # Tentativo con formato datetime completo
                     return datetime.strptime(value, "%Y-%m-%dT%H:%M:%S").date()
                except:
                     pass
                try:
                     # Tentativo con formato datetime con timezone
                     return datetime.strptime(value[:19], "%Y-%m-%dT%H:%M:%S").date()
                except:
                     return None
        
        # Dati generali documento
        body_elem = find_element(root, 'FatturaElettronicaBody')
        dati_doc = None
        dati_gen = None
        if body_elem:
            dati_gen = find_element(body_elem, 'DatiGenerali')
            if dati_gen:
                dati_doc = find_element(dati_gen, 'DatiGeneraliDocumento')
        
        # Header
        header = find_element(root, 'FatturaElettronicaHeader')
        cedente = None
        cessionario = None
        contatti_trasmittente = {}
        dati_trasmissione_info = None
        terzo_intermediario = None
        soggetto_emittente = None
        
        if header:
            # Contatti trasmittente (telefono, email)
            dati_trasmissione = find_element(header, 'DatiTrasmissione')
            if dati_trasmissione:
                id_trasmittente_elem = find_element(dati_trasmissione, 'IdTrasmittente')
                id_paese_trasm = get_text(find_element(id_trasmittente_elem, 'IdPaese')) if id_trasmittente_elem else None
                id_codice_trasm = get_text(find_element(id_trasmittente_elem, 'IdCodice')) if id_trasmittente_elem else None
                progressivo_invio = get_text(find_element(dati_trasmissione, 'ProgressivoInvio'))
                formato_trasmissione = get_text(find_element(dati_trasmissione, 'FormatoTrasmissione'))
                codice_destinatario = get_text(find_element(dati_trasmissione, 'CodiceDestinatario'))
                pec_destinatario = get_text(find_element(dati_trasmissione, 'PECDestinatario'))

                contatti = find_element(dati_trasmissione, 'ContattiTrasmittente')
                if contatti:
                    contatti_trasmittente = {
                        'telefono': get_text(find_element(contatti, 'Telefono')),
                        'email': get_text(find_element(contatti, 'Email'))
                    }
                else:
                    contatti_trasmittente = {}

                dati_trasmissione_info = {
                    'id_trasmittente': {
                        'id_paese': id_paese_trasm,
                        'id_codice': id_codice_trasm,
                    },
                    'progressivo_invio': progressivo_invio,
                    'formato_trasmissione': formato_trasmissione,
                    'codice_destinatario': codice_destinatario,
                    'pec_destinatario': pec_destinatario,
                }
                if contatti_trasmittente:
                    dati_trasmissione_info['contatti'] = contatti_trasmittente
            
            # CedentePrestatore (chi emette la fattura)
            cedente_elem = find_element(header, 'CedentePrestatore')
            if cedente_elem:
                dati_anag_ced = find_element(cedente_elem, 'DatiAnagrafici')
                if dati_anag_ced:
                    id_fiscale = find_element(dati_anag_ced, 'IdFiscaleIVA')
                    id_codice_ced = None
                    if id_fiscale:
                        id_codice_ced = get_text(find_element(id_fiscale, 'IdCodice'))
                    
                    cf_ced = get_text(find_element(dati_anag_ced, 'CodiceFiscale'))
                    anagrafica = find_element(dati_anag_ced, 'Anagrafica')
                    denominazione_ced = None
                    if anagrafica:
                        denominazione_ced = get_text(find_element(anagrafica, 'Denominazione')) or get_text(find_element(anagrafica, 'Nome'))
                    if denominazione_ced:
                        denominazione_ced = denominazione_ced.strip()
                    
                    regime_fiscale = get_text(find_element(dati_anag_ced, 'RegimeFiscale'))
                    
                    # Sede cedente
                    sede_ced = find_element(cedente_elem, 'Sede')
                    indirizzo_ced = None
                    cap_ced = None
                    comune_ced = None
                    provincia_ced = None
                    nazione_ced = None
                    if sede_ced:
                        indirizzo_ced = get_text(find_element(sede_ced, 'Indirizzo'))
                        cap_ced = get_text(find_element(sede_ced, 'CAP'))
                        comune_ced = get_text(find_element(sede_ced, 'Comune'))
                        provincia_ced = get_text(find_element(sede_ced, 'Provincia'))
                        nazione_ced = get_text(find_element(sede_ced, 'Nazione'))
                    
                    # Iscrizione REA
                    rea_ced = find_element(cedente_elem, 'IscrizioneREA')
                    ufficio_rea_ced = None
                    numero_rea_ced = None
                    capitale_sociale_ced = None
                    if rea_ced:
                        ufficio_rea_ced = get_text(find_element(rea_ced, 'Ufficio'))
                        numero_rea_ced = get_text(find_element(rea_ced, 'NumeroREA'))
                        capitale_sociale_ced = get_text(find_element(rea_ced, 'CapitaleSociale'))
                    
                    # Costruisci indirizzo completo
                    indirizzo_completo_ced = None
                    if indirizzo_ced:
                        parts = [indirizzo_ced]
                        if cap_ced:
                            parts.append(cap_ced)
                        if comune_ced:
                            parts.append(comune_ced)
                        if provincia_ced:
                            parts.append(f"({provincia_ced})")
                        if nazione_ced and nazione_ced != 'IT':
                            parts.append(nazione_ced)
                        indirizzo_completo_ced = ', '.join(filter(None, parts))
                    
                    cedente = {
                        'partita_iva': id_codice_ced,
                        'codice_fiscale': cf_ced,
                        'denominazione': denominazione_ced,
                        'regime_fiscale': regime_fiscale,
                        'indirizzo': indirizzo_completo_ced,
                        'indirizzo_dettaglio': {
                            'via': indirizzo_ced,
                            'cap': cap_ced,
                            'comune': comune_ced,
                            'provincia': provincia_ced,
                            'nazione': nazione_ced
                        },
                        'rea': {
                            'ufficio': ufficio_rea_ced,
                            'numero': numero_rea_ced,
                            'capitale_sociale': capitale_sociale_ced
                        }
                    }

                    contatti_ced = find_element(cedente_elem, 'Contatti')
                    contatti_sede_ced = find_element(cedente_elem, 'ContattiSede')
                    telefono_ced = get_text(find_element(contatti_ced, 'Telefono')) if contatti_ced else None
                    email_ced = get_text(find_element(contatti_ced, 'Email')) if contatti_ced else None
                    fax_ced = get_text(find_element(contatti_ced, 'Fax')) if contatti_ced else None
                    if not telefono_ced and contatti_sede_ced:
                        telefono_ced = get_text(find_element(contatti_sede_ced, 'Telefono'))
                    if not email_ced and contatti_sede_ced:
                        email_ced = get_text(find_element(contatti_sede_ced, 'Email'))
                    pec_ced = (
                        get_text(find_element(contatti_ced, 'PEC')) if contatti_ced else None
                    ) or get_text(find_element(cedente_elem, 'PEC'))

                    if telefono_ced or email_ced or fax_ced or pec_ced:
                        cedente['contatti'] = {
                            'telefono': telefono_ced,
                            'email': email_ced,
                            'fax': fax_ced,
                            'pec': pec_ced,
                    }
            
            # CessionarioCommittente (chi riceve la fattura)
            cessionario_elem = find_element(header, 'CessionarioCommittente')
            if cessionario_elem:
                dati_anag_cess = find_element(cessionario_elem, 'DatiAnagrafici')
                if dati_anag_cess:
                    id_fiscale = find_element(dati_anag_cess, 'IdFiscaleIVA')
                    id_codice_cess = None
                    if id_fiscale:
                        id_codice_cess = get_text(find_element(id_fiscale, 'IdCodice'))
                    
                    cf_cess = get_text(find_element(dati_anag_cess, 'CodiceFiscale'))
                    anagrafica = find_element(dati_anag_cess, 'Anagrafica')
                    denominazione_cess = None
                    if anagrafica:
                        denominazione_cess = get_text(find_element(anagrafica, 'Denominazione')) or get_text(find_element(anagrafica, 'Nome'))
                    if denominazione_cess:
                        denominazione_cess = denominazione_cess.strip()
                    
                    # Sede cessionario
                    sede_cess = find_element(cessionario_elem, 'Sede')
                    indirizzo_cess = None
                    cap_cess = None
                    comune_cess = None
                    provincia_cess = None
                    nazione_cess = None
                    if sede_cess:
                        indirizzo_cess = get_text(find_element(sede_cess, 'Indirizzo'))
                        cap_cess = get_text(find_element(sede_cess, 'CAP'))
                        comune_cess = get_text(find_element(sede_cess, 'Comune'))
                        provincia_cess = get_text(find_element(sede_cess, 'Provincia'))
                        nazione_cess = get_text(find_element(sede_cess, 'Nazione'))
                    
                    # Costruisci indirizzo completo
                    indirizzo_completo_cess = None
                    if indirizzo_cess:
                        parts = [indirizzo_cess]
                        if cap_cess:
                            parts.append(cap_cess)
                        if comune_cess:
                            parts.append(comune_cess)
                        if provincia_cess:
                            parts.append(f"({provincia_cess})")
                        if nazione_cess and nazione_cess != 'IT':
                            parts.append(nazione_cess)
                        indirizzo_completo_cess = ', '.join(filter(None, parts))
                    
                    cessionario = {
                        'partita_iva': id_codice_cess,
                        'codice_fiscale': cf_cess,
                        'denominazione': denominazione_cess,
                        'indirizzo': indirizzo_completo_cess,
                        'indirizzo_dettaglio': {
                            'via': indirizzo_cess,
                            'cap': cap_cess,
                            'comune': comune_cess,
                            'provincia': provincia_cess,
                            'nazione': nazione_cess
                        }
                    }

                    contatti_cess = find_element(cessionario_elem, 'Contatti')
                    telefono_cess = get_text(find_element(contatti_cess, 'Telefono')) if contatti_cess else None
                    email_cess = get_text(find_element(contatti_cess, 'Email')) if contatti_cess else None
                    fax_cess = get_text(find_element(contatti_cess, 'Fax')) if contatti_cess else None
                    pec_cess = (
                        get_text(find_element(contatti_cess, 'PEC')) if contatti_cess else None
                    ) or get_text(find_element(cessionario_elem, 'PEC'))

                    if telefono_cess or email_cess or fax_cess or pec_cess:
                        cessionario['contatti'] = {
                            'telefono': telefono_cess,
                            'email': email_cess,
                            'fax': fax_cess,
                            'pec': pec_cess,
                        }
            
            terzo_elem = find_element(header, 'TerzoIntermediarioOSoggettoEmittente')
            if terzo_elem:
                dati_anag_terzo = find_element(terzo_elem, 'DatiAnagrafici')
                sede_terzo = find_element(terzo_elem, 'Sede')
                terzo = {}
                if dati_anag_terzo:
                    id_fiscale_terzo = find_element(dati_anag_terzo, 'IdFiscaleIVA')
                    id_paese_terzo = get_text(find_element(id_fiscale_terzo, 'IdPaese')) if id_fiscale_terzo else None
                    id_codice_terzo = get_text(find_element(id_fiscale_terzo, 'IdCodice')) if id_fiscale_terzo else None
                    cf_terzo = get_text(find_element(dati_anag_terzo, 'CodiceFiscale'))
                    anagrafica_terzo = find_element(dati_anag_terzo, 'Anagrafica')
                    denominazione_terzo = None
                    if anagrafica_terzo:
                        denominazione_terzo = (
                            get_text(find_element(anagrafica_terzo, 'Denominazione'))
                            or get_text(find_element(anagrafica_terzo, 'Nome'))
                        )
                    terzo.update({
                        'id_paese': id_paese_terzo,
                        'id_codice': id_codice_terzo,
                        'codice_fiscale': cf_terzo,
                        'denominazione': denominazione_terzo,
                    })
                if sede_terzo:
                    indirizzo = get_text(find_element(sede_terzo, 'Indirizzo'))
                    cap = get_text(find_element(sede_terzo, 'CAP'))
                    comune = get_text(find_element(sede_terzo, 'Comune'))
                    provincia = get_text(find_element(sede_terzo, 'Provincia'))
                    nazione = get_text(find_element(sede_terzo, 'Nazione'))
                    terzo['sede'] = {
                        'indirizzo': indirizzo,
                        'cap': cap,
                        'comune': comune,
                        'provincia': provincia,
                        'nazione': nazione,
                    }
                if terzo:
                    terzo_intermediario = terzo

            soggetto_emittente = get_text(find_element(header, 'SoggettoEmittente'))
        
        # Estrai dati documento
        numero = None
        data_fattura = None
        importo_totale = None
        causale = None
        causali = []
        
        if dati_doc:
            numero = get_text(find_element(dati_doc, 'Numero'))
            if numero:
                numero = numero.strip()
            data_str = get_text(find_element(dati_doc, 'Data'))
            if data_str:
                data_fattura = _to_date(data_str)
            importo_str = get_text(find_element(dati_doc, 'ImportoTotaleDocumento'))
            if importo_str:
                importo_totale = _to_decimal(importo_str)
            for child in dati_doc:
                tag_name = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                if tag_name == 'Causale':
                    causale_val = get_text(child)
                    if causale_val:
                        causali.append(causale_val.strip())
            causale = '\n'.join(causali) if causali else None

        # Estrai altri DatiGenerali per note
        dati_ordine_acquisto = []
        dati_contratto = []
        dati_convenzione = []
        dati_ricezione = []
        dati_fatture_collegate = []
        dati_ddt = []
        dati_trasporto = {}

        if dati_gen:
            def parse_documenti_correlati(tag_name):
                results = []
                for elem in dati_gen:
                    elem_tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                    if elem_tag == tag_name:
                        doc = {
                           'id_documento': get_text(find_element(elem, 'IdDocumento')),
                           'data': _to_date(get_text(find_element(elem, 'Data'))),
                           'num_item': get_text(find_element(elem, 'NumItem')),
                           'codice_cup': get_text(find_element(elem, 'CodiceCUP')),
                           'codice_cig': get_text(find_element(elem, 'CodiceCIG')),
                        }
                        rif_linea = []
                        for sub in elem:
                            sub_tag = sub.tag.split('}')[-1] if '}' in sub.tag else sub.tag
                            if sub_tag == 'RiferimentoNumeroLinea':
                                rif_linea.append(get_text(sub))
                        if rif_linea:
                            doc['riferimento_numero_linea'] = rif_linea
                        results.append(doc)
                return results
            
            dati_ordine_acquisto = parse_documenti_correlati('DatiOrdineAcquisto')
            dati_contratto = parse_documenti_correlati('DatiContratto')
            dati_convenzione = parse_documenti_correlati('DatiConvenzione')
            dati_ricezione = parse_documenti_correlati('DatiRicezione')
            dati_fatture_collegate = parse_documenti_correlati('DatiFattureCollegate')

            # DatiDDT
            for elem in dati_gen:
                elem_tag = elem.tag.split('}')[-1] if '}' in elem.tag else elem.tag
                if elem_tag == 'DatiDDT':
                    ddt = {
                        'numero_ddt': get_text(find_element(elem, 'NumeroDDT')),
                        'data_ddt': _to_date(get_text(find_element(elem, 'DataDDT'))),
                    }
                    rif_linea = []
                    for sub in elem:
                        sub_tag = sub.tag.split('}')[-1] if '}' in sub.tag else sub.tag
                        if sub_tag == 'RiferimentoNumeroLinea':
                            rif_linea.append(get_text(sub))
                    if rif_linea:
                        ddt['riferimento_numero_linea'] = rif_linea
                    dati_ddt.append(ddt)
            
            # DatiTrasporto
            trasporto_elem = find_element(dati_gen, 'DatiTrasporto')
            if trasporto_elem:
                dati_trasporto = {
                    'causale_trasporto': get_text(find_element(trasporto_elem, 'CausaleTrasporto')),
                    'numero_colli': get_text(find_element(trasporto_elem, 'NumeroColli')),
                    'descrizione': get_text(find_element(trasporto_elem, 'Descrizione')),
                    'peso_lordo': get_text(find_element(trasporto_elem, 'PesoLordo')),
                    'peso_netto': get_text(find_element(trasporto_elem, 'PesoNetto')),
                    'data_ora_ritiro': get_text(find_element(trasporto_elem, 'DataOraRitiro')),
                }
                vettore = find_element(trasporto_elem, 'DatiAnagraficiVettore')
                if vettore:
                     anag = find_element(vettore, 'Anagrafica')
                     if anag:
                         dati_trasporto['vettore'] = get_text(find_element(anag, 'Denominazione')) or get_text(find_element(anag, 'Nome')) + ' ' + get_text(find_element(anag, 'Cognome'))
        
        # Dati beni e servizi
        dati_beni = None
        dati_beni_sections = []
        if body_elem:
            dati_beni_sections.extend(find_all_elements(body_elem, 'DatiBeniServizi'))
            dati_generali_section = find_element(body_elem, 'DatiGenerali')
            if dati_generali_section:
                dati_beni_sections.extend(find_all_elements(dati_generali_section, 'DatiBeniServizi'))
        
        dettaglio_linee = []
        riepilogo_iva = []
        totale_iva = Decimal('0')
        imponibile_totale = Decimal('0')
        
        if dati_beni_sections:
            # Dettaglio linee
            for dettagli_section in dati_beni_sections:
                for dettaglio in dettagli_section:
                    tag_name = dettaglio.tag.split('}')[-1] if '}' in dettaglio.tag else dettaglio.tag
                    if tag_name != 'DettaglioLinee':
                        continue
                    numero_linea_str = get_text(find_element(dettaglio, 'NumeroLinea'))
                    unita_misura = get_text(find_element(dettaglio, 'UnitaMisura'))
                    descrizione = get_text(find_element(dettaglio, 'Descrizione'))
                    quantita_str = get_text(find_element(dettaglio, 'Quantita'))
                    prezzo_unitario_str = get_text(find_element(dettaglio, 'PrezzoUnitario'))
                    prezzo_totale_str = get_text(find_element(dettaglio, 'PrezzoTotale'))
                    # Cerca AliquotaIVA prima nei figli diretti, poi ricorsivamente se non trovato
                    aliquota_elem = find_element(dettaglio, 'AliquotaIVA') or find_element(dettaglio, 'AliquotaIVA', recursive=True)
                    aliquota_iva_str = get_text(aliquota_elem)
                    # Debug: verifica se AliquotaIVA è stato trovato
                    if not aliquota_iva_str:
                        # Prova a cercare anche con namespace esplicito o varianti
                        for child in dettaglio:
                            tag_stripped = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            if tag_stripped == 'AliquotaIVA' and child.text:
                                aliquota_iva_str = child.text.strip()
                                break
                    natura = get_text(find_element(dettaglio, 'Natura'))
                    data_inizio_periodo_str = get_text(find_element(dettaglio, 'DataInizioPeriodo'))
                    data_fine_periodo_str = get_text(find_element(dettaglio, 'DataFinePeriodo'))
                    tipo_cessione_prestazione = get_text(find_element(dettaglio, 'TipoCessionePrestazione'))
                    riferimento_amministrazione = get_text(find_element(dettaglio, 'RiferimentoAmministrazione'))
                    
                    codice_articolo_elem = find_element(dettaglio, 'CodiceArticolo')
                    codice_articolo = None
                    if codice_articolo_elem:
                        codice_parts = []
                        for codice_child in codice_articolo_elem.findall('.//'):
                            child_tag = codice_child.tag.split('}')[-1] if '}' in codice_child.tag else codice_child.tag
                            if child_tag in {'CodiceTipo', 'CodiceValore'} and codice_child.text:
                                codice_parts.append(codice_child.text.strip())
                        if codice_parts:
                            codice_articolo = ' - '.join(codice_parts)
                    
                    # Converti aliquota_iva in Decimal, assicurandosi che sia un valore numerico
                    aliquota_iva_decimal = _to_decimal(aliquota_iva_str)
                    
                    dettaglio_linee.append({
                        'numero_linea': _to_int(numero_linea_str),
                        'descrizione': descrizione,
                        'quantita': _to_decimal(quantita_str),
                        'unita_misura': unita_misura,
                        'prezzo_unitario': _to_decimal(prezzo_unitario_str),
                        'prezzo_totale': _to_decimal(prezzo_totale_str),
                        'aliquota_iva': aliquota_iva_decimal,
                        'natura': natura,
                        'data_inizio_periodo': _to_date(data_inizio_periodo_str),
                        'data_fine_periodo': _to_date(data_fine_periodo_str),
                        'tipo_cessione_prestazione': tipo_cessione_prestazione,
                        'riferimento_amministrazione': riferimento_amministrazione,
                        'codice_articolo': codice_articolo
                    })
            
            # Riepilogo IVA - viene processato dopo le linee
            for dettagli_section in dati_beni_sections:
                for riepilogo in dettagli_section:
                    tag_name = riepilogo.tag.split('}')[-1] if '}' in riepilogo.tag else riepilogo.tag
                    if tag_name != 'DatiRiepilogo':
                        continue
                    # Cerca AliquotaIVA prima nei figli diretti, poi ricorsivamente se non trovato
                    aliquota_elem = find_element(riepilogo, 'AliquotaIVA') or find_element(riepilogo, 'AliquotaIVA', recursive=True)
                    aliquota_str = get_text(aliquota_elem)
                    # Debug: verifica se AliquotaIVA è stato trovato nel riepilogo
                    if not aliquota_str:
                        # Prova a cercare anche con namespace esplicito o varianti
                        for child in riepilogo:
                            tag_stripped = child.tag.split('}')[-1] if '}' in child.tag else child.tag
                            if tag_stripped == 'AliquotaIVA' and child.text:
                                aliquota_str = child.text.strip()
                                break
                    imponibile_str = get_text(find_element(riepilogo, 'ImponibileImporto'))
                    imposta_str = get_text(find_element(riepilogo, 'Imposta'))
                    natura_riepilogo = get_text(find_element(riepilogo, 'Natura'))
                    esigibilita = get_text(find_element(riepilogo, 'EsigibilitaIVA'))
                    riferimento_normativo = get_text(find_element(riepilogo, 'RiferimentoNormativo'))

                    aliquota = _to_decimal(aliquota_str) or Decimal('0')
                    imponibile = _to_decimal(imponibile_str) or Decimal('0')
                    imposta = _to_decimal(imposta_str) or Decimal('0')
                    
                    riepilogo_iva.append({
                        'aliquota': aliquota,
                        'imponibile': imponibile,
                        'imposta': imposta,
                        'natura': natura_riepilogo,
                        'esigibilita': esigibilita,
                        'riferimento_normativo': riferimento_normativo
                    })
                    
                    totale_iva += imposta
                    imponibile_totale += imponibile
            
            # Fallback: se una linea non ha aliquota_iva, prova a usare quella del riepilogo corrispondente
            # (basato su imponibile o natura)
            for linea in dettaglio_linee:
                if not linea.get('aliquota_iva') or linea.get('aliquota_iva') == 0:
                    linea_prezzo = linea.get('prezzo_totale') or Decimal('0')
                    linea_natura = linea.get('natura')
                    # Cerca nel riepilogo IVA un match per natura o imponibile simile
                    for riep in riepilogo_iva:
                        riep_natura = riep.get('natura')
                        riep_imponibile = riep.get('imponibile') or Decimal('0')
                        # Match per natura (se presente) o per imponibile simile
                        if (linea_natura and riep_natura and linea_natura == riep_natura) or \
                           (not linea_natura and not riep_natura and abs(linea_prezzo - riep_imponibile) < Decimal('0.01')):
                            linea['aliquota_iva'] = riep.get('aliquota')
                            break
        
        # Dati pagamento
        dati_pagamento_elem = None
        if body_elem:
            dati_gen = find_element(body_elem, 'DatiGenerali')
            if dati_gen and dati_pagamento_elem is None:
                dati_pagamento_elem = find_element(dati_gen, 'DatiPagamento')
            if dati_pagamento_elem is None:
                dati_pagamento_elem = find_element(body_elem, 'DatiPagamento')
        
        condizioni_pagamento = None
        dettagli_pagamento = []
        data_scadenza = None
        importo_pagamento = None
        
        if dati_pagamento_elem:
            condizioni_pagamento = get_text(find_element(dati_pagamento_elem, 'CondizioniPagamento'))
            
            # Può esserci più di un dettaglio pagamento
            for dettaglio in dati_pagamento_elem:
                tag_name = dettaglio.tag.split('}')[-1] if '}' in dettaglio.tag else dettaglio.tag
                if tag_name == 'DettaglioPagamento':
                    modalita_pagamento = get_text(find_element(dettaglio, 'ModalitaPagamento'))
                    data_scadenza_str = get_text(find_element(dettaglio, 'DataScadenzaPagamento'))
                    giorni_termine_str = get_text(find_element(dettaglio, 'GiorniTerminiPagamento'))
                    data_riferimento_str = get_text(find_element(dettaglio, 'DataRiferimentoTerminiPagamento'))
                    importo_pagamento_str = get_text(find_element(dettaglio, 'ImportoPagamento'))
                    iban = get_text(find_element(dettaglio, 'IBAN'))
                    codice_pagamento = get_text(find_element(dettaglio, 'CodicePagamento'))
                    istituto_finanziario = get_text(find_element(dettaglio, 'IstitutoFinanziario'))
                    abi = get_text(find_element(dettaglio, 'ABI'))
                    cab = get_text(find_element(dettaglio, 'CAB'))
                    bic = get_text(find_element(dettaglio, 'BIC'))
                    cin = get_text(find_element(dettaglio, 'CIN'))
                    conto_corrente = get_text(find_element(dettaglio, 'CC'))
                    titolo_quietanzante = get_text(find_element(dettaglio, 'TitoloQuietanzante'))
                    numero_assegno = get_text(find_element(dettaglio, 'NumeroAssegno'))
                    codice_tributo = get_text(find_element(dettaglio, 'CodiceTributo'))
                    sconto_anticipato_str = get_text(find_element(dettaglio, 'ScontoPagamentoAnticipato'))
                    importo_anticipato_str = get_text(find_element(dettaglio, 'ImportoPagamentoAnticipato'))
                    penalita_ritardo_str = get_text(find_element(dettaglio, 'PenalitaPagamentiRitardati'))
                    data_limite_anticipato_str = get_text(find_element(dettaglio, 'DataLimitePagamentoAnticipato'))
                    data_decorrenza_penale_str = get_text(find_element(dettaglio, 'DataDecorrenzaPenale'))
                    cup = get_text(find_element(dettaglio, 'CodiceCup'))
                    cig = get_text(find_element(dettaglio, 'CodiceCig'))
                    
                    data_scadenza_parsed = _to_date(data_scadenza_str)
                    data_riferimento_parsed = _to_date(data_riferimento_str)
                    data_limite_anticipato = _to_date(data_limite_anticipato_str)
                    data_decorrenza_penale = _to_date(data_decorrenza_penale_str)
                    giorni_termine = _to_int(giorni_termine_str)
                    importo_parsed = _to_decimal(importo_pagamento_str)
                    sconto_pagamento_anticipato = _to_decimal(sconto_anticipato_str)
                    importo_pagamento_anticipato = _to_decimal(importo_anticipato_str)
                    penalita_pagamenti_ritardati = _to_decimal(penalita_ritardo_str)
                    
                    pagamento_info = {
                        'modalita_pagamento': modalita_pagamento,
                        'data_riferimento': data_riferimento_parsed,
                        'giorni_termine': giorni_termine,
                        'data_scadenza': data_scadenza_parsed,
                        'importo': importo_parsed,
                        'iban': iban,
                        'bic': bic,
                        'istituto_finanziario': istituto_finanziario,
                        'banca': istituto_finanziario,
                        'abi': abi,
                        'cab': cab,
                        'cin': cin,
                        'conto_corrente': conto_corrente,
                        'titolo_quietanzante': titolo_quietanzante,
                        'numero_assegno': numero_assegno,
                        'codice_pagamento': codice_pagamento,
                        'codice_tributo': codice_tributo,
                        'sconto_pagamento_anticipato': sconto_pagamento_anticipato,
                        'importo_pagamento_anticipato': importo_pagamento_anticipato,
                        'penalita_pagamenti_ritardati': penalita_pagamenti_ritardati,
                        'data_limite_pagamento_anticipato': data_limite_anticipato,
                        'data_decorrenza_penale': data_decorrenza_penale,
                        'cup': cup,
                        'cig': cig,
                    }
                    
                    dettagli_pagamento.append(pagamento_info)
                    
                    # Prendi la prima data scadenza come riferimento principale
                    if not data_scadenza and data_scadenza_parsed:
                        data_scadenza = data_scadenza_parsed
                    if not importo_pagamento and importo_parsed:
                        importo_pagamento = importo_parsed
        
        # Tipo documento
        tipo_documento = None
        divisa = None
        if dati_doc:
            tipo_documento = get_text(find_element(dati_doc, 'TipoDocumento'))
            divisa = get_text(find_element(dati_doc, 'Divisa'))
        
        # Converti dettaglio_linee in formato JSON serializzabile per la colonna righe
        righe_json = []
        for linea in dettaglio_linee:
            riga_json = {
                'numero_linea': linea.get('numero_linea'),
                'descrizione': linea.get('descrizione'),
                'quantita': float(linea.get('quantita')) if linea.get('quantita') is not None else None,
                'unita_misura': linea.get('unita_misura'),
                'prezzo_unitario': float(linea.get('prezzo_unitario')) if linea.get('prezzo_unitario') is not None else None,
                'prezzo_totale': float(linea.get('prezzo_totale')) if linea.get('prezzo_totale') is not None else None,
                'aliquota_iva': float(linea.get('aliquota_iva')) if linea.get('aliquota_iva') is not None else None,
                'natura': linea.get('natura'),
                'data_inizio_periodo': linea.get('data_inizio_periodo').isoformat() if linea.get('data_inizio_periodo') else None,
                'data_fine_periodo': linea.get('data_fine_periodo').isoformat() if linea.get('data_fine_periodo') else None,
                'tipo_cessione_prestazione': linea.get('tipo_cessione_prestazione'),
                'riferimento_amministrazione': linea.get('riferimento_amministrazione'),
                'codice_articolo': linea.get('codice_articolo')
            }
            righe_json.append(riga_json)

        # Ritorno con tutti i campi estesi (esclusi Allegati)
        return {
            'numero': numero,
            'data_fattura': data_fattura,
            'importo_totale': importo_totale,
            'causale': causale,
            'causali': causali,
            'tipo_documento': tipo_documento,
            'divisa': divisa,
            'cedente': cedente,
            'cessionario': cessionario,
            'contatti_trasmittente': contatti_trasmittente,
            'dati_trasmissione': dati_trasmissione_info,
            'terzo_intermediario': terzo_intermediario,
            'soggetto_emittente': soggetto_emittente,
            'dettaglio_linee': dettaglio_linee,
            'righe': righe_json,  # Righe in formato JSON per la colonna righe
            'riepilogo_iva': riepilogo_iva,
            'totale_iva': totale_iva,
            'imponibile_totale': imponibile_totale,
            'condizioni_pagamento': condizioni_pagamento,
            'dettagli_pagamento': dettagli_pagamento,
            'data_scadenza': data_scadenza,
            'importo_pagamento': importo_pagamento,
            'dati_ordine_acquisto': dati_ordine_acquisto,
            'dati_contratto': dati_contratto,
            'dati_convenzione': dati_convenzione,
            'dati_ricezione': dati_ricezione,
            'dati_fatture_collegate': dati_fatture_collegate,
            'dati_ddt': dati_ddt,
            'dati_trasporto': dati_trasporto,
            'raw_dict': raw_dict
        }
    except ET.ParseError as e:
        raise ValueError(f"Errore di sintassi XML: {str(e)}")
    except Exception as e:
        import traceback
        error_details = traceback.format_exc()
        raise ValueError(f"Errore nel parsing XML: {str(e)}. Dettagli: {error_details[:200]}")


def import_fatture_from_xml_folder(
    db: Session,
    folder_path: str,
    skip_duplicates: bool = True,
    progress_callback: Optional[Callable[[int, int, Dict], None]] = None
) -> Dict[str, any]:
    """
    Importa fatture da una cartella contenente file XML FatturaPA
    
    Args:
        db: Database session
        folder_path: Percorso della cartella o file ZIP
        skip_duplicates: Parametro legacy (le fatture duplicate vengono aggiornate mantenendo categoria e terreno)
        progress_callback: Callback opzionale chiamato dopo ogni fattura processata con (current, total, stats)
    
    Returns:
        Dict con statistiche dell'import
    """
    fornitore_categoria_cache.clear()

    importate_entrata = 0  # Fatture emesse (tipo=entrata)
    importate_uscita = 0   # Fatture ricevute (tipo=uscita)
    errate = 0
    duplicate_entrata = 0
    duplicate_uscita = 0
    errori = []
    
    # Verifica che il percorso esista
    if not os.path.exists(folder_path):
        return {
            'success': False,
            'error': f'Percorso non trovato: {folder_path}',
            'importate_emesse': 0,
            'importate_amministrazione': 0,
            'errate': 0,
            'duplicate_emesse': 0,
            'duplicate_amministrazione': 0,
            'errori': []
        }
    
    # Verifica dimensione del file/cartella (per debug)
    try:
        if os.path.isfile(folder_path):
            file_size = os.path.getsize(folder_path)
            if file_size == 0:
                return {
                    'success': False,
                    'error': f'Il file è vuoto: {os.path.basename(folder_path)}',
                    'importate_emesse': 0,
                    'importate_amministrazione': 0,
                    'errate': 0,
                    'duplicate_emesse': 0,
                    'duplicate_amministrazione': 0,
                    'errori': []
                }
    except Exception:
        pass  # Ignora errori di verifica dimensione
    
    # Carica tutte le aziende per il matching
    aziende = db.query(Azienda).filter(Azienda.deleted_at.is_(None)).all()
    aziende_map = {}
    for azienda in aziende:
        if azienda.partita_iva:
            aziende_map[azienda.partita_iva] = azienda.id
        if azienda.codice_fiscale:
            aziende_map[azienda.codice_fiscale] = azienda.id
    default_azienda_id = aziende[0].id if aziende else None
    
    # Gestisci ZIP o cartella
    temp_dir = None
    try:
        # Verifica se è un file ZIP (controlla estensione e contenuto)
        is_zip = False
        is_xml_file = False
        
        if os.path.isfile(folder_path):
            file_lower = folder_path.lower()
            # Verifica se è un file XML
            if file_lower.endswith('.xml'):
                is_xml_file = True
            # Verifica se è un file ZIP
            elif any(file_lower.endswith(ext.lower()) for ext in ['.zip']):
                # Verifica che sia effettivamente un file ZIP valido
                try:
                    with zipfile.ZipFile(folder_path, 'r') as test_zip:
                        test_zip.testzip()  # Verifica integrità
                    is_zip = True
                except zipfile.BadZipFile:
                    # Non è un ZIP valido
                    is_zip = False
                except Exception:
                    is_zip = False
        
        if is_zip:
            # Verifica che il ZIP contenga file
            try:
                with zipfile.ZipFile(folder_path, 'r') as test_zip:
                    file_list = test_zip.namelist()
                    if not file_list:
                        return {
                            'success': False,
                            'error': 'Il file ZIP è vuoto',
                            'importate_emesse': 0,
                            'importate_amministrazione': 0,
                            'errate': 0,
                            'duplicate_emesse': 0,
                            'duplicate_amministrazione': 0
                        }
            except Exception as e:
                return {
                    'success': False,
                    'error': f'Errore nella lettura del file ZIP: {str(e)}',
                    'importate_emesse': 0,
                    'importate_amministrazione': 0,
                    'errate': 0,
                    'duplicate_emesse': 0,
                    'duplicate_amministrazione': 0
                }
            
            # Estrai ZIP in una cartella temporanea
            temp_dir = tempfile.mkdtemp()
            try:
                with zipfile.ZipFile(folder_path, 'r') as zip_ref:
                    # Estrai tutti i file mantenendo la struttura delle cartelle
                    # Il filtro per .xml verrà applicato durante la ricerca ricorsiva
                    zip_ref.extractall(temp_dir)
                folder_path = temp_dir
            except zipfile.BadZipFile:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                return {
                    'success': False,
                    'error': 'Il file ZIP è corrotto o non valido',
                    'importate_emesse': 0,
                    'importate_amministrazione': 0,
                    'errate': 0,
                    'duplicate_emesse': 0,
                    'duplicate_amministrazione': 0
                }
            except Exception as e:
                if temp_dir and os.path.exists(temp_dir):
                    shutil.rmtree(temp_dir)
                return {
                    'success': False,
                    'error': f'Errore durante l\'estrazione del file ZIP: {str(e)}',
                    'importate_emesse': 0,
                    'importate_amministrazione': 0,
                    'errate': 0,
                    'duplicate_emesse': 0,
                    'duplicate_amministrazione': 0
                }
        
        # Trova tutti i file XML (ignorando file nascosti o firmati .p7m)
        # Processa SOLO file con estensione esattamente .xml (non .xml.p7m, .xml.p7s, ecc.)
        xml_files = []
        
        # Se è un file singolo XML (non ZIP e non cartella)
        if is_xml_file and os.path.isfile(folder_path):
            file_lower = folder_path.lower()
            # Verifica che sia esattamente .xml e non una variante
            if file_lower.endswith('.xml') and not file_lower.endswith('.xml.p7m') and not file_lower.endswith('.xml.p7s'):
                xml_files.append(folder_path)
        elif os.path.isdir(folder_path):
            # Cerca ricorsivamente in cartelle
            for root, dirs, files in os.walk(folder_path):
                for file_name in files:
                    file_lower = file_name.lower()
                    # Ignora file nascosti (es. resource fork macOS)
                    if file_lower.startswith('._') or file_name.startswith('.'):
                        continue
                    
                    # Controlla PRIMA le estensioni più lunghe (varianti di .xml)
                    # per evitare che file .xml.p7m vengano considerati come .xml
                    excluded_extensions = ['.xml.p7m', '.xml.p7s', '.xml.sig', '.xml.p7e']
                    is_excluded = any(file_lower.endswith(ext) for ext in excluded_extensions)
                    
                    # Processa SOLO file con estensione esattamente .xml (non varianti)
                    if not is_excluded and file_lower.endswith('.xml'):
                        xml_files.append(os.path.join(root, file_name))
        elif os.path.isfile(folder_path):
            # File non riconosciuto
            return {
                'success': False,
                'error': f'Tipo di file non supportato. Il file deve essere un ZIP (.zip) o un XML FatturaPA (.xml)',
                'importate_emesse': 0,
                'importate_amministrazione': 0,
                'errate': 0,
                'duplicate_emesse': 0,
                'duplicate_amministrazione': 0
            }
        
        print(f"[IMPORT XML SERVICE] Ricerca file XML: folder_path={folder_path}")
        print(f"[IMPORT XML SERVICE] is_zip={is_zip}, is_xml_file={is_xml_file}, is_dir={os.path.isdir(folder_path) if os.path.exists(folder_path) else False}")
        print(f"[IMPORT XML SERVICE] File XML trovati: {len(xml_files)}")
        if xml_files:
            print(f"[IMPORT XML SERVICE] Primi file: {xml_files[:5]}")
        else:
            # Debug: mostra tutti i file trovati nella cartella per capire perché non vengono processati
            if os.path.isdir(folder_path):
                print(f"[IMPORT XML SERVICE] DEBUG: Contenuto cartella {folder_path}:")
                try:
                    all_files = []
                    for root, dirs, files in os.walk(folder_path):
                        for file_name in files:
                            all_files.append(os.path.join(root, file_name))
                    print(f"[IMPORT XML SERVICE] DEBUG: Totale file trovati: {len(all_files)}")
                    for f in all_files[:20]:  # Mostra i primi 20
                        print(f"  - {os.path.basename(f)} (est: {os.path.splitext(f)[1]})")
                except Exception as e:
                    print(f"[IMPORT XML SERVICE] DEBUG: Errore nel listare file: {e}")
        
        if not xml_files:
            print(f"[IMPORT XML SERVICE] ERRORE: Nessun file XML trovato!")
            print(f"[IMPORT XML SERVICE] Percorso verificato: {folder_path}")
            if os.path.exists(folder_path):
                if os.path.isdir(folder_path):
                    print(f"[IMPORT XML SERVICE] È una cartella, contenuto:")
                    try:
                        for item in os.listdir(folder_path)[:10]:
                            item_path = os.path.join(folder_path, item)
                            print(f"  - {item} (dir: {os.path.isdir(item_path)}, file: {os.path.isfile(item_path)})")
                    except Exception as e:
                        print(f"  Errore nel listare: {e}")
                else:
                    print(f"[IMPORT XML SERVICE] È un file, dimensione: {os.path.getsize(folder_path)} bytes")
            
            return {
                'success': False,
                'error': 'Nessun file XML trovato. Verifica che il file ZIP contenga file XML FatturaPA (.xml) o che il file caricato sia un XML valido. Il sistema cerca file con estensione .xml anche in sottocartelle.',
                'importate_emesse': 0,
                'importate_amministrazione': 0,
                'errate': 0,
                'duplicate_emesse': 0,
                'duplicate_amministrazione': 0,
                'errori': [f'Nessun file XML trovato nel percorso: {os.path.basename(folder_path) if folder_path else "sconosciuto"}']
            }
        
        # Processa ogni file XML
        total_files = len(xml_files)
        current_file = 0
        
        for xml_file_path in xml_files:
            current_file += 1
            file_lower = xml_file_path.lower()
            # Verifica che sia esattamente .xml e non una variante
            # Controlla PRIMA le estensioni più lunghe
            excluded_extensions = ['.xml.p7m', '.xml.p7s', '.xml.sig', '.xml.p7e']
            is_excluded = any(file_lower.endswith(ext) for ext in excluded_extensions)
            if is_excluded or not file_lower.endswith('.xml'):
                continue
            basename = os.path.basename(xml_file_path)
            if basename.startswith('._') or basename.startswith('.'):
                continue
            try:
                # Verifica che il file esista e non sia vuoto
                if not os.path.exists(xml_file_path):
                    errate += 1
                    error_msg = f'{os.path.basename(xml_file_path)}: File non trovato'
                    errori.append(error_msg)
                    if progress_callback:
                        stats = {
                            'importate_emesse': importate_entrata,
                            'importate_amministrazione': importate_uscita,
                            'errate': errate,
                            'duplicate_emesse': duplicate_entrata,
                            'duplicate_amministrazione': duplicate_uscita,
                            'current_file': os.path.basename(xml_file_path),
                            'ultimo_errore': error_msg
                        }
                        progress_callback(current_file, total_files, stats)
                    continue
                
                file_size = os.path.getsize(xml_file_path)
                if file_size == 0:
                    errate += 1
                    error_msg = f'{os.path.basename(xml_file_path)}: File vuoto'
                    errori.append(error_msg)
                    if progress_callback:
                        stats = {
                            'importate_emesse': importate_entrata,
                            'importate_amministrazione': importate_uscita,
                            'errate': errate,
                            'duplicate_emesse': duplicate_entrata,
                            'duplicate_amministrazione': duplicate_uscita,
                            'current_file': os.path.basename(xml_file_path),
                            'ultimo_errore': error_msg
                        }
                        progress_callback(current_file, total_files, stats)
                    continue
                
                # Prova diversi encoding
                xml_content = None
                encodings = ['utf-8', 'utf-8-sig', 'latin-1', 'cp1252', 'iso-8859-1']
                
                for encoding in encodings:
                    try:
                        with open(xml_file_path, 'r', encoding=encoding) as f:
                            xml_content = f.read()
                        if xml_content and xml_content.strip():
                            break
                    except (UnicodeDecodeError, UnicodeError):
                        continue
                    except Exception as e:
                        # Se non è un errore di encoding, prova il prossimo
                        continue
                
                # Se ancora non abbiamo contenuto, prova in modalità binaria e decodifica
                if xml_content is None or not xml_content.strip():
                    try:
                        with open(xml_file_path, 'rb') as f:
                            binary_content = f.read()
                        # Prova a decodificare
                        for encoding in encodings:
                            try:
                                xml_content = binary_content.decode(encoding)
                                if xml_content and xml_content.strip():
                                    break
                            except (UnicodeDecodeError, UnicodeError):
                                continue
                    except Exception as e:
                        pass
                
                if xml_content is None or not xml_content.strip():
                    errate += 1
                    error_msg = f'{os.path.basename(xml_file_path)}: Impossibile leggere il file (encoding non supportato o file corrotto)'
                    errori.append(error_msg)
                    # Chiama callback per errore
                    if progress_callback:
                        stats = {
                            'importate_emesse': importate_entrata,
                            'importate_amministrazione': importate_uscita,
                            'errate': errate,
                            'duplicate_emesse': duplicate_entrata,
                            'duplicate_amministrazione': duplicate_uscita,
                            'current_file': os.path.basename(xml_file_path),
                            'ultimo_errore': error_msg
                        }
                        progress_callback(current_file, total_files, stats)
                    continue
                
                # Parsa XML
                try:
                    dati = parse_xml_fattura(xml_content)
                except Exception as parse_error:
                    errate += 1
                    error_msg = str(parse_error)
                    if len(error_msg) > 200:
                        error_msg = error_msg[:200] + '...'
                    error_final = f'{os.path.basename(xml_file_path)}: Errore nel parsing XML - {error_msg}'
                    errori.append(error_final)
                    # Chiama callback per errore
                    if progress_callback:
                        stats = {
                            'importate_emesse': importate_entrata,
                            'importate_amministrazione': importate_uscita,
                            'errate': errate,
                            'duplicate_emesse': duplicate_entrata,
                            'duplicate_amministrazione': duplicate_uscita,
                            'current_file': os.path.basename(xml_file_path),
                            'ultimo_errore': error_final
                        }
                        progress_callback(current_file, total_files, stats)
                    continue
                
                metadata_payload = build_metadata(dati)
                
                # Determina se è una fattura emessa o ricevuta
                # Controlla se il cedente o il cessionario corrisponde a una delle nostre aziende
                is_fattura_emessa = False
                azienda_id = None
                
                if dati['cedente']:
                    piva_ced = dati['cedente'].get('partita_iva')
                    cf_ced = dati['cedente'].get('codice_fiscale')
                    if piva_ced and piva_ced in aziende_map:
                        is_fattura_emessa = True
                        azienda_id = aziende_map[piva_ced]
                    elif cf_ced and cf_ced in aziende_map:
                        is_fattura_emessa = True
                        azienda_id = aziende_map[cf_ced]
                
                if not is_fattura_emessa and dati['cessionario']:
                    piva_cess = dati['cessionario'].get('partita_iva')
                    cf_cess = dati['cessionario'].get('codice_fiscale')
                    if piva_cess and piva_cess in aziende_map:
                        azienda_id = aziende_map[piva_cess]
                    elif cf_cess and cf_cess in aziende_map:
                        azienda_id = aziende_map[cf_cess]
                
                # Valida dati obbligatori
                if not dati['numero'] or not dati['data_fattura'] or not dati['importo_totale']:
                    errate += 1
                    error_msg = f'{os.path.basename(xml_file_path)}: Dati obbligatori mancanti'
                    errori.append(error_msg)
                    # Chiama callback per errore
                    if progress_callback:
                        stats = {
                            'importate_emesse': importate_entrata,
                            'importate_amministrazione': importate_uscita,
                            'errate': errate,
                            'duplicate_emesse': duplicate_entrata,
                            'duplicate_amministrazione': duplicate_uscita,
                            'current_file': os.path.basename(xml_file_path),
                            'ultimo_errore': error_msg
                        }
                        progress_callback(current_file, total_files, stats)
                    continue
                
                # Determina tipo fattura: entrata (emessa) o uscita (ricevuta)
                tipo_fattura = TipoFattura.ENTRATA if is_fattura_emessa else TipoFattura.USCITA
                
                if is_fattura_emessa:
                    # Fattura emessa (tipo=entrata): la nostra azienda ha emesso la fattura
                    # Il cedente è la nostra azienda, il cessionario è il cliente
                    if not azienda_id:
                        errate += 1
                        error_msg = f'{os.path.basename(xml_file_path)}: Azienda non trovata per fattura emessa'
                        errori.append(error_msg)
                        if progress_callback:
                            stats = {
                                'importate_emesse': importate_entrata,
                                'importate_amministrazione': importate_uscita,
                                'errate': errate,
                                'duplicate_emesse': duplicate_entrata,
                                'duplicate_amministrazione': duplicate_uscita,
                                'current_file': os.path.basename(xml_file_path),
                                'ultimo_errore': error_msg
                            }
                            progress_callback(current_file, total_files, stats)
                        continue
                    
                    metadata_unificata = dict(metadata_payload)
                    metadata_unificata['record_type'] = 'fattura_amministrazione'
                    metadata_unificata['tipo'] = 'entrata'
                    metadata_unificata['azienda_id'] = azienda_id

                    esistente = db.query(FatturaAmministrazione).filter(
                        and_(
                            FatturaAmministrazione.azienda_id == azienda_id,
                            FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
                            FatturaAmministrazione.numero == dati['numero'],
                            FatturaAmministrazione.data_fattura == dati['data_fattura'],
                            FatturaAmministrazione.deleted_at.is_(None)
                        )
                    ).first()
                    
                    # Trova o crea cliente (il cessionario è il cliente)
                    cliente_id = None
                    cliente_nome = None
                    cliente_piva = None
                    cliente_cf = None
                    
                    if dati['cessionario']:
                        cliente_nome = dati['cessionario'].get('denominazione')
                        cliente_piva = dati['cessionario'].get('partita_iva')
                        cliente_cf = dati['cessionario'].get('codice_fiscale')
                        # Nota: i contatti del cliente potrebbero essere in un elemento <StabileOrganizzazione>
                        # o in altri elementi XML, ma di solito non sono presenti nell'XML standard
                        # I contatti trasmittente sono del sistema di fatturazione, non del cliente
                        contatti_cessionario = dati['cessionario'].get('contatti', {}) or {}
                        cliente_telefono = contatti_cessionario.get('telefono')
                        cliente_email = contatti_cessionario.get('email')
                        cliente_pec = contatti_cessionario.get('pec')
                        cliente_fax = contatti_cessionario.get('fax')
                        
                        # Crea o aggiorna cliente con tutti i dati disponibili
                        indirizzo_det = dati['cessionario'].get('indirizzo_dettaglio') or {}
                        # Usa la via separata invece dell'indirizzo completo
                        cliente_indirizzo = indirizzo_det.get('via') if indirizzo_det else dati['cessionario'].get('indirizzo')
                        note_cliente_parts = [
                            f"Cliente creato automaticamente da import XML fattura {dati.get('numero', 'N/A')}"
                        ]
                        if indirizzo_det:
                            addr_line = ", ".join(filter(None, [
                                indirizzo_det.get('via'),
                                indirizzo_det.get('cap'),
                                indirizzo_det.get('comune'),
                                indirizzo_det.get('provincia'),
                                indirizzo_det.get('nazione'),
                            ]))
                            if addr_line:
                                note_cliente_parts.append(f"Indirizzo fiscale: {addr_line}")
                        if cliente_fax:
                            note_cliente_parts.append(f"Fax: {cliente_fax}")
                        note_cliente = "\n".join(note_cliente_parts)

                        cliente_id = create_or_update_fornitore(
                            db=db,
                            nome=cliente_nome,
                            piva=cliente_piva,
                            cf=cliente_cf,
                            indirizzo=cliente_indirizzo,
                            indirizzo_cap=indirizzo_det.get('cap'),
                            indirizzo_comune=indirizzo_det.get('comune'),
                            indirizzo_provincia=indirizzo_det.get('provincia'),
                            indirizzo_nazione=indirizzo_det.get('nazione'),
                            telefono=cliente_telefono,
                            email=cliente_email,
                            pec=cliente_pec,
                            fax=cliente_fax,
                            note=note_cliente,
                            azienda_id=azienda_id or default_azienda_id
                        )
                        categoria_cliente = get_fornitore_categoria_default(db, cliente_id)
                    else:
                        categoria_cliente = None
                    
                    # Calcola importi
                    importo_iva = dati.get('totale_iva', Decimal('0'))
                    importo_netto = dati.get('imponibile_totale', dati['importo_totale'] - importo_iva)
                    
                    # Stato pagamento (per tipo=entrata)
                    stato_pagamento = StatoPagamento.DA_INCASSARE
                    importo_incassato = Decimal('0')
                    if dati['data_scadenza'] and dati['data_scadenza'] < date.today():
                        stato_pagamento = StatoPagamento.SCADUTA
                    
                    if esistente:
                        duplicate_entrata += 1
                        esistente.data_registrazione = dati['data_fattura']
                        esistente.importo_totale = dati['importo_totale']
                        esistente.importo_iva = importo_iva
                        esistente.importo_netto = importo_netto
                        esistente.importo_incassato = importo_incassato
                        esistente.stato_pagamento = stato_pagamento
                        esistente.data_scadenza = dati['data_scadenza']
                        esistente.data_incasso = None  # Reset se non presente nei dati
                        # condizioni_pagamento viene mappato nei pagamenti come modalita_pagamento
                        esistente.tipo_documento = dati.get('tipo_documento')
                        esistente.divisa = dati.get('divisa')
                        if dati.get('causale'):
                            esistente.note = dati.get('causale')
                        esistente.dati_xml = metadata_unificata
                        esistente.xml_raw = xml_content
                        esistente.righe = dati.get('righe')  # Salva righe in formato JSON
                        ensure_prima_nota_for_fattura_amministrazione(db, esistente, azienda_id)
                        if categoria_cliente and not esistente.categoria:
                            esistente.categoria = categoria_cliente
                        
                        db.commit()  # Commit anche per fatture duplicate aggiornate

                        if cliente_id:
                            esistente.cliente_id = cliente_id
                            esistente.cliente_nome = None
                            esistente.cliente_piva = None
                            esistente.cliente_cf = None
                        else:
                            if cliente_nome:
                                esistente.cliente_nome = cliente_nome
                            if cliente_piva:
                                esistente.cliente_piva = cliente_piva
                            if cliente_cf:
                                esistente.cliente_cf = cliente_cf
                        importate_entrata += 1
                        
                        # Chiama callback di progresso per fatture duplicate
                        if progress_callback:
                            stats = {
                                'importate_emesse': importate_entrata,
                                'importate_amministrazione': importate_uscita,
                                'errate': errate,
                                'duplicate_emesse': duplicate_entrata,
                                'duplicate_amministrazione': duplicate_uscita,
                                'current_file': os.path.basename(xml_file_path)
                            }
                            progress_callback(current_file, total_files, stats)
                    else:
                        fattura = FatturaAmministrazione(
                            azienda_id=azienda_id,
                            tipo=TipoFattura.ENTRATA,
                            numero=dati['numero'],
                            data_fattura=dati['data_fattura'],
                            data_registrazione=dati['data_fattura'],
                            divisa=dati.get('divisa'),
                            tipo_documento=dati.get('tipo_documento'),
                            cliente_id=cliente_id,
                            cliente_nome=cliente_nome if not cliente_id else None,
                            cliente_piva=cliente_piva if not cliente_id else None,
                            cliente_cf=cliente_cf if not cliente_id else None,
                            importo_totale=dati['importo_totale'],
                            importo_iva=importo_iva,
                            importo_netto=importo_netto,
                            importo_incassato=importo_incassato,
                            stato_pagamento=stato_pagamento,
                            data_scadenza=dati['data_scadenza'],
                            data_incasso=None,
                            # condizioni_pagamento viene mappato nei pagamenti come modalita_pagamento
                            categoria=categoria_cliente,
                            note=dati.get('causale')
                        )
                        
                        # COSTRUZIONE NOTE AGGIUNTIVE (Nuova Fattura)
                        note_extra = []
                        # 1. Dati Ordine Acquisto
                        if dati.get('dati_ordine_acquisto'):
                            for doc in dati['dati_ordine_acquisto']:
                                doc_note = f"Rif. Ordine: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                if doc.get('codice_cig'):
                                    doc_note += f" CIG: {doc['codice_cig']}"
                                if doc.get('codice_cup'):
                                    doc_note += f" CUP: {doc['codice_cup']}"
                                note_extra.append(doc_note)

                        # 2. Dati Contratto
                        if dati.get('dati_contratto'):
                             for doc in dati['dati_contratto']:
                                doc_note = f"Rif. Contratto: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                note_extra.append(doc_note)
                        
                        # 3. Dati DDT
                        if dati.get('dati_ddt'):
                            for ddt in dati['dati_ddt']:
                                ddt_note = f"Rif. DDT: {ddt.get('numero_ddt', 'N/D')}"
                                if ddt.get('data_ddt'):
                                    ddt_note += f" del {ddt['data_ddt']}"
                                note_extra.append(ddt_note)
                        
                        # 4. Dati Trasporto
                        if dati.get('dati_trasporto'):
                            trasp = dati['dati_trasporto']
                            trasp_parts = []
                            if trasp.get('vettore'): trasp_parts.append(f"Vettore: {trasp['vettore']}")
                            if trasp.get('descrizione'): trasp_parts.append(f"Descr: {trasp['descrizione']}")
                            if trasp.get('numero_colli'): trasp_parts.append(f"Colli: {trasp['numero_colli']}")
                            if trasp.get('peso_lordo'): trasp_parts.append(f"Peso: {trasp['peso_lordo']}kg")
                            if trasp.get('data_ora_ritiro'): trasp_parts.append(f"Ritiro: {trasp['data_ora_ritiro']}")
                            if trasp_parts:
                                note_extra.append("Trasporto: " + ", ".join(trasp_parts))

                        if note_extra:
                            current_note = fattura.note or ""
                            new_note_block = "\n".join(note_extra)
                            fattura.note = (current_note + "\n\n" + new_note_block).strip()

                        fattura.dati_xml = metadata_unificata
                        fattura.xml_raw = xml_content
                        fattura.righe = dati.get('righe')  # Salva righe in formato JSON
                    
                        db.add(fattura)
                        db.flush()
                        ensure_prima_nota_for_fattura_amministrazione(db, fattura, azienda_id)
                        db.commit()  # Commit dopo ogni fattura
                        importate_entrata += 1
                        
                        # Chiama callback di progresso
                        if progress_callback:
                            stats = {
                                'importate_emesse': importate_entrata,
                                'importate_amministrazione': importate_uscita,
                                'errate': errate,
                                'duplicate_emesse': duplicate_entrata,
                                'duplicate_amministrazione': duplicate_uscita,
                                'current_file': os.path.basename(xml_file_path),
                                'ultimo_errore': None
                            }
                            progress_callback(current_file, total_files, stats)
                    
                else:
                    # Fattura amministrazione (ricevuta - la nostra azienda ha ricevuto la fattura)
                    # Il cedente è il fornitore, il cessionario è la nostra azienda (se presente)
                    esistente = db.query(FatturaAmministrazione).filter(
                        and_(
                            FatturaAmministrazione.numero == dati['numero'],
                            FatturaAmministrazione.data_fattura == dati['data_fattura'],
                            FatturaAmministrazione.deleted_at.is_(None)
                        )
                    ).first()
                        
                    metadata_unificata = dict(metadata_payload)
                    metadata_unificata['record_type'] = 'fattura_amministrazione'
                    metadata_unificata['tipo'] = 'uscita'
                    
                    # Trova o crea fornitore (il cedente è il fornitore)
                    fornitore_id = None
                    categoria_default = None
                    if dati['cedente']:
                        fornitore_nome = dati['cedente'].get('denominazione')
                        fornitore_piva = dati['cedente'].get('partita_iva')
                        fornitore_cf = dati['cedente'].get('codice_fiscale')
                        contatti_cedente = dati['cedente'].get('contatti', {}) or {}
                        fornitore_telefono = contatti_cedente.get('telefono')
                        fornitore_email = contatti_cedente.get('email')
                        fornitore_pec = contatti_cedente.get('pec')
                        fornitore_fax = contatti_cedente.get('fax')
                        
                        # Costruisci note con dati REA se disponibili
                        note_fornitore = f"Fornitore creato automaticamente da import XML fattura {dati.get('numero', 'N/A')}"
                        indirizzo_det = dati['cedente'].get('indirizzo_dettaglio') or {}
                        # Usa la via separata invece dell'indirizzo completo
                        fornitore_indirizzo = indirizzo_det.get('via') if indirizzo_det else dati['cedente'].get('indirizzo')
                        indirizzo_line = ", ".join(filter(None, [
                            indirizzo_det.get('via'),
                            indirizzo_det.get('cap'),
                            indirizzo_det.get('comune'),
                            indirizzo_det.get('provincia'),
                            indirizzo_det.get('nazione'),
                        ]))
                        if indirizzo_line:
                            note_fornitore = f"{note_fornitore}\nIndirizzo fiscale: {indirizzo_line}"
                        if dati['cedente'].get('rea', {}).get('numero'):
                            rea_info = f"REA: {dati['cedente']['rea'].get('ufficio', '')} {dati['cedente']['rea'].get('numero', '')}"
                            note_fornitore = f"{note_fornitore}\n{rea_info}"
                        if dati['cedente'].get('regime_fiscale'):
                            note_fornitore = f"{note_fornitore}\nRegime fiscale: {dati['cedente'].get('regime_fiscale')}"
                        if fornitore_fax:
                            note_fornitore = f"{note_fornitore}\nFax: {fornitore_fax}"
                        
                        # Crea o aggiorna fornitore con tutti i dati disponibili
                        fornitore_id = create_or_update_fornitore(
                            db=db,
                            nome=fornitore_nome,
                            piva=fornitore_piva,
                            cf=fornitore_cf,
                            indirizzo=fornitore_indirizzo,
                            indirizzo_cap=indirizzo_det.get('cap') if indirizzo_det else None,
                            indirizzo_comune=indirizzo_det.get('comune') if indirizzo_det else None,
                            indirizzo_provincia=indirizzo_det.get('provincia') if indirizzo_det else None,
                            indirizzo_nazione=indirizzo_det.get('nazione') if indirizzo_det else None,
                            telefono=fornitore_telefono,
                            email=fornitore_email,
                            pec=fornitore_pec,
                            fax=fornitore_fax,
                            regime_fiscale=dati['cedente'].get('regime_fiscale'),
                            rea_ufficio=dati['cedente'].get('rea', {}).get('ufficio') if dati['cedente'].get('rea') else None,
                            rea_numero=dati['cedente'].get('rea', {}).get('numero') if dati['cedente'].get('rea') else None,
                            rea_capitale_sociale=dati['cedente'].get('rea', {}).get('capitale_sociale') if dati['cedente'].get('rea') else None,
                            note=note_fornitore,
                            azienda_id=azienda_id or default_azienda_id
                        )
                    categoria_default = get_fornitore_categoria_default(db, fornitore_id)
                    
                    # Calcola importi
                    importo_iva = dati.get('totale_iva', Decimal('0'))
                    importo_netto = dati.get('imponibile_totale', dati['importo_totale'] - importo_iva)
                    importo_pagato = Decimal('0')
                    
                    # Stato pagamento
                    stato_pagamento = StatoPagamento.DA_PAGARE
                    if dati['data_scadenza'] and dati['data_scadenza'] < date.today():
                        stato_pagamento = StatoPagamento.SCADUTA
                    
                    if esistente:
                        duplicate_uscita += 1
                        esistente.tipo = TipoFattura.USCITA
                        esistente.data_registrazione = dati['data_fattura']
                        esistente.divisa = dati.get('divisa')
                        esistente.tipo_documento = dati.get('tipo_documento')
                        esistente.fornitore_id = fornitore_id
                        esistente.importo_totale = dati['importo_totale']
                        esistente.importo_iva = importo_iva
                        esistente.importo_netto = importo_netto
                        esistente.importo_pagato = importo_pagato
                        esistente.stato_pagamento = stato_pagamento
                        esistente.data_scadenza = dati['data_scadenza']
                        # condizioni_pagamento viene mappato nei pagamenti come modalita_pagamento
                        if dati.get('causale'):
                            esistente.note = dati.get('causale')
                        
                        # COSTRUZIONE NOTE AGGIUNTIVE (Amministrazione Esistente)
                        note_extra = []
                        # 1. Dati Ordine Acquisto
                        if dati.get('dati_ordine_acquisto'):
                            for doc in dati['dati_ordine_acquisto']:
                                doc_note = f"Rif. Ordine: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                if doc.get('codice_cig'):
                                    doc_note += f" CIG: {doc['codice_cig']}"
                                if doc.get('codice_cup'):
                                    doc_note += f" CUP: {doc['codice_cup']}"
                                note_extra.append(doc_note)
                        
                        # 2. Dati Contratto
                        if dati.get('dati_contratto'):
                             for doc in dati['dati_contratto']:
                                doc_note = f"Rif. Contratto: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                note_extra.append(doc_note)
                        
                        # 3. Dati DDT
                        if dati.get('dati_ddt'):
                            for ddt in dati['dati_ddt']:
                                ddt_note = f"Rif. DDT: {ddt.get('numero_ddt', 'N/D')}"
                                if ddt.get('data_ddt'):
                                    ddt_note += f" del {ddt['data_ddt']}"
                                note_extra.append(ddt_note)

                        # 4. Dati Trasporto
                        if dati.get('dati_trasporto'):
                            trasp = dati['dati_trasporto']
                            trasp_parts = []
                            if trasp.get('vettore'): trasp_parts.append(f"Vettore: {trasp['vettore']}")
                            if trasp.get('descrizione'): trasp_parts.append(f"Descr: {trasp['descrizione']}")
                            if trasp.get('numero_colli'): trasp_parts.append(f"Colli: {trasp['numero_colli']}")
                            if trasp.get('peso_lordo'): trasp_parts.append(f"Peso: {trasp['peso_lordo']}kg")
                            if trasp.get('data_ora_ritiro'): trasp_parts.append(f"Ritiro: {trasp['data_ora_ritiro']}")
                            if trasp_parts:
                                note_extra.append("Trasporto: " + ", ".join(trasp_parts))

                        if note_extra:
                            current_note = esistente.note or ""
                            new_note_block = "\n".join(note_extra)
                            if new_note_block not in current_note:
                                esistente.note = (current_note + "\n\n" + new_note_block).strip()

                        esistente.dati_xml = metadata_unificata
                        esistente.xml_raw = xml_content
                        esistente.righe = dati.get('righe')  # Salva righe in formato JSON
                        ensure_prima_nota_for_fattura_amministrazione(db, esistente, default_azienda_id)
                        if categoria_default and not esistente.categoria:
                            esistente.categoria = categoria_default
                        
                        db.commit()  # Commit anche per fatture duplicate aggiornate

                        esistente.linee.clear()
                        esistente.riepiloghi.clear()
                        esistente.pagamenti_programmati.clear()
                        esistente.ricezioni.clear()

                        for linea in dati.get('dettaglio_linee', []):
                            esistente.linee.append(
                                FatturaAmministrazioneLinea(
                                    numero_linea=linea.get('numero_linea'),
                                    descrizione=linea.get('descrizione'),
                                    quantita=linea.get('quantita'),
                                    unita_misura=linea.get('unita_misura'),
                                    data_inizio_periodo=linea.get('data_inizio_periodo'),
                                    data_fine_periodo=linea.get('data_fine_periodo'),
                                    prezzo_unitario=linea.get('prezzo_unitario'),
                                    prezzo_totale=linea.get('prezzo_totale'),
                                    aliquota_iva=linea.get('aliquota_iva'),
                                    natura=linea.get('natura'),
                                    tipo_cessione_prestazione=linea.get('tipo_cessione_prestazione'),
                                    riferimento_amministrazione=linea.get('riferimento_amministrazione'),
                                    codice_articolo=linea.get('codice_articolo'),
                                )
                            )

                        for riepilogo in dati.get('riepilogo_iva', []):
                            esistente.riepiloghi.append(
                                FatturaAmministrazioneRiepilogo(
                                    aliquota_iva=riepilogo.get('aliquota'),
                                    natura=riepilogo.get('natura'),
                                    imponibile=riepilogo.get('imponibile'),
                                    imposta=riepilogo.get('imposta'),
                                    esigibilita_iva=riepilogo.get('esigibilita'),
                                    riferimento_normativo=riepilogo.get('riferimento_normativo'),
                                )
                            )

                        for pagamento in dati.get('dettagli_pagamento', []):
                            esistente.pagamenti_programmati.append(
                                FatturaAmministrazionePagamento(
                                    modalita_pagamento=pagamento.get('modalita_pagamento'),
                                    data_riferimento=pagamento.get('data_riferimento'),
                                    giorni_termine=pagamento.get('giorni_termine'),
                                    data_scadenza=pagamento.get('data_scadenza'),
                                    importo=pagamento.get('importo'),
                                    codice_pagamento=pagamento.get('codice_pagamento'),
                                    iban=pagamento.get('iban'),
                                    banca=pagamento.get('istituto_finanziario') or pagamento.get('banca'),
                                    note=build_pagamento_note(pagamento),
                                )
                            )

                        for ricezione in dati.get('dati_ricezione', []):
                            # Converte riferimento_numero_linea da array a intero se necessario
                            rif_linea_raw = ricezione.get('riferimento_numero_linea')
                            
                            # Debug: verifica cosa viene passato
                            if rif_linea_raw is not None and isinstance(rif_linea_raw, list):
                                print(f"[DEBUG] Trovato array: {rif_linea_raw}, tipo: {type(rif_linea_raw)}")
                            
                            rif_linea = None
                            
                            if rif_linea_raw is not None:
                                if isinstance(rif_linea_raw, list):
                                    # Se è un array, prendi il primo elemento
                                    if rif_linea_raw and len(rif_linea_raw) > 0:
                                        try:
                                            rif_linea = int(str(rif_linea_raw[0]).strip())
                                            print(f"[DEBUG] Convertito da array: {rif_linea_raw[0]} -> {rif_linea}")
                                        except (ValueError, TypeError, IndexError) as e:
                                            print(f"[DEBUG] Errore conversione array: {e}")
                                            rif_linea = None
                                else:
                                    # Se non è un array, prova a convertirlo direttamente
                                    try:
                                        rif_linea = int(str(rif_linea_raw).strip())
                                    except (ValueError, TypeError):
                                        rif_linea = None
                            
                            # Verifica finale: assicurati che sia un intero o None
                            if rif_linea is not None and not isinstance(rif_linea, int):
                                try:
                                    rif_linea = int(rif_linea)
                                except (ValueError, TypeError):
                                    rif_linea = None
                            
                            # Debug: verifica il tipo prima di creare l'oggetto
                            if rif_linea is not None and not isinstance(rif_linea, int):
                                print(f"[DEBUG] ERRORE: rif_linea non è un intero! Tipo: {type(rif_linea)}, Valore: {rif_linea}")
                                rif_linea = None
                            
                            # Crea l'oggetto e verifica esplicitamente il tipo
                            ricezione_obj = FatturaAmministrazioneRicezione(
                                riferimento_numero_linea=rif_linea if isinstance(rif_linea, (int, type(None))) else None,
                                id_documento=ricezione.get('id_documento'),
                            )
                            esistente.ricezioni.append(ricezione_obj)

                        importate_uscita += 1
                        
                        # Chiama callback di progresso per fatture duplicate
                        if progress_callback:
                            stats = {
                                'importate_emesse': importate_entrata,
                                'importate_amministrazione': importate_uscita,
                                'errate': errate,
                                'duplicate_emesse': duplicate_entrata,
                                'duplicate_amministrazione': duplicate_uscita,
                                'current_file': os.path.basename(xml_file_path)
                            }
                            progress_callback(current_file, total_files, stats)
                    else:
                        fattura = FatturaAmministrazione(
                            azienda_id=azienda_id if azienda_id else default_azienda_id,  # IMPORTANTE: associa all'azienda
                            tipo=TipoFattura.USCITA,
                            numero=dati['numero'],
                            data_fattura=dati['data_fattura'],
                            data_registrazione=dati['data_fattura'],
                            divisa=dati.get('divisa'),
                            tipo_documento=dati.get('tipo_documento'),
                            fornitore_id=fornitore_id,
                            importo_totale=dati['importo_totale'],
                            importo_iva=importo_iva,
                            importo_netto=importo_netto,
                            importo_pagato=importo_pagato,
                            stato_pagamento=stato_pagamento,
                            data_scadenza=dati['data_scadenza'],
                            # condizioni_pagamento viene mappato nei pagamenti come modalita_pagamento
                            categoria=categoria_default,
                            note=dati.get('causale')
                        )

                        # COSTRUZIONE NOTE AGGIUNTIVE (Amministrazione Nuova)
                        note_extra = []
                        # 1. Dati Ordine Acquisto
                        if dati.get('dati_ordine_acquisto'):
                            for doc in dati['dati_ordine_acquisto']:
                                doc_note = f"Rif. Ordine: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                if doc.get('codice_cig'):
                                    doc_note += f" CIG: {doc['codice_cig']}"
                                if doc.get('codice_cup'):
                                    doc_note += f" CUP: {doc['codice_cup']}"
                                note_extra.append(doc_note)
                        
                        # 2. Dati Contratto
                        if dati.get('dati_contratto'):
                             for doc in dati['dati_contratto']:
                                doc_note = f"Rif. Contratto: {doc.get('id_documento', 'N/D')}"
                                if doc.get('data'):
                                    doc_note += f" del {doc['data']}"
                                note_extra.append(doc_note)
                        
                        # 3. Dati DDT
                        if dati.get('dati_ddt'):
                            for ddt in dati['dati_ddt']:
                                ddt_note = f"Rif. DDT: {ddt.get('numero_ddt', 'N/D')}"
                                if ddt.get('data_ddt'):
                                    ddt_note += f" del {ddt['data_ddt']}"
                                note_extra.append(ddt_note)

                        # 4. Dati Trasporto
                        if dati.get('dati_trasporto'):
                            trasp = dati['dati_trasporto']
                            trasp_parts = []
                            if trasp.get('vettore'): trasp_parts.append(f"Vettore: {trasp['vettore']}")
                            if trasp.get('descrizione'): trasp_parts.append(f"Descr: {trasp['descrizione']}")
                            if trasp.get('numero_colli'): trasp_parts.append(f"Colli: {trasp['numero_colli']}")
                            if trasp.get('peso_lordo'): trasp_parts.append(f"Peso: {trasp['peso_lordo']}kg")
                            if trasp.get('data_ora_ritiro'): trasp_parts.append(f"Ritiro: {trasp['data_ora_ritiro']}")
                            if trasp_parts:
                                note_extra.append("Trasporto: " + ", ".join(trasp_parts))

                        if note_extra:
                            current_note = fattura.note or ""
                            new_note_block = "\n".join(note_extra)
                            fattura.note = (current_note + "\n\n" + new_note_block).strip()

                        fattura.dati_xml = metadata_unificata
                        fattura.xml_raw = xml_content
                        fattura.righe = dati.get('righe')  # Salva righe in formato JSON
                    
                        db.add(fattura)
                        db.flush()
                        ensure_prima_nota_for_fattura_amministrazione(db, fattura, default_azienda_id)

                        for linea in dati.get('dettaglio_linee', []):
                            db.add(
                                FatturaAmministrazioneLinea(
                                    fattura_id=fattura.id,
                                    numero_linea=linea.get('numero_linea'),
                                    descrizione=linea.get('descrizione'),
                                    quantita=linea.get('quantita'),
                                    unita_misura=linea.get('unita_misura'),
                                    data_inizio_periodo=linea.get('data_inizio_periodo'),
                                    data_fine_periodo=linea.get('data_fine_periodo'),
                                    prezzo_unitario=linea.get('prezzo_unitario'),
                                    prezzo_totale=linea.get('prezzo_totale'),
                                    aliquota_iva=linea.get('aliquota_iva'),
                                    natura=linea.get('natura'),
                                    tipo_cessione_prestazione=linea.get('tipo_cessione_prestazione'),
                                    riferimento_amministrazione=linea.get('riferimento_amministrazione'),
                                    codice_articolo=linea.get('codice_articolo'),
                                )
                            )

                        for riepilogo in dati.get('riepilogo_iva', []):
                            db.add(
                                FatturaAmministrazioneRiepilogo(
                                    fattura_id=fattura.id,
                                    aliquota_iva=riepilogo.get('aliquota'),
                                    natura=riepilogo.get('natura'),
                                    imponibile=riepilogo.get('imponibile'),
                                    imposta=riepilogo.get('imposta'),
                                    esigibilita_iva=riepilogo.get('esigibilita'),
                                    riferimento_normativo=riepilogo.get('riferimento_normativo'),
                                )
                            )

                        for pagamento in dati.get('dettagli_pagamento', []):
                            db.add(
                                FatturaAmministrazionePagamento(
                                    fattura_id=fattura.id,
                                    modalita_pagamento=pagamento.get('modalita_pagamento'),
                                    data_riferimento=pagamento.get('data_riferimento'),
                                    giorni_termine=pagamento.get('giorni_termine'),
                                    data_scadenza=pagamento.get('data_scadenza'),
                                    importo=pagamento.get('importo'),
                                    codice_pagamento=pagamento.get('codice_pagamento'),
                                    iban=pagamento.get('iban'),
                                    banca=pagamento.get('istituto_finanziario') or pagamento.get('banca'),
                                    note=build_pagamento_note(pagamento),
                                )
                            )

                        for ricezione in dati.get('dati_ricezione', []):
                            # Converte riferimento_numero_linea da array a intero se necessario
                            rif_linea_raw = ricezione.get('riferimento_numero_linea')
                            rif_linea = None
                            
                            if rif_linea_raw is not None:
                                if isinstance(rif_linea_raw, list):
                                    # Se è un array, prendi il primo elemento
                                    if rif_linea_raw and len(rif_linea_raw) > 0:
                                        try:
                                            rif_linea = int(str(rif_linea_raw[0]).strip())
                                        except (ValueError, TypeError, IndexError):
                                            rif_linea = None
                                else:
                                    # Se non è un array, prova a convertirlo direttamente
                                    try:
                                        rif_linea = int(str(rif_linea_raw).strip())
                                    except (ValueError, TypeError):
                                        rif_linea = None
                            
                            # Verifica finale: assicurati che sia un intero o None
                            if rif_linea is not None:
                                if not isinstance(rif_linea, int):
                                    try:
                                        rif_linea = int(rif_linea)
                                    except (ValueError, TypeError):
                                        rif_linea = None
                            
                            # Debug: verifica il tipo prima di creare l'oggetto
                            if rif_linea is not None and not isinstance(rif_linea, int):
                                print(f"[DEBUG] ERRORE: rif_linea non è un intero! Tipo: {type(rif_linea)}, Valore: {rif_linea}")
                                rif_linea = None
                            
                            # Crea l'oggetto e verifica esplicitamente il tipo
                            ricezione_obj = FatturaAmministrazioneRicezione(
                                fattura_id=fattura.id,
                                riferimento_numero_linea=rif_linea if isinstance(rif_linea, (int, type(None))) else None,
                                id_documento=ricezione.get('id_documento'),
                            )
                            db.add(ricezione_obj)

                        db.commit()  # Commit dopo ogni fattura
                        importate_uscita += 1
                        
                        # Chiama callback di progresso
                        if progress_callback:
                            stats = {
                                'importate_emesse': importate_entrata,
                                'importate_amministrazione': importate_uscita,
                                'errate': errate,
                                'duplicate_emesse': duplicate_entrata,
                                'duplicate_amministrazione': duplicate_uscita,
                                'current_file': os.path.basename(xml_file_path),
                                'ultimo_errore': None
                            }
                            progress_callback(current_file, total_files, stats)
                
            except Exception as e:
                errate += 1
                error_msg = f'{os.path.basename(xml_file_path)}: {str(e)}'
                errori.append(error_msg)
                # Rollback in caso di errore per permettere il commit successivo
                try:
                    db.rollback()
                except Exception:
                    pass  # Ignora errori di rollback
                # Chiama callback anche per errori
                if progress_callback:
                    stats = {
                        'importate_emesse': importate_entrata,
                        'importate_amministrazione': importate_uscita,
                        'errate': errate,
                        'duplicate_emesse': duplicate_entrata,
                        'duplicate_amministrazione': duplicate_uscita,
                        'current_file': os.path.basename(xml_file_path),
                        'ultimo_errore': error_msg  # Aggiungi l'ultimo errore
                    }
                    progress_callback(current_file, total_files, stats)
                continue
        
        print(f"[IMPORT XML SERVICE] Importazione completata:")
        print(f"  - File XML processati: {len(xml_files)}")
        print(f"  - Fatture emesse: {importate_entrata}")
        print(f"  - Fatture amministrazione: {importate_uscita}")
        print(f"  - Fatture errate: {errate}")
        print(f"  - Errori totali: {len(errori)}")
        if errori:
            print(f"  - Primi errori: {errori[:3]}")
        
        # Anche se ci sono errori, restituisci success=True se almeno alcuni file sono stati processati
        # Questo permette di vedere i risultati parziali
        success = (importate_entrata > 0 or importate_uscita > 0) or (errate == 0 and len(errori) == 0)
        print(f"[IMPORT XML SERVICE] Success finale: {success}")
        
        return {
            'success': success,
            'importate_emesse': importate_entrata,
            'importate_amministrazione': importate_uscita,
            'errate': errate,
            'duplicate_emesse': duplicate_entrata,
            'duplicate_amministrazione': duplicate_uscita,
            'errori': errori[:50]  # Limita a 50 errori
        }
        
    except Exception as e:
        db.rollback()
        return {
            'success': False,
            'error': str(e),
            'importate_emesse': 0,
            'importate_amministrazione': 0,
            'errate': 0,
            'duplicate_emesse': 0,
            'duplicate_amministrazione': 0
        }
    finally:
        # Rimuovi cartella temporanea se creata
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)

