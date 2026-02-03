"""Schemi Pydantic per modulo sanitario"""
from .farmaco import FarmacoCreate, FarmacoUpdate, FarmacoResponse
from .lotto_farmaco import LottoFarmacoCreate, LottoFarmacoUpdate, LottoFarmacoResponse
from .somministrazione import (
    SomministrazioneCreate, 
    SomministrazioneUpdate, 
    SomministrazioneResponse,
    SomministrazioneGruppoCreate,
    AnimaleCandidatoInfo,
    PartitaAnimaliInfo,
    AnimaliCandidatiResponse,
    SomministrazioneGruppoResponse
)

__all__ = [
    "FarmacoCreate", "FarmacoUpdate", "FarmacoResponse",
    "LottoFarmacoCreate", "LottoFarmacoUpdate", "LottoFarmacoResponse",
    "SomministrazioneCreate", "SomministrazioneUpdate", "SomministrazioneResponse",
    "SomministrazioneGruppoCreate",
    "AnimaleCandidatoInfo",
    "PartitaAnimaliInfo",
    "AnimaliCandidatiResponse",
    "SomministrazioneGruppoResponse",
]

