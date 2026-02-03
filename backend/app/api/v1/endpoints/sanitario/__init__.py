"""Sanitario Module - Router aggregation"""
from fastapi import APIRouter

from .farmaci import router as farmaci_router
from .somministrazioni import router as somministrazioni_router

router = APIRouter(prefix="/sanitario", tags=["sanitario"])

router.include_router(farmaci_router)
router.include_router(somministrazioni_router)
