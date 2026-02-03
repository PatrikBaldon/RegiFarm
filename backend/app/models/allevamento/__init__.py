"""
Allevamento models
"""
from .azienda import Azienda
from .azienda_utente import AziendaUtente
from .sede import Sede
from .stabilimento import Stabilimento
from .box import Box
from .animale import Animale
from .movimentazione import Movimentazione
from .decesso import Decesso
from .gruppo_decessi import GruppoDecessi
from .piano_uscita import PianoUscita, PianoUscitaAnimale
from .storico_tipo_allevamento import StoricoTipoAllevamento

__all__ = [
    "Azienda",
    "AziendaUtente",
    "Sede",
    "Stabilimento",
    "Box",
    "Animale",
    "Movimentazione",
    "Decesso",
    "GruppoDecessi",
    "PianoUscita",
    "PianoUscitaAnimale",
    "StoricoTipoAllevamento",
]

