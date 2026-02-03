from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Dict, Iterable, List, Optional

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.models.amministrazione import (
    FatturaAmministrazione,
    Pagamento,
)
from app.models.amministrazione.fornitore import Fornitore
from app.models.amministrazione.partita_animale_movimento_finanziario import PartitaMovimentoFinanziario
from app.models.amministrazione.fattura_amministrazione import StatoPagamento as StatoPagamentoFatturaAmministrazione
# from app.models.amministrazione.fattura_emessa import StatoPagamentoFatturaEmessa  # DEPRECATO: usa StatoPagamento da FatturaAmministrazione
from app.models.amministrazione.fattura_amministrazione import StatoPagamento as StatoPagamentoFatturaEmessa
from app.models.amministrazione.pn import (
    PNCategoria,
    PNConto,
    PNContoIban,
    PNContoTipo,
    PNGirocontoStrategia,
    PNDocumentoTipo,
    PNMovimento,
    PNMovimentoDocumento,
    PNMovimentoOrigine,
    PNPreferenze,
    PNStatoMovimento,
    PNTipoOperazione,
)
from app.schemas.amministrazione import (
    PNCategoriaBase,
    PNCategoriaCreate,
    PNCategoriaUpdate,
    PNCategoriaResponse,
    PNContoIbanCreate,
    PNContoIbanResponse,
    PNContoIbanUpdate,
    PNContoCreate,
    PNContoResponse,
    PNContoUpdate,
    PNDocumentoApertoResponse,
    PNMovimentiListResponse,
    PNMovimentoCreate,
    PNMovimentoDocumentoInput,
    PNMovimentoDocumentoResponse,
    PNMovimentoResponse,
    PNMovimentoUpdate,
    PNPreferenzeResponse,
    PNRiepilogoResponse,
    PNSetupResponse,
)

ZERO = Decimal("0")

# Conti sistema: creati automaticamente, non modificabili/eliminabili dall'utente.
# L'utente crea solo conti Cassa/Banca.
CONTO_SISTEMA_NOMI = frozenset({
    "vendite",
    "iva vendite",
    "crediti vs clienti",
    "acquisti",
    "iva acquisti",
    "debiti vs fornitori",
    "soccida monetizzata - acconti",
})

# Nomi legacy accettati in lettura (per retrocompatibilità con DB esistenti)
CONTO_SISTEMA_NOMI_LEGACY = frozenset({
    "ricavi vendite", "iva a debito", "iva a credito",
    "crediti verso clienti", "debiti verso fornitori",
})

DEFAULT_CONTI = [
    # Solo conti sistema (Cassa/Banca li crea l'utente)
    ("Vendite", PNContoTipo.ALTRO.value),
    ("IVA vendite", PNContoTipo.ALTRO.value),
    ("Crediti vs clienti", PNContoTipo.ALTRO.value),
    ("Acquisti", PNContoTipo.ALTRO.value),
    ("IVA acquisti", PNContoTipo.ALTRO.value),
    ("Debiti vs fornitori", PNContoTipo.ALTRO.value),
]

DEFAULT_CATEGORIE = [
    (PNTipoOperazione.ENTRATA, "Incassi generici", "Entrate non categorizzate"),
    (PNTipoOperazione.ENTRATA, "Vendite prodotti", "Incassi da vendite"),
    (PNTipoOperazione.USCITA, "Pagamenti fornitori", "Pagamenti ordinari"),
    (PNTipoOperazione.USCITA, "Spese generali", "Spese amministrative"),
    (PNTipoOperazione.GIROCONTO, "Trasferimenti interni", "Giroconto tra conti"),
]


def is_conto_sistema(nome: Optional[str]) -> bool:
    """True se il conto è di sistema (non modificabile/eliminabile dall'utente)."""
    if not nome:
        return False
    n = nome.strip().lower()
    return n in CONTO_SISTEMA_NOMI or n in CONTO_SISTEMA_NOMI_LEGACY


def _is_conto_essenziale(conto: PNConto) -> bool:
    """True se il conto è essenziale: tipo Cassa/Banca (utente) o nome di sistema."""
    if not conto:
        return False
    tipo = (conto.tipo or "").lower()
    if tipo in (PNContoTipo.CASSA.value, PNContoTipo.BANCA.value):
        return True
    return is_conto_sistema(conto.nome)


def cleanup_extra_empty_conti(db: Session, azienda_id: int) -> None:
    """
    Elimina conti aggiuntivi (non essenziali) che non hanno movimenti né riferimenti in preferenze.
    Non elimina mai conti con dati presenti.
    """
    conti = (
        db.query(PNConto)
        .filter(PNConto.azienda_id == azienda_id)
        .all()
    )
    preferenze = (
        db.query(PNPreferenze)
        .filter(PNPreferenze.azienda_id == azienda_id)
        .one_or_none()
    )
    preferenza_conto_ids = set()
    if preferenze:
        for attr in ("conto_predefinito_id", "conto_incassi_id", "conto_pagamenti_id", "conto_debiti_fornitori_id", "conto_crediti_clienti_id"):
            vid = getattr(preferenze, attr, None)
            if vid:
                preferenza_conto_ids.add(vid)

    for conto in conti:
        if _is_conto_essenziale(conto):
            continue
        movimenti_count = (
            db.query(PNMovimento)
            .filter(
                or_(
                    PNMovimento.conto_id == conto.id,
                    PNMovimento.conto_destinazione_id == conto.id,
                ),
                PNMovimento.deleted_at.is_(None),
            )
            .count()
        )
        if movimenti_count > 0 or conto.id in preferenza_conto_ids:
            continue
        db.delete(conto)
    db.flush()


def _is_system_account(nome: str) -> bool:
    """Check if an account name matches a system account (current or legacy)."""
    return is_conto_sistema(nome)


def _to_decimal(value: Optional[Decimal]) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return ZERO
    try:
        return Decimal(str(value))
    except Exception:
        return ZERO


def _normalize_nome(value: Optional[str]) -> str:
    if not value:
        return ""
    return " ".join(value.strip().split())


def _clean_text(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _normalize_iban(value: Optional[str]) -> str:
    if not value:
        return ""
    return value.replace(" ", "").replace("-", "").upper()


def create_conto(db: Session, payload: PNContoCreate) -> PNConto:
    nome = _normalize_nome(payload.nome)
    if not nome:
        raise ValueError("Il nome del conto è obbligatorio.")

    existing = (
        db.query(PNConto)
        .filter(
            PNConto.azienda_id == payload.azienda_id,
            func.lower(PNConto.nome) == nome.lower(),
        )
        .first()
    )
    if existing:
        raise ValueError("Esiste già un conto con questo nome per l'azienda selezionata.")

    tipo_enum = PNContoTipo(payload.tipo)
    # Restrict user-created accounts to only CASSA or BANCA types
    if tipo_enum not in (PNContoTipo.CASSA, PNContoTipo.BANCA):
        raise ValueError("È possibile creare solo conti di tipo 'Cassa' o 'Banca'. Gli altri conti sono gestiti automaticamente dal sistema.")

    giro_enum = PNGirocontoStrategia(payload.giroconto_strategia or PNGirocontoStrategia.AUTOMATICO)
    saldo_iniziale = _to_decimal(payload.saldo_iniziale)
    saldo_attuale = (
        _to_decimal(payload.saldo_attuale)
        if payload.saldo_attuale is not None
        else saldo_iniziale
    )

    conto = PNConto(
        azienda_id=payload.azienda_id,
        nome=nome,
        tipo=tipo_enum.value,
        saldo_iniziale=saldo_iniziale,
        saldo_attuale=saldo_attuale,
        attivo=payload.attivo,
        note=_clean_text(payload.note),
        giroconto_strategia=giro_enum.value,
    )
    db.add(conto)
    db.flush()
    return conto


def update_conto(db: Session, conto_id: int, payload: PNContoUpdate) -> PNConto:
    conto = db.get(PNConto, conto_id)
    if not conto:
        raise LookupError("Conto non trovato.")

    # Prevent modification of system accounts (default accounts)
    is_system = _is_system_account(conto.nome)
    
    if payload.nome is not None:
        nuovo_nome = _normalize_nome(payload.nome)
        if not nuovo_nome:
            raise ValueError("Il nome del conto è obbligatorio.")
        # Check if trying to rename a system account
        if is_system and nuovo_nome.lower() != conto.nome.lower():
            raise ValueError("Non è possibile modificare il nome di un conto di sistema.")
        existing = (
            db.query(PNConto)
            .filter(
                PNConto.azienda_id == conto.azienda_id,
                func.lower(PNConto.nome) == nuovo_nome.lower(),
                PNConto.id != conto.id,
            )
            .first()
        )
        if existing:
            raise ValueError("Esiste già un conto con questo nome per l'azienda selezionata.")
        conto.nome = nuovo_nome

    if payload.tipo is not None:
        nuovo_tipo = PNContoTipo(payload.tipo)
        # Prevent changing type of system accounts
        if is_system:
            raise ValueError("Non è possibile modificare il tipo di un conto di sistema.")
        # Even for user accounts, restrict to CASSA/BANCA
        if nuovo_tipo not in (PNContoTipo.CASSA, PNContoTipo.BANCA):
            raise ValueError("È possibile utilizzare solo conti di tipo 'Cassa' o 'Banca' per le operazioni manuali.")
        conto.tipo = nuovo_tipo.value
    if payload.note is not None:
        conto.note = _clean_text(payload.note)
    if payload.attivo is not None:
        conto.attivo = payload.attivo
    if payload.giroconto_strategia is not None:
        conto.giroconto_strategia = PNGirocontoStrategia(payload.giroconto_strategia).value
    if payload.saldo_iniziale is not None:
        conto.saldo_iniziale = _to_decimal(payload.saldo_iniziale)
    if payload.saldo_attuale is not None:
        conto.saldo_attuale = _to_decimal(payload.saldo_attuale)

    db.flush()
    return conto


def delete_conto(db: Session, conto_id: int) -> None:
    conto = db.get(PNConto, conto_id)
    if not conto:
        raise LookupError("Conto non trovato.")
    if is_conto_sistema(conto.nome):
        raise ValueError("Non è possibile eliminare un conto di sistema.")

    movimenti_count = (
        db.query(PNMovimento)
        .filter(
            or_(
                PNMovimento.conto_id == conto_id,
                PNMovimento.conto_destinazione_id == conto_id,
            ),
            PNMovimento.deleted_at.is_(None),
        )
        .count()
    )

    if movimenti_count > 0:
        raise ValueError(
            f"Impossibile eliminare il conto, sono presenti {movimenti_count} movimenti collegati."
        )

    db.delete(conto)
    db.flush()


def _reset_predefinito(db: Session, conto_id: int) -> None:
    db.query(PNContoIban).filter(
        PNContoIban.conto_id == conto_id,
        PNContoIban.predefinito.is_(True),
    ).update({"predefinito": False}, synchronize_session=False)


def add_conto_iban(db: Session, conto_id: int, payload: PNContoIbanCreate) -> PNContoIban:
    conto = db.get(PNConto, conto_id)
    if not conto:
        raise LookupError("Conto non trovato.")

    iban = _normalize_iban(payload.iban)
    if not iban:
        raise ValueError("IBAN non valido.")
    if len(iban) < 15 or len(iban) > 34:
        raise ValueError("IBAN non valido.")

    existing = (
        db.query(PNContoIban)
        .filter(
            PNContoIban.conto_id == conto_id,
            func.lower(PNContoIban.iban) == iban.lower(),
        )
        .first()
    )
    if existing:
        raise ValueError("IBAN già presente per questo conto.")

    if payload.predefinito:
        _reset_predefinito(db, conto_id)

    record = PNContoIban(
        conto_id=conto_id,
        iban=iban,
        descrizione=_clean_text(payload.descrizione),
        predefinito=payload.predefinito,
        attivo=payload.attivo,
    )
    db.add(record)
    db.flush()
    return record


def update_conto_iban(db: Session, iban_id: int, payload: PNContoIbanUpdate) -> PNContoIban:
    record = db.get(PNContoIban, iban_id)
    if not record:
        raise LookupError("IBAN non trovato.")

    if payload.iban is not None:
        new_iban = _normalize_iban(payload.iban)
        if not new_iban:
            raise ValueError("IBAN non valido.")
        if len(new_iban) < 15 or len(new_iban) > 34:
            raise ValueError("IBAN non valido.")
        existing = (
            db.query(PNContoIban)
            .filter(
                PNContoIban.conto_id == record.conto_id,
                func.lower(PNContoIban.iban) == new_iban.lower(),
                PNContoIban.id != record.id,
            )
            .first()
        )
        if existing:
            raise ValueError("IBAN già presente per questo conto.")
        record.iban = new_iban

    if payload.descrizione is not None:
        record.descrizione = _clean_text(payload.descrizione)
    if payload.attivo is not None:
        record.attivo = payload.attivo
    if payload.predefinito is not None:
        if payload.predefinito:
            _reset_predefinito(db, record.conto_id)
            record.predefinito = True
        else:
            record.predefinito = False

    db.flush()
    return record


def delete_conto_iban(db: Session, iban_id: int) -> None:
    record = db.get(PNContoIban, iban_id)
    if not record:
        raise LookupError("IBAN non trovato.")
    db.delete(record)
    db.flush()


def ensure_default_setup(db: Session, azienda_id: int) -> None:
    # Ricrea sempre i 6 conti di sistema se mancanti (anche se esistono già Soccida, Cassa, Banca)
    conti_azienda = (
        db.query(PNConto)
        .filter(PNConto.azienda_id == azienda_id)
        .all()
    )
    nomi_presenti = {c.nome.strip().lower() for c in conti_azienda}
    for nome, tipo in DEFAULT_CONTI:
        if nome.strip().lower() not in nomi_presenti:
            enum_tipo = PNContoTipo(tipo) if isinstance(tipo, PNContoTipo) else PNContoTipo(tipo.lower())
            db.add(
                PNConto(
                    azienda_id=azienda_id,
                    nome=nome,
                    tipo=enum_tipo.value,
                    saldo_iniziale=ZERO,
                    saldo_attuale=ZERO,
                    giroconto_strategia=PNGirocontoStrategia.AUTOMATICO.value,
                )
            )
            nomi_presenti.add(nome.strip().lower())
    db.flush()

    categorie_presenti = (
        db.query(PNCategoria)
        .filter(PNCategoria.azienda_id == azienda_id)
        .limit(1)
        .all()
    )
    if not categorie_presenti:
        ordine = 0
        for tipo, nome, descrizione in DEFAULT_CATEGORIE:
            db.add(
                PNCategoria(
                    azienda_id=azienda_id,
                    nome=nome,
                    descrizione=descrizione,
                    tipo_operazione=tipo,
                    ordine=ordine,
                    creata_dal_sistema=True,
                )
            )
            ordine += 1
        db.flush()

    preferenze = (
        db.query(PNPreferenze)
        .filter(PNPreferenze.azienda_id == azienda_id)
        .one_or_none()
    )
    if not preferenze:
        conti = (
            db.query(PNConto)
            .filter(PNConto.azienda_id == azienda_id)
            .order_by(PNConto.id.asc())
            .all()
        )
        # Conti Cassa/Banca creati dall'utente (tipo cassa o banca)
        conto_cassa = next((c for c in conti if (c.tipo or "").lower() == PNContoTipo.CASSA.value), None)
        conto_banca = next((c for c in conti if (c.tipo or "").lower() == PNContoTipo.BANCA.value), None)
        # Conti sistema (nomi nuovi o legacy)
        conto_debiti = next(
            (c for c in conti if c.nome.lower() in ("debiti vs fornitori", "debiti verso fornitori")),
            None,
        )
        conto_crediti = next(
            (c for c in conti if c.nome.lower() in ("crediti vs clienti", "crediti verso clienti")),
            None,
        )

        # Solo conti Cassa/Banca (creati dall'utente) per predefinito/incassi/pagamenti
        conto_predefinito = conto_cassa.id if conto_cassa else (conto_banca.id if conto_banca else None)
        conto_incassi = conto_cassa.id if conto_cassa else conto_predefinito
        conto_pagamenti = conto_banca.id if conto_banca else conto_predefinito
        conto_debiti_fornitori = conto_debiti.id if conto_debiti else None
        conto_crediti_clienti = conto_crediti.id if conto_crediti else None

        preferenze = PNPreferenze(
            azienda_id=azienda_id,
            conto_predefinito_id=conto_predefinito,
            conto_incassi_id=conto_incassi,
            conto_pagamenti_id=conto_pagamenti,
            conto_debiti_fornitori_id=conto_debiti_fornitori,
            conto_crediti_clienti_id=conto_crediti_clienti,
        )
        db.add(preferenze)
        db.flush()
    else:
        # Aggiorna le preferenze esistenti se mancano i conti sistema
        conti = (
            db.query(PNConto)
            .filter(PNConto.azienda_id == azienda_id)
            .order_by(PNConto.id.asc())
            .all()
        )
        conto_debiti = next(
            (c for c in conti if c.nome.lower() in ("debiti vs fornitori", "debiti verso fornitori")),
            None,
        )
        conto_crediti = next(
            (c for c in conti if c.nome.lower() in ("crediti vs clienti", "crediti verso clienti")),
            None,
        )

        if not preferenze.conto_debiti_fornitori_id and conto_debiti:
            preferenze.conto_debiti_fornitori_id = conto_debiti.id
        if not preferenze.conto_crediti_clienti_id and conto_crediti:
            preferenze.conto_crediti_clienti_id = conto_crediti.id
        db.flush()

    # Elimina conti aggiuntivi (non essenziali) senza movimenti né riferimenti in preferenze
    cleanup_extra_empty_conti(db, azienda_id)


def get_conto_soccida_monetizzata(db: Session, azienda_id: int) -> PNConto:
    """
    Restituisce o crea il conto 'Soccida monetizzata - Acconti' per l'azienda.
    Questo conto viene usato per tracciare gli acconti ricevuti per contratti soccida monetizzati.
    """
    ensure_default_setup(db, azienda_id)
    
    nome_conto = "Soccida monetizzata - Acconti"
    conto = (
        db.query(PNConto)
        .filter(
            PNConto.azienda_id == azienda_id,
            func.lower(PNConto.nome) == nome_conto.lower(),
        )
        .first()
    )
    
    if not conto:
        conto = PNConto(
            azienda_id=azienda_id,
            nome=nome_conto,
            tipo=PNContoTipo.ALTRO.value,
            saldo_iniziale=ZERO,
            saldo_attuale=ZERO,
            attivo=True,
            note="Conto automatico per tracciare acconti ricevuti da contratti soccida monetizzati",
            giroconto_strategia=PNGirocontoStrategia.AUTOMATICO.value,
        )
        db.add(conto)
        db.flush()
        db.refresh(conto)
    
    return conto


def _conti_response(
    conti: Iterable[PNConto],
    provvisori_map: Dict[int, int],
    ultimi_aggiornamenti: Dict[int, Optional[datetime]],
) -> List[PNContoResponse]:
    output: List[PNContoResponse] = []
    for conto in conti:
        ibans = [
            PNContoIbanResponse.model_validate(iban, from_attributes=True)
            for iban in getattr(conto, "ibans", []) or []
        ]
        output.append(
            PNContoResponse(
                id=conto.id,
                nome=conto.nome,
                tipo=conto.tipo,
                saldo_iniziale=conto.saldo_iniziale or ZERO,
                saldo_attuale=conto.saldo_attuale or ZERO,
                attivo=conto.attivo,
                note=conto.note,
                giroconto_strategia=(
                    conto.giroconto_strategia.value if getattr(conto, "giroconto_strategia", None) else None
                ),
                created_at=conto.created_at,
                updated_at=conto.updated_at,
                movimenti_provvisori=provvisori_map.get(conto.id, 0),
                aggiornato_il=ultimi_aggiornamenti.get(conto.id),
                ibans=ibans,
                sistema=is_conto_sistema(conto.nome),
            )
        )
    return output


def get_setup(
    db: Session, 
    azienda_id: int,
    only_financial: bool = False
) -> PNSetupResponse:
    """
    Get Prima Nota setup.
    
    Args:
        only_financial: If True, returns only CASSA and BANCA accounts (for manual entries)
    """
    ensure_default_setup(db, azienda_id)

    query = db.query(PNConto).filter(PNConto.azienda_id == azienda_id)
    
    if only_financial:
        # Return only financial accounts (CASSA and BANCA) for manual entries
        query = query.filter(PNConto.tipo.in_([PNContoTipo.CASSA.value, PNContoTipo.BANCA.value]))
    
    conti = query.order_by(PNConto.nome.asc()).all()

    provvisori_map = dict(
        db.query(PNMovimento.conto_id, func.count())
        .filter(
            PNMovimento.azienda_id == azienda_id,
            PNMovimento.stato == PNStatoMovimento.PROVVISORIO,
        )
        .group_by(PNMovimento.conto_id)
        .all()
    )

    ultimi_mov = dict(
        db.query(PNMovimento.conto_id, func.max(PNMovimento.updated_at))
        .filter(PNMovimento.azienda_id == azienda_id)
        .group_by(PNMovimento.conto_id)
        .all()
    )

    preferenze = (
        db.query(PNPreferenze)
        .filter(PNPreferenze.azienda_id == azienda_id)
        .one()
    )

    categorie = (
        db.query(PNCategoria)
        .filter(PNCategoria.azienda_id == azienda_id)
        .order_by(PNCategoria.ordine.asc(), PNCategoria.nome.asc())
        .all()
    )

    return PNSetupResponse(
        conti=_conti_response(conti, provvisori_map, ultimi_mov),
        categorie=[PNCategoriaResponse.model_validate(cat, from_attributes=True) for cat in categorie],
        preferenze=PNPreferenzeResponse.model_validate(preferenze, from_attributes=True),
    )


def _riepilogo_movimenti(movimenti: Iterable[PNMovimento]) -> PNRiepilogoResponse:
    entrate = ZERO
    uscite = ZERO
    for movimento in movimenti:
        if movimento.deleted_at is not None:
            continue
        if movimento.stato != PNStatoMovimento.DEFINITIVO:
            continue
        amount = _to_decimal(movimento.importo)
        if movimento.tipo_operazione == PNTipoOperazione.ENTRATA:
            entrate += amount
        elif movimento.tipo_operazione == PNTipoOperazione.USCITA:
            uscite += amount
    return PNRiepilogoResponse(entrate=entrate, uscite=uscite, saldo=entrate - uscite)


def movimento_to_response(movimento: PNMovimento) -> PNMovimentoResponse:
    from app.schemas.amministrazione.pn import PartitaCollegataResponse
    
    documenti_resp = [
        PNMovimentoDocumentoResponse(
            id=doc.id,
            documento_tipo=doc.documento_tipo,
            documento_id=doc.documento_id,
            importo=doc.importo,
            created_at=doc.created_at,
            updated_at=doc.updated_at,
        )
        for doc in movimento.documenti
    ]
    
    # Recupera le partite collegate tramite PartitaMovimentoFinanziario
    partite_collegate = []
    if hasattr(movimento, 'movimenti_partita') and movimento.movimenti_partita:
        for mov_fin in movimento.movimenti_partita:
            if mov_fin.partita:
                partite_collegate.append(
                    PartitaCollegataResponse(
                        id=mov_fin.partita.id,
                        numero_partita=mov_fin.partita.numero_partita,
                        data=mov_fin.partita.data,
                        tipo=mov_fin.partita.tipo.value if hasattr(mov_fin.partita.tipo, 'value') else str(mov_fin.partita.tipo),
                        numero_capi=mov_fin.partita.numero_capi,
                        importo=mov_fin.importo,
                        direzione=mov_fin.direzione.value if hasattr(mov_fin.direzione, 'value') else str(mov_fin.direzione),
                        tipo_movimento=mov_fin.tipo.value if hasattr(mov_fin.tipo, 'value') else str(mov_fin.tipo),
                    )
                )

    return PNMovimentoResponse(
        id=movimento.id,
        azienda_id=movimento.azienda_id,
        conto_id=movimento.conto_id,
        tipo_operazione=movimento.tipo_operazione,
        importo=movimento.importo,
        data=movimento.data,
        descrizione=movimento.descrizione,
        categoria_id=movimento.categoria_id,
        conto_destinazione_id=movimento.conto_destinazione_id,
        note=movimento.note,
        stato=movimento.stato,
        origine=movimento.origine,
        contropartita_nome=movimento.contropartita_nome,
        quota_extra=movimento.quota_extra,
        metodo_pagamento=movimento.metodo_pagamento,
        documento_riferimento=movimento.documento_riferimento,
        riferimento_esterno=movimento.riferimento_esterno,
        partita_id=movimento.partita_id,
        attrezzatura_id=movimento.attrezzatura_id,
        created_at=movimento.created_at,
        updated_at=movimento.updated_at,
        deleted_at=movimento.deleted_at,
        categoria_nome=movimento.categoria.nome if movimento.categoria else None,
        categoria_label=movimento.categoria.descrizione if movimento.categoria else None,
        conto_nome=movimento.conto.nome if movimento.conto else None,
        conto_destinazione_nome=movimento.conto_destinazione.nome if movimento.conto_destinazione else None,
        documenti=documenti_resp,
        fattura_emessa_id=movimento.fattura_emessa_id,
        fattura_amministrazione_id=movimento.fattura_amministrazione_id,
        pagamento_id=movimento.pagamento_id,
        attrezzatura_nome=movimento.attrezzatura.nome if movimento.attrezzatura else None,
        partite_collegate=partite_collegate,
    )


def list_movimenti(
    db: Session,
    azienda_id: int,
    *,
    conto_id: Optional[int] = None,
    tipo_operazione: Optional[PNTipoOperazione] = None,
    stato: Optional[PNStatoMovimento] = None,
    categoria_id: Optional[int] = None,
    attrezzatura_id: Optional[int] = None,
    partita_id: Optional[int] = None,
    contratto_soccida_id: Optional[int] = None,
    search: Optional[str] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    skip: int = 0,
    limit: int = 200,
) -> PNMovimentiListResponse:
    query = (
        db.query(PNMovimento)
        .options(
            joinedload(PNMovimento.categoria),
            joinedload(PNMovimento.conto),
            joinedload(PNMovimento.conto_destinazione),
            joinedload(PNMovimento.documenti),
            joinedload(PNMovimento.attrezzatura),
            joinedload(PNMovimento.movimenti_partita).joinedload(PartitaMovimentoFinanziario.partita),
        )
        .filter(
            PNMovimento.azienda_id == azienda_id,
        )
    )

    if conto_id:
        query = query.filter(
            or_(PNMovimento.conto_id == conto_id, PNMovimento.conto_destinazione_id == conto_id)
        )
    if tipo_operazione:
        query = query.filter(PNMovimento.tipo_operazione == tipo_operazione)
    if stato:
        query = query.filter(PNMovimento.stato == stato)
    if categoria_id:
        query = query.filter(PNMovimento.categoria_id == categoria_id)
    if attrezzatura_id:
        query = query.filter(PNMovimento.attrezzatura_id == attrezzatura_id)
    if partita_id:
        query = query.filter(PNMovimento.partita_id == partita_id)
    if contratto_soccida_id:
        query = query.filter(PNMovimento.contratto_soccida_id == contratto_soccida_id)
    if data_da:
        query = query.filter(PNMovimento.data >= data_da)
    if data_a:
        query = query.filter(PNMovimento.data <= data_a)
    if search:
        pattern = f"%{search.lower()}%"
        query = query.filter(
            or_(
                func.lower(PNMovimento.descrizione).like(pattern),
                func.lower(PNMovimento.note).like(pattern),
                func.lower(PNMovimento.contropartita_nome).like(pattern),
            )
        )

    movimenti = (
        query.order_by(PNMovimento.data.desc(), PNMovimento.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    return PNMovimentiListResponse(
        movimenti=[movimento_to_response(m) for m in movimenti],
        riepilogo=_riepilogo_movimenti(movimenti),
    )


def _update_conto_saldo(conto: PNConto, delta: Decimal) -> None:
    conto.saldo_attuale = _to_decimal(conto.saldo_attuale) + delta


def _apply_balance_effect(db: Session, movimento: PNMovimento, direction: int) -> None:
    if movimento.stato != PNStatoMovimento.DEFINITIVO:
        return
    amount = _to_decimal(movimento.importo) * direction
    conto = movimento.conto or db.get(PNConto, movimento.conto_id)
    if not conto:
        return

    if movimento.tipo_operazione == PNTipoOperazione.ENTRATA:
        _update_conto_saldo(conto, amount)
    elif movimento.tipo_operazione == PNTipoOperazione.USCITA:
        _update_conto_saldo(conto, -amount)
    elif movimento.tipo_operazione == PNTipoOperazione.GIROCONTO:
        _update_conto_saldo(conto, -amount)
        if movimento.conto_destinazione_id:
            conto_dest = movimento.conto_destinazione or db.get(PNConto, movimento.conto_destinazione_id)
            if conto_dest:
                _update_conto_saldo(conto_dest, amount)


def _adjust_fattura_emessa(movimento: PNMovimento, delta: Decimal) -> None:
    # DEPRECATO: usa _adjust_fattura_amministrazione con tipo='entrata'
    # Questa funzione è mantenuta per compatibilità ma non dovrebbe essere chiamata
    # Le fatture emesse sono ora gestite come FatturaAmministrazione con tipo='entrata'
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    if movimento.fattura_amministrazione:
        fattura = movimento.fattura_amministrazione
        if fattura.tipo == TipoFattura.ENTRATA:
            fattura.importo_incassato = _to_decimal(fattura.importo_incassato or 0) + delta
            residuo = _to_decimal(fattura.importo_totale) - _to_decimal(fattura.importo_incassato)
            if residuo <= ZERO:
                fattura.importo_incassato = _to_decimal(fattura.importo_totale)
                fattura.stato_pagamento = StatoPagamentoFatturaEmessa.INCASSATA
                fattura.data_incasso = movimento.data
            elif residuo < _to_decimal(fattura.importo_totale):
                fattura.stato_pagamento = StatoPagamentoFatturaEmessa.PARZIALE
            else:
                fattura.stato_pagamento = StatoPagamentoFatturaEmessa.DA_INCASSARE


def _adjust_fattura_amministrazione(movimento: PNMovimento, delta: Decimal) -> None:
    fattura = movimento.fattura_amministrazione
    if not fattura:
        return
    fattura.importo_pagato = _to_decimal(fattura.importo_pagato) + delta
    residuo = _to_decimal(fattura.importo_totale) - _to_decimal(fattura.importo_pagato)
    if residuo <= ZERO:
        fattura.importo_pagato = _to_decimal(fattura.importo_totale)
        fattura.stato_pagamento = StatoPagamentoFatturaAmministrazione.PAGATA
        fattura.data_pagamento = movimento.data
    elif residuo < _to_decimal(fattura.importo_totale):
        fattura.stato_pagamento = StatoPagamentoFatturaAmministrazione.PARZIALE
    else:
        fattura.stato_pagamento = StatoPagamentoFatturaAmministrazione.DA_PAGARE


def _apply_document_links(movimento: PNMovimento, direction: int) -> None:
    if movimento.stato != PNStatoMovimento.DEFINITIVO:
        return
    for documento in movimento.documenti:
        delta = _to_decimal(documento.importo) * direction
        if documento.documento_tipo == PNDocumentoTipo.FATTURA_EMESSA:
            _adjust_fattura_emessa(movimento, delta)
        elif documento.documento_tipo == PNDocumentoTipo.FATTURA_AMMINISTRAZIONE:
            _adjust_fattura_amministrazione(movimento, delta)


def _build_documenti_from_input(
    movimento: PNMovimento, collegamenti: Iterable[PNMovimentoDocumentoInput]
) -> None:
    movimento.documenti.clear()
    for link in collegamenti:
        movimento.documenti.append(
            PNMovimentoDocumento(
                documento_tipo=link.documento_tipo,
                documento_id=link.documento_id,
                importo=_to_decimal(link.importo),
            )
        )


def _check_conto(azienda_id: int, conto: PNConto) -> None:
    if conto.azienda_id != azienda_id:
        raise ValueError("Il conto non appartiene all'azienda selezionata")


def create_movimento(db: Session, payload: PNMovimentoCreate) -> PNMovimentoResponse:
    conto = db.get(PNConto, payload.conto_id)
    if not conto:
        raise ValueError("Conto non trovato")
    azienda_id = payload.azienda_id or conto.azienda_id
    _check_conto(azienda_id, conto)
    
    # For manual entries, validate that conto_id is a financial account (CASSA/BANCA)
    origine = payload.origine or PNMovimentoOrigine.MANUALE
    if origine == PNMovimentoOrigine.MANUALE and conto.tipo not in (PNContoTipo.CASSA.value, PNContoTipo.BANCA.value):
        raise ValueError("Per le operazioni manuali è possibile utilizzare solo conti di tipo 'Cassa' o 'Banca'.")

    movimento = PNMovimento(
        azienda_id=azienda_id,
        conto_id=payload.conto_id,
        conto_destinazione_id=payload.conto_destinazione_id,
        categoria_id=payload.categoria_id,
        partita_id=payload.partita_id,
        attrezzatura_id=payload.attrezzatura_id,
        tipo_operazione=payload.tipo_operazione,
        stato=payload.stato,
        origine=payload.origine,
        data=payload.data,
        descrizione=payload.descrizione,
        note=payload.note,
        importo=_to_decimal(payload.importo),
        quota_extra=_to_decimal(payload.quota_extra) if payload.quota_extra is not None else None,
        contropartita_nome=payload.contropartita_nome,
        metodo_pagamento=payload.metodo_pagamento,
        documento_riferimento=payload.documento_riferimento,
        riferimento_esterno=payload.riferimento_esterno,
        fattura_emessa_id=payload.fattura_emessa_id,
        fattura_amministrazione_id=payload.fattura_amministrazione_id,
        pagamento_id=payload.pagamento_id,
        contratto_soccida_id=payload.contratto_soccida_id,
    )
    db.add(movimento)
    db.flush()

    if payload.collegamenti:
        _build_documenti_from_input(movimento, payload.collegamenti)
        db.flush()

    _apply_balance_effect(db, movimento, direction=1)
    _apply_document_links(movimento, direction=1)
    db.flush()

    return movimento_to_response(movimento)


def update_movimento(db: Session, movimento_id: int, payload: PNMovimentoUpdate) -> PNMovimentoResponse:
    movimento = (
        db.query(PNMovimento)
        .options(
            joinedload(PNMovimento.documenti),
            joinedload(PNMovimento.conto),
            joinedload(PNMovimento.conto_destinazione),
            joinedload(PNMovimento.movimenti_partita).joinedload(PartitaMovimentoFinanziario.partita),
        )
        .filter(PNMovimento.id == movimento_id, PNMovimento.deleted_at.is_(None))
        .first()
    )
    if not movimento:
        raise ValueError("Movimento non trovato")
    
    # Protect system-generated entries: allow limited modifications only
    if movimento.origine == PNMovimentoOrigine.AUTOMATICO:
        # For automatic entries, only allow changing description, notes, and category
        # Do not allow changing account (conto_id), amount, or tipo_operazione
        if payload.conto_id is not None and payload.conto_id != movimento.conto_id:
            raise ValueError("Non è possibile modificare il conto di un movimento generato automaticamente.")
        if payload.importo is not None and payload.importo != movimento.importo:
            raise ValueError("Non è possibile modificare l'importo di un movimento generato automaticamente.")
        if payload.tipo_operazione is not None and payload.tipo_operazione != movimento.tipo_operazione:
            raise ValueError("Non è possibile modificare il tipo operazione di un movimento generato automaticamente.")
    
    # For manual entries, validate that conto_id is a financial account (CASSA/BANCA)
    if movimento.origine == PNMovimentoOrigine.MANUALE and payload.conto_id is not None:
        new_conto = db.get(PNConto, payload.conto_id)
        if new_conto and new_conto.tipo not in (PNContoTipo.CASSA.value, PNContoTipo.BANCA.value):
            raise ValueError("Per le operazioni manuali è possibile utilizzare solo conti di tipo 'Cassa' o 'Banca'.")

    _apply_balance_effect(db, movimento, direction=-1)
    _apply_document_links(movimento, direction=-1)

    if payload.conto_id is not None:
        conto = db.get(PNConto, payload.conto_id)
        if not conto:
            raise ValueError("Conto non trovato")
        _check_conto(movimento.azienda_id, conto)
        movimento.conto_id = payload.conto_id
        movimento.conto = conto

    if payload.conto_destinazione_id is not None:
        if payload.conto_destinazione_id:
            conto_dest = db.get(PNConto, payload.conto_destinazione_id)
            if not conto_dest:
                raise ValueError("Conto destinazione non trovato")
            _check_conto(movimento.azienda_id, conto_dest)
            movimento.conto_destinazione_id = payload.conto_destinazione_id
            movimento.conto_destinazione = conto_dest
        else:
            movimento.conto_destinazione_id = None
            movimento.conto_destinazione = None

    if payload.categoria_id is not None:
        movimento.categoria_id = payload.categoria_id
    if payload.tipo_operazione is not None:
        movimento.tipo_operazione = payload.tipo_operazione
    if payload.stato is not None:
        movimento.stato = payload.stato
    if payload.partita_id is not None:
        movimento.partita_id = payload.partita_id
    if payload.attrezzatura_id is not None:
        movimento.attrezzatura_id = payload.attrezzatura_id
    if payload.contratto_soccida_id is not None:
        movimento.contratto_soccida_id = payload.contratto_soccida_id
    if payload.data is not None:
        movimento.data = payload.data
    if payload.descrizione is not None:
        movimento.descrizione = payload.descrizione
    if payload.note is not None:
        movimento.note = payload.note
    if payload.importo is not None:
        movimento.importo = _to_decimal(payload.importo)
    if payload.quota_extra is not None:
        movimento.quota_extra = _to_decimal(payload.quota_extra)
    if payload.contropartita_nome is not None:
        movimento.contropartita_nome = payload.contropartita_nome
    if payload.metodo_pagamento is not None:
        movimento.metodo_pagamento = payload.metodo_pagamento
    if payload.documento_riferimento is not None:
        movimento.documento_riferimento = payload.documento_riferimento
    if payload.riferimento_esterno is not None:
        movimento.riferimento_esterno = payload.riferimento_esterno

    if payload.collegamenti is not None:
        _build_documenti_from_input(movimento, payload.collegamenti)

    db.flush()
    _apply_balance_effect(db, movimento, direction=1)
    _apply_document_links(movimento, direction=1)
    db.flush()

    return movimento_to_response(movimento)


def delete_movimento(db: Session, movimento_id: int) -> None:
    movimento = (
        db.query(PNMovimento)
        .options(joinedload(PNMovimento.documenti))
        .filter(PNMovimento.id == movimento_id, PNMovimento.deleted_at.is_(None))
        .first()
    )
    if not movimento:
        return

    _apply_balance_effect(db, movimento, direction=-1)
    _apply_document_links(movimento, direction=-1)
    
    # Elimina anche i PartitaMovimentoFinanziario collegati a questo movimento
    # (es. acconti soccida che creano movimenti finanziari sulle partite)
    db.query(PartitaMovimentoFinanziario).filter(
        PartitaMovimentoFinanziario.pn_movimento_id == movimento_id
    ).delete(synchronize_session=False)
    
    movimento.deleted_at = datetime.utcnow()
    db.flush()


def conferma_movimento(db: Session, movimento_id: int) -> PNMovimentoResponse:
    movimento = (
        db.query(PNMovimento)
        .options(joinedload(PNMovimento.documenti))
        .filter(PNMovimento.id == movimento_id, PNMovimento.deleted_at.is_(None))
        .first()
    )
    if not movimento:
        raise ValueError("Movimento non trovato")
    if movimento.stato == PNStatoMovimento.DEFINITIVO:
        return movimento_to_response(movimento)

    movimento.stato = PNStatoMovimento.DEFINITIVO
    db.flush()
    _apply_balance_effect(db, movimento, direction=1)
    _apply_document_links(movimento, direction=1)
    db.flush()
    return movimento_to_response(movimento)


def get_documenti_aperti(db: Session, azienda_id: int) -> List[PNDocumentoApertoResponse]:
    from app.models.amministrazione.fattura_amministrazione import TipoFattura
    
    documenti: List[PNDocumentoApertoResponse] = []

    # Per le fatture emesse (tipo=entrata), recupera anche il cliente se collegato tramite cliente_id
    fatture_emesse = (
        db.query(FatturaAmministrazione, Fornitore)
        .outerjoin(Fornitore, FatturaAmministrazione.cliente_id == Fornitore.id)
        .filter(
            FatturaAmministrazione.azienda_id == azienda_id,
            FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
            FatturaAmministrazione.deleted_at.is_(None),
        )
        .all()
    )
    for fattura, cliente in fatture_emesse:
        residuo = _to_decimal(fattura.importo_totale) - _to_decimal(fattura.importo_incassato)
        if residuo <= ZERO:
            continue
        # Usa cliente_nome se disponibile, altrimenti il nome del fornitore/cliente collegato
        contropartita = fattura.cliente_nome
        if not contropartita and cliente:
            contropartita = cliente.nome
        # Recupera tipo_documento e condizioni_pagamento dai dati XML se disponibili
        tipo_documento = None
        condizioni_pagamento = None
        # FatturaAmministrazione (tipo=entrata) potrebbe avere dati_xml se importata da XML
        if hasattr(fattura, 'dati_xml') and fattura.dati_xml:
            documento = fattura.dati_xml.get('documento', {})
            if isinstance(documento, dict):
                tipo_documento = documento.get('tipo_documento')
            pagamenti = fattura.dati_xml.get('pagamenti', [])
            if pagamenti and isinstance(pagamenti, list) and len(pagamenti) > 0:
                primo_pagamento = pagamenti[0] if isinstance(pagamenti[0], dict) else {}
                condizioni_pagamento = primo_pagamento.get('condizioni_pagamento')
        
        # Verifica se il cliente è una società di soccida
        is_soccida = False
        contratto_soccida_id = None
        if cliente:
            from app.models.amministrazione.contratto_soccida import ContrattoSoccida
            contratto = (
                db.query(ContrattoSoccida)
                .filter(
                    ContrattoSoccida.soccidante_id == cliente.id,
                    ContrattoSoccida.deleted_at.is_(None),
                )
                .first()
            )
            if contratto:
                is_soccida = True
                contratto_soccida_id = contratto.id
        
        documenti.append(
            PNDocumentoApertoResponse(
                id=fattura.id,
                tipo=PNDocumentoTipo.FATTURA_AMMINISTRAZIONE.value,
                riferimento=fattura.numero,
                data=fattura.data_fattura,
                contropartita=contropartita,
                residuo=residuo,
                tipo_documento=tipo_documento,
                condizioni_pagamento=condizioni_pagamento,
                tipo_fattura=TipoFattura.ENTRATA.value,  # Fattura emessa = entrata
                contratto_soccida_id=contratto_soccida_id,
                is_soccida=is_soccida,
            )
        )

    # Fatture ricevute (tipo=uscita) - sono fatture da fornitori
    # Le includiamo tutte perché sono fatture ricevute dall'azienda
    # Usa joinedload per caricare il fornitore in modo efficiente
    fatture_ricevute = (
        db.query(FatturaAmministrazione, Fornitore)
        .outerjoin(Fornitore, FatturaAmministrazione.fornitore_id == Fornitore.id)
        .filter(
            FatturaAmministrazione.azienda_id == azienda_id,
            FatturaAmministrazione.tipo == TipoFattura.USCITA,
            FatturaAmministrazione.deleted_at.is_(None),
        )
        .all()
    )
    for fattura, fornitore in fatture_ricevute:
        residuo = _to_decimal(fattura.importo_totale) - _to_decimal(fattura.importo_pagato)
        if residuo <= ZERO:
            continue
        # Ottieni il nome del fornitore dalla relazione o da dati_xml
        contropartita = None
        if fornitore:
            contropartita = fornitore.nome
        # Se non c'è fornitore collegato, prova a recuperarlo dai dati XML
        if not contropartita and fattura.dati_xml:
            cedente = fattura.dati_xml.get('cedente', {})
            if isinstance(cedente, dict):
                contropartita = cedente.get('denominazione') or cedente.get('ragione_sociale')
        # Se ancora non c'è contropartita, prova a recuperarla da altri campi XML
        if not contropartita and fattura.dati_xml:
            # Prova anche in altri punti dell'XML
            dati_trasmissione = fattura.dati_xml.get('dati_trasmissione', {})
            if isinstance(dati_trasmissione, dict):
                contropartita = dati_trasmissione.get('id_codice') or dati_trasmissione.get('codice_destinatario')
        # Recupera tipo_documento e condizioni_pagamento dai dati XML o dal modello
        tipo_documento = fattura.tipo_documento
        condizioni_pagamento = fattura.condizioni_pagamento
        
        # Se non disponibili nel modello, prova a recuperarli dai dati XML
        if not tipo_documento and fattura.dati_xml:
            documento = fattura.dati_xml.get('documento', {})
            if isinstance(documento, dict):
                tipo_documento = documento.get('tipo_documento')
            pagamenti = fattura.dati_xml.get('pagamenti', [])
            if pagamenti and isinstance(pagamenti, list) and len(pagamenti) > 0:
                primo_pagamento = pagamenti[0] if isinstance(pagamenti[0], dict) else {}
                condizioni_pagamento = primo_pagamento.get('condizioni_pagamento') or condizioni_pagamento
        
        # Per le fatture ricevute, verifica se il fornitore è anche cliente (potrebbe essere misto)
        # ma non è una società di soccida (soccida è solo per clienti)
        documenti.append(
            PNDocumentoApertoResponse(
                id=fattura.id,
                tipo=PNDocumentoTipo.FATTURA_AMMINISTRAZIONE.value,
                riferimento=fattura.numero,
                data=fattura.data_fattura,
                contropartita=contropartita,
                residuo=residuo,
                tipo_documento=tipo_documento,
                condizioni_pagamento=condizioni_pagamento,
                tipo_fattura=TipoFattura.USCITA.value,  # Fattura ricevuta = uscita
                contratto_soccida_id=None,
                is_soccida=False,
            )
        )

    return documenti


def create_categoria(db: Session, payload: PNCategoriaCreate) -> PNCategoria:
    """Crea una nuova categoria Prima Nota"""
    nome = _normalize_nome(payload.nome)
    if not nome:
        raise ValueError("Il nome della categoria è obbligatorio.")
    
    # Verifica duplicati
    existing = (
        db.query(PNCategoria)
        .filter(
            PNCategoria.azienda_id == payload.azienda_id,
            func.lower(PNCategoria.nome) == nome.lower(),
            PNCategoria.tipo_operazione == payload.tipo_operazione,
        )
        .first()
    )
    if existing:
        raise ValueError(f"Esiste già una categoria '{nome}' per questo tipo di operazione.")
    
    categoria = PNCategoria(
        azienda_id=payload.azienda_id,
        nome=nome,
        codice=payload.codice,
        tipo_operazione=payload.tipo_operazione,
        descrizione=_clean_text(payload.descrizione),
        ordine=payload.ordine,
        attiva=payload.attiva,
        richiede_terreno=payload.richiede_terreno,
        richiede_attrezzatura=payload.richiede_attrezzatura,
        macrocategoria=payload.macrocategoria,
        creata_dal_sistema=False,
    )
    db.add(categoria)
    db.flush()
    return categoria


def update_categoria(db: Session, categoria_id: int, payload: PNCategoriaUpdate) -> PNCategoria:
    """Aggiorna una categoria Prima Nota"""
    categoria = db.get(PNCategoria, categoria_id)
    if not categoria:
        raise LookupError("Categoria non trovata")
    
    if categoria.creata_dal_sistema and payload.nome and payload.nome.lower() != categoria.nome.lower():
        raise ValueError("Non è possibile modificare il nome di una categoria creata dal sistema.")
    
    if payload.nome is not None:
        nome = _normalize_nome(payload.nome)
        if not nome:
            raise ValueError("Il nome della categoria non può essere vuoto.")
        
        # Verifica duplicati (escludendo la categoria corrente)
        existing = (
            db.query(PNCategoria)
            .filter(
                PNCategoria.azienda_id == categoria.azienda_id,
                func.lower(PNCategoria.nome) == nome.lower(),
                PNCategoria.tipo_operazione == (payload.tipo_operazione or categoria.tipo_operazione),
                PNCategoria.id != categoria_id,
            )
            .first()
        )
        if existing:
            raise ValueError(f"Esiste già una categoria '{nome}' per questo tipo di operazione.")
        categoria.nome = nome
    
    if payload.codice is not None:
        categoria.codice = payload.codice
    if payload.tipo_operazione is not None:
        categoria.tipo_operazione = payload.tipo_operazione
    if payload.descrizione is not None:
        # Gestisci stringa vuota come None (per cancellare la descrizione)
        cleaned = _clean_text(payload.descrizione)
        categoria.descrizione = cleaned if cleaned else None
    if payload.ordine is not None:
        categoria.ordine = payload.ordine
    if payload.attiva is not None:
        categoria.attiva = payload.attiva
    if payload.richiede_terreno is not None:
        categoria.richiede_terreno = payload.richiede_terreno
    if payload.richiede_attrezzatura is not None:
        categoria.richiede_attrezzatura = payload.richiede_attrezzatura
    if payload.macrocategoria is not None:
        categoria.macrocategoria = payload.macrocategoria
    
    db.flush()
    return categoria


def delete_categoria(db: Session, categoria_id: int) -> None:
    """Elimina una categoria Prima Nota (soft delete o hard delete se non usata)"""
    categoria = db.get(PNCategoria, categoria_id)
    if not categoria:
        raise LookupError("Categoria non trovata")
    
    if categoria.creata_dal_sistema:
        raise ValueError("Non è possibile eliminare una categoria creata dal sistema.")
    
    # Verifica se la categoria è usata in movimenti
    movimenti_count = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.categoria_id == categoria_id,
            PNMovimento.deleted_at.is_(None),
        )
        .count()
    )
    
    if movimenti_count > 0:
        # Soft delete: disattiva invece di eliminare
        categoria.attiva = False
        db.flush()
    else:
        # Hard delete: nessun movimento usa questa categoria
        db.delete(categoria)
        db.flush()


def list_categorie(
    db: Session,
    azienda_id: int,
    tipo_operazione: Optional[PNTipoOperazione] = None,
    attive_only: bool = True,
) -> List[PNCategoria]:
    """Lista le categorie Prima Nota per un'azienda"""
    query = db.query(PNCategoria).filter(PNCategoria.azienda_id == azienda_id)
    
    if tipo_operazione:
        query = query.filter(PNCategoria.tipo_operazione == tipo_operazione)
    
    if attive_only:
        query = query.filter(PNCategoria.attiva.is_(True))
    
    return query.order_by(PNCategoria.ordine.asc(), PNCategoria.nome.asc()).all()
