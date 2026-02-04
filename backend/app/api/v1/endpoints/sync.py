"""
Sync Endpoints - Sincronizzazione batch per database locale

Questi endpoint sono ottimizzati per la sincronizzazione offline-first:
- /sync/pull: Scarica tutti i dati dell'azienda in una singola chiamata
- /sync/pull/stream: Sync streaming (una tabella alla volta, memoria costante)
- /sync/push: Invia modifiche locali in batch
- /sync/incremental: Scarica solo i dati modificati dopo un timestamp

Vantaggi:
- 1 chiamata invece di 15+ separate
- Meno overhead HTTP
- Dati consistenti (transazione unica)
- Supporto offline completo
"""

import gc
import json
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_
from pydantic import BaseModel

from app.core.database import get_db
from app.models.allevamento.animale import Animale
from app.models.allevamento.decesso import Decesso
from app.models.allevamento.sede import Sede
from app.models.allevamento.stabilimento import Stabilimento
from app.models.allevamento.box import Box
from app.models.allevamento.azienda import Azienda
from app.models.amministrazione.fornitore import Fornitore
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.amministrazione.partita_animale import PartitaAnimale
from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
from app.models.amministrazione.partita_animale_movimento_finanziario import PartitaMovimentoFinanziario
from app.models.amministrazione.attrezzatura import Attrezzatura
from app.models.amministrazione.assicurazione_aziendale import AssicurazioneAziendale
from app.models.amministrazione.contratto_soccida import ContrattoSoccida
from app.models.amministrazione.pn import PNMovimento, PNConto, PNCategoria, PNPreferenze
from app.models.sanitario.farmaco import Farmaco
from app.models.terreni.terreno import Terreno
from app.models.terreni.ciclo import CicloTerreno, CicloTerrenoFase, CicloTerrenoCosto

router = APIRouter(prefix="/sync", tags=["sync"])


# ============================================
# SCHEMAS
# ============================================

class SyncPullRequest(BaseModel):
    """Richiesta per sync pull"""
    tables: Optional[List[str]] = None  # Se None, tutte le tabelle
    updated_after: Optional[datetime] = None  # Per sync incrementale


class SyncPullResponse(BaseModel):
    """Risposta sync pull"""
    azienda_id: int
    timestamp: datetime
    tables: Dict[str, List[Dict[str, Any]]]
    record_count: int


class SyncChange(BaseModel):
    """Singola modifica da sincronizzare"""
    table: str
    id: int
    operation: str  # 'insert', 'update', 'delete'
    data: Dict[str, Any]
    local_updated_at: datetime


class SyncPushRequest(BaseModel):
    """Richiesta per sync push"""
    azienda_id: int
    changes: List[SyncChange]


class SyncPushResult(BaseModel):
    """Risultato di una singola modifica"""
    table: str
    id: int
    success: bool
    error: Optional[str] = None
    server_id: Optional[int] = None  # ID assegnato dal server per nuovi record


class SyncPushResponse(BaseModel):
    """Risposta sync push"""
    processed: int
    errors: int
    results: List[SyncPushResult]


# ============================================
# CONFIGURAZIONE TABELLE
# ============================================

# Mapping tabelle -> modelli SQLAlchemy
TABLE_MODELS = {
    'aziende': Azienda,
    'sedi': Sede,
    'stabilimenti': Stabilimento,
    'box': Box,
    'animali': Animale,
    'decessi': Decesso,
    'fornitori': Fornitore,
    'fatture_amministrazione': FatturaAmministrazione,
    'partite_animali': PartitaAnimale,
    'terreni': Terreno,
    'attrezzature': Attrezzatura,
    'farmaci': Farmaco,
    'assicurazioni_aziendali': AssicurazioneAziendale,
    'contratti_soccida': ContrattoSoccida,
    'pn_conti': PNConto,
    'pn_preferenze': PNPreferenze,
    'pn_categorie': PNCategoria,
    'pn_movimenti': PNMovimento,
    'cicli_terreno': CicloTerreno,
    'cicli_terreno_fasi': CicloTerrenoFase,
    'cicli_terreno_costi': CicloTerrenoCosto,
}

# Tabelle con filtro azienda_id diretto
TABLES_WITH_AZIENDA_ID = [
    'sedi', 'animali', 'fornitori', 'fatture_amministrazione',
    'partite_animali', 'terreni', 'attrezzature', 'farmaci',
    'assicurazioni_aziendali', 'contratti_soccida',
    'pn_conti', 'pn_preferenze', 'pn_categorie', 'pn_movimenti',
    'cicli_terreno', 'cicli_terreno_costi'
]

# Ordine di sync per rispettare FK
SYNC_ORDER = [
    'aziende', 'sedi', 'stabilimenti', 'box', 'animali', 'decessi',
    'fornitori', 'fatture_amministrazione', 'partite_animali',
    'terreni', 'attrezzature', 'farmaci',
    'assicurazioni_aziendali', 'contratti_soccida',
    'pn_conti', 'pn_preferenze', 'pn_categorie', 'pn_movimenti',  # Prima Nota: conti e preferenze prima di categorie e movimenti
    'cicli_terreno', 'cicli_terreno_fasi', 'cicli_terreno_costi'  # Cicli terreno dopo terreni
]

# Limiti per tabella per prevenire OOM (memoria costante con streaming)
# None = nessun limite (tabelle piccole). Aziende con molti capi possono avere migliaia di animali.
SYNC_TABLE_LIMITS: Dict[str, Optional[int]] = {
    'aziende': 10,
    'sedi': 500,
    'stabilimenti': 500,
    'box': 2000,
    'animali': 10000,  # Aumentato da 200: le aziende bovine possono avere migliaia di capi
    'decessi': 5000,
    'fornitori': 500,
    'fatture_amministrazione': 5000,
    'partite_animali': 1000,
    'terreni': 500,
    'attrezzature': 500,
    'farmaci': 500,
    'assicurazioni_aziendali': 500,
    'contratti_soccida': 500,
    'pn_conti': 500,
    'pn_preferenze': 10,
    'pn_categorie': 500,
    'pn_movimenti': 5000,
    'cicli_terreno': 500,
    'cicli_terreno_fasi': 2000,
    'cicli_terreno_costi': 2000,
}


# ============================================
# HELPERS
# ============================================

def model_to_dict(record, table_name: str = None) -> Dict[str, Any]:
    """Converte un record SQLAlchemy in dizionario"""
    from decimal import Decimal
    from enum import Enum
    from datetime import date
    
    if record is None:
        return {}
    
    result = {}
    for column in record.__table__.columns:
        value = getattr(record, column.name)
        # Gestisci valori NULL
        if value is None:
            result[column.name] = None
            continue
        # Converti tipi non JSON-serializzabili
        if isinstance(value, datetime):
            value = value.isoformat()
        elif isinstance(value, date):
            value = value.isoformat()
        elif isinstance(value, Decimal):
            value = float(value)
        elif isinstance(value, Enum):
            value = value.value
        result[column.name] = value
    
    # Fatture: relazioni linee/pagamenti NON caricate in sync (riduce memoria); frontend le carica on-demand
    if table_name == 'fatture_amministrazione':
        result['pagamenti_programmati'] = []
        result['linee'] = []
    
    # Mapping speciali per compatibilità frontend
    # Terreni: backend usa 'denominazione', frontend usa 'nome'
    if table_name == 'terreni' and 'denominazione' in result:
        result['nome'] = result['denominazione']
    
    return result


def map_frontend_to_backend(table_name: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Mappa i dati dal frontend al formato backend"""
    mapped_data = data.copy()
    
    # Terreni: frontend usa 'nome', backend usa 'denominazione'
    if table_name == 'terreni':
        if 'nome' in mapped_data and 'denominazione' not in mapped_data:
            mapped_data['denominazione'] = mapped_data.pop('nome')
        # Rimuovi campi che non esistono nel backend
        frontend_only_fields = ['comune', 'foglio', 'particella', 'tipo_coltura']
        for field in frontend_only_fields:
            mapped_data.pop(field, None)
    
    return mapped_data


def get_records_for_azienda(
    db: Session,
    table_name: str,
    azienda_id: int,
    updated_after: Optional[datetime] = None,
    sede_ids: Optional[List[int]] = None,
    stabilimento_ids: Optional[List[int]] = None,
    max_records: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """
    Ottiene i record di una tabella filtrati per azienda.
    
    IMPORTANTE: Per prevenire OOM, usa SYNC_TABLE_LIMITS per tabella.
    Se ci sono più record, i più recenti vengono restituiti (ORDER BY updated_at DESC).
    Relazioni fatture (linee, pagamenti) non caricate qui; frontend le carica on-demand.
    """
    if max_records is None:
        max_records = SYNC_TABLE_LIMITS.get(table_name, 1000) or 10000
    model = TABLE_MODELS.get(table_name)
    if not model:
        # Se il modello non esiste (es. componenti_alimentari, mangimi_confezionati),
        # restituisci array vuoto invece di None
        return []
    
    query = db.query(model)
    # Relazioni fatture NON caricate (selectinload rimosso) per ridurre memoria; frontend on-demand
    
    # Filtro base: record non eliminati
    if hasattr(model, 'deleted_at'):
        query = query.filter(model.deleted_at.is_(None))
    
    # Filtro azienda
    if table_name == 'aziende':
        query = query.filter(model.id == azienda_id)
    elif table_name == 'pn_preferenze':
        # pn_preferenze ha unique constraint su azienda_id, quindi è un record singolo
        query = query.filter(model.azienda_id == azienda_id)
    elif table_name == 'stabilimenti':
        # Stabilimenti filtrati per sede_id
        if sede_ids:
            query = query.filter(model.sede_id.in_(sede_ids))
    elif table_name == 'box':
        # Box filtrati per stabilimento_id
        if stabilimento_ids:
            query = query.filter(model.stabilimento_id.in_(stabilimento_ids))
    elif table_name == 'decessi':
        # Decessi filtrati per animale_id degli animali dell'azienda
        from sqlalchemy import select
        animale_ids_subquery = db.query(Animale.id).filter(
            Animale.azienda_id == azienda_id,
            Animale.deleted_at.is_(None)
        ).subquery()
        query = query.filter(model.animale_id.in_(select(animale_ids_subquery.c.id)))
    elif table_name == 'cicli_terreno_fasi':
        # Fasi filtrate per ciclo_id dei cicli dell'azienda (subquery)
        # Usa select() esplicitamente per evitare warning SQLAlchemy
        from sqlalchemy import select
        ciclo_ids_subquery = db.query(CicloTerreno.id).filter(
            CicloTerreno.azienda_id == azienda_id,
            CicloTerreno.deleted_at.is_(None)
        ).subquery()
        query = query.filter(model.ciclo_id.in_(select(ciclo_ids_subquery.c.id)))
    elif table_name in TABLES_WITH_AZIENDA_ID:
        query = query.filter(model.azienda_id == azienda_id)
    
    # Filtro incrementale
    if updated_after and hasattr(model, 'updated_at'):
        query = query.filter(model.updated_at > updated_after)
    
    # Ordina per updated_at DESC per ottenere i record più recenti
    if hasattr(model, 'updated_at'):
        query = query.order_by(model.updated_at.desc())
    
    # Limita il numero di record per prevenire OOM
    query = query.limit(max_records)
    
    # Esegui query e converti in dizionari
    records = query.all()
    return [model_to_dict(r, table_name) for r in records]


# ============================================
# ENDPOINTS
# ============================================

@router.post("/pull")
async def sync_pull(
    azienda_id: int = Query(..., description="ID dell'azienda"),
    tables: Optional[str] = Query(None, description="Tabelle da sincronizzare (comma-separated); se omesso, tutte"),
    updated_after: Optional[datetime] = Query(None, description="Solo record aggiornati dopo questa data"),
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per sincronizzazione PULL (risposta in streaming).
    
    Risponde in streaming: una tabella alla volta, memoria costante ~200-300MB.
    Stesso formato JSON di prima; il client riceve il corpo completo quando lo stream finisce.
    Supporta full sync e sync incrementale (updated_after).
    """
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
    if not azienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Azienda {azienda_id} non trovata",
        )
    sedi = db.query(Sede).filter(
        Sede.azienda_id == azienda_id,
        Sede.deleted_at.is_(None),
    ).all()
    sede_ids = [s.id for s in sedi]
    stabilimenti = (
        db.query(Stabilimento).filter(
            Stabilimento.sede_id.in_(sede_ids),
            Stabilimento.deleted_at.is_(None),
        ).all()
        if sede_ids
        else []
    )
    stabilimento_ids = [s.id for s in stabilimenti]
    tables_to_sync = SYNC_ORDER
    if tables:
        requested = [t.strip() for t in tables.split(",")]
        tables_to_sync = [t for t in SYNC_ORDER if t in requested]
    return StreamingResponse(
        _sync_pull_stream_generator(
            db, azienda_id, updated_after, sede_ids, stabilimento_ids, tables_to_sync
        ),
        media_type="application/json",
    )


def _sync_pull_stream_generator(
    db: Session,
    azienda_id: int,
    updated_after: Optional[datetime],
    sede_ids: List[int],
    stabilimento_ids: List[int],
    tables_to_sync: Optional[List[str]] = None,
):
    """Generator per sync streaming: una tabella alla volta, libera memoria dopo ogni tabella."""
    order = tables_to_sync if tables_to_sync is not None else SYNC_ORDER
    ts = datetime.utcnow()
    yield '{"azienda_id":' + str(azienda_id) + ',"timestamp":"' + ts.isoformat() + 'Z","tables":{'
    first = True
    total_count = 0
    for table_name in order:
        try:
            records = get_records_for_azienda(
                db, table_name, azienda_id, updated_after,
                sede_ids=sede_ids, stabilimento_ids=stabilimento_ids,
                max_records=None,  # usa SYNC_TABLE_LIMITS
            )
            if records is None:
                records = []
            if not isinstance(records, list):
                records = []
            total_count += len(records)
            chunk = json.dumps(records, default=str)
            if not first:
                yield ","
            yield '"' + table_name + '":' + chunk
            first = False
            del records
        except Exception:
            if not first:
                yield ","
            yield '"' + table_name + '":[]'
            first = False
        finally:
            gc.collect()
    yield '},"record_count":' + str(total_count) + '}'


@router.post("/pull/stream")
async def sync_pull_stream(
    azienda_id: int = Query(..., description="ID dell'azienda"),
    updated_after: Optional[datetime] = Query(None, description="Solo record aggiornati dopo questa data"),
    db: Session = Depends(get_db),
):
    """
    Sync PULL in streaming: una tabella alla volta, memoria costante ~200-300MB.
    Stesso formato risposta di /sync/pull; il client riceve il JSON completo quando lo stream finisce.
    """
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
    if not azienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Azienda {azienda_id} non trovata",
        )
    sedi = db.query(Sede).filter(
        Sede.azienda_id == azienda_id,
        Sede.deleted_at.is_(None),
    ).all()
    sede_ids = [s.id for s in sedi]
    stabilimenti = (
        db.query(Stabilimento).filter(
            Stabilimento.sede_id.in_(sede_ids),
            Stabilimento.deleted_at.is_(None),
        ).all()
        if sede_ids
        else []
    )
    stabilimento_ids = [s.id for s in stabilimenti]
    return StreamingResponse(
        _sync_pull_stream_generator(
            db, azienda_id, updated_after, sede_ids, stabilimento_ids
        ),
        media_type="application/json",
    )


@router.post("/push", response_model=SyncPushResponse)
async def sync_push(
    request: SyncPushRequest,
    db: Session = Depends(get_db)
):
    """
    Endpoint batch per sincronizzazione PUSH.
    
    Accetta multiple modifiche in una singola chiamata.
    Tutte le modifiche vengono applicate in una transazione.
    
    **Vantaggi rispetto a chiamate separate:**
    - 1 chiamata invece di N (una per record)
    - Transazione unica (tutto o niente)
    - Validazione batch
    """
    results = []
    errors = 0
    
    # Verifica azienda
    azienda = db.query(Azienda).filter(Azienda.id == request.azienda_id).first()
    if not azienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Azienda {request.azienda_id} non trovata"
        )
    
    # Raggruppa modifiche per tabella per ottimizzare
    for change in request.changes:
        model = TABLE_MODELS.get(change.table)
        if not model:
            results.append(SyncPushResult(
                table=change.table,
                id=change.id,
                success=False,
                error=f"Tabella {change.table} non supportata"
            ))
            errors += 1
            continue
        
        try:
            # Mappa i dati dal frontend al formato backend
            mapped_data = map_frontend_to_backend(change.table, change.data)
            
            if change.operation == 'insert':
                # Insert
                new_record = model(**mapped_data)
                db.add(new_record)
                db.flush()  # Per ottenere l'ID
                results.append(SyncPushResult(
                    table=change.table,
                    id=change.id,
                    success=True,
                    server_id=new_record.id
                ))
            
            elif change.operation == 'update':
                # Update
                record = db.query(model).filter(model.id == change.id).first()
                if record:
                    for key, value in mapped_data.items():
                        if hasattr(record, key) and key not in ['id', 'created_at']:
                            setattr(record, key, value)
                    record.updated_at = datetime.utcnow()
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=True
                    ))
                else:
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=False,
                        error=f"Record {change.id} non trovato"
                    ))
                    errors += 1
            
            elif change.operation == 'delete':
                record = db.query(model).filter(model.id == change.id).first()
                if not record:
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=False,
                        error=f"Record {change.id} non trovato"
                    ))
                    errors += 1
                elif change.table == 'partite_animali':
                    # Eliminazione definitiva (hard delete) per partite: come da richiesta,
                    # la partita viene rimossa completamente e può essere reinserita come nuova.
                    partita_id = change.id
                    db.query(PartitaAnimaleAnimale).filter(
                        PartitaAnimaleAnimale.partita_animale_id == partita_id
                    ).delete(synchronize_session=False)
                    db.query(PNMovimento).filter(PNMovimento.partita_id == partita_id).update(
                        {PNMovimento.partita_id: None}, synchronize_session=False
                    )
                    db.query(PartitaMovimentoFinanziario).filter(
                        PartitaMovimentoFinanziario.partita_id == partita_id
                    ).delete(synchronize_session=False)
                    db.delete(record)
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=True
                    ))
                elif hasattr(record, 'deleted_at'):
                    # Soft delete per le altre tabelle con deleted_at
                    record.deleted_at = datetime.utcnow()
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=True
                    ))
                else:
                    results.append(SyncPushResult(
                        table=change.table,
                        id=change.id,
                        success=False,
                        error=f"Record {change.id} non eliminabile"
                    ))
                    errors += 1
        
        except Exception as e:
            results.append(SyncPushResult(
                table=change.table,
                id=change.id,
                success=False,
                error=str(e)
            ))
            errors += 1
    
    # Commit se non ci sono errori critici
    if errors < len(request.changes):
        try:
            db.commit()
        except Exception as e:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Errore commit: {str(e)}"
            )
    
    return SyncPushResponse(
        processed=len(results) - errors,
        errors=errors,
        results=results
    )


@router.get("/status")
async def sync_status(
    azienda_id: int = Query(..., description="ID dell'azienda"),
    db: Session = Depends(get_db)
):
    """
    Verifica lo stato dei dati per sincronizzazione.
    
    Ritorna conteggio record e ultimo aggiornamento per ogni tabella.
    Utile per verificare se la sync è necessaria.
    """
    # Verifica azienda
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
    if not azienda:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Azienda {azienda_id} non trovata"
        )
    
    # Prima ottieni sedi per filtrare stabilimenti/box
    sedi = db.query(Sede).filter(
        Sede.azienda_id == azienda_id,
        Sede.deleted_at.is_(None)
    ).all()
    sede_ids = [s.id for s in sedi]
    
    # Ottieni stabilimenti
    stabilimenti = db.query(Stabilimento).filter(
        Stabilimento.sede_id.in_(sede_ids),
        Stabilimento.deleted_at.is_(None)
    ).all() if sede_ids else []
    stabilimento_ids = [s.id for s in stabilimenti]
    
    status_info = {}
    
    for table_name in SYNC_ORDER:
        model = TABLE_MODELS.get(table_name)
        if not model:
            continue
        
        query = db.query(model)
        
        # Filtro base
        if hasattr(model, 'deleted_at'):
            query = query.filter(model.deleted_at.is_(None))
        
        # Filtro azienda
        if table_name == 'aziende':
            query = query.filter(model.id == azienda_id)
        elif table_name == 'stabilimenti' and sede_ids:
            query = query.filter(model.sede_id.in_(sede_ids))
        elif table_name == 'box' and stabilimento_ids:
            query = query.filter(model.stabilimento_id.in_(stabilimento_ids))
        elif table_name in TABLES_WITH_AZIENDA_ID:
            query = query.filter(model.azienda_id == azienda_id)
        
        count = query.count()
        
        # Ultimo aggiornamento
        last_updated = None
        if hasattr(model, 'updated_at'):
            last_record = query.order_by(model.updated_at.desc()).first()
            if last_record and last_record.updated_at:
                last_updated = last_record.updated_at.isoformat()
        
        status_info[table_name] = {
            'count': count,
            'last_updated': last_updated
        }
    
    return {
        'azienda_id': azienda_id,
        'timestamp': datetime.utcnow().isoformat(),
        'tables': status_info
    }

