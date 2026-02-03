"""
Amministrazione Module - Router aggregation

Questo modulo aggrega tutti i sub-router per le diverse funzionalità 
del modulo Amministrazione, seguendo le best practice di organizzazione
del codice FastAPI.

Struttura:
- init_data: Endpoint batch per caricamento dati iniziali
- fornitori: Gestione tipi fornitori e associazioni
- vendite: Vendite prodotti agricoli e prodotti derivati  
- fatture: Fatture ricevute (uscita) ed emesse (entrata)
- pagamenti: Gestione pagamenti
- assicurazioni: Assicurazioni aziendali
- prima_nota: Prima Nota v2
- import_fatture: Import da Excel e XML FatturaPA
- report: Report PDF e statistiche
- partite: Partite animali e sincronizzazione anagrafe
- contratti_soccida: Contratti soccida

Note:
- Attrezzature è un modulo separato (/attrezzatura.py) con proprio router
"""
from fastapi import APIRouter

# Import sub-routers
from .init_data import router as init_data_router
from .fornitori import router as fornitori_router
from .vendite import router as vendite_router
from .fatture import router as fatture_router
from .pagamenti import router as pagamenti_router
from .assicurazioni import router as assicurazioni_router
from .polizze_attrezzature import router as polizze_attrezzature_router
from .prima_nota import router as prima_nota_router
from .import_fatture import router as import_fatture_router
from .report import router as report_router
from .partite import router as partite_router
from .contratti_soccida import router as contratti_soccida_router
from .ddt_emesso import router as ddt_emesso_router

# Router principale
router = APIRouter(prefix="/amministrazione", tags=["amministrazione"])

# Includi tutti i sub-router
router.include_router(init_data_router)
router.include_router(fornitori_router)
router.include_router(vendite_router)
router.include_router(fatture_router)
router.include_router(pagamenti_router)
router.include_router(assicurazioni_router)
router.include_router(polizze_attrezzature_router)
router.include_router(prima_nota_router)
router.include_router(import_fatture_router)
router.include_router(report_router)
router.include_router(partite_router)
router.include_router(contratti_soccida_router)
router.include_router(ddt_emesso_router)
