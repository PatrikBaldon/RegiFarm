"""Impostazioni Module - Router aggregation"""
from fastapi import APIRouter

from .impostazioni import router as impostazioni_router

router = APIRouter(prefix="/impostazioni", tags=["impostazioni"])

router.include_router(impostazioni_router)
