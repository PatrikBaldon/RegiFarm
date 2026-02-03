"""Terreni CRUD endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import List, Optional
from datetime import datetime
from decimal import Decimal

from app.core.database import get_db
from app.models.terreni.terreno import Terreno as TerrenoModel
from app.models.terreni.lavorazione import LavorazioneTerreno as LavorazioneTerrenoModel
from app.models.terreni.raccolto import RaccoltoTerreno as RaccoltoTerrenoModel
from app.models.terreni.ciclo import CicloTerrenoCosto as CicloTerrenoCostoModel
from app.models.amministrazione.fattura_amministrazione import FatturaAmministrazione
from app.models.amministrazione.vendita_prodotto_agricolo import VenditaProdottoAgricolo
from app.models.alimentazione.magazzino_movimento import MagazzinoMovimento as MagazzinoMovimentoModel
from app.schemas.terreni import (
    TerrenoCreate, TerrenoUpdate, TerrenoResponse, TerrenoRiepilogoResponse,
    LavorazioneTerrenoResponse, RaccoltoTerrenoResponse, ProdottoRaccoltoInfo,
)

router = APIRouter()

@router.get("/", response_model=List[TerrenoResponse])
def list_terreni(skip: int = 0, limit: int = 100, azienda_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(TerrenoModel)
    if azienda_id:
        q = q.filter(TerrenoModel.azienda_id == azienda_id)
    return q.offset(skip).limit(limit).all()

@router.get("/{terreno_id}", response_model=TerrenoResponse)
def get_terreno(terreno_id: int, db: Session = Depends(get_db)):
    obj = db.query(TerrenoModel).filter(TerrenoModel.id == terreno_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    return obj

@router.post("/", response_model=TerrenoResponse, status_code=status.HTTP_201_CREATED)
def create_terreno(data: TerrenoCreate, db: Session = Depends(get_db)):
    db_obj = TerrenoModel(**data.dict())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj

@router.put("/{terreno_id}", response_model=TerrenoResponse)
def update_terreno(terreno_id: int, update: TerrenoUpdate, db: Session = Depends(get_db)):
    obj = db.query(TerrenoModel).filter(TerrenoModel.id == terreno_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    for field, value in update.dict(exclude_unset=True).items():
        setattr(obj, field, value)
    db.commit()
    db.refresh(obj)
    return obj

@router.delete("/{terreno_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_terreno(terreno_id: int, db: Session = Depends(get_db)):
    obj = db.query(TerrenoModel).filter(TerrenoModel.id == terreno_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    db.delete(obj)
    db.commit()
    return None

@router.get("/{terreno_id}/lavorazioni", response_model=List[LavorazioneTerrenoResponse])
def list_lavorazioni_terreno(terreno_id: int, db: Session = Depends(get_db)):
    return db.query(LavorazioneTerrenoModel).filter(LavorazioneTerrenoModel.terreno_id == terreno_id).all()

@router.get("/{terreno_id}/raccolti", response_model=List[RaccoltoTerrenoResponse])
def list_raccolti_terreno(terreno_id: int, db: Session = Depends(get_db)):
    return db.query(RaccoltoTerrenoModel).filter(RaccoltoTerrenoModel.terreno_id == terreno_id).all()

# --- CICLI COLTURALI ---
@router.get("/{terreno_id}/riepilogo", response_model=TerrenoRiepilogoResponse)
def get_terreno_riepilogo(terreno_id: int, db: Session = Depends(get_db)):
    """Calcola riepilogo costi, ricavi e margine per un terreno"""
    terreno = db.query(TerrenoModel).filter(TerrenoModel.id == terreno_id).first()
    if not terreno:
        raise HTTPException(status_code=404, detail="Terreno non trovato")
    
    # Calcola costi dalle fatture emesse (ricavi negativi)
    fatture_emesse = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.terreno_id == terreno_id,
        FatturaAmministrazione.deleted_at.is_(None)
    ).all()
    
    costi_fatture_emesse = Decimal(0)
    for f in fatture_emesse:
        # Se la fattura emessa è collegata a un terreno, potrebbe essere un costo (es. vendita a prezzo scontato)
        # Per ora consideriamo solo le fatture ricevute come costi
        pass
    
    # Calcola costi dalle fatture ricevute (fatture amministrazione)
    fatture_ricevute = db.query(FatturaAmministrazione).filter(
        FatturaAmministrazione.terreno_id == terreno_id,
        FatturaAmministrazione.deleted_at.is_(None),
        FatturaAmministrazione.tipo == 'uscita'  # Solo fatture di uscita sono costi
    ).all()
    
    costi_fatture_ricevute = sum(Decimal(str(f.importo_totale)) for f in fatture_ricevute)
    
    # Calcola costi dai cicli colturali (solo costi associati alle fasi)
    costi_cicli = db.query(CicloTerrenoCostoModel).filter(
        CicloTerrenoCostoModel.terreno_id == terreno_id,
        CicloTerrenoCostoModel.fase_id.isnot(None)  # Solo costi associati alle fasi
    ).all()
    
    # Prepara mappe per risoluzione importi
    fattura_ids_cicli = {c.fattura_amministrazione_id for c in costi_cicli if c.fattura_amministrazione_id}
    lavorazione_ids_cicli = {c.lavorazione_id for c in costi_cicli if c.lavorazione_id}
    
    fatture_map_cicli = {}
    if fattura_ids_cicli:
        fatture_cicli = db.query(FatturaAmministrazione).filter(
            FatturaAmministrazione.id.in_(fattura_ids_cicli)
        ).all()
        fatture_map_cicli = {f.id: f for f in fatture_cicli}
    
    lavorazioni_map_cicli = {}
    if lavorazione_ids_cicli:
        lavorazioni_cicli = db.query(LavorazioneTerrenoModel).filter(
            LavorazioneTerrenoModel.id.in_(lavorazione_ids_cicli)
        ).all()
        lavorazioni_map_cicli = {l.id: l for l in lavorazioni_cicli}
    
    # Importa la funzione di risoluzione importi
    from app.api.v1.endpoints.terreni.cicli import _resolve_costo_amount
    
    costi_cicli_totali = Decimal(0)
    for costo in costi_cicli:
        try:
            importo = _resolve_costo_amount(costo, fatture_map_cicli, lavorazioni_map_cicli)
            costi_cicli_totali += importo
        except Exception as e:
            # Se c'è un errore nella risoluzione, usa l'importo diretto o 0
            print(f"Errore nella risoluzione importo per costo ciclo {costo.id}: {e}")
            importo_fallback = Decimal(str(costo.importo)) if costo.importo is not None else Decimal("0")
            costi_cicli_totali += importo_fallback
    
    # Somma costi da fatture e costi da cicli
    costi_totali = costi_fatture_ricevute + costi_cicli_totali
    
    # Calcola ricavi dalle vendite prodotti agricoli
    vendite = db.query(VenditaProdottoAgricolo).filter(
        VenditaProdottoAgricolo.terreno_id == terreno_id,
        VenditaProdottoAgricolo.deleted_at.is_(None)
    ).all()
    
    ricavi_totali = sum(Decimal(str(v.importo_totale)) for v in vendite)
    numero_vendite = len(vendite)
    
    # Calcola margine
    margine = ricavi_totali - costi_totali
    
    # Raggruppa prodotti raccolti
    prodotti_map = {}
    for vendita in vendite:
        prodotto_key = f"{vendita.prodotto}_{vendita.unita_misura}"
        if prodotto_key not in prodotti_map:
            prodotti_map[prodotto_key] = {
                'prodotto': vendita.prodotto,
                'unita_misura': vendita.unita_misura,
                'quantita_venduta': Decimal(0),
                'ricavi_totali': Decimal(0),
                'prezzi_vendita': []
            }
        prodotti_map[prodotto_key]['quantita_venduta'] += Decimal(str(vendita.quantita))
        prodotti_map[prodotto_key]['ricavi_totali'] += Decimal(str(vendita.importo_totale))
        prodotti_map[prodotto_key]['prezzi_vendita'].append(Decimal(str(vendita.prezzo_unitario)))
    
    # Aggiungi raccolti non venduti
    raccolti = db.query(RaccoltoTerrenoModel).filter(
        RaccoltoTerrenoModel.terreno_id == terreno_id
    ).all()
    
    for raccolto in raccolti:
        prodotto_key = f"{raccolto.prodotto}_{raccolto.unita_misura}"
        if prodotto_key not in prodotti_map:
            prodotti_map[prodotto_key] = {
                'prodotto': raccolto.prodotto,
                'unita_misura': raccolto.unita_misura,
                'quantita_venduta': Decimal(0),
                'ricavi_totali': Decimal(0),
                'prezzi_vendita': []
            }
        if raccolto.resa_quantita:
            quantita_totale = Decimal(str(raccolto.resa_quantita))
            # Verifica se è già stata venduta
            quantita_venduta_prod = sum(
                Decimal(str(v.quantita)) for v in vendite 
                if v.prodotto == raccolto.prodotto and v.unita_misura == raccolto.unita_misura
            )
            if quantita_totale > quantita_venduta_prod:
                # Aggiungi quantità disponibile
                if 'quantita_totale' not in prodotti_map[prodotto_key]:
                    prodotti_map[prodotto_key]['quantita_totale'] = quantita_totale
                else:
                    prodotti_map[prodotto_key]['quantita_totale'] += quantita_totale
    
    # Calcola scorte per tutti i prodotti in una singola query (ottimizzazione)
    # Raccogli tutti i nomi prodotti unici
    prodotti_nomi = [dati['prodotto'] for dati in prodotti_map.values()]
    scorte_map = {}
    if prodotti_nomi:
        # Fai una singola query per tutte le scorte invece di una per prodotto
        # Usa OR per cercare tutti i prodotti in una volta
        from sqlalchemy import or_
        scorte_results = db.query(
            MagazzinoMovimentoModel.causale,
            func.sum(
                case(
                    (MagazzinoMovimentoModel.tipo == 'carico', MagazzinoMovimentoModel.quantita),
                    else_=0
                ) - case(
                    (MagazzinoMovimentoModel.tipo == 'scarico', MagazzinoMovimentoModel.quantita),
                    else_=0
                ) + case(
                    (MagazzinoMovimentoModel.tipo == 'rettifica', MagazzinoMovimentoModel.quantita),
                    else_=0
                )
            ).label('quantita')
        ).filter(
            MagazzinoMovimentoModel.deleted_at.is_(None),
            or_(*[MagazzinoMovimentoModel.causale.ilike(f"%{nome}%") for nome in prodotti_nomi])
        ).group_by(MagazzinoMovimentoModel.causale).all()
        
        # Mappa le scorte ai prodotti (match parziale per nome)
        for causale, quantita in scorte_results:
            if quantita:
                for nome_prod in prodotti_nomi:
                    if nome_prod.lower() in causale.lower() if causale else False:
                        if nome_prod not in scorte_map:
                            scorte_map[nome_prod] = Decimal(0)
                        scorte_map[nome_prod] += Decimal(str(quantita))
    
    # Costruisci lista prodotti con informazioni scorte
    prodotti_info = []
    prodotti_autoprodotti = []
    
    for key, dati in prodotti_map.items():
        quantita_totale = dati.get('quantita_totale', dati['quantita_venduta'])
        quantita_venduta = dati['quantita_venduta']
        quantita_disponibile = quantita_totale - quantita_venduta
        
        prezzo_medio = None
        if dati['prezzi_vendita']:
            prezzo_medio = sum(dati['prezzi_vendita']) / len(dati['prezzi_vendita'])
        
        # Usa le scorte calcolate in batch
        quantita_scorte = scorte_map.get(dati['prodotto'], Decimal(0))
        
        prodotto_info = ProdottoRaccoltoInfo(
            prodotto=dati['prodotto'],
            quantita_totale=quantita_totale,
            unita_misura=dati['unita_misura'],
            quantita_venduta=quantita_venduta,
            quantita_disponibile=quantita_disponibile if quantita_disponibile > 0 else quantita_scorte,
            prezzo_medio_vendita=prezzo_medio,
            ricavi_totali=dati['ricavi_totali']
        )
        prodotti_info.append(prodotto_info)
        
        # Se c'è quantità disponibile, calcola costo unitario per risparmio
        if quantita_disponibile > 0 or quantita_scorte > 0:
            costo_unitario = Decimal(0)
            if quantita_totale > 0 and costi_totali > 0:
                # Distribuisci i costi proporzionalmente alla quantità
                costo_unitario = costi_totali / quantita_totale
            
            prodotti_autoprodotti.append({
                'prodotto': dati['prodotto'],
                'quantita_disponibile': float(quantita_disponibile if quantita_disponibile > 0 else quantita_scorte),
                'unita_misura': dati['unita_misura'],
                'costo_unitario': float(costo_unitario),
                'costo_totale': float(costo_unitario * (quantita_disponibile if quantita_disponibile > 0 else quantita_scorte))
            })
    
    # Conta fatture uniche dai cicli (escludendo quelle già conteggiate)
    fatture_ids_cicli = {c.fattura_amministrazione_id for c in costi_cicli if c.fattura_amministrazione_id}
    fatture_ids_ricevute = {f.id for f in fatture_ricevute}
    fatture_ids_cicli_uniche = fatture_ids_cicli - fatture_ids_ricevute
    numero_fatture_costi = len(fatture_ricevute) + len(fatture_ids_cicli_uniche)
    
    return TerrenoRiepilogoResponse(
        terreno_id=terreno.id,
        terreno_denominazione=terreno.denominazione,
        costi_totali=costi_totali,
        ricavi_totali=ricavi_totali,
        margine=margine,
        prodotti_raccolti=prodotti_info,
        costi_fatture_emesse=costi_fatture_emesse,
        costi_fatture_ricevute=costi_fatture_ricevute,  # Solo fatture ricevute direttamente
        numero_fatture_costi=numero_fatture_costi,
        numero_vendite=numero_vendite,
        prodotti_autoprodotti_disponibili=prodotti_autoprodotti
    )
