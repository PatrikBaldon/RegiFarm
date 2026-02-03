"""
Allevamento schemas
"""
from .azienda import (
    AziendaBase,
    AziendaCreate,
    AziendaUpdate,
    AziendaResponse,
    VeterinarioResponse,
)
from .utente import (
    AziendaUtenteBase,
    AziendaUtenteCreate,
    AziendaUtenteResponse,
)
from .decesso import DecessoBase, DecessoCreate, DecessoUpdate, DecessoResponse, DecessoConfirm
from .gruppo_decessi import (
    GruppoDecessiBase,
    GruppoDecessiCreate,
    GruppoDecessiUpdate,
    GruppoDecessiResponse,
    GruppoDecessiWithDecessi,
    GruppoDecessiConfirm,
)
from .piano_uscita import (
    PianoUscitaBase,
    PianoUscitaCreate,
    PianoUscitaUpdate,
    PianoUscitaResponse,
    PianoUscitaDetailResponse,
    PianoUscitaAddAnimaliRequest,
    PianoUscitaAnimaleResponse,
)

__all__ = [
    "AziendaBase",
    "AziendaCreate",
    "AziendaUpdate",
    "AziendaResponse",
    "VeterinarioResponse",
    "AziendaUtenteBase",
    "AziendaUtenteCreate",
    "AziendaUtenteResponse",
    "DecessoBase",
    "DecessoCreate",
    "DecessoUpdate",
    "DecessoResponse",
    "DecessoConfirm",
    "GruppoDecessiBase",
    "GruppoDecessiCreate",
    "GruppoDecessiUpdate",
    "GruppoDecessiResponse",
    "GruppoDecessiWithDecessi",
    "GruppoDecessiConfirm",
    "PianoUscitaBase",
    "PianoUscitaCreate",
    "PianoUscitaUpdate",
    "PianoUscitaResponse",
    "PianoUscitaDetailResponse",
    "PianoUscitaAddAnimaliRequest",
    "PianoUscitaAnimaleResponse",
]

