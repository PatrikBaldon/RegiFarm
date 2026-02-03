"""
Servizio per la gestione dei contratti di soccida
"""
from typing import List, Optional
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func
from datetime import date

from app.models.amministrazione.contratto_soccida import ContrattoSoccida
from app.models.amministrazione.fornitore import Fornitore
from app.models.allevamento.animale import Animale
from app.schemas.amministrazione.contratto_soccida import (
    ContrattoSoccidaCreate,
    ContrattoSoccidaUpdate,
    ContrattoSoccidaResponse,
    ContrattoSoccidaWithRelations,
)


def get_contratti_soccida(
    db: Session,
    azienda_id: Optional[int] = None,
    soccidante_id: Optional[int] = None,
    attivo: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ContrattoSoccida]:
    """
    Recupera i contratti di soccida con filtri opzionali
    """
    query = db.query(ContrattoSoccida).filter(ContrattoSoccida.deleted_at.is_(None))
    
    if azienda_id:
        query = query.filter(ContrattoSoccida.azienda_id == azienda_id)
    
    if soccidante_id:
        query = query.filter(ContrattoSoccida.soccidante_id == soccidante_id)
    
    if attivo is not None:
        query = query.filter(ContrattoSoccida.attivo == attivo)
    
    return query.order_by(ContrattoSoccida.data_inizio.desc()).offset(skip).limit(limit).all()


def get_contratto_soccida(
    db: Session,
    contratto_id: int,
    include_relations: bool = False
) -> Optional[ContrattoSoccida]:
    """
    Recupera un contratto di soccida per ID
    """
    query = db.query(ContrattoSoccida).filter(
        ContrattoSoccida.id == contratto_id,
        ContrattoSoccida.deleted_at.is_(None)
    )
    
    if include_relations:
        query = query.options(
            joinedload(ContrattoSoccida.soccidante),
            joinedload(ContrattoSoccida.azienda)
        )
    
    return query.first()


def create_contratto_soccida(
    db: Session,
    contratto: ContrattoSoccidaCreate
) -> ContrattoSoccida:
    """
    Crea un nuovo contratto di soccida
    """
    # Verifica che il soccidante esista e sia un cliente
    soccidante = db.query(Fornitore).filter(
        Fornitore.id == contratto.soccidante_id,
        Fornitore.deleted_at.is_(None)
    ).first()
    
    if not soccidante:
        raise ValueError(f"Fornitore con ID {contratto.soccidante_id} non trovato")
    
    # Verifica che sia un cliente (soccidante)
    if not soccidante.is_cliente:
        raise ValueError(f"Il fornitore {soccidante.nome} non è configurato come cliente (soccidante). Impostare 'is_cliente' a true.")
    
    db_contratto = ContrattoSoccida(**contratto.dict())
    db.add(db_contratto)
    db.commit()
    db.refresh(db_contratto)
    return db_contratto


def update_contratto_soccida(
    db: Session,
    contratto_id: int,
    contratto_update: ContrattoSoccidaUpdate
) -> Optional[ContrattoSoccida]:
    """
    Aggiorna un contratto di soccida esistente
    """
    db_contratto = get_contratto_soccida(db, contratto_id)
    
    if not db_contratto:
        return None
    
    update_data = contratto_update.dict(exclude_unset=True)
    
    for field, value in update_data.items():
        setattr(db_contratto, field, value)
    
    db.commit()
    db.refresh(db_contratto)
    return db_contratto


def delete_contratto_soccida(
    db: Session,
    contratto_id: int
) -> bool:
    """
    Soft delete di un contratto di soccida
    """
    db_contratto = get_contratto_soccida(db, contratto_id)
    
    if not db_contratto:
        return False
    
    # Verifica che non ci siano animali associati
    animali_count = db.query(func.count(Animale.id)).filter(
        Animale.contratto_soccida_id == contratto_id,
        Animale.deleted_at.is_(None)
    ).scalar()
    
    if animali_count > 0:
        raise ValueError(
            f"Impossibile eliminare il contratto: ci sono {animali_count} animali associati. "
            "Rimuovi prima gli animali dal contratto."
        )
    
    from datetime import datetime, timezone
    db_contratto.deleted_at = datetime.now(timezone.utc)
    db.commit()
    return True


def get_contratti_soccida_with_stats(
    db: Session,
    azienda_id: Optional[int] = None
) -> List[dict]:
    """
    Recupera i contratti di soccida con statistiche (numero animali)
    Ritorna una lista di dizionari con tutte le informazioni
    OTTIMIZZATO: usa subquery per conteggio animali invece di N+1
    """
    from sqlalchemy.orm import aliased
    from sqlalchemy import literal_column
    
    # Subquery per conteggio animali per contratto (1 query invece di N)
    animali_count_subq = db.query(
        Animale.contratto_soccida_id,
        func.count(Animale.id).label('count')
    ).filter(
        Animale.contratto_soccida_id.isnot(None),
        Animale.deleted_at.is_(None)
    ).group_by(Animale.contratto_soccida_id).subquery()
    
    query = db.query(ContrattoSoccida).filter(
        ContrattoSoccida.deleted_at.is_(None)
    )
    
    if azienda_id:
        query = query.filter(ContrattoSoccida.azienda_id == azienda_id)
    
    contratti = query.options(
        joinedload(ContrattoSoccida.soccidante),
        joinedload(ContrattoSoccida.azienda)
    ).all()
    
    # Recupera i conteggi in un dict (1 query)
    contratto_ids = [c.id for c in contratti]
    animali_counts = {}
    if contratto_ids:
        counts = db.query(
            animali_count_subq.c.contratto_soccida_id,
            animali_count_subq.c.count
        ).filter(
            animali_count_subq.c.contratto_soccida_id.in_(contratto_ids)
        ).all()
        animali_counts = {row[0]: row[1] for row in counts}
    
    # Import una volta sola fuori dal loop
    from app.schemas.amministrazione.fornitore import FornitoreResponse
    from app.schemas.allevamento.azienda import AziendaResponse
    
    result = []
    for contratto in contratti:
        contratto_dict = ContrattoSoccidaResponse.from_orm(contratto).dict()
        contratto_dict["numero_animali"] = animali_counts.get(contratto.id, 0)
        
        # Aggiungi informazioni soccidante se disponibile
        if contratto.soccidante:
            contratto_dict["soccidante"] = FornitoreResponse.from_orm(contratto.soccidante).dict()
        
        # Aggiungi informazioni azienda se disponibile
        if contratto.azienda:
            contratto_dict["azienda"] = AziendaResponse.from_orm(contratto.azienda).dict()
        
        result.append(contratto_dict)
    
    return result


def get_soccidanti_disponibili(
    db: Session,
    azienda_id: Optional[int] = None
) -> List[Fornitore]:
    """
    Recupera tutti i clienti (soccidanti) disponibili
    Un fornitore è un soccidante se is_cliente = True
    """
    query = db.query(Fornitore).filter(
        Fornitore.is_cliente == True,
        Fornitore.deleted_at.is_(None)
    )
    
    return query.order_by(Fornitore.nome).all()


def get_animali_by_contratto(
    db: Session,
    contratto_id: int
) -> List[Animale]:
    """
    Recupera tutti gli animali associati a un contratto di soccida
    """
    return db.query(Animale).filter(
        Animale.contratto_soccida_id == contratto_id,
        Animale.deleted_at.is_(None)
    ).all()

