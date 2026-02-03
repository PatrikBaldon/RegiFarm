"""
DDT Emessi endpoints - Documenti di Trasporto emessi dall'azienda
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date
from io import BytesIO

from app.core.database import get_db
from app.models.amministrazione.ddt_emesso import DdtEmesso
from app.schemas.amministrazione.ddt_emesso import (
    DdtEmessoCreate,
    DdtEmessoUpdate,
    DdtEmessoResponse,
)
from app.services.amministrazione.ddt_emesso_service import (
    get_ddt_emessi,
    get_ddt_emesso,
    create_ddt_emesso,
    update_ddt_emesso,
    delete_ddt_emesso,
    get_next_ddt_number,
)
from app.models.allevamento.azienda import Azienda
# PDF imports lazy - caricati solo quando servono per risparmiare memoria

router = APIRouter()


@router.get("/ddt-emessi", response_model=List[DdtEmessoResponse])
def list_ddt_emessi(
    skip: int = 0,
    limit: int = 1000,
    azienda_id: Optional[int] = None,
    cliente_id: Optional[int] = None,
    data_da: Optional[date] = None,
    data_a: Optional[date] = None,
    db: Session = Depends(get_db)
):
    """Get all DDT emessi with optional filters"""
    return get_ddt_emessi(
        db=db,
        azienda_id=azienda_id,
        cliente_id=cliente_id,
        data_da=data_da,
        data_a=data_a,
        skip=skip,
        limit=limit
    )


@router.get("/ddt-emessi/next-number")
def get_next_ddt_number_endpoint(
    azienda_id: int = Query(..., description="ID azienda"),
    anno: Optional[int] = Query(None, description="Anno di riferimento (default: anno corrente)"),
    numero_progressivo: Optional[int] = Query(None, description="Numero progressivo specifico (opzionale)"),
    db: Session = Depends(get_db)
):
    """Get the next DDT number for an azienda and year"""
    try:
        numero_progressivo, anno, numero_formattato = get_next_ddt_number(
            db, azienda_id, anno, numero_progressivo
        )
        return {
            "numero_progressivo": numero_progressivo,
            "anno": anno,
            "numero": numero_formattato
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nel calcolo del numero: {str(e)}")


@router.get("/ddt-emessi/{ddt_id}", response_model=DdtEmessoResponse)
def get_ddt_emesso_endpoint(ddt_id: int, db: Session = Depends(get_db)):
    """Get a single DDT emesso by ID"""
    ddt = get_ddt_emesso(db, ddt_id)
    if not ddt:
        raise HTTPException(status_code=404, detail="DDT non trovato")
    return ddt


@router.post("/ddt-emessi", response_model=DdtEmessoResponse, status_code=status.HTTP_201_CREATED)
def create_ddt_emesso_endpoint(
    data: DdtEmessoCreate,
    numero_progressivo: Optional[int] = Query(None, description="Numero progressivo specifico (opzionale)"),
    db: Session = Depends(get_db)
):
    """Create a new DDT emesso"""
    try:
        return create_ddt_emesso(db, data, numero_progressivo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nella creazione del DDT: {str(e)}")


@router.put("/ddt-emessi/{ddt_id}", response_model=DdtEmessoResponse)
def update_ddt_emesso_endpoint(
    ddt_id: int,
    update: DdtEmessoUpdate,
    db: Session = Depends(get_db)
):
    """Update an existing DDT emesso"""
    ddt = update_ddt_emesso(db, ddt_id, update)
    if not ddt:
        raise HTTPException(status_code=404, detail="DDT non trovato")
    return ddt


@router.delete("/ddt-emessi/{ddt_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ddt_emesso_endpoint(ddt_id: int, db: Session = Depends(get_db)):
    """Soft delete a DDT emesso"""
    success = delete_ddt_emesso(db, ddt_id)
    if not success:
        raise HTTPException(status_code=404, detail="DDT non trovato")
    return None


@router.get("/ddt-emessi/{ddt_id}/pdf")
def get_ddt_emesso_pdf(
    ddt_id: int,
    db: Session = Depends(get_db)
):
    """Generate PDF for a DDT emesso"""
    # Lazy import per risparmiare memoria all'avvio
    from app.utils.pdf_generator import generate_ddt_emesso_pdf
    from app.utils.pdf_layout import branding_from_azienda
    
    ddt = get_ddt_emesso(db, ddt_id)
    if not ddt:
        raise HTTPException(status_code=404, detail="DDT non trovato")
    
    # Carica azienda per branding
    azienda = db.query(Azienda).filter(Azienda.id == ddt.azienda_id).first()
    branding = branding_from_azienda(azienda) if azienda else None
    
    # Genera PDF
    try:
        pdf_buffer = generate_ddt_emesso_pdf(ddt, branding=branding)
        
        # Prepara risposta
        headers = {
            "Content-Disposition": f'attachment; filename="DDT_{ddt.numero.replace("/", "_")}.pdf"'
        }
        
        return Response(
            content=pdf_buffer.getvalue(),
            media_type="application/pdf",
            headers=headers
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Errore nella generazione del PDF: {str(e)}")

