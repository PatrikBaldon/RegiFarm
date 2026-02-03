import React, { useCallback, useEffect, useMemo, useState } from 'react';
import SearchableSelect from '../../../components/SearchableSelect';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { terreniService } from '../services/terreniService';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import { amministrazioneService } from '../../amministrazione/services/amministrazioneService';
import './CostiCicliPanel.css';

const PHASE_OPTIONS = [
  { value: 'preparazione', label: 'Preparazione' },
  { value: 'semina', label: 'Semina' },
  { value: 'crescita', label: 'Crescita / Gestione' },
  { value: 'trattamento', label: 'Trattamenti' },
  { value: 'raccolta', label: 'Raccolta' },
  { value: 'post_raccolta', label: 'Post-raccolta' },
  { value: 'altro', label: 'Altro' },
];

const emptyCycleForm = () => ({
  coltura: '',
  anno: new Date().getFullYear(),
  data_inizio: '',
  data_fine: '',
  superficie_coinvolta: '',
  note: '',
});

const emptyPhaseForm = () => ({
  nome: '',
  tipo: 'preparazione',
  ordine: '',
  data_inizio: '',
  data_fine: '',
  note: '',
});

const formatMoney = (value) => {
  if (value === null || value === undefined) return '-';
  const number = Number(value);
  if (Number.isNaN(number)) return '-';
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(number);
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT');
};

const ensureNumberOrNull = (raw) => {
  if (raw === '' || raw === null || raw === undefined) return null;
  const normalized =
    typeof raw === 'string' ? raw.replace(',', '.').trim() : raw;
  if (normalized === '' || normalized === null || normalized === undefined) return null;
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
};

const SURFACE_UNIT_OPTIONS = [
  { value: 'm2', label: 'Metri quadrati (m²)', shortLabel: 'm²', m2Factor: 1 },
  { value: 'ca', label: 'Centiara (ca)', shortLabel: 'ca', m2Factor: 1 },
  { value: 'a', label: 'Ara (a)', shortLabel: 'a', m2Factor: 100 },
  { value: 'ha', label: 'Ettaro (ha)', shortLabel: 'ha', m2Factor: 10000 },
];

const SURFACE_UNIT_MAP = SURFACE_UNIT_OPTIONS.reduce((acc, item) => {
  acc[item.value] = item;
  return acc;
}, {});

const SURFACE_UNIT_ALIASES = {
  ha: 'ha',
  ettaro: 'ha',
  ettari: 'ha',
  hectare: 'ha',
  hectares: 'ha',
  'ha.': 'ha',
  m2: 'm2',
  mq: 'm2',
  'm²': 'm2',
  metro: 'm2',
  'metro quadrato': 'm2',
  'metri quadrati': 'm2',
  'metriquadri': 'm2',
  ca: 'ca',
  centiara: 'ca',
  centiare: 'ca',
  'c.a.': 'ca',
  a: 'a',
  ara: 'a',
  are: 'a',
};

const normalizeSurfaceUnit = (unit) => {
  if (!unit) return 'ha';
  const raw = unit.toString().trim().toLowerCase();
  if (SURFACE_UNIT_MAP[raw]) return raw;
  const simplified = raw.replace(/\s+/g, '');
  if (SURFACE_UNIT_MAP[simplified]) return simplified;
  const noExpo = raw.replace('²', '2').replace(/\./g, '');
  if (SURFACE_UNIT_MAP[noExpo]) return noExpo;
  const simplifiedNoExpo = simplified.replace('²', '2').replace(/\./g, '');
  if (SURFACE_UNIT_MAP[simplifiedNoExpo]) return simplifiedNoExpo;
  return (
    SURFACE_UNIT_ALIASES[raw]
    || SURFACE_UNIT_ALIASES[simplified]
    || SURFACE_UNIT_ALIASES[noExpo]
    || SURFACE_UNIT_ALIASES[simplifiedNoExpo]
    || 'ha'
  );
};

const convertSurfaceValue = (value, fromUnit, toUnit) => {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return null;
  const from = SURFACE_UNIT_MAP[normalizeSurfaceUnit(fromUnit)] || SURFACE_UNIT_MAP.ha;
  const to = SURFACE_UNIT_MAP[normalizeSurfaceUnit(toUnit)] || SURFACE_UNIT_MAP.ha;
  const valueInM2 = numeric * from.m2Factor;
  const converted = valueInM2 / to.m2Factor;
  return Number.isFinite(converted) ? converted : numeric;
};

const toSurfaceInputString = (value) => {
  if (value === null || value === undefined) return '';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '';
  return Number(numeric.toFixed(4)).toString();
};

const formatSurfaceValue = (value, maximumFractionDigits = 4) => {
  if (value === null || value === undefined) return '-';
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return '-';
  return numeric.toLocaleString('it-IT', {
    minimumFractionDigits: 0,
    maximumFractionDigits,
  });
};

// Normalizza i campi di una riga fattura da qualsiasi formato (snake_case, camelCase, PascalCase) a snake_case
const normalizeRigaFattura = (riga) => {
  if (!riga) return null;
  return {
    id: riga.id,
    numero_linea: riga.numero_linea || riga.numeroLinea || riga.NumeroLinea || null,
    descrizione: riga.descrizione || riga.Descrizione || null,
    quantita: riga.quantita || riga.Quantita || riga.quantita || null,
    unita_misura: riga.unita_misura || riga.unitaMisura || riga.UnitaMisura || null,
    prezzo_unitario: riga.prezzo_unitario || riga.prezzoUnitario || riga.PrezzoUnitario || null,
    prezzo_totale: riga.prezzo_totale || riga.prezzoTotale || riga.PrezzoTotale || null,
    aliquota_iva: riga.aliquota_iva || riga.aliquotaIva || riga.AliquotaIva || null,
    natura: riga.natura || riga.Natura || null,
    tipo_cessione_prestazione: riga.tipo_cessione_prestazione || riga.tipoCessionePrestazione || riga.TipoCessionePrestazione || null,
    riferimento_amministrazione: riga.riferimento_amministrazione || riga.riferimentoAmministrazione || riga.RiferimentoAmministrazione || null,
    codice_articolo: riga.codice_articolo || riga.codiceArticolo || riga.CodiceArticolo || null,
    data_inizio_periodo: riga.data_inizio_periodo || riga.dataInizioPeriodo || riga.DataInizioPeriodo || null,
    data_fine_periodo: riga.data_fine_periodo || riga.dataFinePeriodo || riga.DataFinePeriodo || null,
  };
};

// Calcola il prezzo totale di una riga fattura
// Prova prima prezzo_totale, poi calcola da prezzo_unitario * quantita
const calcolaPrezzoTotaleRiga = (riga) => {
  if (!riga) return null;
  
  const rigaNormalizzata = normalizeRigaFattura(riga);
  
  // Prova prezzo_totale diretto
  let prezzoTotale = parseFloat(rigaNormalizzata.prezzo_totale) || 0;
  
  // Se non disponibile o è 0, calcola da prezzo_unitario * quantita
  if (prezzoTotale <= 0) {
    const prezzoUnitario = parseFloat(rigaNormalizzata.prezzo_unitario) || 0;
    const quantita = parseFloat(rigaNormalizzata.quantita) || 0;
    if (prezzoUnitario > 0 && quantita > 0) {
      prezzoTotale = prezzoUnitario * quantita;
    }
  }
  
  return prezzoTotale > 0 ? Number(prezzoTotale.toFixed(2)) : null;
};

// Helper functions for form rendering
const renderCycleForm = ({
  cycleForm,
  setCycleForm,
  normalizedSurfaceUnit,
  handleSurfaceUnitChange,
  SURFACE_UNIT_OPTIONS,
  terrenoSurfaceInfo,
  surfaceUnitDef,
  currentSurfaceValue,
  surfaceExceeded,
  remainingSurface,
  formatSurfaceValue,
}) => (
  <>
    <div className="form-group">
      <label>Coltura / Ciclo *</label>
      <input
        value={cycleForm.coltura}
        onChange={(e) => setCycleForm((prev) => ({ ...prev, coltura: e.target.value }))}
        required
      />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Anno</label>
        <input
          type="number"
          value={cycleForm.anno}
          onChange={(e) => setCycleForm((prev) => ({ ...prev, anno: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label>Superficie coinvolta</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            value={cycleForm.superficie_coinvolta}
            onChange={(e) =>
              setCycleForm((prev) => ({ ...prev, superficie_coinvolta: e.target.value }))
            }
            placeholder="Opzionale"
            inputMode="decimal"
          />
          <select
            value={normalizedSurfaceUnit}
            onChange={(e) => handleSurfaceUnitChange(e.target.value)}
            style={{ minWidth: '130px' }}
          >
            {SURFACE_UNIT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="form-hint" style={{ marginTop: '6px' }}>
          {terrenoSurfaceInfo
            ? `Superficie terreno: ${formatSurfaceValue(
                terrenoSurfaceInfo.surfaceInCurrentUnit,
              )} ${surfaceUnitDef.shortLabel}${
                terrenoSurfaceInfo.surfaceInHa !== null
                && terrenoSurfaceInfo.surfaceInHa !== undefined
                  ? ` (${formatSurfaceValue(terrenoSurfaceInfo.surfaceInHa)} ha)`
                  : ''
              }${
                currentSurfaceValue !== null && !surfaceExceeded
                  ? ` · Residuo: ${formatSurfaceValue(remainingSurface)} ${surfaceUnitDef.shortLabel}`
                  : ''
              }`
            : 'Superficie del terreno non indicata: puoi aggiungerla dall’anagrafica terreno.'}
        </p>
        {surfaceExceeded && (
          <p className="form-hint" style={{ marginTop: 4, color: '#d32f2f' }}>
            La superficie indicata supera la superficie disponibile del terreno.
          </p>
        )}
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Inizio</label>
        <input
          type="date"
          value={cycleForm.data_inizio}
          onChange={(e) => setCycleForm((prev) => ({ ...prev, data_inizio: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label>Fine</label>
        <input
          type="date"
          value={cycleForm.data_fine}
          onChange={(e) => setCycleForm((prev) => ({ ...prev, data_fine: e.target.value }))}
        />
      </div>
    </div>
    <div className="form-group">
      <label>Note</label>
      <textarea
        value={cycleForm.note}
        onChange={(e) => setCycleForm((prev) => ({ ...prev, note: e.target.value }))}
        rows={3}
      />
    </div>
  </>
);

const renderPhaseForm = ({ phaseForm, setPhaseForm, PHASE_OPTIONS }) => (
  <>
    <div className="form-group">
      <label>Nome fase *</label>
      <input
        value={phaseForm.nome}
        onChange={(e) => setPhaseForm((prev) => ({ ...prev, nome: e.target.value }))}
        required
      />
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Tipologia</label>
        <select
          value={phaseForm.tipo}
          onChange={(e) => setPhaseForm((prev) => ({ ...prev, tipo: e.target.value }))}
        >
          {PHASE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Ordine</label>
        <input
          type="number"
          value={phaseForm.ordine}
          onChange={(e) => setPhaseForm((prev) => ({ ...prev, ordine: e.target.value }))}
          placeholder="Automatico"
        />
      </div>
    </div>
    <div className="form-row">
      <div className="form-group">
        <label>Inizio</label>
        <input
          type="date"
          value={phaseForm.data_inizio}
          onChange={(e) => setPhaseForm((prev) => ({ ...prev, data_inizio: e.target.value }))}
        />
      </div>
      <div className="form-group">
        <label>Fine</label>
        <input
          type="date"
          value={phaseForm.data_fine}
          onChange={(e) => setPhaseForm((prev) => ({ ...prev, data_fine: e.target.value }))}
        />
      </div>
    </div>
    <div className="form-group">
      <label>Note</label>
      <textarea
        value={phaseForm.note}
        onChange={(e) => setPhaseForm((prev) => ({ ...prev, note: e.target.value }))}
        rows={3}
      />
    </div>
  </>
);


const CostiCicliPanel = ({ terreni, aziendaId, showToast, initialSelectedTerrenoId, onTerrenoChange }) => {
  const [selectedTerrenoId, setSelectedTerrenoId] = useState(initialSelectedTerrenoId || null);
  const [loadingCicli, setLoadingCicli] = useState(false);
  const [cicli, setCicli] = useState([]);


  const [showCycleModal, setShowCycleModal] = useState(false);
  const [editingCycleId, setEditingCycleId] = useState(null);
  const [cycleForm, setCycleForm] = useState(emptyCycleForm());
  const [savingCycle, setSavingCycle] = useState(false);
  const [cycleSurfaceUnit, setCycleSurfaceUnit] = useState('ha');

  const [showPhaseModal, setShowPhaseModal] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState(null);
  const [phaseForm, setPhaseForm] = useState(emptyPhaseForm());
  const [savingPhase, setSavingPhase] = useState(false);
  const [fattureFaseInModal, setFattureFaseInModal] = useState([]);
  const [faseAddingFatturaInModal, setFaseAddingFatturaInModal] = useState(false);
  const [selectedFatturaToAddInModal, setSelectedFatturaToAddInModal] = useState('');
  const [fatturaSelezionataDettagli, setFatturaSelezionataDettagli] = useState(null);
  const [righeFatturaSelezionate, setRigheFatturaSelezionate] = useState([]);
  const [loadingFatturaDettagli, setLoadingFatturaDettagli] = useState(false);


  // Stati per modale gestione fasi
  const [showFasiModal, setShowFasiModal] = useState(false);
  const [selectedCicloForFasi, setSelectedCicloForFasi] = useState(null);
  const [cicloDetailForFasi, setCicloDetailForFasi] = useState(null);
  const [loadingFasi, setLoadingFasi] = useState(false);


  const [fatture, setFatture] = useState([]);
  const [lavorazioni, setLavorazioni] = useState([]);
  const [supportLoading, setSupportLoading] = useState(false);

  const terrenoOptions = useMemo(
    () => (terreni || []).map((t) => ({ value: String(t.id), label: t.denominazione })),
    [terreni],
  );

  const selectedTerreno = useMemo(() => {
    if (!selectedTerrenoId) return null;
    return (terreni || []).find((t) => Number(t.id) === Number(selectedTerrenoId)) || null;
  }, [selectedTerrenoId, terreni]);

  const defaultSurfaceUnit = useMemo(
    () => normalizeSurfaceUnit(selectedTerreno?.unita_misura),
    [selectedTerreno],
  );

  useEffect(() => {
    if (!showCycleModal) {
      setCycleSurfaceUnit(selectedTerreno ? defaultSurfaceUnit : 'ha');
    }
  }, [defaultSurfaceUnit, selectedTerreno, showCycleModal]);

  const terrenoSurfaceInfo = useMemo(() => {
    if (!selectedTerreno) return null;
    const rawSurface = ensureNumberOrNull(selectedTerreno.superficie);
    if (rawSurface === null) return null;
    const terrenoUnit = normalizeSurfaceUnit(selectedTerreno.unita_misura);
    const currentUnit = normalizeSurfaceUnit(cycleSurfaceUnit);
    return {
      raw: rawSurface,
      terrenoUnit,
      surfaceInCurrentUnit: convertSurfaceValue(rawSurface, terrenoUnit, currentUnit),
      surfaceInHa: convertSurfaceValue(rawSurface, terrenoUnit, 'ha'),
    };
  }, [selectedTerreno, cycleSurfaceUnit]);


  const notify = useCallback(
    (message, type = 'success') => {
      if (showToast) {
        showToast(message, type);
      } else {
        if (type === 'error') {
          // eslint-disable-next-line no-console

        } else {
          // eslint-disable-next-line no-console

        }
      }
    },
    [showToast],
  );

  const loadCicli = useCallback(
    async (terrenoId, { keepSelection = false } = {}) => {
      if (!terrenoId) {
        setCicli([]);
        return;
      }
      setLoadingCicli(true);
      try {
        const response = await terreniService.getCicli(terrenoId);
        setCicli(response || []);
      } catch (error) {
        notify(error.message || 'Errore nel caricamento dei cicli', 'error');
        setCicli([]);
      } finally {
        setLoadingCicli(false);
      }
    },
    [notify],
  );


  // Seleziona automaticamente un terreno se disponibile e nessuno è selezionato o quello selezionato non esiste più
  useEffect(() => {
    if (terreni.length > 0) {
      const currentExists = selectedTerrenoId && terreni.find(t => t.id === selectedTerrenoId);
      if (!currentExists) {
        // Usa initialSelectedTerrenoId se disponibile e valido, altrimenti il primo terreno
        const terrenoToSelect = initialSelectedTerrenoId && terreni.find(t => t.id === initialSelectedTerrenoId)
          ? initialSelectedTerrenoId
          : terreni[0].id;
        setSelectedTerrenoId(terrenoToSelect);
        if (onTerrenoChange) {
          onTerrenoChange(terrenoToSelect);
        }
      }
    }
  }, [terreni, selectedTerrenoId, initialSelectedTerrenoId, onTerrenoChange]);

  useEffect(() => {
    if (selectedTerrenoId) {
      loadCicli(selectedTerrenoId);
    } else {
      setCicli([]);
      setSelectedCicloId(null);
      setCicloDetail(null);
    }
  }, [selectedTerrenoId, loadCicli]);

  const openNewCycle = useCallback(() => {
    setEditingCycleId(null);
    setCycleSurfaceUnit(defaultSurfaceUnit);
    setCycleForm(emptyCycleForm());
    setShowCycleModal(true);
  }, [defaultSurfaceUnit]);

  const openEditCycle = useCallback(
    (cycle) => {
      const cycleSurfaceHa = ensureNumberOrNull(cycle.superficie_coinvolta);
      setCycleSurfaceUnit(defaultSurfaceUnit);
      setEditingCycleId(cycle.id);
      setCycleForm({
        coltura: cycle.coltura || '',
        anno: cycle.anno || '',
        data_inizio: cycle.data_inizio || '',
        data_fine: cycle.data_fine || '',
        superficie_coinvolta:
          cycleSurfaceHa !== null
            ? toSurfaceInputString(convertSurfaceValue(cycleSurfaceHa, 'ha', defaultSurfaceUnit))
            : '',
        note: cycle.note || '',
      });
      setShowCycleModal(true);
    },
    [defaultSurfaceUnit],
  );

  const handleSaveCycle = useCallback(async () => {
    if (!selectedTerrenoId) {
      notify('Seleziona un terreno prima di creare un ciclo', 'error');
      return;
    }

    if (!cycleForm.coltura.trim()) {
      notify('Indica la coltura o il ciclo da registrare', 'error');
      return;
    }

    setSavingCycle(true);
    const normalizedUnit = normalizeSurfaceUnit(cycleSurfaceUnit);
    const unitDef = SURFACE_UNIT_MAP[normalizedUnit] || SURFACE_UNIT_MAP.ha;
    const superficieValueInput = ensureNumberOrNull(cycleForm.superficie_coinvolta);
    if (
      superficieValueInput !== null
      && terrenoSurfaceInfo?.surfaceInCurrentUnit !== null
      && terrenoSurfaceInfo?.surfaceInCurrentUnit !== undefined
      && superficieValueInput > terrenoSurfaceInfo.surfaceInCurrentUnit + 1e-6
    ) {
      notify(
        `La superficie indicata (${formatSurfaceValue(superficieValueInput)} ${unitDef.shortLabel}) supera la superficie disponibile del terreno (${formatSurfaceValue(terrenoSurfaceInfo.surfaceInCurrentUnit)} ${unitDef.shortLabel}).`,
        'error',
      );
      setSavingCycle(false);
      return;
    }

    let superficieCoinvoltaHa = null;
    if (superficieValueInput !== null) {
      const convertedHa = convertSurfaceValue(superficieValueInput, normalizedUnit, 'ha');
      if (convertedHa !== null) {
        superficieCoinvoltaHa = Number(convertedHa.toFixed(4));
      }
    }

    const payload = {
      terreno_id: Number(selectedTerrenoId),
      coltura: cycleForm.coltura.trim(),
      anno: cycleForm.anno ? Number(cycleForm.anno) : null,
      data_inizio: cycleForm.data_inizio || null,
      data_fine: cycleForm.data_fine || null,
      superficie_coinvolta: superficieCoinvoltaHa,
      note: cycleForm.note || null,
    };

    try {
      if (editingCycleId) {
        await terreniService.updateCiclo(editingCycleId, payload);
        notify('Ciclo aggiornato');
      } else {
        await terreniService.createCiclo(payload);
        notify('Nuovo ciclo creato');
      }
      setShowCycleModal(false);
      await loadCicli(selectedTerrenoId);
    } catch (error) {
      notify(error.message || 'Errore durante il salvataggio del ciclo', 'error');
    } finally {
      setSavingCycle(false);
    }
  }, [
    cycleForm,
    cycleSurfaceUnit,
    editingCycleId,
    loadCicli,
    notify,
    selectedTerrenoId,
    terrenoSurfaceInfo,
  ]);

  const handleDeleteCycle = useCallback(
    async (cycleId) => {
      if (!cycleId) return;
      if (!window.confirm('Eliminare definitivamente questo ciclo colturale?')) return;
      try {
        await terreniService.deleteCiclo(cycleId);
        notify('Ciclo eliminato');
        await loadCicli(selectedTerrenoId);
      } catch (error) {
        notify(error.message || 'Errore durante l’eliminazione del ciclo', 'error');
      }
    },
    [loadCicli, notify, selectedTerrenoId],
  );

  const handleSurfaceUnitChange = useCallback(
    (nextUnit) => {
      const normalizedNext = normalizeSurfaceUnit(nextUnit);
      setCycleForm((prev) => {
        const numericValue = ensureNumberOrNull(prev.superficie_coinvolta);
        if (numericValue === null) {
          return { ...prev };
        }
        const converted = convertSurfaceValue(numericValue, cycleSurfaceUnit, normalizedNext);
        return {
          ...prev,
          superficie_coinvolta: converted === null ? '' : toSurfaceInputString(converted),
        };
      });
      setCycleSurfaceUnit(normalizedNext);
    },
    [cycleSurfaceUnit],
  );

  const openFasiModal = useCallback(
    async (ciclo) => {
      setSelectedCicloForFasi(ciclo);
      setLoadingFasi(true);
      try {
        const detail = await terreniService.getCiclo(ciclo.id);
        setCicloDetailForFasi(detail);
        setShowFasiModal(true);
      } catch (error) {
        notify(error.message || 'Errore nel caricamento delle fasi', 'error');
      } finally {
        setLoadingFasi(false);
      }
    },
    [notify],
  );

  const refreshFasiModal = useCallback(async () => {
    if (!selectedCicloForFasi) return;
    setLoadingFasi(true);
    try {
      const detail = await terreniService.getCiclo(selectedCicloForFasi.id);
      setCicloDetailForFasi(detail);
    } catch (error) {
      notify(error.message || 'Errore nel caricamento delle fasi', 'error');
    } finally {
      setLoadingFasi(false);
    }
  }, [selectedCicloForFasi, notify]);

  const openPhaseModal = useCallback(
    async (fase) => {
      if (fase) {
        setEditingPhaseId(fase.id);
        setPhaseForm({
          nome: fase.nome || '',
          tipo: fase.tipo || 'altro',
          ordine: fase.ordine ?? '',
          data_inizio: fase.data_inizio || '',
          data_fine: fase.data_fine || '',
          note: fase.note || '',
        });
        // Carica le fatture collegate alla fase
        try {
          const cicloDetail = await terreniService.getCiclo(fase.ciclo_id);
          const costiFase = (cicloDetail.costi || []).filter(c => c.fase_id === fase.id && c.source_type === 'fattura');
          setFattureFaseInModal(costiFase);
        } catch (error) {
          setFattureFaseInModal([]);
        }
      } else {
        setEditingPhaseId(null);
        setPhaseForm(emptyPhaseForm());
        setFattureFaseInModal([]);
      }
      setFaseAddingFatturaInModal(false);
      setSelectedFatturaToAddInModal('');
      setFatturaSelezionataDettagli(null);
      setRigheFatturaSelezionate([]);
      setShowPhaseModal(true);
    },
    [],
  );

  const handleSavePhase = useCallback(async (closeAfterSave = false) => {
    const cicloId = selectedCicloForFasi?.id;
    if (!cicloId) {
      notify('Ciclo non valido', 'error');
      return;
    }
    if (!phaseForm.nome.trim()) {
      notify('Indica un titolo per la fase', 'error');
      return;
    }
    setSavingPhase(true);
    const payload = {
      nome: phaseForm.nome.trim(),
      tipo: phaseForm.tipo || 'altro',
      ordine: phaseForm.ordine === '' ? null : Number(phaseForm.ordine),
      data_inizio: phaseForm.data_inizio || null,
      data_fine: phaseForm.data_fine || null,
      note: phaseForm.note || null,
    };
    try {
      let faseId = editingPhaseId;
      if (editingPhaseId) {
        await terreniService.updateCicloFase(editingPhaseId, payload);
        notify('Fase aggiornata');
      } else {
        const nuovaFase = await terreniService.createCicloFase(cicloId, payload);
        faseId = nuovaFase.id;
        setEditingPhaseId(faseId);
        notify('Nuova fase aggiunta');
      }
      // Ricarica le fatture collegate dopo il salvataggio
      if (faseId) {
        const cicloDetail = await terreniService.getCiclo(cicloId);
        const costiFase = (cicloDetail.costi || []).filter(c => c.fase_id === faseId && c.source_type === 'fattura');
        setFattureFaseInModal(costiFase);
      }
      await refreshFasiModal();
      await loadCicli(selectedTerrenoId);
      
      // Se closeAfterSave è true, chiudi la modale dopo il salvataggio
      if (closeAfterSave) {
        setShowPhaseModal(false);
        setFattureFaseInModal([]);
        setFaseAddingFatturaInModal(false);
        setSelectedFatturaToAddInModal('');
        setEditingPhaseId(null);
        setPhaseForm(emptyPhaseForm());
      }
    } catch (error) {
      notify(error.message || 'Errore durante il salvataggio della fase', 'error');
    } finally {
      setSavingPhase(false);
    }
  }, [editingPhaseId, notify, phaseForm, selectedCicloForFasi, refreshFasiModal, loadCicli, selectedTerrenoId]);

  const handleDeletePhase = useCallback(
    async (faseId) => {
      if (!faseId) return;
      if (!window.confirm('Eliminare questa fase dal ciclo?')) return;
      try {
        await terreniService.deleteCicloFase(faseId);
        notify('Fase eliminata');
        // Se la modale è aperta per questa fase, chiudila
        if (editingPhaseId === faseId) {
          setShowPhaseModal(false);
          setEditingPhaseId(null);
          setFattureFaseInModal([]);
          setFaseAddingFatturaInModal(false);
          setSelectedFatturaToAddInModal('');
        }
        await refreshFasiModal();
        await loadCicli(selectedTerrenoId);
      } catch (error) {
        notify(error.message || "Errore durante l'eliminazione della fase", 'error');
      }
    },
    [notify, refreshFasiModal, loadCicli, selectedTerrenoId, editingPhaseId],
  );


  const loadSupportData = useCallback(async () => {
    if (!selectedTerrenoId) return { fattureList: [], lavorazioniList: [] };
    setSupportLoading(true);
    try {
      const [fattureResponse, lavorazioniResponse] = await Promise.all([
        alimentazioneService.getFatture().catch(() => []),
        terreniService.getLavorazioni(selectedTerrenoId).catch(() => []),
      ]);
      const fattureList = Array.isArray(fattureResponse) ? fattureResponse : (fattureResponse?.data || []);
      const lavorazioniList = Array.isArray(lavorazioniResponse) ? lavorazioniResponse : [];
      // Carica tutte le fatture (non filtrate per categoria)
      // Questo permette di collegare qualsiasi fattura a una fase del ciclo
      setFatture(fattureList);
      setLavorazioni(lavorazioniList);
      return { fattureList, lavorazioniList };
    } finally {
      setSupportLoading(false);
    }
  }, [selectedTerrenoId]);

  const loadFatturaDettagli = useCallback(async (fatturaId) => {
    if (!fatturaId) {
      setFatturaSelezionataDettagli(null);
      setRigheFatturaSelezionate([]);
      return;
    }
    setLoadingFatturaDettagli(true);
    try {
      const dettagli = await amministrazioneService.getFattura(Number(fatturaId));
      // Normalizza le righe: priorità a linee, poi righe JSON, poi dati_xml
      const lineeRaw = dettagli.linee && Array.isArray(dettagli.linee) && dettagli.linee.length > 0
        ? dettagli.linee
        : dettagli.righe && Array.isArray(dettagli.righe) && dettagli.righe.length > 0
          ? dettagli.righe
          : dettagli.dati_xml?.linee || dettagli.dati_xml?.dettaglio_linee || [];
      
      // Normalizza tutte le righe per assicurare formato consistente
      const linee = lineeRaw.map((riga, index) => {
        const normalized = normalizeRigaFattura(riga);
        // Mantieni l'id originale o crea un id temporaneo basato sull'indice
        return {
          ...normalized,
          id: normalized.id || `linea-${index}`,
        };
      });
      
      setFatturaSelezionataDettagli({
        ...dettagli,
        linee: linee,
      });
      setRigheFatturaSelezionate([]);
    } catch (error) {
      notify(error.message || 'Errore nel caricamento dei dettagli della fattura', 'error');
      setFatturaSelezionataDettagli(null);
      setRigheFatturaSelezionate([]);
    } finally {
      setLoadingFatturaDettagli(false);
    }
  }, [notify]);



  const normalizedSurfaceUnit = normalizeSurfaceUnit(cycleSurfaceUnit);
  const surfaceUnitDef = SURFACE_UNIT_MAP[normalizedSurfaceUnit] || SURFACE_UNIT_MAP.ha;
  const summarySurfaceUnitDef = SURFACE_UNIT_MAP[defaultSurfaceUnit] || SURFACE_UNIT_MAP.ha;
  const currentSurfaceValue = ensureNumberOrNull(cycleForm.superficie_coinvolta);
  const surfaceExceeded = Boolean(
    currentSurfaceValue !== null
      && terrenoSurfaceInfo?.surfaceInCurrentUnit !== null
      && terrenoSurfaceInfo?.surfaceInCurrentUnit !== undefined
      && currentSurfaceValue > terrenoSurfaceInfo.surfaceInCurrentUnit + 1e-6,
  );
  const remainingSurface =
    terrenoSurfaceInfo?.surfaceInCurrentUnit !== null
      && terrenoSurfaceInfo?.surfaceInCurrentUnit !== undefined
      ? Math.max(
          terrenoSurfaceInfo.surfaceInCurrentUnit
            - (currentSurfaceValue !== null
              ? Math.min(currentSurfaceValue, terrenoSurfaceInfo.surfaceInCurrentUnit)
              : 0),
          0,
        )
      : null;

  return (
    <div className="alimentazione-section">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Gestione cicli colturali</h3>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <SearchableSelect
            options={terrenoOptions}
            displayField="label"
            valueField="value"
            value={selectedTerrenoId ? String(selectedTerrenoId) : ''}
            onChange={(event) => {
              const value = event.target.value;
              const terrenoId = value ? Number(value) : null;
              if (terrenoId) {
                setSelectedTerrenoId(terrenoId);
                if (onTerrenoChange) {
                  onTerrenoChange(terrenoId);
                }
              } else if (terreni.length > 0) {
                // Se viene deselezionato ma ci sono terreni, seleziona il primo
                const firstTerrenoId = terreni[0].id;
                setSelectedTerrenoId(firstTerrenoId);
                if (onTerrenoChange) {
                  onTerrenoChange(firstTerrenoId);
                }
              } else {
                setSelectedTerrenoId(null);
                if (onTerrenoChange) {
                  onTerrenoChange(null);
                }
              }
            }}
            placeholder="Seleziona un terreno..."
            showSelectedInInput={true}
          />
          <button
            className="btn-primary"
            onClick={openNewCycle}
            disabled={!selectedTerrenoId || !aziendaId}
          >
            Nuovo ciclo
          </button>
        </div>
      </div>

      <section className="section-block">
        {loadingCicli ? (
          <div className="loading">Caricamento cicli...</div>
        ) : !(cicli && cicli.length) ? (
          <p className="form-hint">
            Nessun ciclo registrato per il terreno selezionato. Crea un nuovo ciclo per monitorare
            fasi, costi e rese associate.
          </p>
        ) : (
          <div className="cicli-grid">
            {[...cicli].sort((a, b) => {
              // Ordina per data decrescente (più recenti in cima)
              const dateA = a.data_inizio ? new Date(a.data_inizio) : (a.created_at ? new Date(a.created_at) : new Date(0));
              const dateB = b.data_inizio ? new Date(b.data_inizio) : (b.created_at ? new Date(b.created_at) : new Date(0));
              return dateB - dateA; // Decrescente
            }).map((cycle) => {
              return (
                <div
                  key={cycle.id}
                  className="ciclo-card"
                >
                  <div className="ciclo-card__header">
                    <div className="ciclo-card__title">
                      <h4>{cycle.coltura}</h4>
                      <div className="ciclo-card__title-meta">
                        {cycle.anno ? <span className="ciclo-card__badge">{cycle.anno}</span> : null}
                        {(cycle.data_inizio || cycle.data_fine) && (
                          <span className="ciclo-card__dates">
                            {cycle.data_inizio ? formatDate(cycle.data_inizio) : 'N/D'} →{' '}
                            {cycle.data_fine ? formatDate(cycle.data_fine) : 'N/D'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ciclo-card__actions">
                      <button
                        className="btn-icon"
                        title="Modifica ciclo"
                        onClick={(event) => {
                          event.stopPropagation();
                          openEditCycle(cycle);
                        }}
                      >
                        ✏️
                      </button>
                      <button
                        className="btn-icon"
                        title="Elimina ciclo"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleDeleteCycle(cycle.id);
                        }}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                  <div className="ciclo-card__body">
                    <div className="ciclo-card__fasi-section">
                      <div className="ciclo-card__fasi-info">
                        <span>Fasi concluse</span>
                        <strong>
                          {cycle.fasi_concluse}/{cycle.fasi_totali}
                        </strong>
                      </div>
                      <button
                        className="btn-secondary btn-small"
                        title="Gestisci fasi"
                        onClick={(event) => {
                          event.stopPropagation();
                          openFasiModal(cycle);
                        }}
                      >
                        Gestisci fasi
                      </button>
                    </div>
                    <div className="ciclo-card__stats">
                      <div className="ciclo-card__stat">
                        <span>Superficie</span>
                        <strong>
                          {cycle.superficie_coinvolta !== null && cycle.superficie_coinvolta !== undefined
                            ? `${formatSurfaceValue(
                                convertSurfaceValue(
                                  cycle.superficie_coinvolta,
                                  'ha',
                                  defaultSurfaceUnit,
                                ),
                              )} ${summarySurfaceUnitDef.shortLabel}`
                            : 'N/D'}
                        </strong>
                      </div>
                      <div className="ciclo-card__stat">
                        <span>Costi totali</span>
                        <strong>{formatMoney(cycle.totale_costi)}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>


      <BaseModal
        isOpen={showCycleModal}
        onClose={() => setShowCycleModal(false)}
        title={editingCycleId ? 'Modifica ciclo' : 'Nuovo ciclo'}
        size="large"
        footerActions={
          <>
              <button className="btn-secondary" onClick={() => setShowCycleModal(false)}>Annulla</button>
              <button className="btn-primary" onClick={handleSaveCycle} disabled={savingCycle || surfaceExceeded}>
                {savingCycle ? 'Salvataggio...' : 'Salva'}
              </button>
          </>
        }
      >
        {renderCycleForm({
          cycleForm,
          setCycleForm,
          normalizedSurfaceUnit,
          handleSurfaceUnitChange,
          SURFACE_UNIT_OPTIONS,
          terrenoSurfaceInfo,
          surfaceUnitDef,
          currentSurfaceValue,
          surfaceExceeded,
          remainingSurface,
          formatSurfaceValue,
        })}
      </BaseModal>

      {/* Modale Gestione Fasi */}
      <BaseModal
        isOpen={showFasiModal}
        onClose={() => {
          setShowFasiModal(false);
          setSelectedCicloForFasi(null);
          setCicloDetailForFasi(null);
        }}
        title={selectedCicloForFasi ? `Gestione fasi - ${selectedCicloForFasi.coltura}` : 'Gestione fasi'}
        size="large"
        footerActions={
          <button className="btn-secondary" onClick={() => {
            setShowFasiModal(false);
            setSelectedCicloForFasi(null);
            setCicloDetailForFasi(null);
          }}>
            Chiudi
          </button>
        }
      >
        {loadingFasi ? (
          <div className="loading">Caricamento fasi...</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h4>Fasi del ciclo</h4>
              <button
                className="btn-primary"
                onClick={() => openPhaseModal(null)}
              >
                Aggiungi fase
              </button>
            </div>
            {cicloDetailForFasi?.fasi && cicloDetailForFasi.fasi.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Ordine</th>
                      <th>Nome</th>
                      <th>Tipo</th>
                      <th>Periodo</th>
                      <th>Fatture</th>
                      <th>Costo totale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...cicloDetailForFasi.fasi].sort((a, b) => {
                      // Ordina per ordine se disponibile, altrimenti per data_inizio
                      if (a.ordine !== null && b.ordine !== null) {
                        return a.ordine - b.ordine;
                      }
                      if (a.ordine !== null) return -1;
                      if (b.ordine !== null) return 1;
                      const dateA = a.data_inizio ? new Date(a.data_inizio) : new Date(0);
                      const dateB = b.data_inizio ? new Date(b.data_inizio) : new Date(0);
                      return dateA - dateB;
                    }).map((fase) => {
                      const fattureFase = (cicloDetailForFasi.costi || []).filter(
                        c => c.fase_id === fase.id && c.source_type === 'fattura'
                      );
                      const totaleFatture = fattureFase.reduce((sum, c) => sum + (c.importo_risolto ?? c.importo ?? 0), 0);
                      return (
                        <tr 
                          key={fase.id}
                          onClick={() => openPhaseModal(fase)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>{fase.ordine !== null ? fase.ordine : '-'}</td>
                          <td><strong>{fase.nome}</strong></td>
                          <td>{PHASE_OPTIONS.find((opt) => opt.value === fase.tipo)?.label || fase.tipo}</td>
                          <td>
                            {fase.data_inizio ? formatDate(fase.data_inizio) : 'N/D'} →{' '}
                            {fase.data_fine ? formatDate(fase.data_fine) : 'N/D'}
                          </td>
                          <td>{fattureFase.length}</td>
                          <td><strong>{formatMoney(totaleFatture)}</strong></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="form-hint">Nessuna fase registrata per questo ciclo. Aggiungi una fase per iniziare.</p>
            )}
          </>
        )}
      </BaseModal>

      <BaseModal
        isOpen={showPhaseModal}
        onClose={() => {
          setShowPhaseModal(false);
          setFattureFaseInModal([]);
          setFaseAddingFatturaInModal(false);
          setSelectedFatturaToAddInModal('');
        }}
        title={editingPhaseId ? 'Modifica fase' : 'Nuova fase'}
        size="large"
        headerActions={
          editingPhaseId ? (
            <button
              className="btn-danger"
              title="Elimina fase"
              onClick={(e) => {
                e.stopPropagation();
                handleDeletePhase(editingPhaseId);
              }}
            >
              Elimina
            </button>
          ) : null
        }
        footerActions={
          <>
              <button className="btn-secondary" onClick={() => {
                // Se la fase è già stata salvata (editingPhaseId esiste), non resettare tutto
                if (!editingPhaseId) {
                  // Se stiamo creando una nuova fase e non è ancora stata salvata, resetta tutto
                  setPhaseForm(emptyPhaseForm());
                  setEditingPhaseId(null);
                }
                setShowPhaseModal(false);
                setFattureFaseInModal([]);
                setFaseAddingFatturaInModal(false);
                setSelectedFatturaToAddInModal('');
              }}>Annulla</button>
              <button className="btn-primary" onClick={() => handleSavePhase(false)} disabled={savingPhase}>
                {savingPhase ? 'Salvataggio...' : 'Salva'}
              </button>
              <button className="btn-primary" onClick={() => handleSavePhase(true)} disabled={savingPhase}>
                {savingPhase ? 'Salvataggio...' : 'Salva e chiudi'}
              </button>
          </>
        }
      >
        {renderPhaseForm({
          phaseForm,
          setPhaseForm,
          PHASE_OPTIONS,
        })}
        
        {/* Sezione gestione fatture - appare sempre nella modale */}
        <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #e0e0e0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h4 style={{ margin: 0 }}>Fatture collegate</h4>
          </div>
          
          {/* Lista fatture collegate - solo se la fase esiste già */}
          {editingPhaseId && fattureFaseInModal.length > 0 && (
              <div style={{ marginBottom: '15px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {fattureFaseInModal.map((costo) => (
                  <div key={costo.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: '#f9f9f9', borderRadius: '4px' }}>
                    <div>
                      <span style={{ fontWeight: '500' }}>
                        {costo.fattura?.numero || costo.fattura_amministrazione_id || 'N/D'}
                      </span>
                      {' · '}
                      <span style={{ color: '#666', fontSize: '13px' }}>
                        {costo.fattura?.data_fattura ? formatDate(costo.fattura.data_fattura) : '-'}
                      </span>
                      {' · '}
                      <span style={{ fontWeight: '600' }}>
                        {formatMoney(costo.importo_risolto ?? costo.importo ?? costo.fattura?.importo_netto ?? costo.fattura?.importo_totale ?? 0)}
                      </span>
                    </div>
                    <button
                      className="btn-icon"
                      title="Rimuovi fattura"
                      onClick={async () => {
                        if (!window.confirm('Rimuovere questa fattura dalla fase?')) return;
                        try {
                          await terreniService.deleteCicloCosto(costo.id);
                          notify('Fattura rimossa dalla fase');
                          // Ricarica le fatture
                          const cicloDetail = await terreniService.getCiclo(selectedCicloForFasi.id);
                          const costiFase = (cicloDetail.costi || []).filter(c => c.fase_id === editingPhaseId && c.source_type === 'fattura');
                          setFattureFaseInModal(costiFase);
                          await refreshFasiModal();
                          await loadCicli(selectedTerrenoId);
                        } catch (error) {
                          notify(error.message || 'Errore durante la rimozione della fattura', 'error');
                        }
                      }}
                      style={{ fontSize: '14px' }}
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Aggiungi fattura - solo se la fase esiste già */}
            {editingPhaseId && (
              <>
                {!faseAddingFatturaInModal ? (
                  <button
                    className="btn-secondary"
                    onClick={async () => {
                      await loadSupportData();
                      setFaseAddingFatturaInModal(true);
                      setSelectedFatturaToAddInModal('');
                      setFatturaSelezionataDettagli(null);
                      setRigheFatturaSelezionate([]);
                    }}
                    style={{ width: '100%' }}
                  >
                    Aggiungi fattura
                  </button>
                ) : (
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexDirection: 'column', width: '100%' }}>
                <SmartSelect
                  options={[
                    { value: '', label: 'Seleziona fattura' },
                    ...(fatture || [])
                      .filter(f => {
                        // Filtra solo fatture con macrocategoria "terreno"
                        const hasMacrocategoriaTerreno = f.macrocategoria === 'terreno';
                        // Filtra le fatture già collegate a questa fase
                        const isAlreadyLinked = (fattureFaseInModal || []).some(
                          cf => Number(cf.fattura_amministrazione_id) === Number(f.id)
                        );
                        return hasMacrocategoriaTerreno && !isAlreadyLinked;
                      })
                      .map(f => ({
                        value: String(f.id),
                        label: `${f.numero || 'S/N'} · ${formatDate(f.data_fattura || f.data)} · ${formatMoney(f.importo_netto || f.importo_totale)}`,
                      })),
                  ]}
                  displayField="label"
                  valueField="value"
                  value={selectedFatturaToAddInModal}
                  onChange={async (e) => {
                    setSelectedFatturaToAddInModal(e.target.value);
                    if (e.target.value) {
                      await loadFatturaDettagli(e.target.value);
                    } else {
                      setFatturaSelezionataDettagli(null);
                      setRigheFatturaSelezionate([]);
                    }
                  }}
                  placeholder="Cerca fattura con macrocategoria terreni..."
                  style={{ flex: 1, width: '100%' }}
                />
                {(!fatture || fatture.length === 0) && (
                  <p className="form-hint" style={{ marginTop: '5px', fontSize: '12px', color: '#999' }}>
                    Nessuna fattura disponibile. Caricamento in corso...
                  </p>
                )}
                {fatture && fatture.length > 0 && fatture.filter(f => f.macrocategoria === 'terreno' && !(fattureFaseInModal || []).some(cf => Number(cf.fattura_amministrazione_id) === Number(f.id))).length === 0 && (
                  <p className="form-hint" style={{ marginTop: '5px', fontSize: '12px', color: '#999' }}>
                    Nessuna fattura con macrocategoria "terreno" disponibile. Assicurati che le fatture abbiano la macrocategoria "terreno" impostata.
                  </p>
                )}
                
                {/* Mostra le righe della fattura selezionata */}
                {selectedFatturaToAddInModal && (
                  <div style={{ width: '100%', marginTop: '16px' }}>
                    {loadingFatturaDettagli ? (
                      <p className="form-hint" style={{ fontSize: '12px', color: '#999' }}>
                        Caricamento righe fattura...
                      </p>
                    ) : fatturaSelezionataDettagli && fatturaSelezionataDettagli.linee && fatturaSelezionataDettagli.linee.length > 0 ? (
                      <div style={{ border: '1px solid #e0e0e0', borderRadius: '6px', padding: '12px', maxHeight: '300px', overflowY: 'auto' }}>
                        <p style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600' }}>
                          Seleziona le righe da collegare:
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {fatturaSelezionataDettagli.linee.map((linea, index) => {
                            const lineaId = linea.id || `linea-${index}`;
                            const isSelected = righeFatturaSelezionate.some(r => (r.id || `linea-${r.index}`) === lineaId);
                            
                            // Usa la funzione helper per calcolare il prezzo totale
                            const prezzoTotale = calcolaPrezzoTotaleRiga(linea);
                            
                            return (
                              <label
                                key={lineaId}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  padding: '10px',
                                  border: isSelected ? '2px solid #3b82f6' : '1px solid #e0e0e0',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  backgroundColor: isSelected ? '#eff6ff' : '#fff',
                                  transition: 'all 0.2s',
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setRigheFatturaSelezionate([...righeFatturaSelezionate, { ...linea, index }]);
                                    } else {
                                      setRigheFatturaSelezionate(righeFatturaSelezionate.filter(r => (r.id || `linea-${r.index}`) !== lineaId));
                                    }
                                  }}
                                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                                />
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>
                                    {linea.descrizione || `Riga ${linea.numero_linea || index + 1}`}
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#666', display: 'flex', gap: '12px' }}>
                                    {linea.quantita && (
                                      <span>Qty: {parseFloat(linea.quantita || 0).toFixed(2)} {linea.unita_misura || ''}</span>
                                    )}
                                    {prezzoTotale && prezzoTotale > 0 && (
                                      <span style={{ fontWeight: '600', color: '#059669' }}>
                                        {formatMoney(prezzoTotale)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                        <p style={{ margin: '12px 0 0 0', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                          Totale selezionato: {formatMoney(righeFatturaSelezionate.reduce((sum, r) => {
                            const prezzo = calcolaPrezzoTotaleRiga(r) || 0;
                            return sum + prezzo;
                          }, 0))}
                        </p>
                      </div>
                    ) : fatturaSelezionataDettagli ? (
                      <p className="form-hint" style={{ fontSize: '12px', color: '#999' }}>
                        Questa fattura non ha righe di dettaglio. Verrà collegata l'intera fattura.
                      </p>
                    ) : null}
                  </div>
                )}
                
                <button
                  className="btn-primary"
                  onClick={async () => {
                    if (selectedFatturaToAddInModal && editingPhaseId && selectedCicloForFasi) {
                      try {
                        const fatturaId = Number(selectedFatturaToAddInModal);
                        
                        // Recupera azienda_id dal ciclo (necessario per il database locale)
                        const cicloDetailForAzienda = cicloDetailForFasi || await terreniService.getCiclo(selectedCicloForFasi.id);
                        const aziendaId = cicloDetailForAzienda.azienda_id || selectedCicloForFasi.azienda_id;
                        
                        if (!aziendaId) {
                          notify('Errore: azienda_id non trovato nel ciclo', 'error');
                          return;
                        }
                        
                        // Se ci sono righe selezionate, crea un costo per ogni riga
                        if (righeFatturaSelezionate.length > 0) {
                          const righeConImporto = [];
                          const righeSenzaImporto = [];
                          
                          for (const riga of righeFatturaSelezionate) {
                            // Usa la funzione helper per calcolare il prezzo totale
                            const prezzoTotale = calcolaPrezzoTotaleRiga(riga);
                            
                            if (!prezzoTotale || prezzoTotale <= 0) {
                              const rigaNormalizzata = normalizeRigaFattura(riga);
                              const descrizioneRiga = rigaNormalizzata.descrizione || `Riga ${rigaNormalizzata.numero_linea || ''}`;
                              righeSenzaImporto.push(descrizioneRiga);
                              continue;
                            }
                            
                            const rigaNormalizzata = normalizeRigaFattura(riga);
                            const descrizioneRiga = rigaNormalizzata.descrizione || `Riga ${rigaNormalizzata.numero_linea || ''}`;
                            
                            // Formatta la data se presente
                            let dataFattura = null;
                            if (fatturaSelezionataDettagli.data_fattura) {
                              const data = new Date(fatturaSelezionataDettagli.data_fattura);
                              if (!isNaN(data.getTime())) {
                                dataFattura = data.toISOString().split('T')[0];
                              }
                            }
                            
                            const payload = {
                              azienda_id: Number(aziendaId),
                              terreno_id: Number(selectedTerrenoId),
                              source_type: 'fattura',
                              descrizione: `${descrizioneRiga} - Fattura ${fatturaSelezionataDettagli.numero || 'S/N'}`,
                              data: dataFattura,
                              importo: prezzoTotale, // Sempre un numero > 0 a questo punto
                              fase_id: Number(editingPhaseId),
                              fattura_amministrazione_id: fatturaId,
                              lavorazione_id: null,
                              note: null,
                            };
                            
                            righeConImporto.push(payload);
                          }
                          
                          // Mostra warning se ci sono righe senza importo
                          if (righeSenzaImporto.length > 0) {
                            notify(
                              `Attenzione: ${righeSenzaImporto.length} riga/e senza importo valido sono state escluse: ${righeSenzaImporto.join(', ')}`,
                              'warning'
                            );
                          }
                          
                          // Salva solo le righe con importo valido
                          if (righeConImporto.length > 0) {
                            for (const payload of righeConImporto) {
                              await terreniService.createCicloCosto(selectedCicloForFasi.id, payload);
                            }
                            notify(`${righeConImporto.length} riga/e collegata/e alla fase`);
                          } else {
                            notify('Nessuna riga con importo valido da collegare', 'error');
                            return;
                          }
                        } else {
                          // Se non ci sono righe selezionate, collega l'intera fattura (comportamento originale)
                          const payload = {
                            azienda_id: Number(aziendaId),
                            terreno_id: Number(selectedTerrenoId),
                            source_type: 'fattura',
                            descrizione: `Fattura collegata a fase ${phaseForm.nome}`,
                            data: null,
                            importo: null,
                            fase_id: Number(editingPhaseId),
                            fattura_amministrazione_id: fatturaId,
                            lavorazione_id: null,
                            note: null,
                          };
                          await terreniService.createCicloCosto(selectedCicloForFasi.id, payload);
                          notify('Fattura collegata alla fase');
                        }
                        
                        // Ricarica le fatture
                        const cicloDetail = await terreniService.getCiclo(selectedCicloForFasi.id);
                        const costiFase = (cicloDetail.costi || []).filter(c => c.fase_id === editingPhaseId && c.source_type === 'fattura');
                        
                        setFattureFaseInModal(costiFase);
                        setFaseAddingFatturaInModal(false);
                        setSelectedFatturaToAddInModal('');
                        setFatturaSelezionataDettagli(null);
                        setRigheFatturaSelezionate([]);
                        await refreshFasiModal();
                        await loadCicli(selectedTerrenoId);
                      } catch (error) {
                        notify(error.message || 'Errore durante il collegamento della fattura', 'error');
                      }
                    }
                  }}
                  disabled={!selectedFatturaToAddInModal}
                >
                  {righeFatturaSelezionate.length > 0 ? `Collega ${righeFatturaSelezionate.length} riga/e` : 'Collega fattura'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setFaseAddingFatturaInModal(false);
                    setSelectedFatturaToAddInModal('');
                    setFatturaSelezionataDettagli(null);
                    setRigheFatturaSelezionate([]);
                  }}
                >
                  Annulla
                  </button>
                </div>
                )}
              </>
            )}
            {!editingPhaseId && (
              <p className="form-hint" style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
                Salva la fase per poter aggiungere fatture collegate.
              </p>
            )}
          </div>
      </BaseModal>


    </div>
  );
};

export default CostiCicliPanel;

