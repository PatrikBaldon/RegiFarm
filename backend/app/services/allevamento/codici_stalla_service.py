"""
Service centralizzato per la gestione dinamica dei codici stalla
Riconosce automaticamente tutti i codici stalla gestiti dalla tabella sedi
"""
from typing import List, Set, Optional, Tuple, Dict
from sqlalchemy.orm import Session
from app.models.allevamento.sede import Sede


def _normalize_codice_stalla(value: Optional[str]) -> Optional[str]:
    """Normalizza un codice stalla rimuovendo spazi e portando a maiuscolo."""
    if not value:
        return None
    return value.strip().upper()


def get_codici_stalla_gestiti(db: Session, azienda_id: Optional[int] = None) -> Set[str]:
    """
    Ottiene tutti i codici stalla gestiti dal database.
    Se azienda_id è specificato, filtra solo per quella azienda.
    
    Args:
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Set di codici stalla gestiti
    """
    query = db.query(Sede).filter(Sede.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    sedi = query.all()
    return {
        _normalize_codice_stalla(sede.codice_stalla)
        for sede in sedi
        if sede.codice_stalla
    }


def is_codice_stalla_gestito(codice_stalla: str, db: Session, azienda_id: Optional[int] = None) -> bool:
    """
    Verifica se un codice stalla è gestito (presente nella tabella sedi).
    
    Args:
        codice_stalla: Codice stalla da verificare
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        True se il codice stalla è gestito, False altrimenti
    """
    if not codice_stalla:
        return False
    codice_norm = _normalize_codice_stalla(codice_stalla)
    codici_gestiti = get_codici_stalla_gestiti(db, azienda_id)
    return codice_norm in codici_gestiti


def get_sede_by_codice_stalla(codice_stalla: str, db: Session, azienda_id: Optional[int] = None) -> Optional[Sede]:
    """
    Ottiene la sede corrispondente a un codice stalla.
    
    Args:
        codice_stalla: Codice stalla da cercare
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Sede object se trovata, None altrimenti
    """
    if not codice_stalla:
        return None
    codice_norm = _normalize_codice_stalla(codice_stalla)
    query = db.query(Sede).filter(
        Sede.codice_stalla.ilike(codice_norm),
        Sede.deleted_at.is_(None)
    )
    
    if azienda_id is not None:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    return query.first()


def get_codice_stalla_default_ingresso(db: Session, azienda_id: Optional[int] = None) -> Optional[str]:
    """
    Ottiene il codice stalla di default per ingressi da codici stalla esterni (non gestiti).
    Per convenzione, usa il primo codice stalla trovato per l'azienda.
    Se azienda_id non è specificato, usa il primo codice stalla trovato.
    
    Args:
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Codice stalla di default o None se non ci sono sedi
    """
    codici_gestiti = get_codici_stalla_gestiti(db, azienda_id)
    if codici_gestiti:
        # Ordina per avere un comportamento prevedibile (usa il primo alfabeticamente)
        return sorted(codici_gestiti)[0]
    return None


def get_codice_stalla_default_uscita(db: Session, azienda_id: Optional[int] = None) -> Optional[str]:
    """
    Ottiene il codice stalla di default per uscite verso codici stalla esterni (non gestiti).
    Per convenzione, usa l'ultimo codice stalla trovato per l'azienda.
    Se azienda_id non è specificato, usa l'ultimo codice stalla trovato.
    
    Args:
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Codice stalla di default o None se non ci sono sedi
    """
    codici_gestiti = get_codici_stalla_gestiti(db, azienda_id)
    if codici_gestiti:
        # Ordina per avere un comportamento prevedibile (usa l'ultimo alfabeticamente)
        return sorted(codici_gestiti)[-1]
    return None


def get_codice_stalla_per_trasferimento_interno(
    codice_stalla_origine: str,
    db: Session,
    azienda_id: Optional[int] = None
) -> Optional[str]:
    """
    Determina il codice stalla di destinazione per un trasferimento interno.
    Se codice_stalla_origine è gestito, cerca un altro codice stalla gestito della stessa azienda.
    Se c'è solo un codice stalla gestito, restituisce None (non è un trasferimento interno).
    
    Args:
        codice_stalla_origine: Codice stalla di origine
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Codice stalla di destinazione per trasferimento interno, o None se non applicabile
    """
    if not codice_stalla_origine:
        return None
    
    codici_gestiti = get_codici_stalla_gestiti(db, azienda_id)
    codice_orig_norm = _normalize_codice_stalla(codice_stalla_origine)
    if codice_orig_norm not in codici_gestiti:
        return None
    
    # Se c'è solo un codice stalla gestito, non è un trasferimento interno
    if len(codici_gestiti) < 2:
        return None
    
    # Trova un altro codice stalla gestito (preferibilmente diverso da quello di origine)
    altri_codici = sorted(codici_gestiti - {codice_orig_norm})
    if altri_codici:
        return altri_codici[0]
    
    return None


def determina_codice_stalla_azienda(
    codice_stalla_provenienza: Optional[str],
    tipo: str,  # 'ingresso' o 'uscita'
    is_trasferimento_interno: bool,
    db: Session,
    azienda_id: Optional[int] = None
) -> Optional[str]:
    """
    Determina automaticamente il codice_stalla_azienda (codice stalla dell'allevamento dell'utente)
    in base alla logica di business:
    
    - Per ingressi da esterni: usa codice_stalla_default_ingresso
    - Per ingressi interni: determina il codice stalla di destinazione
    - Per uscite verso esterni: usa codice_stalla_default_uscita
    - Per uscite interne: determina il codice stalla di origine
    
    Args:
        codice_stalla_provenienza: Codice stalla di provenienza/destinazione esterna
        tipo: Tipo di partita ('ingresso' o 'uscita')
        is_trasferimento_interno: Se è un trasferimento interno
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Codice stalla azienda determinato o None
    """
    if tipo == 'ingresso':
        if is_trasferimento_interno and codice_stalla_provenienza:
            # Trasferimento interno: determina il codice stalla di destinazione
            return get_codice_stalla_per_trasferimento_interno(
                codice_stalla_provenienza,
                db,
                azienda_id
            )
        else:
            # Ingresso da esterno: usa il codice stalla di default per ingressi
            return get_codice_stalla_default_ingresso(db, azienda_id)
    
    elif tipo == 'uscita':
        if is_trasferimento_interno:
            # Uscita interna: il codice_stalla_azienda è quello di origine (da cui partono gli animali)
            if codice_stalla_provenienza and is_codice_stalla_gestito(codice_stalla_provenienza, db, azienda_id):
                # Se la destinazione è gestita, l'origine deve essere un altro codice gestito
                return get_codice_stalla_per_trasferimento_interno(
                    codice_stalla_provenienza,
                    db,
                    azienda_id
                )
            else:
                # Destinazione non gestita, usa il codice stalla di default per uscite
                return get_codice_stalla_default_uscita(db, azienda_id)
        else:
            # Uscita verso esterno: usa il codice stalla di default per uscite
            return get_codice_stalla_default_uscita(db, azienda_id)
    
    return None


def get_sedi_info(db: Session, azienda_id: Optional[int] = None) -> List[Dict]:
    """
    Ottiene informazioni sulle sedi gestite con i relativi codici stalla.
    
    Args:
        db: Database session
        azienda_id: ID azienda opzionale per filtrare
    
    Returns:
        Lista di dizionari con informazioni sulle sedi
    """
    query = db.query(Sede).filter(Sede.deleted_at.is_(None))
    
    if azienda_id is not None:
        query = query.filter(Sede.azienda_id == azienda_id)
    
    sedi = query.order_by(Sede.codice_stalla).all()
    
    return [
        {
            'id': sede.id,
            'nome': sede.nome,
            'codice_stalla': sede.codice_stalla,
            'azienda_id': sede.azienda_id
        }
        for sede in sedi
    ]

