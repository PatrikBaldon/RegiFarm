"""
Alimentazione Module - Router aggregation
"""
from fastapi import APIRouter

from .catalogo import router as catalogo_router
from .piani import router as piani_router
from .ddt import router as ddt_router
from .magazzino import router as magazzino_router
from .registri import router as registri_router

router = APIRouter(prefix="/alimentazione", tags=["alimentazione"])

router.include_router(catalogo_router)
router.include_router(piani_router)
router.include_router(ddt_router)
router.include_router(magazzino_router)
router.include_router(registri_router)
