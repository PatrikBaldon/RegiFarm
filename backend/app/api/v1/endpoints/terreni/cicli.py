"""Cicli Terreno endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.models.terreni.ciclo import (
    CicloTerreno as CicloTerrenoModel,
    CicloTerrenoFase as CicloTerrenoFaseModel,
    CicloTerrenoCosto as CicloTerrenoCostoModel,
)
from app.models.terreni.terreno import Terreno as TerrenoModel
from app.models.terreni.lavorazione import LavorazioneTerreno as LavorazioneModel
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.schemas.terreni import (
    CicloTerrenoCreate, CicloTerrenoUpdate, CicloTerrenoResponse,
    CicloTerrenoSummary, CicloTerrenoDetail,
    CicloTerrenoFaseCreate, CicloTerrenoFaseUpdate, CicloTerrenoFaseResponse,
    CicloTerrenoCostoCreate, CicloTerrenoCostoUpdate, CicloTerrenoCostoResponse,
)

router = APIRouter()

@router.get("/{terreno_id}/cicli", response_model=List[CicloTerrenoSummary])
def list_cicli_terreno(terreno_id: int, db: Session = Depends(get_db)):
    # Usa eager loading per caricare fasi e costi insieme ai cicli
    cicli = (
        db.query(CicloTerrenoModel)
        .options(
            selectinload(CicloTerrenoModel.fasi),
            selectinload(CicloTerrenoModel.costi)
        )
        .filter(CicloTerrenoModel.terreno_id == terreno_id, CicloTerrenoModel.deleted_at.is_(None))
        .order_by(CicloTerrenoModel.anno.desc(), CicloTerrenoModel.data_inizio.desc(), CicloTerrenoModel.created_at.desc())
        .all()
    )
    if not cicli:
        return []

    ciclo_ids = [c.id for c in cicli]
    # Raccogli tutti i costi dai cicli già caricati (evita query extra)
    costi = []
    for ciclo in cicli:
        costi.extend(ciclo.costi)

    fattura_ids = {c.fattura_amministrazione_id for c in costi if c.fattura_amministrazione_id}
    lavorazione_ids = {c.lavorazione_id for c in costi if c.lavorazione_id}

    fatture_map = {}
    if fattura_ids:
        fatture = (
            db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.id.in_(fattura_ids))
            .all()
        )
        fatture_map = {f.id: f for f in fatture}

    lavorazioni_map = {}
    if lavorazione_ids:
        lavorazioni = (
            db.query(LavorazioneModel)
            .filter(LavorazioneModel.id.in_(lavorazione_ids))
            .all()
        )
        lavorazioni_map = {l.id: l for l in lavorazioni}

    totals = {ciclo_id: Decimal("0") for ciclo_id in ciclo_ids}
    for costo in costi:
        # Calcola il totale sommando solo i costi associati alle fasi
        if costo.fase_id is not None:
            try:
                importo = _resolve_costo_amount(costo, fatture_map, lavorazioni_map)
                totals[costo.ciclo_id] = totals.get(costo.ciclo_id, Decimal("0")) + importo
            except Exception as e:
                # Se c'è un errore nella risoluzione, usa l'importo diretto o 0
                print(f"Errore nella risoluzione importo per costo {costo.id}: {e}")
                importo_fallback = Decimal(str(costo.importo)) if costo.importo is not None else Decimal("0")
                totals[costo.ciclo_id] = totals.get(costo.ciclo_id, Decimal("0")) + importo_fallback

    # Usa le fasi già caricate invece di fare una query separata
    fase_counts = {c.id: {"tot": 0, "done": 0} for c in cicli}
    for ciclo in cicli:
        for fase in ciclo.fasi:
            entry = fase_counts.setdefault(ciclo.id, {"tot": 0, "done": 0})
            entry["tot"] += 1
            if fase.data_fine is not None:
                entry["done"] += 1

    summaries: List[CicloTerrenoSummary] = []
    for ciclo in cicli:
        info = fase_counts.get(ciclo.id, {"tot": 0, "done": 0})
        summaries.append(
            CicloTerrenoSummary(
                id=ciclo.id,
                terreno_id=ciclo.terreno_id,
                coltura=ciclo.coltura,
                anno=ciclo.anno,
                data_inizio=ciclo.data_inizio,
                data_fine=ciclo.data_fine,
                superficie_coinvolta=float(ciclo.superficie_coinvolta)
                if ciclo.superficie_coinvolta is not None
                else None,
                totale_costi=totals.get(ciclo.id, Decimal("0")),
                fasi_concluse=info["done"],
                fasi_totali=info["tot"],
                created_at=ciclo.created_at,
                updated_at=ciclo.updated_at,
            )
        )
    return summaries

@router.get("/cicli/{ciclo_id}", response_model=CicloTerrenoDetail)
def get_ciclo_terreno(ciclo_id: int, db: Session = Depends(get_db)):
    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    fasi = (
        db.query(CicloTerrenoFaseModel)
        .filter(CicloTerrenoFaseModel.ciclo_id == ciclo_id)
        .order_by(
            CicloTerrenoFaseModel.ordine.asc(),
            CicloTerrenoFaseModel.data_inizio.asc(),
            CicloTerrenoFaseModel.id.asc(),
        )
        .all()
    )

    costi = (
        db.query(CicloTerrenoCostoModel)
        .filter(CicloTerrenoCostoModel.ciclo_id == ciclo_id)
        .order_by(CicloTerrenoCostoModel.data.asc(), CicloTerrenoCostoModel.created_at.asc())
        .all()
    )

    fattura_ids = {c.fattura_amministrazione_id for c in costi if c.fattura_amministrazione_id}
    lavorazione_ids = {c.lavorazione_id for c in costi if c.lavorazione_id}

    fatture_map = {}
    if fattura_ids:
        fatture = (
            db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.id.in_(fattura_ids))
            .all()
        )
        fatture_map = {f.id: f for f in fatture}

    lavorazioni_map = {}
    if lavorazione_ids:
        lavorazioni = (
            db.query(LavorazioneModel)
            .filter(LavorazioneModel.id.in_(lavorazione_ids))
            .all()
        )
        lavorazioni_map = {l.id: l for l in lavorazioni}

    fase_totals = {fase.id: Decimal("0") for fase in fasi}
    totale_costi = Decimal("0")
    costi_responses: List[CicloTerrenoCostoResponse] = []
    for costo in costi:
        try:
            serialized = _serialize_ciclo_costo(costo, fatture_map, lavorazioni_map)
            totale_costi += serialized.importo_risolto
            # Aggiungi il costo alla fase solo se la fase esiste ancora
            if costo.fase_id and costo.fase_id in fase_totals:
                fase_totals[costo.fase_id] += serialized.importo_risolto
            costi_responses.append(serialized)
        except Exception as e:
            # Log dell'errore ma continua con gli altri costi
            # In produzione potresti voler loggare questo errore
            print(f"Errore nella serializzazione del costo {costo.id}: {e}")
            # Aggiungi comunque il costo con valori di default per non perderlo
            try:
                importo_risolto = Decimal(str(costo.importo)) if costo.importo is not None else Decimal("0")
                fallback_response = CicloTerrenoCostoResponse(
                    id=costo.id,
                    ciclo_id=costo.ciclo_id,
                    fase_id=costo.fase_id,
                    terreno_id=costo.terreno_id,
                    azienda_id=costo.azienda_id,
                    descrizione=costo.descrizione or "Costo con errore di serializzazione",
                    data=costo.data,
                    importo=float(costo.importo) if costo.importo is not None else None,
                    importo_risolto=importo_risolto,
                    source_type=costo.source_type,
                    fattura_amministrazione_id=costo.fattura_amministrazione_id,
                    lavorazione_id=costo.lavorazione_id,
                    note=costo.note,
                    created_at=costo.created_at,
                    updated_at=costo.updated_at,
                    fattura=None,
                    lavorazione=None,
                )
                totale_costi += importo_risolto
                if costo.fase_id and costo.fase_id in fase_totals:
                    fase_totals[costo.fase_id] += importo_risolto
                costi_responses.append(fallback_response)
            except Exception as e2:
                # Se anche il fallback fallisce, logga ma continua
                print(f"Errore anche nel fallback per costo {costo.id}: {e2}")

    fasi_responses = [
        _serialize_ciclo_fase(fase, fase_totals.get(fase.id, Decimal("0")))
        for fase in fasi
    ]

    superficie = float(ciclo.superficie_coinvolta) if ciclo.superficie_coinvolta is not None else None

    return CicloTerrenoDetail(
        id=ciclo.id,
        azienda_id=ciclo.azienda_id,
        terreno_id=ciclo.terreno_id,
        coltura=ciclo.coltura,
        anno=ciclo.anno,
        data_inizio=ciclo.data_inizio,
        data_fine=ciclo.data_fine,
        superficie_coinvolta=superficie,
        note=ciclo.note,
        created_at=ciclo.created_at,
        updated_at=ciclo.updated_at,
        deleted_at=ciclo.deleted_at,
        totale_costi=totale_costi,
        fasi=fasi_responses,
        costi=costi_responses,
        costi_per_fase=[
            {"fase_id": fase.id, "totale": fase_totals.get(fase.id, Decimal("0")), "nome": fase.nome}
            for fase in fasi
        ],
    )


@router.post("/cicli", response_model=CicloTerrenoResponse, status_code=status.HTTP_201_CREATED)
def create_ciclo(data: CicloTerrenoCreate, db: Session = Depends(get_db)):
    terreno = (
        db.query(TerrenoModel)
        .filter(TerrenoModel.id == data.terreno_id)
        .first()
    )
    if not terreno:
        raise HTTPException(status_code=404, detail="Terreno non trovato")

    db_obj = CicloTerrenoModel(
        azienda_id=terreno.azienda_id,
        terreno_id=data.terreno_id,
        coltura=data.coltura,
        anno=data.anno,
        data_inizio=data.data_inizio,
        data_fine=data.data_fine,
        superficie_coinvolta=_normalize_superficie_coinvolta(data.superficie_coinvolta),
        note=data.note,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@router.put("/cicli/{ciclo_id}", response_model=CicloTerrenoResponse)
def update_ciclo(ciclo_id: int, update: CicloTerrenoUpdate, db: Session = Depends(get_db)):
    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    for field, value in update.dict(exclude_unset=True).items():
        if field == "superficie_coinvolta":
            value = _normalize_superficie_coinvolta(value)
        setattr(ciclo, field, value)
    ciclo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(ciclo)
    return ciclo


@router.delete("/cicli/{ciclo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ciclo(ciclo_id: int, db: Session = Depends(get_db)):
    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    ciclo.deleted_at = datetime.utcnow()
    db.commit()
    return None


@router.post("/cicli/{ciclo_id}/fasi", response_model=CicloTerrenoFaseResponse, status_code=status.HTTP_201_CREATED)
def create_ciclo_fase(ciclo_id: int, data: CicloTerrenoFaseCreate, db: Session = Depends(get_db)):
    # Usa ciclo_id dall'URL se non presente nel body (per compatibilità con sync)
    effective_ciclo_id = data.ciclo_id if data.ciclo_id is not None else ciclo_id
    
    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == effective_ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    payload = data.dict(exclude={"ciclo_id"})
    ordine = payload.get("ordine")
    if ordine is None:
        max_order = (
            db.query(func.max(CicloTerrenoFaseModel.ordine))
            .filter(CicloTerrenoFaseModel.ciclo_id == effective_ciclo_id)
            .scalar()
        )
        ordine = (max_order or 0) + 1

    fase = CicloTerrenoFaseModel(
        ciclo_id=effective_ciclo_id,
        nome=payload["nome"],
        tipo=payload["tipo"],
        ordine=ordine,
        data_inizio=payload.get("data_inizio"),
        data_fine=payload.get("data_fine"),
        note=payload.get("note"),
    )
    db.add(fase)
    db.commit()
    db.refresh(fase)
    return _serialize_ciclo_fase(fase)


@router.put("/cicli/fasi/{fase_id}", response_model=CicloTerrenoFaseResponse)
def update_ciclo_fase(fase_id: int, update: CicloTerrenoFaseUpdate, db: Session = Depends(get_db)):
    fase = db.query(CicloTerrenoFaseModel).filter(CicloTerrenoFaseModel.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase non trovata")

    for field, value in update.dict(exclude_unset=True).items():
        setattr(fase, field, value)
    fase.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(fase)

    costi_fase = db.query(CicloTerrenoCostoModel).filter(CicloTerrenoCostoModel.fase_id == fase.id).all()
    fatture_map = {}
    lavorazioni_map = {}
    if costi_fase:
        fattura_ids = {c.fattura_amministrazione_id for c in costi_fase if c.fattura_amministrazione_id}
        lavorazione_ids = {c.lavorazione_id for c in costi_fase if c.lavorazione_id}
        if fattura_ids:
            fatture = (
                db.query(FatturaAmministrazione)
                .filter(FatturaAmministrazione.id.in_(fattura_ids))
                .all()
            )
            fatture_map = {f.id: f for f in fatture}
        if lavorazione_ids:
            lavorazioni = (
                db.query(LavorazioneModel)
                .filter(LavorazioneModel.id.in_(lavorazione_ids))
                .all()
            )
            lavorazioni_map = {l.id: l for l in lavorazioni}
    totale = sum((_resolve_costo_amount(c, fatture_map, lavorazioni_map) for c in costi_fase), Decimal("0"))
    return _serialize_ciclo_fase(fase, totale)


@router.delete("/cicli/fasi/{fase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ciclo_fase(fase_id: int, db: Session = Depends(get_db)):
    fase = db.query(CicloTerrenoFaseModel).filter(CicloTerrenoFaseModel.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase non trovata")

    db.delete(fase)
    db.commit()
    return None


@router.post("/cicli/{ciclo_id}/costi", response_model=CicloTerrenoCostoResponse, status_code=status.HTTP_201_CREATED)
def create_ciclo_costo(ciclo_id: int, data: CicloTerrenoCostoCreate, db: Session = Depends(get_db)):
    # Usa ciclo_id dall'URL se non presente nel body (per compatibilità con sync)
    effective_ciclo_id = data.ciclo_id if data.ciclo_id is not None else ciclo_id
    
    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == effective_ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    # Usa terreno_id dal ciclo se non presente nel body (per compatibilità con sync)
    effective_terreno_id = data.terreno_id if data.terreno_id is not None else ciclo.terreno_id
    
    if effective_terreno_id != ciclo.terreno_id:
        raise HTTPException(status_code=400, detail="Il costo deve riferirsi allo stesso terreno del ciclo")

    fase = None
    effective_fase_id = None
    if data.fase_id:
        # Verifica se la fase esiste e appartiene al ciclo
        fase = (
            db.query(CicloTerrenoFaseModel)
            .filter(CicloTerrenoFaseModel.id == data.fase_id, CicloTerrenoFaseModel.ciclo_id == effective_ciclo_id)
            .first()
        )
        if not fase:
            # La fase non esiste o non appartiene al ciclo
            # Verifica se esiste ma appartiene a un altro ciclo
            fase_any = (
                db.query(CicloTerrenoFaseModel)
                .filter(CicloTerrenoFaseModel.id == data.fase_id)
                .first()
            )
            if fase_any:
                raise HTTPException(status_code=400, detail="La fase indicata non appartiene al ciclo selezionato")
            # Se la fase non esiste ancora (probabilmente non sincronizzata),
            # non possiamo creare il costo con un fase_id non valido
            # Impostiamo fase_id a None per evitare violazioni di foreign key
            effective_fase_id = None
        else:
            effective_fase_id = data.fase_id
    else:
        effective_fase_id = None

    source_type = data.source_type or "manuale"
    if source_type not in {"manuale", "fattura", "lavorazione"}:
        raise HTTPException(status_code=400, detail="Tipologia di costo non valida")

    fattura = None
    if source_type == "fattura":
        if not data.fattura_amministrazione_id:
            raise HTTPException(status_code=400, detail="Seleziona una fattura da collegare")
        fattura = (
            db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.id == data.fattura_amministrazione_id)
            .first()
        )
        if not fattura:
            raise HTTPException(status_code=404, detail="Fattura non trovata")
        fattura_azienda_id = getattr(fattura, "azienda_id", None)
        if fattura_azienda_id != ciclo.azienda_id:
            raise HTTPException(status_code=400, detail="La fattura non appartiene all'azienda del terreno")

    lavorazione = None
    if source_type == "lavorazione":
        if not data.lavorazione_id:
            raise HTTPException(status_code=400, detail="Seleziona una lavorazione da collegare")
        lavorazione = (
            db.query(LavorazioneModel)
            .filter(LavorazioneModel.id == data.lavorazione_id)
            .first()
        )
        if not lavorazione:
            raise HTTPException(status_code=404, detail="Lavorazione non trovata")
        if lavorazione.terreno_id != ciclo.terreno_id:
            raise HTTPException(status_code=400, detail="La lavorazione appartiene a un altro terreno")

    costo = CicloTerrenoCostoModel(
        ciclo_id=effective_ciclo_id,
        fase_id=effective_fase_id,
        azienda_id=ciclo.azienda_id,
        terreno_id=effective_terreno_id,
        source_type=source_type,
        descrizione=data.descrizione,
        data=data.data,
        importo=data.importo,
        fattura_amministrazione_id=data.fattura_amministrazione_id,
        lavorazione_id=data.lavorazione_id,
        note=data.note,
    )
    
    db.add(costo)
    db.commit()
    db.refresh(costo)

    fatture_map = {fattura.id: fattura} if fattura else {}
    lavorazioni_map = {lavorazione.id: lavorazione} if lavorazione else {}
    return _serialize_ciclo_costo(costo, fatture_map, lavorazioni_map)


@router.put("/cicli/costi/{costo_id}", response_model=CicloTerrenoCostoResponse)
def update_ciclo_costo(costo_id: int, update: CicloTerrenoCostoUpdate, db: Session = Depends(get_db)):
    costo = (
        db.query(CicloTerrenoCostoModel)
        .filter(CicloTerrenoCostoModel.id == costo_id)
        .first()
    )
    if not costo:
        raise HTTPException(status_code=404, detail="Costo non trovato")

    ciclo = (
        db.query(CicloTerrenoModel)
        .filter(CicloTerrenoModel.id == costo.ciclo_id, CicloTerrenoModel.deleted_at.is_(None))
        .first()
    )
    if not ciclo:
        raise HTTPException(status_code=404, detail="Ciclo non trovato")

    data = update.dict(exclude_unset=True)
    fase_id = data.get("fase_id", costo.fase_id)
    if fase_id:
        fase = (
            db.query(CicloTerrenoFaseModel)
            .filter(CicloTerrenoFaseModel.id == fase_id, CicloTerrenoFaseModel.ciclo_id == ciclo.id)
            .first()
        )
        if not fase:
            # Verifica se la fase esiste ma appartiene a un altro ciclo
            fase_any = (
                db.query(CicloTerrenoFaseModel)
                .filter(CicloTerrenoFaseModel.id == fase_id)
                .first()
            )
            if fase_any:
                raise HTTPException(status_code=400, detail="La fase indicata non appartiene al ciclo selezionato")
            # Se la fase non esiste, imposta fase_id a None per evitare violazioni di foreign key
            data["fase_id"] = None
            fase_id = None

    new_source_type = data.get("source_type", costo.source_type)
    fattura = None
    lavorazione = None

    fattura_id = data.get("fattura_amministrazione_id", costo.fattura_amministrazione_id)
    if new_source_type == "fattura":
        if not fattura_id:
            raise HTTPException(status_code=400, detail="Seleziona una fattura da collegare")
        fattura = (
            db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.id == fattura_id)
            .first()
        )
        if not fattura:
            raise HTTPException(status_code=404, detail="Fattura non trovata")
        if getattr(fattura, "azienda_id", ciclo.azienda_id) != ciclo.azienda_id:
            raise HTTPException(status_code=400, detail="La fattura non appartiene all'azienda del terreno")
    else:
        data.setdefault("fattura_amministrazione_id", None)

    lavorazione_id = data.get("lavorazione_id", costo.lavorazione_id)
    if new_source_type == "lavorazione":
        if not lavorazione_id:
            raise HTTPException(status_code=400, detail="Seleziona una lavorazione da collegare")
        lavorazione = (
            db.query(LavorazioneModel)
            .filter(LavorazioneModel.id == lavorazione_id)
            .first()
        )
        if not lavorazione:
            raise HTTPException(status_code=404, detail="Lavorazione non trovata")
        if lavorazione.terreno_id != ciclo.terreno_id:
            raise HTTPException(status_code=400, detail="La lavorazione appartiene a un altro terreno")
    else:
        data.setdefault("lavorazione_id", None)

    for field, value in data.items():
        setattr(costo, field, value)
    costo.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(costo)

    fatture_map = {}
    if costo.fattura_amministrazione_id:
        fattura = (
            fattura
            or db.query(FatturaAmministrazione)
            .filter(FatturaAmministrazione.id == costo.fattura_amministrazione_id)
            .first()
        )
        if fattura:
            fatture_map = {fattura.id: fattura}

    lavorazioni_map = {}
    if costo.lavorazione_id:
        lavorazione = (
            lavorazione
            or db.query(LavorazioneModel)
            .filter(LavorazioneModel.id == costo.lavorazione_id)
            .first()
        )
        if lavorazione:
            lavorazioni_map = {lavorazione.id: lavorazione}

    return _serialize_ciclo_costo(costo, fatture_map, lavorazioni_map)


@router.delete("/cicli/costi/{costo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ciclo_costo(costo_id: int, db: Session = Depends(get_db)):
    costo = (
        db.query(CicloTerrenoCostoModel)
        .filter(CicloTerrenoCostoModel.id == costo_id)
        .first()
    )
    if not costo:
        raise HTTPException(status_code=404, detail="Costo non trovato")

    db.delete(costo)
    db.commit()
    return None


# Helper functions

def _normalize_superficie_coinvolta(value):
    """Normalizza il valore della superficie coinvolta"""
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (ValueError, TypeError):
        return None


def _resolve_costo_amount(costo: CicloTerrenoCostoModel, fatture_map: dict, lavorazioni_map: dict) -> Decimal:
    """Risolve l'importo di un costo basandosi sul source_type"""
    # Priorità 1: Se c'è un importo esplicito (es. riga fattura selezionata), usalo SEMPRE
    # Questo è fondamentale: se l'importo è stato salvato esplicitamente, deve essere usato
    # IMPORTANTE: controllo anche se importo è 0, perché 0 è un valore valido (riga senza costo)
    if costo.importo is not None:
        try:
            # Converti in Decimal - gestisce sia Decimal che float che string
            if isinstance(costo.importo, Decimal):
                importo_decimal = costo.importo
            elif isinstance(costo.importo, (int, float)):
                importo_decimal = Decimal(str(costo.importo))
            else:
                # Prova a convertire da string o altro tipo
                importo_decimal = Decimal(str(costo.importo))
            # Usa sempre l'importo se è presente, anche se è 0 (è un valore esplicito salvato)
            # Non passiamo mai alla priorità 2 se importo è presente (anche se 0)
            return importo_decimal
        except (ValueError, TypeError, Exception) as e:
            # Se la conversione fallisce, loggiamo ma NON usiamo il totale fattura
            # perché l'importo esiste ma ha un problema - meglio 0 che il totale sbagliato
            print(f"Errore nella conversione importo per costo {costo.id}: {e}, tipo: {type(costo.importo)}, valore: {costo.importo}")
            # Ritorna 0 invece di passare alla priorità 2 (totale fattura)
            return Decimal("0")
    
    # Priorità 2: Se è una fattura, usa l'importo totale della fattura
    # SOLO se non c'è un importo esplicito valido
    if costo.source_type == "fattura" and costo.fattura_amministrazione_id:
        fattura = fatture_map.get(costo.fattura_amministrazione_id)
        if fattura:
            # Usa importo_netto se disponibile, altrimenti importo_totale
            importo_fattura = Decimal(str(fattura.importo_netto)) if hasattr(fattura, 'importo_netto') and fattura.importo_netto else Decimal(str(fattura.importo_totale))
            return importo_fattura
    # Priorità 3: Se è una lavorazione, usa il costo della lavorazione
    elif costo.source_type == "lavorazione" and costo.lavorazione_id:
        lavorazione = lavorazioni_map.get(costo.lavorazione_id)
        if lavorazione:
            # Usa il costo della lavorazione se disponibile
            if hasattr(lavorazione, 'costo') and lavorazione.costo is not None:
                return Decimal(str(lavorazione.costo))
    # Fallback: 0 se nessun importo disponibile
    return Decimal("0")


def _serialize_ciclo_costo(costo: CicloTerrenoCostoModel, fatture_map: dict, lavorazioni_map: dict) -> CicloTerrenoCostoResponse:
    """Serializza un costo del ciclo in un CicloTerrenoCostoResponse"""
    importo_risolto = _resolve_costo_amount(costo, fatture_map, lavorazioni_map)
    
    fattura_dict = None
    if costo.fattura_amministrazione_id and costo.fattura_amministrazione_id in fatture_map:
        fattura = fatture_map[costo.fattura_amministrazione_id]
        fattura_dict = {
            "id": fattura.id,
            "numero": fattura.numero,
            "data_fattura": fattura.data_fattura.isoformat() if fattura.data_fattura else None,
            "importo_totale": float(fattura.importo_totale) if fattura.importo_totale else None,
            "importo_netto": float(fattura.importo_netto) if hasattr(fattura, 'importo_netto') and fattura.importo_netto else None,
        }
    
    lavorazione_dict = None
    if costo.lavorazione_id and costo.lavorazione_id in lavorazioni_map:
        lavorazione = lavorazioni_map[costo.lavorazione_id]
        lavorazione_dict = {
            "id": lavorazione.id,
            "tipo": getattr(lavorazione, 'tipo', None),
            "data": lavorazione.data.isoformat() if hasattr(lavorazione, 'data') and lavorazione.data else None,
            "costo": float(lavorazione.costo) if hasattr(lavorazione, 'costo') and lavorazione.costo else None,
        }
    
    return CicloTerrenoCostoResponse(
        id=costo.id,
        ciclo_id=costo.ciclo_id,
        fase_id=costo.fase_id,
        terreno_id=costo.terreno_id,
        azienda_id=costo.azienda_id,
        descrizione=costo.descrizione,
        data=costo.data,
        importo=float(costo.importo) if costo.importo is not None else None,
        importo_risolto=importo_risolto,
        source_type=costo.source_type,
        fattura_amministrazione_id=costo.fattura_amministrazione_id,
        lavorazione_id=costo.lavorazione_id,
        note=costo.note,
        created_at=costo.created_at,
        updated_at=costo.updated_at,
        fattura=fattura_dict,
        lavorazione=lavorazione_dict,
    )


def _serialize_ciclo_fase(fase: CicloTerrenoFaseModel, totale_costi: Decimal = Decimal("0")) -> CicloTerrenoFaseResponse:
    """Serializza una fase del ciclo in un CicloTerrenoFaseResponse"""
    return CicloTerrenoFaseResponse(
        id=fase.id,
        ciclo_id=fase.ciclo_id,
        nome=fase.nome,
        tipo=fase.tipo,
        ordine=fase.ordine,
        data_inizio=fase.data_inizio,
        data_fine=fase.data_fine,
        note=fase.note,
        created_at=fase.created_at,
        updated_at=fase.updated_at,
        totale_costi=totale_costi,
    )


