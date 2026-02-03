"""
Allevamento Module - Router aggregation

Struttura:
- sedi: Gestione sedi/allevamenti
- stabilimenti: Gestione stabilimenti
- box: Gestione box/recinti
- animali: Gestione animali (CRUD, assegnazione, storico)
- movimentazioni: Movimentazioni animali
- piani_uscita: Piani di uscita e PDF
"""
from fastapi import APIRouter

from .sedi import router as sedi_router
from .stabilimenti import router as stabilimenti_router
from .box import router as box_router
from .animali import router as animali_router
from .movimentazioni import router as movimentazioni_router
from .piani_uscita import router as piani_uscita_router

# Router principale
router = APIRouter(prefix="/allevamento", tags=["allevamento"])

# Includi tutti i sub-router
router.include_router(sedi_router)
router.include_router(stabilimenti_router)
router.include_router(box_router)
router.include_router(animali_router)
router.include_router(movimentazioni_router)
router.include_router(piani_uscita_router)

