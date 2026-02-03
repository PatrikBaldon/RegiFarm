"""
Amministrazione models package
"""
from .fornitore import Fornitore
from .fornitore_tipo import FornitoreTipo
from .vendita_prodotto_agricolo import VenditaProdottoAgricolo
from .prodotto_derivato import ProdottoDerivato
from .fattura_amministrazione import FatturaAmministrazione
from .fattura_amministrazione_linea import FatturaAmministrazioneLinea
from .fattura_amministrazione_riepilogo import FatturaAmministrazioneRiepilogo
from .fattura_amministrazione_pagamento import FatturaAmministrazionePagamento
from .fattura_amministrazione_ricezione import FatturaAmministrazioneRicezione
from .partita_animale import PartitaAnimale, ModalitaGestionePartita
from .partita_animale_animale import PartitaAnimaleAnimale
from .partita_animale_movimento_finanziario import (
    PartitaMovimentoFinanziario,
    PartitaMovimentoDirezione,
    PartitaMovimentoTipo,
)
# from .fattura_emessa import FatturaEmessa  # DEPRECATO: modello unificato in FatturaAmministrazione
from .pagamento import Pagamento
from .prima_nota import PrimaNota
from .pn import (
    PNConto,
    PNPreferenze,
    PNCategoria,
    PNMovimento,
    PNMovimentoDocumento,
    PNContoIban,
    PNContoTipo,
    PNTipoOperazione,
    PNStatoMovimento,
    PNMovimentoOrigine,
    PNDocumentoTipo,
)
from .attrezzatura import Attrezzatura, ScadenzaAttrezzatura, Ammortamento
from .assicurazione_aziendale import AssicurazioneAziendale
from .polizza_attrezzatura import PolizzaAttrezzatura, TipoPolizza
from .polizza_pagamento import PolizzaPagamento
from .polizza_rinnovo import PolizzaRinnovo
from .contratto_soccida import ContrattoSoccida
from .report_allevamento_fatture import ReportAllevamentoFattureUtilizzate
from .ddt_emesso import DdtEmesso

__all__ = [
    "Fornitore",
    "FornitoreTipo",
    "VenditaProdottoAgricolo",
    "ProdottoDerivato",
    "FatturaAmministrazione",
    "FatturaAmministrazioneLinea",
    "FatturaAmministrazioneRiepilogo",
    "FatturaAmministrazionePagamento",
    "FatturaAmministrazioneRicezione",
    "PartitaAnimale",
    "ModalitaGestionePartita",
    "PartitaAnimaleAnimale",
    "PartitaMovimentoFinanziario",
    "PartitaMovimentoDirezione",
    "PartitaMovimentoTipo",
    # "FatturaEmessa",  # DEPRECATO
    "Pagamento",
    "PrimaNota",
    "PNConto",
    "PNPreferenze",
    "PNCategoria",
    "PNMovimento",
    "PNMovimentoDocumento",
    "PNContoIban",
    "PNContoTipo",
    "PNTipoOperazione",
    "PNStatoMovimento",
    "PNMovimentoOrigine",
    "PNDocumentoTipo",
    "Attrezzatura",
    "ScadenzaAttrezzatura",
    "Ammortamento",
    "AssicurazioneAziendale",
    "PolizzaAttrezzatura",
    "TipoPolizza",
    "PolizzaPagamento",
    "PolizzaRinnovo",
    "ContrattoSoccida",
    "ReportAllevamentoFattureUtilizzate",
    "DdtEmesso",
]

