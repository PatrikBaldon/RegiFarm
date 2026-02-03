"""Terreni Module - Router aggregation"""
from fastapi import APIRouter

from .terreni import router as terreni_router
from .cicli import router as cicli_router
from .lavorazioni import router as lavorazioni_router
from .raccolti import router as raccolti_router

router = APIRouter(prefix="/terreni", tags=["terreni"])

router.include_router(terreni_router)
router.include_router(cicli_router)
router.include_router(lavorazioni_router)
router.include_router(raccolti_router)
