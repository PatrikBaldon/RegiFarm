"""Statistiche Module - Router aggregation"""
from fastapi import APIRouter

from .batch import router as batch_router
from .animali import router as animali_router
from .generali import router as generali_router
from .notifiche import router as notifiche_router

router = APIRouter(prefix="/statistiche", tags=["statistiche"])

router.include_router(batch_router)
router.include_router(animali_router)
router.include_router(generali_router)
router.include_router(notifiche_router)

