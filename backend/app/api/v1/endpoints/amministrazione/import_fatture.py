"""
Import Fatture endpoints (Excel e XML)
"""
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Dict
import asyncio
import json
import tempfile
import os

from app.core.database import get_db
from app.services.amministrazione.import_fatture import (
    import_fatture_emesse,
    import_fatture_amministrazione
)
from app.services.amministrazione.import_fatture_xml import import_fatture_from_xml_folder

router = APIRouter()


@router.post("/import/fatture-emesse")
async def import_fatture_emesse_from_excel(
    file: UploadFile = File(...),
    azienda_id: int = Query(..., description="ID azienda"),
    skip_duplicates: bool = Query(True, description="Salta fatture duplicate"),
    db: Session = Depends(get_db)
):
    """
    Importa fatture emesse da file Excel (.xlsx)
    
    Il file deve contenere almeno le colonne:
    - numero (obbligatorio)
    - data_fattura (obbligatorio)
    - importo_totale (obbligatorio)
    
    Colonne opzionali:
    - cliente_nome, cliente_piva, cliente_cf
    - data_registrazione
    - importo_iva, importo_netto, importo_incassato
    - stato_pagamento (da_incassare, incassata, scaduta, parziale, annullata)
    - data_scadenza, data_incasso
    - categoria
    - terreno (nome del terreno)
    - note
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il file deve essere in formato Excel (.xlsx o .xls)"
        )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        result = import_fatture_emesse(
            db=db,
            file_path=tmp_file_path,
            azienda_id=azienda_id,
            skip_duplicates=skip_duplicates
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Errore durante l\'importazione')
            )
        
        return {
            'success': True,
            'importate': result['importate'],
            'errate': result['errate'],
            'duplicate': result['duplicate'],
            'errori': result.get('errori', [])
        }
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.post("/import/fatture-amministrazione")
async def import_fatture_amministrazione_from_excel(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Salta fatture duplicate"),
    db: Session = Depends(get_db)
):
    """
    Importa fatture amministrazione (ricevute) da file Excel (.xlsx)
    
    Il file deve contenere almeno le colonne:
    - numero (obbligatorio)
    - data_fattura (obbligatorio)
    - importo_totale (obbligatorio)
    """
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Il file deve essere in formato Excel (.xlsx o .xls)"
        )
    
    with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp_file:
        content = await file.read()
        tmp_file.write(content)
        tmp_file_path = tmp_file.name
    
    try:
        result = import_fatture_amministrazione(
            db=db,
            file_path=tmp_file_path,
            skip_duplicates=skip_duplicates
        )
        
        if not result['success']:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result.get('error', 'Errore durante l\'importazione')
            )
        
        return {
            'success': True,
            'importate': result['importate'],
            'errate': result['errate'],
            'duplicate': result['duplicate'],
            'errori': result.get('errori', [])
        }
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


@router.post("/import/fatture-xml-stream")
async def import_fatture_from_xml_stream(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Salta fatture duplicate"),
    db: Session = Depends(get_db)
):
    """
    Importa fatture da file ZIP contenente file XML FatturaPA con progresso in tempo reale.
    Restituisce uno stream Server-Sent Events (SSE) con aggiornamenti di progresso.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome file non valido"
        )
    
    supported_extensions = ['.zip', '.ZIP', '.xml', '.XML']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in [ext.lower() for ext in supported_extensions]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato file non supportato. Estensioni supportate: {', '.join(supported_extensions)}"
        )
    
    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Il file è vuoto"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Errore nella lettura del file: {str(e)}"
        )
    
    try:
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext, mode='wb')
        tmp_file.write(content)
        tmp_file.flush()
        os.fsync(tmp_file.fileno())
        tmp_file_path = tmp_file.name
        tmp_file.close()
        
        if not os.path.exists(tmp_file_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Errore: il file temporaneo non è stato creato correttamente"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nel salvataggio temporaneo del file: {str(e)}"
        )
    
    async def generate_progress_stream():
        """Genera lo stream SSE con aggiornamenti di progresso"""
        try:
            import threading
            import queue
            
            progress_queue = queue.Queue()
            result_queue = queue.Queue()
            error_queue = queue.Queue()
            
            def progress_callback(current: int, total: int, stats: Dict):
                try:
                    progress_data = {
                        'current': current,
                        'total': total,
                        'progress': (current / total * 100) if total > 0 else 0,
                        'stats': stats
                    }
                    progress_queue.put(progress_data)
                except Exception as e:
                    print(f"[IMPORT XML SSE] Errore nel callback: {e}")
            
            def run_import():
                try:
                    result = import_fatture_from_xml_folder(
                        db=db,
                        folder_path=tmp_file_path,
                        skip_duplicates=skip_duplicates,
                        progress_callback=progress_callback
                    )
                    result_queue.put(result)
                except Exception as e:
                    error_queue.put(str(e))
            
            thread = threading.Thread(target=run_import, daemon=True)
            thread.start()
            
            yield f"data: {json.dumps({'type': 'start', 'message': 'Importazione avviata'})}\n\n"
            
            while thread.is_alive() or not result_queue.empty() or not error_queue.empty() or not progress_queue.empty():
                try:
                    error = error_queue.get_nowait()
                    yield f"data: {json.dumps({'type': 'error', 'error': error})}\n\n"
                    break
                except queue.Empty:
                    pass
                
                try:
                    result = result_queue.get_nowait()
                    complete_data = {
                        'type': 'complete',
                        'result': result
                    }
                    yield f"data: {json.dumps(complete_data)}\n\n"
                    break
                except queue.Empty:
                    pass
                
                try:
                    progress_data = progress_queue.get_nowait()
                    progress_msg = {
                        'type': 'progress',
                        'current': progress_data['current'],
                        'total': progress_data['total'],
                        'progress': progress_data['progress'],
                        'importate_emesse': progress_data['stats'].get('importate_emesse', 0),
                        'importate_amministrazione': progress_data['stats'].get('importate_amministrazione', 0),
                        'errate': progress_data['stats'].get('errate', 0),
                        'duplicate_emesse': progress_data['stats'].get('duplicate_emesse', 0),
                        'duplicate_amministrazione': progress_data['stats'].get('duplicate_amministrazione', 0),
                        'current_file': progress_data['stats'].get('current_file', ''),
                        'ultimo_errore': progress_data['stats'].get('ultimo_errore')
                    }
                    yield f"data: {json.dumps(progress_msg)}\n\n"
                except queue.Empty:
                    await asyncio.sleep(0.1)
                    continue
            
            thread.join(timeout=30)
            
            if not result_queue.empty():
                try:
                    result = result_queue.get_nowait()
                    complete_data_final = {
                        'type': 'complete',
                        'result': result
                    }
                    yield f"data: {json.dumps(complete_data_final)}\n\n"
                except queue.Empty:
                    pass
            
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"
        finally:
            if os.path.exists(tmp_file_path):
                import shutil
                if os.path.isdir(tmp_file_path):
                    shutil.rmtree(tmp_file_path)
                else:
                    os.unlink(tmp_file_path)
    
    return StreamingResponse(
        generate_progress_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/import/fatture-xml")
async def import_fatture_from_xml(
    file: UploadFile = File(...),
    skip_duplicates: bool = Query(True, description="Salta fatture duplicate"),
    db: Session = Depends(get_db)
):
    """
    Importa fatture da file ZIP contenente file XML FatturaPA
    
    Supporta:
    - File ZIP (.zip) contenenti uno o più file XML
    - File XML singoli (.xml)
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nome file non valido"
        )
    
    supported_extensions = ['.zip', '.ZIP', '.xml', '.XML']
    file_ext = os.path.splitext(file.filename)[1].lower()
    
    if file_ext not in [ext.lower() for ext in supported_extensions]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Formato file non supportato. Estensioni supportate: {', '.join(supported_extensions)}"
        )
    
    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Il file è vuoto"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Errore nella lettura del file: {str(e)}"
        )
    
    try:
        tmp_file = tempfile.NamedTemporaryFile(delete=False, suffix=file_ext, mode='wb')
        tmp_file.write(content)
        tmp_file.flush()
        os.fsync(tmp_file.fileno())
        tmp_file_path = tmp_file.name
        tmp_file.close()
        
        if not os.path.exists(tmp_file_path):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Errore: il file temporaneo non è stato creato correttamente"
            )
        
        file_size = os.path.getsize(tmp_file_path)
        if file_size != len(content):
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Errore: il file temporaneo non è stato scritto correttamente"
            )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Errore nel salvataggio temporaneo del file: {str(e)}"
        )
    
    try:
        print(f"[IMPORT XML] Avvio importazione: {file.filename}, dimensione: {len(content)} bytes")
        
        result = import_fatture_from_xml_folder(
            db=db,
            folder_path=tmp_file_path,
            skip_duplicates=skip_duplicates
        )
        
        if not result['success']:
            error_detail = result.get('error', 'Errore durante l\'importazione')
            if result.get('errori') and len(result['errori']) > 0:
                errori_list = result['errori'][:5]
                error_detail += f"\nErrori dettagliati:\n" + "\n".join(f"- {err}" for err in errori_list)
                if len(result['errori']) > 5:
                    error_detail += f"\n... e altri {len(result['errori']) - 5} errori"
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=error_detail
            )
        
        return {
            'success': True,
            'importate_emesse': result.get('importate_emesse', 0),
            'importate_amministrazione': result.get('importate_amministrazione', 0),
            'errate': result.get('errate', 0),
            'duplicate_emesse': result.get('duplicate_emesse', 0),
            'duplicate_amministrazione': result.get('duplicate_amministrazione', 0),
            'errori': result.get('errori', [])
        }
    finally:
        if os.path.exists(tmp_file_path):
            import shutil
            if os.path.isdir(tmp_file_path):
                shutil.rmtree(tmp_file_path)
            else:
                os.unlink(tmp_file_path)

