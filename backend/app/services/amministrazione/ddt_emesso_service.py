"""
Servizio per la gestione dei DDT emessi
"""
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from datetime import date, datetime
from decimal import Decimal

from app.models.amministrazione.ddt_emesso import DdtEmesso
from app.models.amministrazione.fornitore import Fornitore
from app.models.impostazioni import Impostazioni
from app.schemas.amministrazione.ddt_emesso import (
    DdtEmessoCreate,
    DdtEmessoUpdate,
)


def get_ddt_emessi(
    db: Session,
    azienda_id: Optional[int] = None,
    cliente_id: Optional[int] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    skip: int = 0,
    limit: int = 1000
) -> List[DdtEmesso]:
    """
    Recupera i DDT emessi con filtri opzionali
    """
    query = db.query(DdtEmesso).filter(DdtEmesso.deleted_at.is_(None))
    
    if azienda_id:
        query = query.filter(DdtEmesso.azienda_id == azienda_id)
    
    if cliente_id:
        query = query.filter(DdtEmesso.cliente_id == cliente_id)
    
    if data_da:
        query = query.filter(DdtEmesso.data >= data_da)
    
    if data_a:
        query = query.filter(DdtEmesso.data <= data_a)
    
    return query.order_by(DdtEmesso.data.desc(), DdtEmesso.numero_progressivo.desc()).offset(skip).limit(limit).all()


def get_ddt_emesso(
    db: Session,
    ddt_id: int
) -> Optional[DdtEmesso]:
    """
    Recupera un DDT emesso per ID
    """
    return db.query(DdtEmesso).filter(
        DdtEmesso.id == ddt_id,
        DdtEmesso.deleted_at.is_(None)
    ).first()


def get_next_ddt_number(
    db: Session,
    azienda_id: int,
    anno: Optional[int] = None,
    numero_progressivo: Optional[int] = None
) -> tuple[int, int, str]:
    """
    Calcola il prossimo numero DDT per l'azienda e l'anno specificati.
    
    Args:
        db: Database session
        azienda_id: ID azienda
        anno: Anno di riferimento (default: anno corrente)
        numero_progressivo: Numero progressivo da usare (se None, calcola automaticamente)
    
    Returns:
        Tuple (numero_progressivo, anno, numero_formattato)
    """
    if anno is None:
        anno = date.today().year
    
    # Recupera formato numerazione dalle impostazioni
    formato_numero = get_ddt_number_format(db, azienda_id)
    
    # Se numero_progressivo non è specificato, calcola il prossimo disponibile
    if numero_progressivo is None:
        # Trova il numero progressivo massimo per l'anno
        max_progressivo = db.query(func.max(DdtEmesso.numero_progressivo)).filter(
            DdtEmesso.azienda_id == azienda_id,
            DdtEmesso.anno == anno,
            DdtEmesso.deleted_at.is_(None)
        ).scalar()
        
        numero_progressivo = (max_progressivo or 0) + 1
    
    # Formatta il numero secondo il formato configurato
    numero_formattato = format_ddt_number(numero_progressivo, anno, formato_numero)
    
    return numero_progressivo, anno, numero_formattato


def get_ddt_number_format(db: Session, azienda_id: int) -> str:
    """
    Recupera il formato di numerazione DDT dalle impostazioni.
    Default: "{progressivo}/{anno}" (es. "1/2026")
    """
    impostazione = db.query(Impostazioni).filter(
        Impostazioni.azienda_id == azienda_id,
        Impostazioni.modulo == 'ddt_emessi'
    ).first()
    
    if impostazione and isinstance(impostazione.configurazione, dict):
        formato = impostazione.configurazione.get('formato_numero')
        if formato:
            return formato
    
    # Default format
    return "{progressivo}/{anno}"


def format_ddt_number(progressivo: int, anno: int, formato: str) -> str:
    """
    Formatta il numero DDT secondo il formato specificato.
    
    Formati supportati:
    - "{progressivo}/{anno}" -> "1/2026"
    - "{progressivo:03d}/{anno}" -> "001/2026"
    - "{progressivo:02d}/{anno:02d}" -> "01/26"
    - "{progressivo:03d}-{anno:02d}" -> "001-26"
    """
    try:
        # Estrai anno a 2 cifre
        anno_2cifre = anno % 100
        
        # Sostituisci i placeholder
        numero = formato.format(
            progressivo=progressivo,
            anno=anno,
            anno_2cifre=anno_2cifre
        )
        return numero
    except (KeyError, ValueError):
        # Fallback a formato semplice
        return f"{progressivo}/{anno}"


def create_ddt_emesso(
    db: Session,
    ddt: DdtEmessoCreate,
    numero_progressivo: Optional[int] = None
) -> DdtEmesso:
    """
    Crea un nuovo DDT emesso.
    Se numero_progressivo non è specificato, viene calcolato automaticamente.
    """
    # Converti in dict per modifiche
    ddt_data = ddt.model_dump() if hasattr(ddt, 'model_dump') else ddt.dict()
    
    # Calcola numero se non specificato
    if ddt_data.get('numero_progressivo') is None:
        numero_prog, anno, numero = get_next_ddt_number(
            db, ddt_data['azienda_id'], ddt_data.get('anno'), numero_progressivo
        )
        ddt_data['numero_progressivo'] = numero_prog
        ddt_data['anno'] = anno
        ddt_data['numero'] = numero
    elif ddt_data.get('numero') is None:
        # Se numero_progressivo è specificato ma numero no, formatta
        formato = get_ddt_number_format(db, ddt_data['azienda_id'])
        if ddt_data.get('anno') is None:
            ddt_data['anno'] = date.today().year
        ddt_data['numero'] = format_ddt_number(
            ddt_data['numero_progressivo'], 
            ddt_data['anno'], 
            formato
        )
    
    # Popola snapshot destinatario se cliente_id è specificato
    if ddt_data.get('cliente_id') and not ddt_data.get('destinatario_nome'):
        cliente = db.query(Fornitore).filter(
            Fornitore.id == ddt_data['cliente_id'],
            Fornitore.deleted_at.is_(None)
        ).first()
        
        if cliente:
            ddt_data['destinatario_nome'] = cliente.nome
            ddt_data['destinatario_indirizzo'] = cliente.indirizzo
            ddt_data['destinatario_cap'] = cliente.indirizzo_cap
            ddt_data['destinatario_comune'] = cliente.indirizzo_comune
            ddt_data['destinatario_provincia'] = cliente.indirizzo_provincia
            ddt_data['destinatario_nazione'] = cliente.indirizzo_nazione or 'IT'
            ddt_data['destinatario_piva'] = cliente.partita_iva
            # CF non è nel modello Fornitore, quindi rimane None se non specificato
    
    # Crea il DDT dal dict modificato
    db_ddt = DdtEmesso(**ddt_data)
    db.add(db_ddt)
    db.commit()
    db.refresh(db_ddt)
    return db_ddt


def update_ddt_emesso(
    db: Session,
    ddt_id: int,
    ddt_update: DdtEmessoUpdate
) -> Optional[DdtEmesso]:
    """
    Aggiorna un DDT emesso esistente
    """
    ddt = get_ddt_emesso(db, ddt_id)
    if not ddt:
        return None
    
    # Usa dict() per compatibilità con Pydantic v1 e v2
    update_data = ddt_update.dict(exclude_unset=True) if hasattr(ddt_update, 'dict') else ddt_update.model_dump(exclude_unset=True)
    
    # Rimuovi campi immutabili (numero_progressivo, anno, numero) dall'update se presenti
    # Questi campi non possono essere modificati dopo la creazione
    update_data.pop('numero_progressivo', None)
    update_data.pop('anno', None)
    update_data.pop('numero', None)
    update_data.pop('azienda_id', None)  # Anche azienda_id non può essere modificato
    
    # Se viene aggiornato numero_progressivo o anno (non dovrebbe mai accadere), riformatta il numero
    if 'numero_progressivo' in update_data or 'anno' in update_data:
        if 'numero_progressivo' in update_data and update_data['numero_progressivo'] is not None:
            ddt.numero_progressivo = update_data['numero_progressivo']
        if 'anno' in update_data and update_data['anno'] is not None:
            ddt.anno = update_data['anno']
        formato = get_ddt_number_format(db, ddt.azienda_id)
        ddt.numero = format_ddt_number(ddt.numero_progressivo, ddt.anno, formato)
        update_data.pop('numero', None)  # Rimuovi numero da update_data se presente
    
    # Aggiorna altri campi (escludi None per campi che non devono essere null)
    for field, value in update_data.items():
        # Non aggiornare se il valore è None e il campo è NOT NULL nel database
        if value is None and field in ['numero_progressivo', 'anno', 'numero', 'data', 'azienda_id']:
            continue
        setattr(ddt, field, value)
    
    db.commit()
    db.refresh(ddt)
    return ddt


def delete_ddt_emesso(
    db: Session,
    ddt_id: int
) -> bool:
    """
    Soft delete di un DDT emesso
    """
    ddt = get_ddt_emesso(db, ddt_id)
    if not ddt:
        return False
    
    ddt.deleted_at = datetime.utcnow()
    db.commit()
    return True

