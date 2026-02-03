"""Registro Alimentazione endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, case, or_, and_
from typing import List, Optional
from collections import defaultdict
from datetime import timedelta, date, datetime
from decimal import Decimal, ROUND_HALF_UP

from app.core.database import get_db
from app.models.alimentazione.registro_alimentazione import (
    RegistroAlimentazione as RegistroAlimentazioneModel,
    RegistroAlimentazioneDettaglio as RegistroAlimentazioneDettaglioModel,
)
from app.models.alimentazione.magazzino_movimento import MagazzinoMovimento as MagazzinoMovimentoModel
from app.models.allevamento import Animale, Box, Stabilimento, Sede
from app.schemas.alimentazione import (
    RegistroAlimentazioneCreate,
    RegistroAlimentazioneUpdate,
    RegistroAlimentazioneResponse,
    RegistroAlimentazionePreviewResponse,
    RegistroAlimentazioneDettaglioResponse,
)

router = APIRouter()

def _resolve_target_context(db: Session, target_tipo: str, target_id: int) -> dict:
    target_tipo = (target_tipo or "").lower()
    if target_tipo not in {"box", "stabilimento", "sede"}:
        raise HTTPException(status_code=400, detail="Tipo di distribuzione non valido")

    if target_tipo == "box":
        box = (
            db.query(Box)
            .options(joinedload(Box.stabilimento).joinedload(Stabilimento.sede))
            .filter(Box.id == target_id, Box.deleted_at.is_(None))
            .first()
        )
        if not box or not box.stabilimento or box.stabilimento.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Box non trovato o disattivato")
        sede = box.stabilimento.sede
        if not sede or sede.deleted_at is not None:
            raise HTTPException(status_code=400, detail="La sede associata al box non è valida")
        return {
            "target_tipo": target_tipo,
            "target_id": target_id,
            "boxes": [box],
            "box_ids": [box.id],
            "boxes_map": {box.id: box},
            "stabilimento_ids": [box.stabilimento_id],
            "sede_id": sede.id,
            "sede_codice_stalla": sede.codice_stalla,
            "azienda_id": sede.azienda_id,
            "target_label": box.nome,
        }

    if target_tipo == "stabilimento":
        stabilimento = (
            db.query(Stabilimento)
            .options(joinedload(Stabilimento.sede))
            .filter(Stabilimento.id == target_id, Stabilimento.deleted_at.is_(None))
            .first()
        )
        if not stabilimento or not stabilimento.sede or stabilimento.sede.deleted_at is not None:
            raise HTTPException(status_code=404, detail="Stabilimento non trovato")
        boxes = (
            db.query(Box)
            .filter(Box.stabilimento_id == stabilimento.id, Box.deleted_at.is_(None))
            .all()
        )
        boxes_map = {b.id: b for b in boxes}
        return {
            "target_tipo": target_tipo,
            "target_id": target_id,
            "boxes": boxes,
            "box_ids": list(boxes_map.keys()),
            "boxes_map": boxes_map,
            "stabilimento_ids": [stabilimento.id],
            "sede_id": stabilimento.sede.id,
            "sede_codice_stalla": stabilimento.sede.codice_stalla,
            "azienda_id": stabilimento.sede.azienda_id,
            "target_label": f"{stabilimento.nome} ({stabilimento.sede.nome})",
        }

    # target_tipo == "sede"
    sede = (
        db.query(Sede)
        .options(joinedload(Sede.stabilimenti).joinedload(Stabilimento.box))
        .filter(Sede.id == target_id, Sede.deleted_at.is_(None))
        .first()
    )
    if not sede:
        raise HTTPException(status_code=404, detail="Sede non trovata")
    boxes: list[Box] = []
    for stabilimento in sede.stabilimenti:
        if getattr(stabilimento, "deleted_at", None) is not None:
            continue
        boxes.extend([b for b in stabilimento.box if getattr(b, "deleted_at", None) is None])
    boxes_map = {b.id: b for b in boxes}
    return {
        "target_tipo": target_tipo,
        "target_id": target_id,
        "boxes": boxes,
        "box_ids": list(boxes_map.keys()),
        "boxes_map": boxes_map,
        "stabilimento_ids": [st.id for st in sede.stabilimenti if getattr(st, "deleted_at", None) is None],
        "sede_id": sede.id,
        "sede_codice_stalla": sede.codice_stalla,
        "azienda_id": sede.azienda_id,
        "target_label": sede.nome,
    }


def _fetch_animals_for_context(db: Session, context: dict, data: RegistroAlimentazioneCreate) -> List[Animale]:
    riferimento = data.data
    giorni_min = data.giorni_permanenza_min or 0
    giorni_max = data.giorni_permanenza_max

    query = (
        db.query(Animale)
        .options(joinedload(Animale.box).joinedload(Box.stabilimento))
        .filter(
            Animale.deleted_at.is_(None),
            Animale.data_arrivo <= riferimento,
            or_(Animale.data_uscita.is_(None), Animale.data_uscita > riferimento),
        )
    )

    if giorni_min:
        query = query.filter(Animale.data_arrivo <= riferimento - timedelta(days=giorni_min))
    if giorni_max:
        query = query.filter(Animale.data_arrivo >= riferimento - timedelta(days=giorni_max))

    if context["target_tipo"] == "box":
        return query.filter(Animale.box_id == context["target_id"]).all()

    filters = []
    if context["box_ids"]:
        filters.append(Animale.box_id.in_(context["box_ids"]))
    if context["target_tipo"] == "sede" and context.get("sede_codice_stalla"):
        filters.append(
            and_(
                Animale.box_id.is_(None),
                Animale.codice_azienda_anagrafe == context["sede_codice_stalla"],
            )
        )

    if filters:
        return query.filter(or_(*filters)).all()

    return []


def _calculate_stock(db: Session, componente_id: Optional[int], mangime_id: Optional[int]) -> Decimal:
    query = db.query(
        func.sum(
            case((MagazzinoMovimentoModel.tipo == 'carico', MagazzinoMovimentoModel.quantita), else_=0)
            - case((MagazzinoMovimentoModel.tipo == 'scarico', MagazzinoMovimentoModel.quantita), else_=0)
            + case((MagazzinoMovimentoModel.tipo == 'rettifica', MagazzinoMovimentoModel.quantita), else_=0)
        )
    ).filter(MagazzinoMovimentoModel.deleted_at.is_(None))

    if componente_id:
        query = query.filter(MagazzinoMovimentoModel.componente_alimentare_id == componente_id)
    if mangime_id:
        query = query.filter(MagazzinoMovimentoModel.mangime_confezionato_id == mangime_id)

    result = query.scalar()
    return Decimal(result or 0)


def _enrich_dettaglio(detail: RegistroAlimentazioneDettaglioModel) -> None:
    if detail.box:
        detail.box_nome = detail.box.nome
        detail.stabilimento_id = detail.box.stabilimento_id
        if detail.box.stabilimento:
            detail.stabilimento_nome = detail.box.stabilimento.nome
    else:
        detail.box_nome = "Animali senza box"
        detail.stabilimento_id = None
        detail.stabilimento_nome = None


def _prepare_distribution_payload(db: Session, data: RegistroAlimentazioneCreate) -> dict:
    context = _resolve_target_context(db, data.target_tipo, data.target_id)
    animali = _fetch_animals_for_context(db, context, data)

    if not animali:
        raise HTTPException(status_code=400, detail="Nessun animale presente per i filtri selezionati")

    quantita_totale = Decimal(data.quantita_totale)
    numero_capi = len(animali)
    quota_per_capo = (quantita_totale / Decimal(numero_capi)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)

    distribuzione = defaultdict(list)
    for animale in animali:
        distribuzione[animale.box_id].append(animale)

    dettagli_db = []
    preview_items = []
    somma_quantita = Decimal("0")
    for box_id, gruppo in distribuzione.items():
        count = len(gruppo)
        quantita_box = (quota_per_capo * Decimal(count)).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        somma_quantita += quantita_box

        box_nome = None
        stabilimento_id = None
        stabilimento_nome = None
        if box_id and box_id in context["boxes_map"]:
            box_obj = context["boxes_map"][box_id]
            box_nome = box_obj.nome
            stabilimento_id = box_obj.stabilimento_id
            if box_obj.stabilimento:
                stabilimento_nome = box_obj.stabilimento.nome
        elif box_id is None:
            box_nome = "Animali senza box"

        dettagli_db.append(
            {
                "box_id": box_id,
                "numero_capi": count,
                "quantita": quantita_box,
                "note": "Animali senza box" if box_id is None else None,
            }
        )
        preview_items.append(
            {
                "box_id": box_id,
                "numero_capi": count,
                "quantita": quantita_box,
                "note": "Animali senza box" if box_id is None else None,
                "box_nome": box_nome,
                "stabilimento_id": stabilimento_id,
                "stabilimento_nome": stabilimento_nome,
            }
        )

    # Adjust rounding difference on the last detail if necessary
    delta = quantita_totale - somma_quantita
    if dettagli_db and delta != Decimal("0"):
        dettagli_db[-1]["quantita"] = (dettagli_db[-1]["quantita"] + delta).quantize(Decimal("0.0001"), rounding=ROUND_HALF_UP)
        preview_items[-1]["quantita"] = dettagli_db[-1]["quantita"]

    stock_warning = None
    magazzino_movimenti: List[dict] = []
    unita_misura = "kg"
    if data.tipo_alimento == "singolo":
        componente = None
        mangime = None
        if data.componente_alimentare_id:
            componente = db.query(ComponenteAlimentareModel).filter(
                ComponenteAlimentareModel.id == data.componente_alimentare_id,
                ComponenteAlimentareModel.deleted_at.is_(None),
            ).first()
            if not componente:
                raise HTTPException(status_code=404, detail="Componente alimentare non trovato")
            unita_misura = componente.unita_misura or 'kg'
        if data.mangime_confezionato_id:
            mangime = db.query(MangimeConfezionatoModel).filter(
                MangimeConfezionatoModel.id == data.mangime_confezionato_id,
                MangimeConfezionatoModel.deleted_at.is_(None),
            ).first()
            if not mangime:
                raise HTTPException(status_code=404, detail="Mangime confezionato non trovato")
            unita_misura = mangime.unita_misura or unita_misura

        stock_attuale = _calculate_stock(db, data.componente_alimentare_id, data.mangime_confezionato_id)
        stock_post = (stock_attuale - quantita_totale).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
        if stock_post < Decimal("0"):
            stock_warning = f"Attenzione: la giacenza prevista scenderà a {stock_post} {unita_misura}."

        magazzino_movimenti.append(
            {
                "data": data.data,
                "tipo": 'scarico',
                "componente_alimentare_id": data.componente_alimentare_id,
                "mangime_confezionato_id": data.mangime_confezionato_id,
                "quantita": quantita_totale,
                "unita_misura": unita_misura,
                "causale": f"Somministrazione alimentazione {data.data.isoformat()} ({context['target_label']})",
                "note": data.note,
                "azienda_id": context["azienda_id"],
            }
        )

    registro_kwargs = {
        "data": data.data,
        "razione_id": data.razione_id,
        "note": data.note,
        "quantita_totale": quantita_totale,
        "target_tipo": context["target_tipo"],
        "target_id": context["target_id"],
        "tipo_alimento": data.tipo_alimento,
        "componente_alimentare_id": data.componente_alimentare_id,
        "mangime_confezionato_id": data.mangime_confezionato_id,
        "numero_capi": numero_capi,
        "quota_per_capo": quota_per_capo,
        "giorni_permanenza_min": data.giorni_permanenza_min,
        "giorni_permanenza_max": data.giorni_permanenza_max,
        "azienda_id": context["azienda_id"],
        "box_id": context["target_id"] if context["target_tipo"] == "box" else None,
    }

    return {
        "registro_kwargs": registro_kwargs,
        "dettagli_db": dettagli_db,
        "preview_items": preview_items,
        "numero_capi": numero_capi,
        "quota_per_capo": quota_per_capo,
        "stock_warning": stock_warning,
        "magazzino_movimenti": magazzino_movimenti,
    }

# --- FORNITORI CRUD ---
@router.get("/registro-alimentazione", response_model=List[RegistroAlimentazioneResponse])
def list_registro_alimentazione(
	skip: int = 0,
	limit: int = 100,
	azienda_id: Optional[int] = None,
	data_da: Optional[date] = None,
	data_a: Optional[date] = None,
	db: Session = Depends(get_db)
):
	"""Get all registro alimentazione with optional filters"""
	query = (
		db.query(RegistroAlimentazioneModel)
		.filter(RegistroAlimentazioneModel.deleted_at.is_(None))
		.options(
			joinedload(RegistroAlimentazioneModel.dettagli)
			.joinedload(RegistroAlimentazioneDettaglioModel.box)
			.joinedload(Box.stabilimento)
		)
	)
	
	if azienda_id is not None:
		query = query.filter(RegistroAlimentazioneModel.azienda_id == azienda_id)
	if data_da is not None:
		query = query.filter(RegistroAlimentazioneModel.data >= data_da)
	if data_a is not None:
		query = query.filter(RegistroAlimentazioneModel.data <= data_a)
	
	records = query.order_by(RegistroAlimentazioneModel.data.desc(), RegistroAlimentazioneModel.id.desc()).offset(skip).limit(limit).all()
	for registro in records:
		for dettaglio in registro.dettagli:
			_enrich_dettaglio(dettaglio)
	return records


@router.get("/registro-alimentazione/{reg_id}", response_model=RegistroAlimentazioneResponse)
def get_registro_alimentazione(reg_id: int, db: Session = Depends(get_db)):
	obj = (
		db.query(RegistroAlimentazioneModel)
		.filter(
			RegistroAlimentazioneModel.id == reg_id,
			RegistroAlimentazioneModel.deleted_at.is_(None)
		)
		.options(
			joinedload(RegistroAlimentazioneModel.dettagli)
			.joinedload(RegistroAlimentazioneDettaglioModel.box)
			.joinedload(Box.stabilimento)
		)
		.first()
	)
	if not obj:
		raise HTTPException(status_code=404, detail="Registro alimentazione non trovato")
	for dettaglio in obj.dettagli:
		_enrich_dettaglio(dettaglio)
	return obj


@router.post(
	"/registro-alimentazione/anteprima",
	response_model=RegistroAlimentazionePreviewResponse,
)
def preview_registro_alimentazione(data: RegistroAlimentazioneCreate, db: Session = Depends(get_db)):
	payload = _prepare_distribution_payload(db, data)
	dettagli_preview = [
		RegistroAlimentazioneDettaglioResponse(**item)
		for item in payload["preview_items"]
	]
	return RegistroAlimentazionePreviewResponse(
		numero_capi=payload["numero_capi"],
		quota_per_capo=payload["quota_per_capo"],
		dettagli=dettagli_preview,
		stock_warning=payload["stock_warning"],
	)


@router.post("/registro-alimentazione", response_model=RegistroAlimentazioneResponse, status_code=status.HTTP_201_CREATED)
def create_registro_alimentazione(data: RegistroAlimentazioneCreate, db: Session = Depends(get_db)):
	payload = _prepare_distribution_payload(db, data)
	registro = RegistroAlimentazioneModel(**payload["registro_kwargs"])
	for dettaglio in payload["dettagli_db"]:
		registro.dettagli.append(RegistroAlimentazioneDettaglioModel(**dettaglio))
	for movimento in payload["magazzino_movimenti"]:
		db.add(MagazzinoMovimentoModel(**movimento))
	db.add(registro)
	db.commit()
	registro = (
		db.query(RegistroAlimentazioneModel)
		.options(
			joinedload(RegistroAlimentazioneModel.dettagli)
			.joinedload(RegistroAlimentazioneDettaglioModel.box)
			.joinedload(Box.stabilimento)
		)
		.filter(RegistroAlimentazioneModel.id == registro.id)
		.first()
	)
	if registro is None:
		raise HTTPException(status_code=500, detail="Errore nel salvataggio della registrazione")
	for dettaglio in registro.dettagli:
		_enrich_dettaglio(dettaglio)
	registro.stock_warning = payload["stock_warning"]
	return registro

@router.put("/registro-alimentazione/{reg_id}", response_model=RegistroAlimentazioneResponse)
def update_registro_alimentazione(reg_id: int, update: RegistroAlimentazioneUpdate, db: Session = Depends(get_db)):
	obj = (
		db.query(RegistroAlimentazioneModel)
		.filter(
			RegistroAlimentazioneModel.id == reg_id,
			RegistroAlimentazioneModel.deleted_at.is_(None)
		)
		.options(
			joinedload(RegistroAlimentazioneModel.dettagli)
			.joinedload(RegistroAlimentazioneDettaglioModel.box)
			.joinedload(Box.stabilimento)
		)
		.first()
	)
	if not obj:
		raise HTTPException(status_code=404, detail="Registro alimentazione non trovato")
	# Usa dict() per compatibilità con Pydantic v1 e v2
	values = update.dict(exclude_unset=True) if hasattr(update, 'dict') else update.model_dump(exclude_unset=True)
	unsupported_fields = set(values.keys()) - {"note"}
	if unsupported_fields:
		raise HTTPException(
			status_code=400,
			detail="L'aggiornamento di una somministrazione è supportato solo per il campo 'note'.",
		)
	if "note" in values:
		obj.note = values["note"]
	db.commit()
	db.refresh(obj)
	for dettaglio in obj.dettagli:
		_enrich_dettaglio(dettaglio)
	return obj

@router.delete("/registro-alimentazione/{reg_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_registro_alimentazione(reg_id: int, db: Session = Depends(get_db)):
	"""Soft delete registro alimentazione"""
	obj = db.query(RegistroAlimentazioneModel).filter(
		RegistroAlimentazioneModel.id == reg_id,
		RegistroAlimentazioneModel.deleted_at.is_(None)
	).first()
	if not obj:
		raise HTTPException(status_code=404, detail="Registro alimentazione non trovato")
	obj.deleted_at = datetime.utcnow()
	db.commit()
	return None

# --- DDT CRUD ---
