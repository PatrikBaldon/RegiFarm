"""Attrezzatura Module - Router aggregation"""
from fastapi import APIRouter

from .attrezzature import router as attrezzature_router

router = APIRouter(prefix="/amministrazione", tags=["attrezzatura"])

router.include_router(attrezzature_router)
