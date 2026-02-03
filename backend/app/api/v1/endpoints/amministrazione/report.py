"""
Report endpoints
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.services.amministrazione.report_allevamento_service import to_decimal
from typing import Optional, List, Dict, Any
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.models.amministrazione import (
    VenditaProdottoAgricolo,
    FatturaAmministrazione,
    ContrattoSoccida,
)
from app.models.amministrazione.fattura_amministrazione import TipoFattura
from app.models.amministrazione.report_allevamento_fatture import ReportAllevamentoFattureUtilizzate
from app.services.amministrazione.report_allevamento_service import to_decimal
from app.models.amministrazione.pn import PNMovimento, PNTipoOperazione
from app.models.allevamento.azienda import Azienda
from app.models.amministrazione import Fornitore
from app.schemas.amministrazione import FatturaAmministrazioneResponse
from app.services.amministrazione.report_allevamento_service import calculate_report_allevamento_data
# PDF imports lazy - caricati solo quando servono per risparmiare memoria

router = APIRouter()


# ============================================
# SCHEMAS PER GESTIONE ACCONTI
# ============================================

class TipoGestioneAcconti(str, Enum):
    NESSUNO = "nessuno"
    AUTOMATICO = "automatico"
    MANUALE = "manuale"
    MOVIMENTI_INTERI = "movimenti_interi"
    FATTURE_SOCCIDA = "fatture_soccida"


class FatturaAccontoSelezionata(BaseModel):
    fattura_id: int
    importo_utilizzato: Decimal = Field(..., ge=0, description="Importo da utilizzare della fattura")


class ReportAllevamentoAccontiParams(BaseModel):
    """Parametri per la gestione degli acconti nel report allevamento"""
    tipo_gestione_acconti: TipoGestioneAcconti = Field(
        default=TipoGestioneAcconti.NESSUNO,
        description="Tipo di gestione acconti"
    )
    acconto_manuale: Optional[Decimal] = Field(
        None,
        ge=0,
        description="Importo manuale da scalare (solo per tipo 'manuale')"
    )
    movimenti_pn_ids: Optional[List[int]] = Field(
        None,
        description="Lista ID movimenti PN da considerare (solo per tipo 'movimenti_interi')"
    )
    fatture_acconto_selezionate: Optional[List[FatturaAccontoSelezionata]] = Field(
        None,
        description="Lista fatture acconto con importi utilizzati (solo per tipo 'fatture_soccida')"
    )

    def validate(self):
        """Valida i parametri in base al tipo di gestione"""
        if self.tipo_gestione_acconti == TipoGestioneAcconti.MANUALE:
            if self.acconto_manuale is None:
                raise ValueError("acconto_manuale è obbligatorio per tipo 'manuale'")
            if self.acconto_manuale < 0:
                raise ValueError("acconto_manuale non può essere negativo")
        
        if self.tipo_gestione_acconti == TipoGestioneAcconti.MOVIMENTI_INTERI:
            if not self.movimenti_pn_ids:
                raise ValueError("movimenti_pn_ids è obbligatorio e non può essere vuoto per tipo 'movimenti_interi'")
        
        if self.tipo_gestione_acconti == TipoGestioneAcconti.FATTURE_SOCCIDA:
            if not self.fatture_acconto_selezionate:
                raise ValueError("fatture_acconto_selezionate è obbligatorio e non può essere vuoto per tipo 'fatture_soccida'")
        
        return self


@router.get("/report/sintesi-vendite")
async def report_sintesi_vendite(
    azienda_id: Optional[int] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Report sintesi vendite prodotti agricoli"""
    query = db.query(VenditaProdottoAgricolo).filter(VenditaProdottoAgricolo.deleted_at.is_(None))
    
    if azienda_id:
        query = query.filter(VenditaProdottoAgricolo.azienda_id == azienda_id)
    if data_da:
        query = query.filter(VenditaProdottoAgricolo.data_vendita >= data_da)
    if data_a:
        query = query.filter(VenditaProdottoAgricolo.data_vendita <= data_a)
    
    vendite = query.all()
    
    totale_ricavi = sum(float(v.importo_totale) for v in vendite)
    totale_costi = sum(float(v.costi_terreno_totale) for v in vendite)
    totale_margine = totale_ricavi - totale_costi
    
    prodotti = {}
    for v in vendite:
        if v.prodotto not in prodotti:
            prodotti[v.prodotto] = {
                'quantita': 0,
                'ricavi': 0,
                'costi': 0,
                'margine': 0
            }
        prodotti[v.prodotto]['quantita'] += float(v.quantita)
        prodotti[v.prodotto]['ricavi'] += float(v.importo_totale)
        prodotti[v.prodotto]['costi'] += float(v.costi_terreno_totale)
        prodotti[v.prodotto]['margine'] += float(v.margine or 0)
    
    return {
        'totale_ricavi': totale_ricavi,
        'totale_costi': totale_costi,
        'totale_margine': totale_margine,
        'numero_vendite': len(vendite),
        'per_prodotto': prodotti
    }


@router.get("/report/fatture-scadenza")
async def report_fatture_scadenza(
    giorni: int = 30,
    db: Session = Depends(get_db)
):
    """Report fatture in scadenza nei prossimi N giorni"""
    oggi = date.today()
    data_limite = date.fromordinal(oggi.toordinal() + giorni)
    
    fatture = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.deleted_at.is_(None),
        FatturaAmministrazione.stato_pagamento.in_(['da_pagare', 'parziale']),
        FatturaAmministrazione.data_scadenza.isnot(None),
        FatturaAmministrazione.data_scadenza >= oggi,
        FatturaAmministrazione.data_scadenza <= data_limite
    ).order_by(FatturaAmministrazione.data_scadenza).all()
    
    totale_da_pagare = sum(
        float(f.importo_netto - f.importo_pagato) for f in fatture
    )
    
    return {
        'fatture': [FatturaAmministrazioneResponse.model_validate(f).model_dump() for f in fatture],
        'totale_da_pagare': totale_da_pagare,
        'numero_fatture': len(fatture)
    }


@router.get("/report/layout-preview")
async def report_layout_preview(
    azienda_id: Optional[int] = Query(None, description="ID azienda per includere logo e dati aziendali"),
    db: Session = Depends(get_db),
):
    """Scarica un PDF vuoto per verificare il layout standard."""
    # Lazy import per risparmiare memoria all'avvio
    from app.utils.pdf_layout import generate_layout_preview_pdf, branding_from_azienda
    
    branding = None
    if azienda_id:
        azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
        if not azienda:
            raise HTTPException(status_code=404, detail="Azienda non trovata")
        branding = branding_from_azienda(azienda)

    pdf_buffer = generate_layout_preview_pdf(branding=branding)
    filename = f"regifarm_layout_preview_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.pdf"
    pdf_buffer.seek(0)

    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/report/allevamento/dates-uscita")
async def get_dates_uscita_allevamento(
    azienda_id: Optional[int] = Query(None, description="ID azienda"),
    contratto_soccida_id: Optional[int] = Query(None, description="ID contratto soccida"),
    db: Session = Depends(get_db),
):
    """Ottiene le date di uscita disponibili per un'azienda o un contratto."""
    from app.models.amministrazione.partita_animale import PartitaAnimale, TipoPartita
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.models.allevamento.animale import Animale
    
    if not azienda_id and not contratto_soccida_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deve essere specificato azienda_id o contratto_soccida_id"
        )
    
    query = (
        db.query(PartitaAnimale.data)
        .join(PartitaAnimaleAnimale, PartitaAnimale.id == PartitaAnimaleAnimale.partita_animale_id)
        .join(Animale, PartitaAnimaleAnimale.animale_id == Animale.id)
        .filter(
            PartitaAnimale.tipo == TipoPartita.USCITA,
            PartitaAnimale.is_trasferimento_interno == False,
            PartitaAnimale.deleted_at.is_(None),
            Animale.data_uscita.isnot(None),
            Animale.deleted_at.is_(None),
            Animale.stato.in_(['venduto', 'macellato'])
        )
    )
    
    if contratto_soccida_id:
        query = query.filter(Animale.contratto_soccida_id == contratto_soccida_id)
    elif azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    dates = [row[0] for row in query.distinct().order_by(PartitaAnimale.data.desc()).all()]
    
    return {
        "dates": [d.isoformat() if d else None for d in dates if d],
        "count": len(dates)
    }


@router.get("/report/allevamento/tipo-da-data")
async def get_tipo_da_data_uscita(
    azienda_id: Optional[int] = Query(None, description="ID azienda"),
    contratto_soccida_id: Optional[int] = Query(None, description="ID contratto soccida"),
    data_uscita: Optional[date] = Query(None, description="Data di uscita (per singolo giorno)"),
    data_uscita_da: Optional[date] = Query(None, description="Data inizio intervallo uscite"),
    data_uscita_a: Optional[date] = Query(None, description="Data fine intervallo uscite"),
    db: Session = Depends(get_db),
):
    """
    Determina automaticamente il tipo di gestione (proprietà, soccida, soccida monetizzata)
    in base agli animali usciti nella data/periodo specificato.
    """
    from app.models.amministrazione.partita_animale import PartitaAnimale, TipoPartita
    from app.models.amministrazione.partita_animale_animale import PartitaAnimaleAnimale
    from app.models.allevamento.animale import Animale
    from app.models.amministrazione.contratto_soccida import ContrattoSoccida
    from sqlalchemy.orm import joinedload
    
    if not azienda_id and not contratto_soccida_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deve essere specificato azienda_id o contratto_soccida_id"
        )
    
    if not data_uscita and not (data_uscita_da and data_uscita_a):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specificare una data di uscita oppure un intervallo (data_uscita_da + data_uscita_a)"
        )
    
    # Determina il range di date
    if data_uscita:
        date_start = data_uscita
        date_end = data_uscita
    else:
        date_start = data_uscita_da
        date_end = data_uscita_a
    
    # Query per recuperare gli animali usciti
    query = (
        db.query(Animale)
        .join(PartitaAnimaleAnimale, Animale.id == PartitaAnimaleAnimale.animale_id)
        .join(PartitaAnimale, PartitaAnimaleAnimale.partita_animale_id == PartitaAnimale.id)
        .options(
            joinedload(Animale.contratto_soccida)
        )
        .filter(
            Animale.deleted_at.is_(None),
            PartitaAnimale.tipo == TipoPartita.USCITA,
            PartitaAnimale.data >= date_start,
            PartitaAnimale.data <= date_end,
            PartitaAnimale.is_trasferimento_interno == False,
            PartitaAnimale.deleted_at.is_(None),
        )
    )
    
    if contratto_soccida_id:
        query = query.filter(Animale.contratto_soccida_id == contratto_soccida_id)
    elif azienda_id:
        query = query.filter(Animale.azienda_id == azienda_id)
    
    animali_usciti = query.distinct().all()
    
    if not animali_usciti:
        return {
            "tipo": "nessuno",
            "ha_proprieta": False,
            "ha_soccida": False,
            "ha_soccida_monetizzata": False,
            "ha_soccida_fatturata": False,
            "contratti": [],
        }
    
    # Analizza gli animali
    animali_proprieta = [a for a in animali_usciti if not a.contratto_soccida_id]
    animali_soccida = [a for a in animali_usciti if a.contratto_soccida_id]
    
    # Raggruppa per contratto
    contratti_info = {}
    for animale in animali_soccida:
        if animale.contratto_soccida_id:
            if animale.contratto_soccida_id not in contratti_info:
                contratti_info[animale.contratto_soccida_id] = {
                    "id": animale.contratto_soccida_id,
                    "monetizzata": animale.contratto_soccida.monetizzata if animale.contratto_soccida else False,
                    "numero_capi": 0,
                }
            contratti_info[animale.contratto_soccida_id]["numero_capi"] += 1
    
    contratti_list = list(contratti_info.values())
    ha_soccida_monetizzata = any(c["monetizzata"] for c in contratti_list)
    ha_soccida_fatturata = any(not c["monetizzata"] for c in contratti_list)
    
    # Determina il tipo principale
    if animali_proprieta and not animali_soccida:
        tipo = "proprieta"
    elif animali_soccida and not animali_proprieta:
        if ha_soccida_monetizzata and not ha_soccida_fatturata:
            tipo = "soccida_monetizzata"
        elif ha_soccida_fatturata and not ha_soccida_monetizzata:
            tipo = "soccida_fatturata"
        else:
            tipo = "soccida_mista"  # Sia monetizzata che fatturata
    else:
        tipo = "misto"  # Sia proprietà che soccida
    
    return {
        "tipo": tipo,
        "ha_proprieta": len(animali_proprieta) > 0,
        "ha_soccida": len(animali_soccida) > 0,
        "ha_soccida_monetizzata": ha_soccida_monetizzata,
        "ha_soccida_fatturata": ha_soccida_fatturata,
        "numero_capi_proprieta": len(animali_proprieta),
        "numero_capi_soccida": len(animali_soccida),
        "contratti": contratti_list,
    }


@router.get("/report/allevamento")
async def report_allevamento(
    azienda_id: Optional[int] = Query(None, description="ID azienda"),
    contratto_soccida_id: Optional[int] = Query(None, description="ID contratto soccida"),
    data_uscita: Optional[date] = Query(None, description="Data di uscita (per singolo giorno)"),
    data_uscita_da: Optional[date] = Query(None, description="Data inizio intervallo uscite"),
    data_uscita_a: Optional[date] = Query(None, description="Data fine intervallo uscite"),
    formato: str = Query("pdf", description="Formato output: 'pdf' o 'json'"),
    # Parametri gestione acconti (opzionali, passati come query params JSON o body)
    tipo_gestione_acconti: Optional[str] = Query(None, description="Tipo gestione acconti: 'nessuno', 'automatico', 'manuale', 'movimenti_interi', 'fatture_soccida'"),
    acconto_manuale: Optional[float] = Query(None, description="Importo manuale (per tipo 'manuale')"),
    movimenti_pn_ids: Optional[str] = Query(None, description="Lista ID movimenti PN separati da virgola (per tipo 'movimenti_interi')"),
    fatture_acconto_selezionate: Optional[str] = Query(None, description="JSON con lista fatture selezionate (per tipo 'fatture_soccida')"),
    db: Session = Depends(get_db),
):
    """Genera report allevamento con conteggi vendita animali."""
    if not azienda_id and not contratto_soccida_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Deve essere specificato azienda_id o contratto_soccida_id"
        )
    
    if not data_uscita and not (data_uscita_da and data_uscita_a):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Specificare una data di uscita oppure un intervallo (data_uscita_da + data_uscita_a)"
        )
    if data_uscita and (data_uscita_da or data_uscita_a):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Non è possibile combinare data_uscita singola con l'intervallo di date"
        )
    
    # Parsing parametri acconti
    acconti_params = None
    if tipo_gestione_acconti:
        try:
            tipo_enum = TipoGestioneAcconti(tipo_gestione_acconti)
            acconto_manuale_decimal = Decimal(str(acconto_manuale)) if acconto_manuale is not None else None
            movimenti_ids_list = [int(x.strip()) for x in movimenti_pn_ids.split(',')] if movimenti_pn_ids else None
            fatture_list = None
            if fatture_acconto_selezionate:
                import json
                fatture_data = json.loads(fatture_acconto_selezionate)
                fatture_list = [FatturaAccontoSelezionata(**f) for f in fatture_data]
            
            acconti_params = ReportAllevamentoAccontiParams(
                tipo_gestione_acconti=tipo_enum,
                acconto_manuale=acconto_manuale_decimal,
                movimenti_pn_ids=movimenti_ids_list,
                fatture_acconto_selezionate=fatture_list,
            )
            acconti_params.validate()
        except ValueError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Errore validazione parametri acconti: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Errore parsing parametri acconti: {str(e)}"
            )
    
    # Prepara parametri per calculate_report_allevamento_data
    acconti_kwargs = {}
    if acconti_params:
        acconti_kwargs = {
            'tipo_gestione_acconti': acconti_params.tipo_gestione_acconti.value,
            'acconto_manuale': acconti_params.acconto_manuale,
            'movimenti_pn_ids': acconti_params.movimenti_pn_ids,
            'fatture_acconto_selezionate': [
                {'fattura_id': f.fattura_id, 'importo_utilizzato': float(f.importo_utilizzato)}
                for f in (acconti_params.fatture_acconto_selezionate or [])
            ] if acconti_params.fatture_acconto_selezionate else None,
        }
    
    report_data = calculate_report_allevamento_data(
        db=db,
        data_uscita=data_uscita,
        data_inizio=data_uscita_da,
        data_fine=data_uscita_a,
        azienda_id=azienda_id,
        contratto_soccida_id=contratto_soccida_id,
        **acconti_kwargs,
    )
    
    # Salva importi utilizzati per tracciamento se tipo è 'fatture_soccida'
    if acconti_params and acconti_params.tipo_gestione_acconti == TipoGestioneAcconti.FATTURE_SOCCIDA:
        if acconti_params.fatture_acconto_selezionate and contratto_soccida_id:
            data_report = data_uscita or data_uscita_da or date.today()
            for fattura_data in acconti_params.fatture_acconto_selezionate:
                importo_utilizzato = to_decimal(fattura_data.importo_utilizzato)
                if importo_utilizzato > 0:
                    # Crea record di tracciamento
                    report_fattura = ReportAllevamentoFattureUtilizzate(
                        contratto_soccida_id=contratto_soccida_id,
                        fattura_id=fattura_data.fattura_id,
                        importo_utilizzato=importo_utilizzato,
                        data_report=data_report,
                    )
                    db.add(report_fattura)
            db.commit()
    
    if formato == "json":
        return report_data
    
    if report_data.get('totale_capi', 0) == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nessun animale trovato per il periodo richiesto"
        )
    
    # Lazy import per risparmiare memoria all'avvio
    from app.utils.pdf_generator import generate_report_allevamento_pdf
    from app.utils.pdf_layout import branding_from_azienda
    
    branding = None
    if azienda_id:
        azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
        if azienda:
            branding = branding_from_azienda(azienda)
    elif contratto_soccida_id:
        contratto = db.query(ContrattoSoccida).filter(ContrattoSoccida.id == contratto_soccida_id).first()
        if contratto and contratto.azienda_id:
            azienda = db.query(Azienda).filter(Azienda.id == contratto.azienda_id).first()
            if azienda:
                branding = branding_from_azienda(azienda)
    
    pdf_buffer = generate_report_allevamento_pdf(report_data, branding=branding)
    if data_uscita:
        filename = f"report_allevamento_uscita_del_{data_uscita.strftime('%Y-%m-%d')}.pdf"
    else:
        filename = (
            f"report_allevamento_uscita_dal_{data_uscita_da.strftime('%Y-%m-%d')}"
            f"_al_{data_uscita_a.strftime('%Y-%m-%d')}.pdf"
        )
    pdf_buffer.seek(0)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/report/allevamento/fatture-acconto/{contratto_id}")
async def get_fatture_acconto_contratto(
    contratto_id: int,
    db: Session = Depends(get_db),
):
    """Recupera fatture acconto disponibili per un contratto soccida fatturata."""
    contratto = db.query(ContrattoSoccida).filter(
        ContrattoSoccida.id == contratto_id,
        ContrattoSoccida.deleted_at.is_(None),
    ).first()
    
    if not contratto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Contratto soccida {contratto_id} non trovato"
        )
    
    # Verifica che sia soccida fatturata
    if contratto.monetizzata:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Questo endpoint è disponibile solo per contratti soccida fatturata (non monetizzati)"
        )
    
    # Recupera tutte le fatture acconto del contratto
    fatture = (
        db.query(FatturaAmministrazione)
        .filter(
            FatturaAmministrazione.contratto_soccida_id == contratto_id,
            FatturaAmministrazione.tipo == TipoFattura.ENTRATA,
            FatturaAmministrazione.deleted_at.is_(None),
        )
        .order_by(FatturaAmministrazione.data_fattura.asc())
        .all()
    )
    
    # Determina quali sono acconto e quali saldo
    fatture_acconto = []
    for fattura in fatture:
        # Determina se è acconto o saldo basandosi sui movimenti finanziari collegati
        from app.models.amministrazione.partita_animale_movimento_finanziario import (
            PartitaMovimentoFinanziario,
            PartitaMovimentoTipo,
        )
        movimenti_finanziari = (
            db.query(PartitaMovimentoFinanziario)
            .filter(
                PartitaMovimentoFinanziario.fattura_amministrazione_id == fattura.id,
                PartitaMovimentoFinanziario.attivo == True,
            )
            .all()
        )
        
        tipo_fattura = None
        for mf in movimenti_finanziari:
            if mf.tipo == PartitaMovimentoTipo.ACCONTO:
                tipo_fattura = "acconto"
                break
            elif mf.tipo == PartitaMovimentoTipo.SALDO:
                tipo_fattura = "saldo"
                break
        
        # Se non trovato nei movimenti, assume che l'ultima sia il saldo
        if not tipo_fattura:
            if fattura == fatture[-1] and len(fatture) > 1:
                tipo_fattura = "saldo"
            else:
                tipo_fattura = "acconto"
        
        # Solo fatture acconto
        if tipo_fattura == "acconto":
            importo_totale = float(to_decimal(fattura.importo_netto or fattura.importo_totale))
            
            # Calcola importo già utilizzato
            importo_utilizzato = (
                db.query(func.sum(ReportAllevamentoFattureUtilizzate.importo_utilizzato))
                .filter(
                    ReportAllevamentoFattureUtilizzate.fattura_id == fattura.id,
                )
                .scalar() or Decimal(0)
            )
            
            importo_disponibile = importo_totale - float(importo_utilizzato)
            
            fatture_acconto.append({
                "id": fattura.id,
                "numero": fattura.numero,
                "data": fattura.data_fattura.isoformat() if fattura.data_fattura else None,
                "importo_totale": importo_totale,
                "importo_utilizzato": float(importo_utilizzato),
                "importo_disponibile": importo_disponibile,
            })
    
    return {
        "contratto_id": contratto_id,
        "fatture_acconto": fatture_acconto,
    }


@router.get("/report/prima-nota/contropartite")
async def get_contropartite_prima_nota(
    azienda_id: int = Query(..., description="ID azienda"),
    db: Session = Depends(get_db),
):
    """Restituisce la lista delle contropartite disponibili per i movimenti prima nota."""
    contropartite = db.query(
        func.distinct(PNMovimento.contropartita_nome).label('nome')
    ).filter(
        PNMovimento.azienda_id == azienda_id,
        PNMovimento.contropartita_nome.isnot(None),
        PNMovimento.contropartita_nome != '',
        PNMovimento.deleted_at.is_(None)
    ).order_by(PNMovimento.contropartita_nome).all()
    
    return {
        "contropartite": [c.nome for c in contropartite if c.nome]
    }


@router.get("/report/prima-nota/dare-avere")
async def report_prima_nota_dare_avere(
    azienda_id: int = Query(..., description="ID azienda"),
    contropartita_nome: str = Query(..., description="Nome fornitore/cliente (contropartita)"),
    data_da: Optional[date] = Query(None, description="Data inizio periodo"),
    data_a: Optional[date] = Query(None, description="Data fine periodo"),
    db: Session = Depends(get_db),
):
    """Genera report prima nota dare/avere per un fornitore/cliente specifico."""
    query = db.query(PNMovimento).filter(
        PNMovimento.azienda_id == azienda_id,
        PNMovimento.contropartita_nome == contropartita_nome,
        PNMovimento.deleted_at.is_(None)
    )
    
    if data_da:
        query = query.filter(PNMovimento.data >= data_da)
    if data_a:
        query = query.filter(PNMovimento.data <= data_a)
    
    movimenti = query.order_by(PNMovimento.data.asc(), PNMovimento.created_at.asc()).all()
    
    if not movimenti:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Nessun movimento trovato per il fornitore/cliente '{contropartita_nome}'"
        )
    
    movimenti_data = []
    totale_dare = Decimal('0.00')
    totale_avere = Decimal('0.00')
    
    for movimento in movimenti:
        if movimento.tipo_operazione == PNTipoOperazione.ENTRATA:
            dare = movimento.importo
            avere = Decimal('0.00')
            totale_dare += dare
        else:
            dare = Decimal('0.00')
            avere = movimento.importo
            totale_avere += avere
        
        movimenti_data.append({
            'data': movimento.data.strftime('%d/%m/%Y') if movimento.data else '',
            'descrizione': movimento.descrizione or '',
            'dare': float(dare),
            'avere': float(avere),
        })
    
    saldo = totale_dare - totale_avere
    
    fornitore_cliente_data = {'nome': contropartita_nome}
    
    fornitore = db.query(Fornitore).filter(
        or_(
            Fornitore.nome == contropartita_nome,
            Fornitore.partita_iva == contropartita_nome,
        )
    ).first()
    
    if fornitore:
        fornitore_cliente_data.update({
            'nome': fornitore.nome or contropartita_nome,
            'piva': fornitore.partita_iva or '',
            'indirizzo': fornitore.indirizzo or '',
            'cap': fornitore.indirizzo_cap or '',
            'citta': fornitore.indirizzo_comune or '',
            'provincia': fornitore.indirizzo_provincia or '',
            'telefono': fornitore.telefono or '',
            'email': fornitore.email or '',
        })
    
    report_data = {
        'fornitore_cliente': fornitore_cliente_data,
        'movimenti': movimenti_data,
        'totale_dare': float(totale_dare),
        'totale_avere': float(totale_avere),
        'saldo': float(saldo),
    }
    
    # Lazy import per risparmiare memoria all'avvio
    from app.utils.pdf_generator import generate_prima_nota_dare_avere_pdf
    from app.utils.pdf_layout import branding_from_azienda
    
    azienda = db.query(Azienda).filter(Azienda.id == azienda_id).first()
    branding = None
    if azienda:
        branding = branding_from_azienda(azienda)
    
    pdf_buffer = generate_prima_nota_dare_avere_pdf(report_data, branding=branding)
    filename = f"report_prima_nota_dare_avere_{contropartita_nome.replace(' ', '_')}_{datetime.utcnow().strftime('%Y%m%d_%H%M')}.pdf"
    pdf_buffer.seek(0)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

