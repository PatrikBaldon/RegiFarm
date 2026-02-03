"""Utility helpers to keep Prima Nota entries in sync with invoices and payments."""

from datetime import date
from decimal import Decimal
from typing import Optional, List

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.amministrazione import (
    FatturaAmministrazione,
    Pagamento,
)
from app.models.amministrazione.fattura_amministrazione import TipoFattura
from app.models.amministrazione.partita_animale import PartitaAnimale, ModalitaGestionePartita
from app.models.amministrazione.partita_animale_movimento_finanziario import (
    PartitaMovimentoFinanziario,
    PartitaMovimentoDirezione,
    PartitaMovimentoTipo,
)
from app.models.amministrazione.contratto_soccida import ContrattoSoccida
from app.models.amministrazione.pn import (
    PNMovimento,
    PNPreferenze,
    PNCategoria,
    PNTipoOperazione,
    PNStatoMovimento,
    PNMovimentoOrigine,
    PNDocumentoTipo,
    PNConto,
)
from app.schemas.amministrazione.pn import (
    PNMovimentoCreate,
    PNMovimentoUpdate,
    PNMovimentoDocumentoInput,
    SyncFattureResponse,
    SyncFattureErrorItem,
)
from app.services.amministrazione.prima_nota_service import (
    ensure_default_setup,
    create_movimento as pn_create_movimento,
    update_movimento as pn_update_movimento,
    delete_movimento as pn_delete_movimento,
    get_conto_soccida_monetizzata,
)


ZERO = Decimal("0")


def _to_decimal(value: Optional[Decimal]) -> Decimal:
    if isinstance(value, Decimal):
        return value
    if value is None:
        return ZERO
    try:
        return Decimal(str(value))
    except Exception:
        return ZERO


def _get_preferenze(db: Session, azienda_id: int) -> Optional[PNPreferenze]:
    ensure_default_setup(db, azienda_id)
    return (
        db.query(PNPreferenze)
        .filter(PNPreferenze.azienda_id == azienda_id)
        .one_or_none()
    )


def _get_conto_iva(
    db: Session,
    azienda_id: int,
    tipo_fattura: TipoFattura,
) -> Optional[int]:
    """
    Trova il conto IVA appropriato per il tipo di fattura.
    - Fatture emesse (entrata): IVA vendite (da versare allo Stato)
    - Fatture ricevute (uscita): IVA acquisti (da recuperare dallo Stato)
    Supporta anche nomi legacy (IVA a debito / IVA a credito).
    """
    from app.models.amministrazione.pn import PNConto

    if tipo_fattura == TipoFattura.ENTRATA:
        nomi_prova = ["IVA vendite", "IVA a debito"]
    else:
        nomi_prova = ["IVA acquisti", "IVA a credito"]

    for nome_conto in nomi_prova:
        conto = (
            db.query(PNConto)
            .filter(
                PNConto.azienda_id == azienda_id,
                func.lower(PNConto.nome) == nome_conto.lower(),
                PNConto.attivo.is_(True),
            )
            .first()
        )
        if conto:
            return conto.id
    return None


def _get_categoria_id(
    db: Session, 
    azienda_id: int, 
    tipo: PNTipoOperazione,
    categoria_fattura: Optional[str] = None,
    categoria_id: Optional[int] = None
) -> Optional[int]:
    """
    Trova la categoria Prima Nota da usare per un movimento.
    
    Strategia:
    1. Se categoria_id è fornito direttamente, usalo (priorità massima)
    2. Se categoria_fattura è fornita, cerca una categoria Prima Nota che corrisponda
       (per nome o codice, case-insensitive)
    3. Se non trovata, usa la categoria di default (prima categoria attiva per tipo)
    """
    # Priorità 1: Se abbiamo categoria_id direttamente, usalo
    if categoria_id:
        categoria = db.query(PNCategoria).filter(
            PNCategoria.id == categoria_id,
            PNCategoria.tipo_operazione == tipo,
            PNCategoria.attiva.is_(True),
        ).first()
        if categoria:
            return categoria.id
    
    # Priorità 2: Se abbiamo una categoria dalla fattura (stringa), cerca una corrispondenza
    if categoria_fattura:
        # Cerca per nome (case-insensitive, partial match)
        categoria = (
            db.query(PNCategoria)
            .filter(
                PNCategoria.tipo_operazione == tipo,
                (PNCategoria.azienda_id == azienda_id) | (PNCategoria.azienda_id.is_(None)),
                PNCategoria.attiva.is_(True),
                func.lower(PNCategoria.nome).contains(categoria_fattura.lower())
            )
            .order_by(
                # Priorità: prima quelle specifiche dell'azienda, poi quelle globali
                PNCategoria.azienda_id.desc().nullslast(),
                PNCategoria.ordine.asc(),
                PNCategoria.id.asc()
            )
            .first()
        )
        
        # Se non trovata per nome, prova per codice
        if not categoria and categoria_fattura:
            categoria = (
                db.query(PNCategoria)
                .filter(
                    PNCategoria.tipo_operazione == tipo,
                    (PNCategoria.azienda_id == azienda_id) | (PNCategoria.azienda_id.is_(None)),
                    PNCategoria.attiva.is_(True),
                    func.lower(PNCategoria.codice).contains(categoria_fattura.lower())
                )
                .order_by(
                    PNCategoria.azienda_id.desc().nullslast(),
                    PNCategoria.ordine.asc(),
                    PNCategoria.id.asc()
                )
                .first()
            )
        
        if categoria:
            return categoria.id
    
    # Fallback: categoria di default (prima categoria attiva per tipo)
    categoria = (
        db.query(PNCategoria)
        .filter(
            PNCategoria.tipo_operazione == tipo,
            (PNCategoria.azienda_id == azienda_id) | (PNCategoria.azienda_id.is_(None)),
            PNCategoria.attiva.is_(True),
        )
        .order_by(
            PNCategoria.azienda_id.desc().nullslast(),  # Prima quelle specifiche dell'azienda
            PNCategoria.ordine.asc(),
            PNCategoria.id.asc()
        )
        .first()
    )
    return categoria.id if categoria else None


def _build_documento_link(documento_tipo: PNDocumentoTipo, documento_id: int, importo: Decimal) -> PNMovimentoDocumentoInput:
    return PNMovimentoDocumentoInput(
        documento_tipo=documento_tipo,
        documento_id=documento_id,
        importo=_to_decimal(importo),
    )


def ensure_prima_nota_for_fattura_amministrazione_entrata(db: Session, fattura: FatturaAmministrazione, azienda_id: Optional[int] = None) -> None:
    """Crea/aggiorna movimento Prima Nota per fattura emessa (tipo=entrata)"""
    if not fattura or not fattura.id:
        return
    
    # Per tipo=entrata, azienda_id è obbligatorio
    azienda_id = azienda_id or fattura.azienda_id
    if not azienda_id:
        return

    preferenze = _get_preferenze(db, azienda_id)
    if not preferenze or not preferenze.conto_incassi_id:
        return

    amount = _to_decimal(fattura.importo_netto or fattura.importo_totale)
    movement_date = fattura.data_fattura or fattura.data_registrazione or date.today()
    description = f"Fattura emessa {fattura.numero}"
    categoria_id = _get_categoria_id(db, azienda_id, PNTipoOperazione.ENTRATA, fattura.categoria)

    movimento = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.fattura_amministrazione_id == fattura.id,
            PNMovimento.tipo_operazione == PNTipoOperazione.ENTRATA,
            PNMovimento.deleted_at.is_(None),
        )
        .first()
    )

    collegamenti = [_build_documento_link(PNDocumentoTipo.FATTURA_AMMINISTRAZIONE, fattura.id, amount)]

    if movimento:
        update_payload = PNMovimentoUpdate(
            conto_id=preferenze.conto_incassi_id,
            categoria_id=categoria_id,
            tipo_operazione=PNTipoOperazione.ENTRATA,
            stato=PNStatoMovimento.DEFINITIVO,
            data=movement_date,
            descrizione=description,
            importo=amount,
            contropartita_nome=fattura.cliente_nome or fattura.cliente_piva or fattura.cliente_cf,
            collegamenti=collegamenti,
        )
        pn_update_movimento(db, movimento.id, update_payload)
    else:
        create_payload = PNMovimentoCreate(
            azienda_id=azienda_id,
            conto_id=preferenze.conto_incassi_id,
            categoria_id=categoria_id,
            tipo_operazione=PNTipoOperazione.ENTRATA,
            stato=PNStatoMovimento.DEFINITIVO,
            origine=PNMovimentoOrigine.AUTOMATICO,
            data=movement_date,
            descrizione=description,
            importo=amount,
            contropartita_nome=fattura.cliente_nome or fattura.cliente_piva or fattura.cliente_cf,
            fattura_amministrazione_id=fattura.id,
            collegamenti=collegamenti,
        )
        pn_create_movimento(db, create_payload)


def _split_imponibile_iva(
    db: Session,
    fattura: FatturaAmministrazione,
    azienda_id: int,
    tipo_operazione: PNTipoOperazione,
    conto_imponibile_id: int,
    categoria_id: Optional[int],
    movement_date: date,
    description: str,
    contropartita_nome: Optional[str],
    collegamenti: List[PNMovimentoDocumentoInput],
    attrezzatura_id: Optional[int] = None,
    contratto_soccida_id: Optional[int] = None,
) -> List[PNMovimento]:
    """
    Crea movimenti separati per imponibile e IVA.
    Restituisce la lista dei movimenti creati.
    """
    importo_netto = _to_decimal(fattura.importo_netto or fattura.importo_totale)
    importo_iva = _to_decimal(fattura.importo_iva or 0)
    
    movimenti_creati = []
    
    # Ottieni conti IVA per identificare movimenti IVA
    conto_iva_id = _get_conto_iva(db, azienda_id, fattura.tipo) if importo_iva > 0 else None
    conti_iva_ids = []
    if conto_iva_id:
        conti_iva_ids = [conto_iva_id]
    else:
        # Cerca anche manualmente i conti IVA
        conti_iva = (
            db.query(PNConto)
            .filter(
                PNConto.azienda_id == azienda_id,
                func.lower(PNConto.nome).in_(
                    ["iva vendite", "iva acquisti", "iva a debito", "iva a credito"]
                ),
                PNConto.attivo.is_(True),
            )
            .all()
        )
        conti_iva_ids = [c.id for c in conti_iva]
    
    # 1. Movimento imponibile (sempre creato se importo_netto > 0)
    if importo_netto > 0:
        # Cerca movimento imponibile esistente (non è un conto IVA)
        movimento_imponibile = (
            db.query(PNMovimento)
            .filter(
                PNMovimento.fattura_amministrazione_id == fattura.id,
                PNMovimento.tipo_operazione == tipo_operazione,
                PNMovimento.deleted_at.is_(None),
            )
        )
        # Se ci sono conti IVA, escludili dalla ricerca
        if conti_iva_ids:
            movimento_imponibile = movimento_imponibile.filter(~PNMovimento.conto_id.in_(conti_iva_ids))
        movimento_imponibile = movimento_imponibile.first()
        
        if movimento_imponibile:
            update_payload = PNMovimentoUpdate(
                conto_id=conto_imponibile_id,
                categoria_id=categoria_id,
                tipo_operazione=tipo_operazione,
                stato=PNStatoMovimento.DEFINITIVO,
                data=movement_date,
                descrizione=f"{description} - Imponibile",
                importo=importo_netto,
                contropartita_nome=contropartita_nome,
                collegamenti=collegamenti,
                attrezzatura_id=attrezzatura_id,
                contratto_soccida_id=contratto_soccida_id,
            )
            movimento_updated = pn_update_movimento(db, movimento_imponibile.id, update_payload)
            movimenti_creati.append(db.query(PNMovimento).filter(PNMovimento.id == movimento_updated.id).first())
        else:
            create_payload = PNMovimentoCreate(
                azienda_id=azienda_id,
                conto_id=conto_imponibile_id,
                categoria_id=categoria_id,
                tipo_operazione=tipo_operazione,
                stato=PNStatoMovimento.DEFINITIVO,
                origine=PNMovimentoOrigine.AUTOMATICO,
                data=movement_date,
                descrizione=f"{description} - Imponibile",
                importo=importo_netto,
                contropartita_nome=contropartita_nome,
                fattura_amministrazione_id=fattura.id,
                collegamenti=collegamenti,
                attrezzatura_id=attrezzatura_id,
                contratto_soccida_id=contratto_soccida_id,
            )
            movimento_response = pn_create_movimento(db, create_payload)
            movimenti_creati.append(db.query(PNMovimento).filter(PNMovimento.id == movimento_response.id).first())
    
    # 2. Movimento IVA (solo se presente)
    if importo_iva > 0 and conto_iva_id:
        # Cerca movimento IVA esistente
        movimento_iva = (
            db.query(PNMovimento)
            .filter(
                PNMovimento.fattura_amministrazione_id == fattura.id,
                PNMovimento.tipo_operazione == tipo_operazione,
                PNMovimento.conto_id == conto_iva_id,
                PNMovimento.deleted_at.is_(None),
            )
            .first()
        )
        
        # Crea collegamento per IVA (stesso documento, importo IVA)
        collegamenti_iva = [_build_documento_link(PNDocumentoTipo.FATTURA_AMMINISTRAZIONE, fattura.id, importo_iva)]
        
        if movimento_iva:
            update_payload = PNMovimentoUpdate(
                conto_id=conto_iva_id,
                categoria_id=_get_categoria_id(db, azienda_id, tipo_operazione, categoria_fattura="IVA"),
                tipo_operazione=tipo_operazione,
                stato=PNStatoMovimento.DEFINITIVO,
                data=movement_date,
                descrizione=f"{description} - IVA",
                importo=importo_iva,
                contropartita_nome=contropartita_nome,
                collegamenti=collegamenti_iva,
            )
            movimento_updated = pn_update_movimento(db, movimento_iva.id, update_payload)
            movimenti_creati.append(db.query(PNMovimento).filter(PNMovimento.id == movimento_updated.id).first())
        else:
            create_payload = PNMovimentoCreate(
                azienda_id=azienda_id,
                conto_id=conto_iva_id,
                categoria_id=_get_categoria_id(db, azienda_id, tipo_operazione, categoria_fattura="IVA"),
                tipo_operazione=tipo_operazione,
                stato=PNStatoMovimento.DEFINITIVO,
                origine=PNMovimentoOrigine.AUTOMATICO,
                data=movement_date,
                descrizione=f"{description} - IVA",
                importo=importo_iva,
                contropartita_nome=contropartita_nome,
                fattura_amministrazione_id=fattura.id,
                collegamenti=collegamenti_iva,
            )
            movimento_response = pn_create_movimento(db, create_payload)
            movimenti_creati.append(db.query(PNMovimento).filter(PNMovimento.id == movimento_response.id).first())
    
    return movimenti_creati


def _get_conto_revenue_or_cost(
    db: Session,
    azienda_id: int,
    tipo_fattura: TipoFattura,
    categoria_id: Optional[int] = None,
) -> Optional[int]:
    """
    Trova il conto economico appropriato per la fattura.
    - Fatture emesse (entrata): Vendite (o legacy Ricavi vendite)
    - Fatture ricevute (uscita): Acquisti
    """
    from app.models.amministrazione.pn import PNConto

    if tipo_fattura == TipoFattura.ENTRATA:
        nomi_prova = ["Vendite", "Ricavi vendite"]
    else:
        nomi_prova = ["Acquisti"]

    for nome_conto in nomi_prova:
        conto = (
            db.query(PNConto)
            .filter(
                PNConto.azienda_id == azienda_id,
                func.lower(PNConto.nome) == nome_conto.lower(),
                PNConto.attivo.is_(True),
            )
            .first()
        )
        if conto:
            return conto.id
    return None


def ensure_prima_nota_for_fattura_amministrazione(
    db: Session,
    fattura: FatturaAmministrazione,
    azienda_id: Optional[int],
) -> None:
    """Crea/aggiorna movimento Prima Nota per fattura (gestisce sia tipo=entrata che tipo=uscita)
    
    Implementa la contabilizzazione completa secondo le best practice nazionali:
    - Fattura emessa (ENTRATA):
        * Debit: "Crediti verso clienti" (importo totale)
        * Credit: "Ricavi vendite" (imponibile) 
        * Credit: "IVA a debito" (IVA)
    - Fattura ricevuta (USCITA):
        * Credit: "Debiti verso fornitori" (importo totale)
        * Debit: "Acquisti" (imponibile)
        * Debit: "IVA a credito" (IVA)
    """
    if not fattura or not fattura.id:
        return
    
    # Determina azienda_id: per tipo=entrata è obbligatorio, per tipo=uscita può essere opzionale
    if fattura.tipo == TipoFattura.ENTRATA:
        azienda_id = azienda_id or fattura.azienda_id
        if not azienda_id:
            return
        preferenze = _get_preferenze(db, azienda_id)
        if not preferenze:
            return
        # Per fattura emessa: conto ricavi per imponibile, conto crediti per totale
        conto_imponibile_id = _get_conto_revenue_or_cost(db, azienda_id, fattura.tipo)
        conto_crediti_id = preferenze.conto_crediti_clienti_id
        if not conto_imponibile_id or not conto_crediti_id:
            return
        tipo_operazione = PNTipoOperazione.ENTRATA
        description = f"Fattura emessa {fattura.numero}"
        contropartita_nome = fattura.cliente_nome or fattura.cliente_piva or fattura.cliente_cf
    else:
        # Per tipo=uscita
        if not azienda_id:
            return
        preferenze = _get_preferenze(db, azienda_id)
        if not preferenze:
            return
        # Per fattura ricevuta: conto acquisti per imponibile, conto debiti per totale
        conto_imponibile_id = _get_conto_revenue_or_cost(db, azienda_id, fattura.tipo)
        conto_debiti_id = preferenze.conto_debiti_fornitori_id
        if not conto_imponibile_id or not conto_debiti_id:
            return
        tipo_operazione = PNTipoOperazione.USCITA
        description = f"Fattura ricevuta {fattura.numero}"
        # Per tipo=uscita, contropartita è il fornitore
        from app.models.amministrazione.fornitore import Fornitore
        if fattura.fornitore_id:
            fornitore = db.query(Fornitore).filter(Fornitore.id == fattura.fornitore_id).first()
            contropartita_nome = fornitore.nome if fornitore else None
        else:
            contropartita_nome = None

    movement_date = fattura.data_fattura or fattura.data_registrazione or date.today()
    # Usa categoria_id se disponibile, altrimenti cerca per categoria (stringa)
    categoria_id = _get_categoria_id(
        db, 
        azienda_id, 
        tipo_operazione, 
        categoria_fattura=fattura.categoria,
        categoria_id=getattr(fattura, 'categoria_id', None)
    )

    # Determina se la fattura è collegata a un contratto soccida
    contratto_soccida_id = getattr(fattura, "contratto_soccida_id", None)
    
    # Crea collegamenti per imponibile (importo netto)
    importo_netto = _to_decimal(fattura.importo_netto or fattura.importo_totale)
    importo_totale = _to_decimal(fattura.importo_totale)
    collegamenti = [_build_documento_link(PNDocumentoTipo.FATTURA_AMMINISTRAZIONE, fattura.id, importo_netto)]
    
    # Crea movimenti separati per imponibile e IVA sui conti economici
    movimenti = _split_imponibile_iva(
        db=db,
        fattura=fattura,
        azienda_id=azienda_id,
        tipo_operazione=tipo_operazione,
        conto_imponibile_id=conto_imponibile_id,
        categoria_id=categoria_id,
        movement_date=movement_date,
        description=description,
        contropartita_nome=contropartita_nome,
        collegamenti=collegamenti,
        attrezzatura_id=getattr(fattura, "attrezzatura_id", None),
        contratto_soccida_id=contratto_soccida_id,
    )
    
    # Crea movimento sul conto debiti/crediti con importo totale
    if fattura.tipo == TipoFattura.ENTRATA:
        conto_contropartita_id = conto_crediti_id
        conto_contropartita_nome = "Crediti verso clienti"
    else:
        conto_contropartita_id = conto_debiti_id
        conto_contropartita_nome = "Debiti verso fornitori"
    
    # Cerca movimento esistente sul conto debiti/crediti
    movimento_contropartita = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.fattura_amministrazione_id == fattura.id,
            PNMovimento.tipo_operazione == tipo_operazione,
            PNMovimento.conto_id == conto_contropartita_id,
            PNMovimento.deleted_at.is_(None),
        )
        .first()
    )
    
    collegamenti_contropartita = [_build_documento_link(PNDocumentoTipo.FATTURA_AMMINISTRAZIONE, fattura.id, importo_totale)]
    
    if movimento_contropartita:
        update_payload = PNMovimentoUpdate(
            conto_id=conto_contropartita_id,
            categoria_id=_get_categoria_id(db, azienda_id, tipo_operazione, categoria_fattura=conto_contropartita_nome),
            tipo_operazione=tipo_operazione,
            stato=PNStatoMovimento.DEFINITIVO,
            data=movement_date,
            descrizione=f"{description} - {conto_contropartita_nome}",
            importo=importo_totale,
            contropartita_nome=contropartita_nome,
            collegamenti=collegamenti_contropartita,
        )
        pn_update_movimento(db, movimento_contropartita.id, update_payload)
    else:
        create_payload = PNMovimentoCreate(
            azienda_id=azienda_id,
            conto_id=conto_contropartita_id,
            categoria_id=_get_categoria_id(db, azienda_id, tipo_operazione, categoria_fattura=conto_contropartita_nome),
            tipo_operazione=tipo_operazione,
            stato=PNStatoMovimento.DEFINITIVO,
            origine=PNMovimentoOrigine.AUTOMATICO,
            data=movement_date,
            descrizione=f"{description} - {conto_contropartita_nome}",
            importo=importo_totale,
            contropartita_nome=contropartita_nome,
            fattura_amministrazione_id=fattura.id,
            collegamenti=collegamenti_contropartita,
        )
        pn_create_movimento(db, create_payload)
    
    # Usa il primo movimento (imponibile) per la logica successiva (partite soccida)
    movimento = movimenti[0] if movimenti else None
    
    # Se la fattura è collegata a un contratto soccida e è di tipo ENTRATA (fattura emessa),
    # crea PartitaMovimentoFinanziario per le partite del contratto
    if contratto_soccida_id and tipo_operazione == PNTipoOperazione.ENTRATA and movimento:
        # Recupera le partite collegate al contratto
        partite = (
            db.query(PartitaAnimale)
            .filter(
                PartitaAnimale.contratto_soccida_id == contratto_soccida_id,
                PartitaAnimale.deleted_at.is_(None),
            )
            .all()
        )
        
        # Determina tipo movimento (acconto o saldo)
        # Per ora assumiamo che se ci sono già fatture per questo contratto, questa è un saldo
        # Altrimenti è un acconto. In futuro si può aggiungere un campo esplicito sulla fattura.
        fatture_esistenti = (
            db.query(FatturaAmministrazione)
            .filter(
                FatturaAmministrazione.contratto_soccida_id == contratto_soccida_id,
                FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
                FatturaAmministrazione.id != fattura.id,
                FatturaAmministrazione.deleted_at.is_(None),
            )
            .count()
        )
        tipo_movimento = PartitaMovimentoTipo.SALDO if fatture_esistenti > 0 else PartitaMovimentoTipo.ACCONTO
        
        # Crea PartitaMovimentoFinanziario per ogni partita (distribuisci importo proporzionalmente ai capi)
        if partite:
            # Calcola il totale dei capi per distribuzione proporzionale
            totale_capi = sum(p.numero_capi or 0 for p in partite)
            
            # Crea PartitaMovimentoFinanziario per ogni partita (proporzionale ai capi)
            # Usa il movimento sul conto ricavi (primo movimento) per il collegamento
            movimento_riferimento = movimenti[0] if movimenti else movimento_contropartita
            for partita in partite:
                # Distribuzione proporzionale al numero di capi
                numero_capi_partita = partita.numero_capi or 0
                if totale_capi > 0 and numero_capi_partita > 0:
                    importo_per_partita = (importo_totale * numero_capi_partita) / totale_capi
                else:
                    # Fallback: divisione equa se non ci sono dati sui capi
                    importo_per_partita = importo_totale / len(partite)
                # Verifica se esiste già un movimento finanziario per questa fattura e partita
                movimento_finanziario_esistente = (
                    db.query(PartitaMovimentoFinanziario)
                    .filter(
                        PartitaMovimentoFinanziario.partita_id == partita.id,
                        PartitaMovimentoFinanziario.fattura_amministrazione_id == fattura.id,
                    )
                    .first()
                )
                
                if not movimento_finanziario_esistente and movimento_riferimento:
                    movimento_finanziario = PartitaMovimentoFinanziario(
                        partita_id=partita.id,
                        direzione=PartitaMovimentoDirezione.ENTRATA,
                        tipo=tipo_movimento,
                        modalita=partita.modalita_gestione or ModalitaGestionePartita.SOCCIDA_FATTURATA,
                        data=movement_date,
                        importo=importo_per_partita,
                        note=f"Fattura {fattura.numero} - {tipo_movimento.value}",
                        fattura_amministrazione_id=fattura.id,
                        pn_movimento_id=movimento_riferimento.id,  # Usa il movimento sul conto ricavi
                        attivo=True,
                    )
                    db.add(movimento_finanziario)
        
        db.flush()


def sync_prima_nota_fatture(
    db: Session,
    azienda_id: Optional[int] = None,
) -> SyncFattureResponse:
    """
    Sincronizza tutte le fatture (esistenti e future) con la Prima Nota.

    Per ogni fattura non eliminata (deleted_at IS NULL), crea o aggiorna i movimenti
    di Prima Nota secondo la divisione corretta: imponibile, IVA, crediti/debiti.
    Le fatture inserite o modificate in seguito continueranno a usare la stessa
    logica (ensure_prima_nota_for_fattura_amministrazione) tramite i hook su create/update.

    Args:
        db: Sessione DB.
        azienda_id: Se specificato, elabora solo le fatture di questa azienda.
                   Se None, elabora tutte le fatture di tutte le aziende.

    Returns:
        SyncFattureResponse con processed, total ed eventuali errori per fattura.
    """
    query = (
        db.query(FatturaAmministrazione)
        .filter(FatturaAmministrazione.deleted_at.is_(None))
    )
    if azienda_id is not None:
        query = query.filter(FatturaAmministrazione.azienda_id == azienda_id)
    fatture = query.order_by(FatturaAmministrazione.id.asc()).all()
    total = len(fatture)
    errors: List[SyncFattureErrorItem] = []
    processed = 0
    chunk_size = 50  # commit ogni N fatture per evitare transazioni troppo lunghe

    for i, fattura in enumerate(fatture):
        try:
            ensure_prima_nota_for_fattura_amministrazione(
                db, fattura, fattura.azienda_id or azienda_id
            )
            processed += 1
        except Exception as exc:
            errors.append(
                SyncFattureErrorItem(
                    fattura_id=fattura.id,
                    numero=getattr(fattura, "numero", None),
                    azienda_id=getattr(fattura, "azienda_id", None),
                    error=str(exc),
                )
            )
        if (i + 1) % chunk_size == 0:
            db.commit()

    return SyncFattureResponse(processed=processed, total=total, errors=errors)


def ensure_prima_nota_for_pagamento(db: Session, pagamento: Pagamento) -> None:
    """Crea movimento Prima Nota per pagamento.
    
    Se il pagamento è collegato a una fattura, crea un giroconto:
    - Da: conto_debiti_fornitori (per fatture ricevute) o conto_crediti_clienti (per fatture emesse)
    - A: conto_pagamenti (per pagamenti) o conto_incassi (per incassi)
    
    Questo riduce il debito/credito e riduce cassa/banca.
    """
    if not pagamento or not pagamento.id or not pagamento.azienda_id:
        return

    preferenze = _get_preferenze(db, pagamento.azienda_id)
    if not preferenze:
        return

    amount = _to_decimal(pagamento.importo)
    movement_date = pagamento.data_pagamento or date.today()
    
    # Determina se è un pagamento o un incasso
    is_entrata = getattr(pagamento, "tipo", None) == "entrata"
    tipo_operazione = PNTipoOperazione.ENTRATA if is_entrata else PNTipoOperazione.USCITA
    
    # Se c'è una fattura collegata, usa giroconto tra debiti/crediti e cassa/banca
    if pagamento.fattura_amministrazione_id:
        from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
        fattura = db.query(FatturaAmministrazione).filter(
            FatturaAmministrazione.id == pagamento.fattura_amministrazione_id
        ).first()
        
        if fattura:
            # Determina conto origine (debiti/crediti) e conto destinazione (cassa/banca)
            if fattura.tipo == TipoFattura.ENTRATA:
                # Fattura emessa: giroconto da Crediti verso clienti a Incassi
                conto_origine = preferenze.conto_crediti_clienti_id or preferenze.conto_incassi_id
                conto_destinazione = preferenze.conto_incassi_id
            else:
                # Fattura ricevuta: giroconto da Debiti verso fornitori a Pagamenti
                conto_origine = preferenze.conto_debiti_fornitori_id or preferenze.conto_pagamenti_id
                conto_destinazione = preferenze.conto_pagamenti_id
            
            if not conto_origine or not conto_destinazione:
                return
            
            # Crea giroconto
            categoria_id = _get_categoria_id(db, pagamento.azienda_id, PNTipoOperazione.GIROCONTO)
            description = f"Pagamento {'ricevuto' if is_entrata else 'effettuato'} - {fattura.numero}"
            
            movimento = (
                db.query(PNMovimento)
                .filter(
                    PNMovimento.pagamento_id == pagamento.id,
                    PNMovimento.deleted_at.is_(None),
                )
                .first()
            )
            
            collegamenti = [
                _build_documento_link(PNDocumentoTipo.FATTURA_AMMINISTRAZIONE, pagamento.fattura_amministrazione_id, amount)
            ]
            
            if movimento:
                update_payload = PNMovimentoUpdate(
                    conto_id=conto_origine,
                    conto_destinazione_id=conto_destinazione,
                    categoria_id=categoria_id,
                    tipo_operazione=PNTipoOperazione.GIROCONTO,
                    stato=PNStatoMovimento.DEFINITIVO,
                    data=movement_date,
                    descrizione=description,
                    importo=amount,
                    contropartita_nome=pagamento.descrizione,
                    collegamenti=collegamenti,
                )
                pn_update_movimento(db, movimento.id, update_payload)
            else:
                create_payload = PNMovimentoCreate(
                    azienda_id=pagamento.azienda_id,
                    conto_id=conto_origine,
                    conto_destinazione_id=conto_destinazione,
                    categoria_id=categoria_id,
                    tipo_operazione=PNTipoOperazione.GIROCONTO,
                    stato=PNStatoMovimento.DEFINITIVO,
                    origine=PNMovimentoOrigine.AUTOMATICO,
                    data=movement_date,
                    descrizione=description,
                    importo=amount,
                    contropartita_nome=pagamento.descrizione,
                    pagamento_id=pagamento.id,
                    fattura_amministrazione_id=pagamento.fattura_amministrazione_id,
                    collegamenti=collegamenti,
                )
                pn_create_movimento(db, create_payload)
            return
    
    # Se non c'è fattura collegata, usa il comportamento originale
    conto_id = (
        preferenze.conto_incassi_id if tipo_operazione == PNTipoOperazione.ENTRATA else preferenze.conto_pagamenti_id
    )
    if not conto_id:
        return

    categoria_id = _get_categoria_id(db, pagamento.azienda_id, tipo_operazione)
    description = "Pagamento ricevuto" if tipo_operazione == PNTipoOperazione.ENTRATA else "Pagamento effettuato"

    movimento = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.pagamento_id == pagamento.id,
            PNMovimento.deleted_at.is_(None),
        )
        .first()
    )

    collegamenti = []

    if movimento:
        update_payload = PNMovimentoUpdate(
            conto_id=conto_id,
            categoria_id=categoria_id,
            tipo_operazione=tipo_operazione,
            stato=PNStatoMovimento.DEFINITIVO,
            data=movement_date,
            descrizione=description,
            importo=amount,
            contropartita_nome=pagamento.descrizione,
            collegamenti=collegamenti if collegamenti else None,
        )
        pn_update_movimento(db, movimento.id, update_payload)
    else:
        create_payload = PNMovimentoCreate(
            azienda_id=pagamento.azienda_id,
            conto_id=conto_id,
            categoria_id=categoria_id,
            tipo_operazione=tipo_operazione,
            stato=PNStatoMovimento.DEFINITIVO,
            origine=PNMovimentoOrigine.AUTOMATICO,
            data=movement_date,
            descrizione=description,
            importo=amount,
            contropartita_nome=pagamento.descrizione,
            pagamento_id=pagamento.id,
            fattura_amministrazione_id=pagamento.fattura_amministrazione_id,
            collegamenti=collegamenti,
        )
        pn_create_movimento(db, create_payload)


def soft_delete_prima_nota_for_pagamento(db: Session, pagamento_id: int) -> None:
    if not pagamento_id:
        return
    movimento = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.pagamento_id == pagamento_id,
            PNMovimento.deleted_at.is_(None),
        )
        .first()
    )
    if movimento:
        pn_delete_movimento(db, movimento.id)


def sync_categoria_fattura_to_movimento(
    db: Session,
    fattura: FatturaAmministrazione,
    azienda_id: Optional[int] = None
) -> None:
    """
    Sincronizza la categoria della fattura con il movimento Prima Nota associato.
    Viene chiamata quando si aggiorna la categoria di una fattura.
    """
    if not fattura or not fattura.id:
        return
    
    # Determina azienda_id
    if fattura.tipo == TipoFattura.ENTRATA:
        azienda_id = azienda_id or fattura.azienda_id
    else:
        azienda_id = azienda_id or fattura.azienda_id
    
    if not azienda_id:
        return
    
    # Determina tipo_operazione
    tipo_operazione = PNTipoOperazione.ENTRATA if fattura.tipo == TipoFattura.ENTRATA else PNTipoOperazione.USCITA
    
    # Trova il movimento Prima Nota associato
    movimento = (
        db.query(PNMovimento)
        .filter(
            PNMovimento.fattura_amministrazione_id == fattura.id,
            PNMovimento.tipo_operazione == tipo_operazione,
            PNMovimento.deleted_at.is_(None),
        )
        .first()
    )
    
    if not movimento:
        return
    
    # Calcola la nuova categoria_id
    nuova_categoria_id = _get_categoria_id(
        db,
        azienda_id,
        tipo_operazione,
        categoria_fattura=fattura.categoria,
        categoria_id=getattr(fattura, 'categoria_id', None)
    )
    
    # Aggiorna la categoria del movimento se è cambiata
    if movimento.categoria_id != nuova_categoria_id:
        from app.services.amministrazione.prima_nota_service import update_movimento
        from app.schemas.amministrazione.pn import PNMovimentoUpdate
        
        update_payload = PNMovimentoUpdate(
            categoria_id=nuova_categoria_id
        )
        update_movimento(db, movimento.id, update_payload)
        db.flush()


def ensure_prima_nota_for_soccida_acconto(
    db: Session,
    contratto_id: int,
    importo: Decimal,
    data: date,
    partita_ids: Optional[List[int]] = None,
    azienda_id: int = None,
    note: Optional[str] = None,
    tipo: str = "acconto",
) -> PNMovimento:
    """
    Crea movimento Prima Nota per acconto o saldo a chiusura soccida monetizzata.
    - Conto: "Soccida monetizzata - Acconti" (creato automaticamente se non esiste)
    - Tipo: ENTRATA
    - Collegamento: contratto_soccida_id, partita_ids (opzionale)
    - Categoria: categoria default entrate soccida
    - Crea PartitaMovimentoFinanziario per ogni partita (tipo ACCONTO o SALDO).
    - Se tipo="saldo", imposta data_chiusura sulle partite coinvolte (non compaiono più in acconti/saldi).
    """
    if not azienda_id:
        # Recupera azienda_id dal contratto
        contratto = db.query(ContrattoSoccida).filter(
            ContrattoSoccida.id == contratto_id,
            ContrattoSoccida.deleted_at.is_(None),
        ).first()
        if not contratto:
            raise ValueError(f"Contratto soccida {contratto_id} non trovato")
        azienda_id = contratto.azienda_id
    
    # Verifica/crea conto soccida monetizzata
    conto = get_conto_soccida_monetizzata(db, azienda_id)
    
    # Trova categoria default per entrate
    categoria_id = _get_categoria_id(db, azienda_id, PNTipoOperazione.ENTRATA)
    
    # Prepara descrizione
    contratto = db.query(ContrattoSoccida).filter(ContrattoSoccida.id == contratto_id).first()
    contratto_numero = contratto.numero_contratto if contratto else f"#{contratto_id}"
    is_saldo = (tipo or "acconto").lower() == "saldo"
    descrizione = (
        f"Saldo a chiusura soccida - Contratto {contratto_numero}"
        if is_saldo
        else f"Acconto soccida monetizzata - Contratto {contratto_numero}"
    )
    
    # Se c'è una sola partita, aggiungila alla descrizione e al movimento PN
    partita_id_for_movement = None
    if partita_ids and len(partita_ids) == 1:
        partita = db.query(PartitaAnimale).filter(PartitaAnimale.id == partita_ids[0]).first()
        if partita:
            descrizione += f" - Partita {partita.numero_partita or partita.id}"
            partita_id_for_movement = partita_ids[0]
    elif partita_ids and len(partita_ids) > 1:
        # Se ci sono più partite, non impostare partita_id sul movimento PN
        # Il collegamento avverrà tramite PartitaMovimentoFinanziario
        descrizione += f" - {len(partita_ids)} partite"
    
    # Crea movimento Prima Nota
    create_payload = PNMovimentoCreate(
        azienda_id=azienda_id,
        conto_id=conto.id,
        categoria_id=categoria_id,
        tipo_operazione=PNTipoOperazione.ENTRATA,
        stato=PNStatoMovimento.DEFINITIVO,
        origine=PNMovimentoOrigine.AUTOMATICO,
        data=data,
        descrizione=descrizione,
        importo=_to_decimal(importo),
        contropartita_nome=contratto.soccidante.nome if contratto and contratto.soccidante else "Soccidante",
        note=note,
        contratto_soccida_id=contratto_id,
        partita_id=partita_id_for_movement,  # Solo se c'è una singola partita
    )
    
    movimento_response = pn_create_movimento(db, create_payload)
    movimento = db.query(PNMovimento).filter(PNMovimento.id == movimento_response.id).first()
    
    # Collega movimento al contratto tramite partite (se fornite)
    if partita_ids:
        # Verifica che le partite appartengano al contratto
        partite = (
            db.query(PartitaAnimale)
            .filter(
                PartitaAnimale.id.in_(partita_ids),
                PartitaAnimale.contratto_soccida_id == contratto_id,
                PartitaAnimale.deleted_at.is_(None),
            )
            .all()
        )
        
        if len(partite) != len(partita_ids):
            raise ValueError("Alcune partite non sono state trovate o non appartengono al contratto")
        
        # Calcola il totale dei capi per distribuzione proporzionale
        totale_capi = sum(p.numero_capi or 0 for p in partite)
        movimento_tipo = PartitaMovimentoTipo.SALDO if is_saldo else PartitaMovimentoTipo.ACCONTO
        note_default = (
            f"Saldo a chiusura contratto {contratto_numero}"
            if is_saldo
            else f"Acconto contratto {contratto_numero}"
        )

        for partita in partite:
            # Distribuzione proporzionale al numero di capi
            numero_capi_partita = partita.numero_capi or 0
            if totale_capi > 0 and numero_capi_partita > 0:
                importo_per_partita = (_to_decimal(importo) * numero_capi_partita) / totale_capi
            else:
                # Fallback: divisione equa se non ci sono dati sui capi
                importo_per_partita = _to_decimal(importo) / len(partite)

            movimento_finanziario = PartitaMovimentoFinanziario(
                partita_id=partita.id,
                direzione=PartitaMovimentoDirezione.ENTRATA,
                tipo=movimento_tipo,
                modalita=partita.modalita_gestione or ModalitaGestionePartita.SOCCIDA_MONETIZZATA,
                data=data,
                importo=importo_per_partita,
                note=note or note_default,
                pn_movimento_id=movimento.id,
                attivo=True,
            )
            db.add(movimento_finanziario)
            if is_saldo:
                partita.data_chiusura = data

    db.flush()
    return movimento

