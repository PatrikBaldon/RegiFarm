/**
 * SincronizzazioneAnagrafe - Upload file anagrafe e gestione partite animali
 */
import React, { useState, useEffect, useMemo } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import PartiteAnagrafeModal from './PartiteAnagrafeModal';
import DettaglioPartitaModal from './DettaglioPartitaModal';
import '../../alimentazione/components/Alimentazione.css';
import './SincronizzazioneAnagrafe.css';
import { useAzienda } from '../../../context/AziendaContext';
import { useCodiciStallaGestiti } from '../../../hooks/useCodiciStallaGestiti';
import { allevamentoService } from '../../allevamento/services/allevamentoService';

const MODALITA_GESTIONE_OPTIONS = [
  { value: 'proprieta', label: 'Proprietà' },
  { value: 'soccida_monetizzata', label: 'Soccida monetizzata' },
  { value: 'soccida_fatturata', label: 'Soccida fatturata' },
];

const SESSO_OPTIONS = [
  { value: '', label: 'Non specificato' },
  { value: 'M', label: 'Maschio' },
  { value: 'F', label: 'Femmina' },
];

// Codici motivo BDN (Banca Dati Nazionale) - codici letterali/numerici usati nei file Excel
// Basati sui valori effettivamente presenti nei file scaricati dall'anagrafe BDN
const CODICI_MOTIVO_INGRESSO = {
  'A': 'Acquisto',
  'N': 'Nascita',
  'T': 'Trasferimento',
  'I': 'Importazione',
  'R': 'Rientro',
};

const CODICI_MOTIVO_USCITA = {
  'V': 'Vendita',  // Usato nel backend per impostare stato 'venduto'
  'M': 'Macellazione',  // Usato nel backend per impostare stato 'macellato' (nota: nei file Excel può essere anche 'K')
  'D': 'Decesso',  // Usato nel backend per decessi (MOTIVO_USCITA = 'D')
  '02': 'Morte/Decesso',  // Codice numerico recente per decessi (MOTIVO_USCITA = '02')
  'K': 'Macellazione',  // Alternativa comune nei file Excel
  'T': 'Trasferimento',
  'E': 'Esportazione',
  'F': 'Fiera',
};

const CODICI_MOTIVO = { ...CODICI_MOTIVO_INGRESSO, ...CODICI_MOTIVO_USCITA };

const MODALITA_GESTIONE_LABELS = MODALITA_GESTIONE_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {}
);

const SincronizzazioneAnagrafe = () => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  const [partite, setPartite] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [filterSearch, setFilterSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [showModalPartite, setShowModalPartite] = useState(false);
  const [partiteIdentificate, setPartiteIdentificate] = useState(null);
  const [showModalPartita, setShowModalPartita] = useState(false);
  const [showModalDecesso, setShowModalDecesso] = useState(false);
  const [selectedPartitaId, setSelectedPartitaId] = useState(null);
  const [tipoPartita, setTipoPartita] = useState('ingresso');
  const [formDataPartita, setFormDataPartita] = useState({
    azienda_id: null,
    tipo: 'ingresso',
    data: new Date().toISOString().split('T')[0],
    numero_partita: '',
    codice_stalla: '',
    nome_stalla: '',
    codice_stalla_azienda: '',
    numero_capi: '',
    peso_totale: '',
    peso_medio: '',
    modalita_gestione: 'proprieta',
    costo_unitario: '',
    valore_totale: '',
    fattura_amministrazione_id: '',
    fattura_emessa_id: '',
    motivo: '',
    numero_modello: '',
    is_trasferimento_interno: false,
    note: '',
  });
  const [animaliManuali, setAnimaliManuali] = useState([]);
  const [pesoMode, setPesoMode] = useState('per_capo'); // 'per_capo' | 'totale'
  const [autoCalcolaPeso, setAutoCalcolaPeso] = useState(true);
  const [fattureAcquisto, setFattureAcquisto] = useState([]);
  const [fattureVendita, setFattureVendita] = useState([]);
  const [formDataDecesso, setFormDataDecesso] = useState({
    azienda_id: null,
    data_uscita: new Date().toISOString().split('T')[0],
    numero_certificato_smaltimento: '',
    fattura_smaltimento_id: '',
    valore_economico_totale: '',
    a_carico: true,
    note: '',
  });
  const [animaliDecesso, setAnimaliDecesso] = useState([{ auricolare: '', valore: '', note: '', a_carico: true }]);
  const [showBovinoForm, setShowBovinoForm] = useState(false);
  const [editingBovinoIndex, setEditingBovinoIndex] = useState(null);
  const [bovinoDraft, setBovinoDraft] = useState(null);
  const [showDecessiModal, setShowDecessiModal] = useState(false);
  const [showTipoMovimentoModal, setShowTipoMovimentoModal] = useState(false);
  const [showTrasferimentoModal, setShowTrasferimentoModal] = useState(false);
  const [trasferimentoAnimali, setTrasferimentoAnimali] = useState([]);
  const [trasferimentoPesoMode, setTrasferimentoPesoMode] = useState('per_capo');
  const [trasferimentoAutoCalcolaPeso, setTrasferimentoAutoCalcolaPeso] = useState(true);
  const [trasferimentoData, setTrasferimentoData] = useState({
    data: new Date().toISOString().split('T')[0],
    sede_origine_id: '',
    sede_destinazione_id: '',
    codice_stalla_origine: '',
    codice_stalla_destinazione: '',
    numero_partita: '',
    numero_modello: '',
    numero_capi: '',
    peso_totale: '',
    peso_medio: '',
    note: '',
  });
  const [showSelezionaCapiModal, setShowSelezionaCapiModal] = useState(false);
  const [showSelezionaCapiTrasferimento, setShowSelezionaCapiTrasferimento] = useState(false);
  const [animaliDisponibili, setAnimaliDisponibili] = useState([]);
  const [loadingAnimaliDisponibili, setLoadingAnimaliDisponibili] = useState(false);
  const [filtroSedeSelezione, setFiltroSedeSelezione] = useState('');

  const numeroAnimaliInseriti = useMemo(
    () => animaliManuali.filter((animale) => animale.auricolare && animale.auricolare.trim() !== '').length,
    [animaliManuali]
  );
  const numeroDecessiInseriti = useMemo(
    () => animaliDecesso.filter((capo) => capo.auricolare && capo.auricolare.trim() !== '').length,
    [animaliDecesso]
  );

  const { codiciStalla, sedi, codiceDefaultIngresso, codiceDefaultUscita } = useCodiciStallaGestiti(aziendaId);

  const getSedeIdByCodice = (codice) => {
    if (!codice || !sedi) return null;
    const sede = sedi.find((s) => s.codice_stalla === codice);
    return sede ? sede.id : null;
  };

  const codiciStallaOptions = useMemo(
    () =>
      (codiciStalla || []).map((codice) => {
        const sede = (sedi || []).find((s) => s.codice_stalla === codice);
        const label = sede?.nome ? `${sede.nome} (${codice})` : codice;
        return { value: codice, label };
      }),
    [codiciStalla, sedi]
  );

  const sediOptions = useMemo(
    () =>
      (sedi || []).map((sede) => ({
        value: String(sede.id),
        label: sede.nome ? `${sede.nome} (${sede.codice_stalla || ''})` : sede.codice_stalla || `Sede #${sede.id}`,
      })),
    [sedi]
  );

  const codiceStallaOptionsWithCurrent = useMemo(() => {
    const opts = [...codiciStallaOptions];
    if (formDataPartita.codice_stalla && !opts.find((o) => o.value === formDataPartita.codice_stalla)) {
      opts.unshift({ value: formDataPartita.codice_stalla, label: formDataPartita.codice_stalla });
    }
    return opts;
  }, [codiciStallaOptions, formDataPartita.codice_stalla]);

  const codiceStallaAziendaOptionsWithCurrent = useMemo(() => {
    const opts = [...codiciStallaOptions];
    if (formDataPartita.codice_stalla_azienda && !opts.find((o) => o.value === formDataPartita.codice_stalla_azienda)) {
      opts.unshift({ value: formDataPartita.codice_stalla_azienda, label: formDataPartita.codice_stalla_azienda });
    }
    return opts;
  }, [codiciStallaOptions, formDataPartita.codice_stalla_azienda]);

  const fattureAcquistoOptions = useMemo(() => [
    { value: '', label: 'Nessuna' },
    ...fattureAcquisto.map((fattura) => {
      const numero = fattura.numero || `Fattura #${fattura.id}`;
      const descrizione =
        fattura.fornitore_nome || fattura.denominazione || fattura.intestatario || '';
      return {
        value: String(fattura.id),
        label: descrizione ? `${numero} · ${descrizione}` : numero,
      };
    }),
  ], [fattureAcquisto]);

  const fattureVenditaOptions = useMemo(() => [
    { value: '', label: 'Nessuna' },
    ...fattureVendita.map((fattura) => {
      const numero = fattura.numero || `Fattura #${fattura.id}`;
      const descrizione =
        fattura.cliente_nome || fattura.denominazione || fattura.intestatario || '';
      return {
        value: String(fattura.id),
        label: descrizione ? `${numero} · ${descrizione}` : numero,
      };
    }),
  ], [fattureVendita]);

  // Filtra le partite in base al termine di ricerca e ordina per data (dal più recente al meno recente)
  const partiteFiltrate = useMemo(() => {
    let list;
    if (!filterSearch.trim()) {
      list = partite;
    } else {
      const searchTerm = filterSearch.toLowerCase();
      list = partite.filter((partita) => {
        const dataStr = new Date(partita.data).toLocaleDateString('it-IT').toLowerCase();
        const codiceStalla = (partita.codice_stalla || '').toLowerCase();
        const numeroPartita = (partita.numero_partita || '').toLowerCase();
        const tipo = (partita.tipo === 'ingresso' ? 'ingresso' : 'uscita').toLowerCase();
        return (
          dataStr.includes(searchTerm) ||
          codiceStalla.includes(searchTerm) ||
          numeroPartita.includes(searchTerm) ||
          tipo.includes(searchTerm) ||
          String(partita.numero_capi || '').includes(searchTerm)
        );
      });
    }
    return [...list].sort((a, b) => {
      const dateA = new Date(a.data || 0).getTime();
      const dateB = new Date(b.data || 0).getTime();
      return dateB - dateA; // dal più recente al meno recente
    });
  }, [partite, filterSearch]);

  // Reset pagina quando cambia il filtro di ricerca
  useEffect(() => {
    setCurrentPage(1);
  }, [filterSearch]);

  // Calcola le partite paginate
  const totalPages = Math.ceil(partiteFiltrate.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const partitePaginate = partiteFiltrate.slice(startIndex, endIndex);

  // Funzioni per la paginazione
  const goToPage = (page) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      goToPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      goToPage(currentPage + 1);
    }
  };

  useEffect(() => {
    if (pesoMode !== 'per_capo' || !autoCalcolaPeso) {
      return;
    }
    const totals = animaliManuali.reduce(
      (acc, animale) => {
        if (animale.peso && !Number.isNaN(parseFloat(animale.peso))) {
          acc.totale += parseFloat(animale.peso);
          acc.count += 1;
        }
        return acc;
      },
      { totale: 0, count: 0 }
    );

    setFormDataPartita((prev) => {
      const nuovoPesoTotale = totals.count > 0 ? totals.totale.toFixed(2) : '';
      const nuovoPesoMedio =
        totals.count > 0 && totals.totale > 0 ? (totals.totale / totals.count).toFixed(2) : '';

      if (prev.peso_totale === nuovoPesoTotale && prev.peso_medio === nuovoPesoMedio) {
        return prev;
      }

      return {
        ...prev,
        peso_totale: nuovoPesoTotale,
        peso_medio: nuovoPesoMedio,
      };
    });
  }, [animaliManuali, autoCalcolaPeso, pesoMode]);

  useEffect(() => {
    if (trasferimentoPesoMode !== 'per_capo' || !trasferimentoAutoCalcolaPeso) {
      return;
    }
    const totals = trasferimentoAnimali.reduce(
      (acc, animale) => {
        if (animale.peso && !Number.isNaN(parseFloat(animale.peso))) {
          acc.totale += parseFloat(animale.peso);
          acc.count += 1;
        }
        return acc;
      },
      { totale: 0, count: 0 }
    );

    setTrasferimentoData((prev) => {
      const nuovoPesoTotale = totals.count > 0 ? totals.totale.toFixed(2) : '';
      const nuovoPesoMedio =
        totals.count > 0 && totals.totale > 0 ? (totals.totale / totals.count).toFixed(2) : '';

      if (prev.peso_totale === nuovoPesoTotale && prev.peso_medio === nuovoPesoMedio) {
        return prev;
      }

      return {
        ...prev,
        peso_totale: nuovoPesoTotale,
        peso_medio: nuovoPesoMedio,
      };
    });
  }, [trasferimentoAnimali, trasferimentoAutoCalcolaPeso, trasferimentoPesoMode]);

  useEffect(() => {
    if (!showModalPartita && !showModalDecesso) return;

    const normalizeFatture = (response) => {
      if (!response) return [];
      if (Array.isArray(response)) return response;
      if (Array.isArray(response.items)) return response.items;
      if (Array.isArray(response.results)) return response.results;
      if (Array.isArray(response.data)) return response.data;
      return [];
    };

    const loadFatture = async () => {
      try {
        const currentAziendaId = showModalPartita
          ? (formDataPartita.azienda_id || aziendaId)
          : (formDataDecesso.azienda_id || aziendaId);
        const [acquistoRes, venditaRes] = await Promise.all([
          amministrazioneService.getFatture({ azienda_id: currentAziendaId, limit: 200 }),
          amministrazioneService.getFattureEmesse(currentAziendaId, { limit: 200 }),
        ]);
        setFattureAcquisto(normalizeFatture(acquistoRes));
        setFattureVendita(normalizeFatture(venditaRes));
      } catch (err) {

        setFattureAcquisto([]);
        setFattureVendita([]);
      }
    };

    loadFatture();
  }, [showModalPartita, showModalDecesso, formDataPartita.azienda_id, formDataDecesso.azienda_id]);

  // Aggiorna azienda_id nei form quando cambia l'azienda loggata
  useEffect(() => {
    if (aziendaId) {
      setFormDataPartita(prev => ({ ...prev, azienda_id: aziendaId }));
      setFormDataDecesso(prev => ({ ...prev, azienda_id: aziendaId }));
    }
  }, [aziendaId]);

  useEffect(() => {
    if (aziendaId) {
      loadData(true);
    }
  }, [aziendaId]);

  const loadData = async (forceFromServer = false) => {
    if (!aziendaId) return;
    setLoading(true);
    try {
      const partiteData = await amministrazioneService.getPartite(
        { azienda_id: aziendaId, limit: 1000 },
        forceFromServer ? { forceApi: true } : {}
      );
      setPartite(Array.isArray(partiteData) ? partiteData : []);
    } catch (error) {
      alert('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.gz')) {
      alert('Il file deve essere un file .gz');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const uploadAziendaId = formDataPartita.azienda_id || aziendaId;
      if (!uploadAziendaId) {
        alert('Nessuna azienda selezionata');
        setUploading(false);
        return;
      }
      const response = await amministrazioneService.sincronizzaAnagrafe(file, uploadAziendaId);
      
      // Il metodo api.request restituisce direttamente il JSON parsato, non response.data
      setUploadResult({
        success: true,
        message: response.message || 'File processato correttamente',
        partite_trovate: response.partite_trovate || {
          ingresso: 0,
          uscita: 0
        },
        decessi_trovati: response.decessi_trovati || 0
      });

      // Se ci sono partite o gruppi decessi, mostra il modale per gestirli
      const hasPartite = response.partite && (response.partite.ingresso?.length > 0 || response.partite.uscita?.length > 0);
      const hasGruppiDecessi = (response.gruppi_decessi || response.decessi) && (response.gruppi_decessi?.length > 0 || response.decessi?.length > 0);
      
      if (hasPartite || hasGruppiDecessi) {
        // Aggiungi codice_stalla_azienda a tutte le partite se disponibile
        const codiceStallaAzienda = response.codice_stalla_file || null;
        const partiteIngresso = (response.partite.ingresso || []).map(p => ({
          ...p,
          codice_stalla_azienda: p.codice_stalla_azienda || codiceStallaAzienda,
          modalita_gestione: p.modalita_gestione || 'proprieta',
        }));
        const partiteUscita = (response.partite.uscita || []).map(p => ({
          ...p,
          codice_stalla_azienda: p.codice_stalla_azienda || codiceStallaAzienda,
          modalita_gestione: p.modalita_gestione || 'proprieta',
        }));
        
        // Gestisci gruppi decessi (o decessi per compatibilità)
        const gruppiDecessi = (response.gruppi_decessi || response.decessi || []).map(g => ({
          ...g,
          azienda_id: g.azienda_id || aziendaId,
          // Mantieni compatibilità con vecchio formato
          codici_capi: g.codici_capi || []
        }));
        
        setPartiteIdentificate({
          ingresso: partiteIngresso,
          uscita: partiteUscita,
          gruppi_decessi: gruppiDecessi
        });
        setShowModalPartite(true);
      } else {
        alert('Nessuna partita o decesso trovato nel file');
      }

      // Reset input file
      event.target.value = '';
    } catch (error) {

      // Gestisci diversi formati di errore
      let errorMessage = 'Errore durante il processamento del file';
      let errors = null;
      let partite_dati = null;
      let codiceStallaMancante = null;
      let richiedeCreaSede = false;
      
      // Se l'errore ha un messaggio
      if (error.message) {
        errorMessage = error.message;
        // Messaggio più chiaro per timeout
        if (error.message.includes('Timeout') || error.message.includes('timeout')) {
          errorMessage = 'Timeout: Il processamento del file ha impiegato troppo tempo. Il file potrebbe essere troppo grande o il server potrebbe essere sovraccarico. Prova a:\n\n' +
            '1. Verificare che il file non superi i 20MB\n' +
            '2. Riprovare tra qualche minuto\n' +
            '3. Contattare il supporto se il problema persiste';
        }
      }
      
      // Se l'errore è un oggetto con dettagli
      if (error.detail) {
        errorMessage = error.detail;
        
        // Controlla se richiede la creazione di una sede
        if (error.detail.includes('Codice stalla') && error.detail.includes('non trovato')) {
          richiedeCreaSede = true;
          // Estrai il codice stalla dall'errore o dalle header
          const match = error.detail.match(/Codice stalla '([^']+)'/);
          if (match) {
            codiceStallaMancante = match[1];
          }
        }
      }
      
      // Verifica anche nelle response headers se disponibili
      if (error.response && error.response.headers) {
        const codiceStallaHeader = error.response.headers['x-codice-stalla'];
        const azioneHeader = error.response.headers['x-azione-richiesta'];
        if (codiceStallaHeader && azioneHeader === 'crea_sede') {
          richiedeCreaSede = true;
          codiceStallaMancante = codiceStallaHeader;
        }
      }
      
      if (error.errors) {
        errors = error.errors;
      }
      
      if (error.partite_dati) {
        partite_dati = error.partite_dati;
      }
      
      setUploadResult({
        success: false,
        message: errorMessage,
        errors: errors,
        partite_dati: partite_dati,
        richiedeCreaSede: richiedeCreaSede,
        codiceStallaMancante: codiceStallaMancante
      });
      
      // Se richiede creazione sede, mostra messaggio specifico
      if (richiedeCreaSede && codiceStallaMancante) {
        alert(`Il codice stalla "${codiceStallaMancante}" non è presente nel database.\n\nÈ necessario creare una nuova sede con questo codice stalla prima di procedere con l'import.\n\nVai alla sezione Allevamento > Sedi per creare la sede.`);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitPartita = async (e) => {
    e.preventDefault();
    try {
      const boviniValidi = animaliManuali.filter(
        (animale) => animale.auricolare && animale.auricolare.trim() !== ''
      );
      if (boviniValidi.length === 0) {
        alert('Inserisci almeno un bovino nella partita.');
        return;
      }

      const numeroCapiValueRaw = parseInt(formDataPartita.numero_capi, 10);
      const numeroCapiValue = Number.isNaN(numeroCapiValueRaw) || numeroCapiValueRaw <= 0
        ? boviniValidi.length
        : numeroCapiValueRaw;

      if (numeroCapiValue !== boviniValidi.length) {
        alert(`Sono stati inseriti ${boviniValidi.length} bovini ma il numero capi indicato è ${numeroCapiValue}.`);
        return;
      }

      const pesiValidati = boviniValidi
        .filter((bovino) => bovino.peso && !Number.isNaN(parseFloat(bovino.peso)))
        .map((bovino) => ({
          auricolare: bovino.auricolare.trim(),
          peso: parseFloat(bovino.peso),
        }));

      const pesoTotaleValue = formDataPartita.peso_totale
        ? parseFloat(formDataPartita.peso_totale)
        : null;
      const pesoTotaleDaPesi = pesiValidati.reduce((acc, voce) => acc + voce.peso, 0);
      const pesoMedioValue =
        pesiValidati.length > 0
          ? pesoTotaleDaPesi / pesiValidati.length
          : formDataPartita.peso_medio
            ? parseFloat(formDataPartita.peso_medio)
            : null;

      if (pesoMode === 'totale' && (pesoTotaleValue === null || Number.isNaN(pesoTotaleValue))) {
        alert('Inserisci il peso totale della partita oppure passa alla modalità peso per capo.');
        return;
      }

      if (
        pesoMode === 'per_capo' &&
        !formDataPartita.is_trasferimento_interno &&
        pesiValidati.length === 0 &&
        (pesoTotaleValue === null || Number.isNaN(pesoTotaleValue))
      ) {
        alert('Per i trasferimenti esterni è necessario indicare un peso totale o i pesi individuali.');
        return;
      }

      if (
        pesoMode === 'per_capo' &&
        pesoTotaleValue !== null &&
        !Number.isNaN(pesoTotaleValue) &&
        pesiValidati.length > 0 &&
        Math.abs(pesoTotaleDaPesi - pesoTotaleValue) > 0.01
      ) {
        alert('La somma dei pesi dei capi non coincide con il peso totale inserito.');
        return;
      }

      const costoUnitarioValue = formDataPartita.costo_unitario
        ? parseFloat(formDataPartita.costo_unitario)
        : null;
      const valoreTotaleValue = formDataPartita.valore_totale
        ? parseFloat(formDataPartita.valore_totale)
        : null;

      const animaliDatiMap = {};
      boviniValidi.forEach((bovino) => {
        const key = bovino.auricolare.trim();
        animaliDatiMap[key] = {
          specie: bovino.specie || null,
          sesso: bovino.sesso || null,
          razza: bovino.razza || null,
          codice_madre: bovino.codice_madre || null,
          data_nascita: bovino.data_nascita || null,
          peso: bovino.peso ? parseFloat(bovino.peso) : null,
        };
      });

      const payload = {
        azienda_id: formDataPartita.azienda_id,
        tipo: tipoPartita,
        data: formDataPartita.data,
        codice_stalla: formDataPartita.codice_stalla,
        codice_stalla_azienda: formDataPartita.codice_stalla_azienda || null,
        numero_capi: numeroCapiValue,
        peso_totale:
          pesoTotaleValue !== null && !Number.isNaN(pesoTotaleValue)
            ? pesoTotaleValue
            : pesiValidati.length > 0
              ? pesoTotaleDaPesi
              : null,
        is_trasferimento_interno: Boolean(formDataPartita.is_trasferimento_interno),
        codici_capi: boviniValidi.map((bovino) => bovino.auricolare.trim()),
        motivo: formDataPartita.motivo || null,
        numero_modello: formDataPartita.numero_modello || null,
        file_anagrafe_origine: null,
        animali_dati: Object.keys(animaliDatiMap).length > 0 ? animaliDatiMap : null,
        pesi_individuali: pesiValidati.length > 0 ? pesiValidati : null,
        modalita_gestione: formDataPartita.modalita_gestione || 'proprieta',
        costo_unitario: !Number.isNaN(costoUnitarioValue) ? costoUnitarioValue : null,
        valore_totale: !Number.isNaN(valoreTotaleValue) ? valoreTotaleValue : null,
        peso_medio:
          pesoMedioValue !== null && !Number.isNaN(pesoMedioValue)
            ? parseFloat(pesoMedioValue.toFixed(2))
            : null,
        note: formDataPartita.note || null,
        fattura_amministrazione_id:
          tipoPartita === 'ingresso' && formDataPartita.fattura_amministrazione_id
            ? parseInt(formDataPartita.fattura_amministrazione_id, 10)
            : null,
        fattura_emessa_id:
          tipoPartita === 'uscita' && formDataPartita.fattura_emessa_id
            ? parseInt(formDataPartita.fattura_emessa_id, 10)
            : null,
        numero_partita: formDataPartita.numero_partita || null,
        nome_stalla: formDataPartita.nome_stalla || null,
      };

      await amministrazioneService.confirmPartita(payload);
      setShowModalPartita(false);
      resetFormPartita();
      loadData();
    } catch (error) {

      const message =
        error?.response?.detail ||
        error?.detail ||
        error?.message ||
        'Errore nel salvataggio della partita';
      alert(message);
    }
  };

  const handleSubmitTrasferimento = async (e) => {
    e.preventDefault();
    try {
      const capiValidi = trasferimentoAnimali.filter(
        (animale) => animale.auricolare && animale.auricolare.trim() !== ''
      );
      if (capiValidi.length === 0) {
        alert('Inserisci almeno un bovino per il trasferimento.');
        return;
      }

      const numeroCapiValueRaw = parseInt(trasferimentoData.numero_capi, 10);
      const numeroCapiValue = Number.isNaN(numeroCapiValueRaw) || numeroCapiValueRaw <= 0
        ? capiValidi.length
        : numeroCapiValueRaw;

      if (numeroCapiValue !== capiValidi.length) {
        alert(`Sono stati inseriti ${capiValidi.length} bovini ma il numero capi indicato è ${numeroCapiValue}.`);
        return;
      }

      const pesiValidati = capiValidi
        .filter((bovino) => bovino.peso && !Number.isNaN(parseFloat(bovino.peso)))
        .map((bovino) => ({
          auricolare: bovino.auricolare.trim(),
          peso: parseFloat(bovino.peso),
        }));

      const pesoTotaleValue = trasferimentoData.peso_totale
        ? parseFloat(trasferimentoData.peso_totale)
        : null;
      const pesoTotaleDaPesi = pesiValidati.reduce((acc, voce) => acc + voce.peso, 0);

      if (
        trasferimentoPesoMode === 'totale' &&
        (pesoTotaleValue === null || Number.isNaN(pesoTotaleValue))
      ) {
        alert('Inserisci il peso totale della partita per il trasferimento.');
        return;
      }

      if (
        pesoTotaleValue !== null &&
        !Number.isNaN(pesoTotaleValue) &&
        pesiValidati.length > 0 &&
        Math.abs(pesoTotaleValue - pesoTotaleDaPesi) > 0.01
      ) {
        alert('La somma dei pesi dei capi non coincide con il peso totale inserito.');
        return;
      }

      const animaliDatiMap = {};
      capiValidi.forEach((bovino) => {
        const key = bovino.auricolare.trim();
        animaliDatiMap[key] = {
          sesso: bovino.sesso || null,
          razza: bovino.razza || null,
          data_nascita: bovino.data_nascita || null,
          peso: bovino.peso ? parseFloat(bovino.peso) : null,
          codice_madre: bovino.codice_madre || null,
          specie: bovino.specie || null,
        };
      });

      const sedeOrigine = sedi.find((s) => String(s.id) === String(trasferimentoData.sede_origine_id));
      const sedeDestinazione = sedi.find((s) => String(s.id) === String(trasferimentoData.sede_destinazione_id));

      const codiceStallaOrigine = trasferimentoData.codice_stalla_origine || sedeOrigine?.codice_stalla || '';
      const codiceStallaDestinazione = trasferimentoData.codice_stalla_destinazione || sedeDestinazione?.codice_stalla || '';

      if (!codiceStallaOrigine || !codiceStallaDestinazione) {
        alert('Seleziona codice stalla di origine e destinazione per il trasferimento.');
        return;
      }

      const pesoTotaleFinale =
        pesoTotaleValue !== null && !Number.isNaN(pesoTotaleValue)
          ? pesoTotaleValue
          : pesiValidati.length > 0
            ? pesoTotaleDaPesi
            : null;
      const pesoMedioFinale =
        pesoTotaleFinale && numeroCapiValue > 0
          ? (pesoTotaleFinale / numeroCapiValue).toFixed(2)
          : '';

      const basePayload = {
        azienda_id: formDataPartita.azienda_id || aziendaId,
        data: trasferimentoData.data,
        numero_partita: trasferimentoData.numero_partita || null,
        numero_modello: trasferimentoData.numero_modello || null,
        numero_capi: numeroCapiValue,
        peso_totale: pesoTotaleFinale !== null ? parseFloat(pesoTotaleFinale) : null,
        peso_medio: pesoMedioFinale ? parseFloat(pesoMedioFinale) : null,
        is_trasferimento_interno: true,
        codici_capi: capiValidi.map((bovino) => bovino.auricolare.trim()),
        motivo: 'T',
        file_anagrafe_origine: null,
        animali_dati: Object.keys(animaliDatiMap).length > 0 ? animaliDatiMap : null,
        pesi_individuali: pesiValidati.length > 0 ? pesiValidati : null,
        modalita_gestione: formDataPartita.modalita_gestione || 'proprieta',
        costo_unitario: null,
        valore_totale: null,
        note: trasferimentoData.note || null,
      };

      const payloadUscita = {
        ...basePayload,
        tipo: 'uscita',
        codice_stalla: codiceStallaOrigine,
        codice_stalla_azienda: codiceStallaOrigine,
        nome_stalla: sedeOrigine?.nome || null,
      };

      const payloadIngresso = {
        ...basePayload,
        tipo: 'ingresso',
        codice_stalla: codiceStallaDestinazione,
        codice_stalla_azienda: codiceStallaDestinazione,
        nome_stalla: sedeDestinazione?.nome || null,
      };

      await amministrazioneService.confirmPartita(payloadUscita);
      await amministrazioneService.confirmPartita(payloadIngresso);

      setShowTrasferimentoModal(false);
      setTrasferimentoAnimali([]);
      setTrasferimentoData({
        data: new Date().toISOString().split('T')[0],
        sede_origine_id: '',
        sede_destinazione_id: '',
        codice_stalla_origine: '',
        codice_stalla_destinazione: '',
        numero_partita: '',
        numero_modello: '',
        numero_capi: '',
        peso_totale: '',
        peso_medio: '',
        note: '',
      });
      setTrasferimentoPesoMode('per_capo');
      setTrasferimentoAutoCalcolaPeso(true);
      setFiltroSedeSelezione('');
      loadData();
    } catch (error) {
      const message =
        error?.response?.detail ||
        error?.detail ||
        error?.message ||
        'Errore nel salvataggio del trasferimento';
      alert(message);
    }
  };

  const handleSubmitDecesso = async (e) => {
    e.preventDefault();
    try {
      const capiValidi = animaliDecesso.filter(
        (capo) => capo.auricolare && capo.auricolare.trim() !== ''
      );
      if (capiValidi.length === 0) {
        alert('Inserisci almeno un auricolare per il gruppo decessi.');
        return;
      }

      const animaliDatiMap = {};
      capiValidi.forEach((capo) => {
        const key = capo.auricolare.trim();
        const valore = capo.valore ? parseFloat(capo.valore) : null;
        animaliDatiMap[key] = {
          valore_capo: !Number.isNaN(valore) ? valore : null,
          note: capo.note || null,
          a_carico: capo.a_carico !== undefined ? Boolean(capo.a_carico) : true, // Default a true se non specificato
        };
      });

      const payload = {
        azienda_id: formDataDecesso.azienda_id,
        data_uscita: formDataDecesso.data_uscita,
        numero_certificato_smaltimento: formDataDecesso.numero_certificato_smaltimento || null,
        fattura_smaltimento_id: formDataDecesso.fattura_smaltimento_id
          ? parseInt(formDataDecesso.fattura_smaltimento_id, 10)
          : null,
        valore_economico_totale: formDataDecesso.valore_economico_totale
          ? parseFloat(formDataDecesso.valore_economico_totale)
          : null,
        // a_carico viene gestito per singolo capo tramite animali_dati, ma manteniamo il campo per retrocompatibilità
        // Il backend userà a_carico da animali_dati se presente, altrimenti questo valore
        a_carico: true, // Default, ma ogni capo può avere il proprio valore in animali_dati
        note: formDataDecesso.note || null,
        file_anagrafe_origine: null,
        codici_capi: capiValidi.map((capo) => capo.auricolare.trim()),
        animali_dati: Object.keys(animaliDatiMap).length > 0 ? animaliDatiMap : null,
      };

      await amministrazioneService.confirmGruppoDecessi(payload);
      setShowModalDecesso(false);
      resetFormDecesso();
      loadData();
    } catch (error) {

      const message =
        error?.response?.detail ||
        error?.detail ||
        error?.message ||
        'Errore nel salvataggio del gruppo decessi';
      alert(message);
    }
  };

  const resetFormPartita = () => {
    setFormDataPartita({
      azienda_id: aziendaId,
      tipo: 'ingresso',
      data: new Date().toISOString().split('T')[0],
      numero_partita: '',
      codice_stalla: '',
      nome_stalla: '',
      codice_stalla_azienda: '',
      numero_capi: '',
      peso_totale: '',
      peso_medio: '',
      modalita_gestione: 'proprieta',
      costo_unitario: '',
      valore_totale: '',
      fattura_amministrazione_id: '',
      fattura_emessa_id: '',
      motivo: '',
      numero_modello: '',
      is_trasferimento_interno: false,
      note: '',
    });
    setAnimaliManuali([]);
    setPesoMode('per_capo');
    setAutoCalcolaPeso(true);
    setTipoPartita('ingresso');
    setFattureAcquisto([]);
    setFattureVendita([]);
  };

  const resetFormDecesso = () => {
    setFormDataDecesso({
      azienda_id: aziendaId,
      data_uscita: new Date().toISOString().split('T')[0],
      numero_certificato_smaltimento: '',
      fattura_smaltimento_id: '',
      valore_economico_totale: '',
      a_carico: true,
      note: '',
    });
    setAnimaliDecesso([{ auricolare: '', valore: '', note: '', a_carico: true }]);
  };

  const addAnimaleManuale = () => {
    setAnimaliManuali((prev) => [
      ...prev,
      { auricolare: '', specie: 'bovino', razza: '', sesso: '', codice_madre: '', data_nascita: '', peso: '' },
    ]);
  };

  const removeAnimaleManuale = (index) => {
    setAnimaliManuali((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAnimaleManuale = (index, field, value) => {
    setAnimaliManuali((prev) => {
      const updated = [...prev];
      const nextValue =
        field === 'sesso' && value
          ? value.toUpperCase()
          : value;
      updated[index] = { ...updated[index], [field]: nextValue };
      return updated;
    });
  };

  const openAddBovino = () => {
    setEditingBovinoIndex(null);
    setBovinoDraft({ auricolare: '', specie: 'bovino', razza: '', sesso: '', codice_madre: '', data_nascita: '', peso: '' });
    setShowBovinoForm(true);
  };

  const openEditBovino = (index) => {
    const target = animaliManuali[index];
    setEditingBovinoIndex(index);
    setBovinoDraft(target || { auricolare: '', specie: 'bovino', razza: '', sesso: '', codice_madre: '', data_nascita: '', peso: '' });
    setShowBovinoForm(true);
  };

  const saveBovino = (data) => {
    if (!data?.auricolare) {
      alert('Inserisci il codice capo (auricolare).');
      return;
    }
    setAnimaliManuali((prev) => {
      if (editingBovinoIndex === null || editingBovinoIndex === undefined) {
        return [...prev, data];
      }
      const updated = [...prev];
      updated[editingBovinoIndex] = data;
      return updated;
    });
    setShowBovinoForm(false);
    setEditingBovinoIndex(null);
    setBovinoDraft(null);
  };

  const deleteBovino = (index) => {
    const confirmDelete = window.confirm('Confermi l’eliminazione di questo capo?');
    if (!confirmDelete) return;
    setAnimaliManuali((prev) => prev.filter((_, i) => i !== index));
    setShowBovinoForm(false);
    setEditingBovinoIndex(null);
    setBovinoDraft(null);
  };

  const closeBovinoForm = () => {
    setShowBovinoForm(false);
    setEditingBovinoIndex(null);
    setBovinoDraft(null);
  };

  const loadAnimaliSelezionabili = async (sedeId = null) => {
    if (!aziendaId) return;
    setLoadingAnimaliDisponibili(true);
    try {
      const filters = { azienda_id: aziendaId, stato: 'presente' };
      if (sedeId) {
        filters.sede_id = sedeId;
      }
      const data = await allevamentoService.getAnimali(filters);
      const elenco = Array.isArray(data) ? data : [];
      setAnimaliDisponibili(elenco);
    } catch (err) {
      setAnimaliDisponibili([]);
    } finally {
      setLoadingAnimaliDisponibili(false);
    }
  };

  const openSelezionaCapi = () => {
    const sedeIdFromCodice = getSedeIdByCodice(formDataPartita.codice_stalla);
    const sedeId = sedeIdFromCodice || (filtroSedeSelezione ? parseInt(filtroSedeSelezione, 10) : null);
    setFiltroSedeSelezione(sedeId ? String(sedeId) : '');
    loadAnimaliSelezionabili(sedeId);
    setShowSelezionaCapiModal(true);
  };

  const openSelezionaCapiTrasferimento = (sedeIdOrigine) => {
    const sedeId = sedeIdOrigine ? parseInt(sedeIdOrigine, 10) : null;
    setFiltroSedeSelezione(sedeId ? String(sedeId) : '');
    loadAnimaliSelezionabili(sedeId);
    setShowSelezionaCapiTrasferimento(true);
  };

  const onSalvaSelezioneCapi = (selezionati) => {
    setAnimaliManuali(selezionati);
    setFormDataPartita((prev) => ({
      ...prev,
      numero_capi: selezionati.length ? String(selezionati.length) : prev.numero_capi,
    }));
    setShowSelezionaCapiModal(false);
  };

  const onSalvaSelezioneCapiTrasferimento = (selezionati) => {
    setTrasferimentoAnimali(selezionati);
    setTrasferimentoData((prev) => ({
      ...prev,
      numero_capi: selezionati.length ? String(selezionati.length) : prev.numero_capi || '',
    }));
    setShowSelezionaCapiTrasferimento(false);
  };

  const apriPartita = (tipo, interno = false) => {
    const codiceDefault = tipo === 'ingresso' ? codiceDefaultIngresso || codiceDefaultUscita : codiceDefaultUscita || codiceDefaultIngresso;
    setTipoPartita(tipo);
    setFormDataPartita((prev) => ({
      ...prev,
      tipo,
      is_trasferimento_interno: interno,
      codice_stalla_azienda: prev.codice_stalla_azienda || codiceDefault || '',
      codice_stalla: prev.codice_stalla || codiceDefault || '',
    }));
    setPesoMode('per_capo');
    setShowModalPartita(true);
    setShowTipoMovimentoModal(false);
  };

  const addAnimaleDecesso = () => {
    setAnimaliDecesso((prev) => [...prev, { auricolare: '', valore: '', note: '', a_carico: true }]);
  };

  const removeAnimaleDecesso = (index) => {
    setAnimaliDecesso((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAnimaleDecesso = (index, field, value) => {
    setAnimaliDecesso((prev) => {
      const updated = [...prev];
      let nextValue = value;
      if (field === 'auricolare' && value) {
        nextValue = value.toUpperCase();
      } else if (field === 'a_carico') {
        // Per checkbox, usa il valore booleano direttamente
        nextValue = Boolean(value);
      }
      updated[index] = { ...updated[index], [field]: nextValue };
      return updated;
    });
  };

  const formatModalita = (value) => {
    if (!value) {
      return '—'; // NULL viene mostrato come trattino
    }
    const key = String(value).toLowerCase();
    return MODALITA_GESTIONE_LABELS[key] || value;
  };

  const isAnyModalOpen = showModalPartite || !!selectedPartitaId || showTipoMovimentoModal || showTrasferimentoModal || showModalPartita || showModalDecesso;

  return (
    <div className={`sincronizzazione-anagrafe ${isAnyModalOpen ? 'modal-open' : ''}`}>
      <div className="section">
        <h3>Upload File Anagrafe Nazionale</h3>
        <div className="upload-section">
          <input
            type="file"
            accept=".gz"
            onChange={handleFileUpload}
            id="file-upload"
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <label 
            htmlFor="file-upload" 
            className={`btn btn-primary ${uploading ? 'disabled' : ''}`}
            style={{ opacity: uploading ? 0.6 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? '⏳ Caricamento...' : '📁 Seleziona File .gz Anagrafe'}
          </label>
          <p className="help-text">Carica il file .gz scaricato dall'Anagrafe Nazionale per sincronizzare i dati</p>
          
          {uploadResult && (
            <div className={`upload-result ${uploadResult.success ? 'success' : 'error'}`}>
              <div className="upload-result-header">
                <h4>{uploadResult.success ? '✅ Successo' : '❌ Errore'}</h4>
                <p className="upload-result-message">{uploadResult.message}</p>
              </div>
              
              {uploadResult.success && uploadResult.partite_trovate && (
                <div className="partite-summary">
                  <div className="partite-summary-header">
                    <strong>PARTITE IDENTIFICATE</strong>
                  </div>
                  <div className="partite-summary-content">
                    <div className="partite-summary-item">
                      <span className="partite-label">INGRESSO:</span>
                      <span className="partite-value">{uploadResult.partite_trovate.ingresso}</span>
                    </div>
                    <div className="partite-summary-item">
                      <span className="partite-label">USCITA:</span>
                      <span className="partite-value">{uploadResult.partite_trovate.uscita}</span>
                    </div>
                  </div>
                  <p className="partite-summary-hint">
                    Clicca su "Gestisci Partite" per confermarle una ad una
                  </p>
                </div>
              )}
              
              {!uploadResult.success && uploadResult.errors && uploadResult.errors.length > 0 && (
                <div className="errors-list">
                  <div className="errors-list-header">
                    <strong>ERRORI</strong>
                  </div>
                  <ul className="errors-list-items">
                    {uploadResult.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                  <p className="info-text">
                    Le partite sono state individuate ma richiedono peso obbligatorio per trasferimenti esterni.
                    Puoi modificarle manualmente nella tabella sottostante.
                  </p>
                </div>
              )}
              
              {!uploadResult.success && uploadResult.partite_dati && (
                <div className="partite-individuali">
                  <div className="partite-individuali-header">
                    <strong>PARTITE INDIVIDUATE</strong>
                  </div>
                  <div className="partite-individuali-content">
                    <div className="partite-individuali-item">
                      <span className="partite-label">INGRESSO:</span>
                      <span className="partite-value">{uploadResult.partite_dati.ingresso?.length || 0}</span>
                    </div>
                    <div className="partite-individuali-item">
                      <span className="partite-label">USCITA:</span>
                      <span className="partite-value">{uploadResult.partite_dati.uscita?.length || 0}</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="upload-result-actions">
                <button 
                  className="btn btn-primary" 
                  onClick={() => setShowModalPartite(true)}
                  disabled={!partiteIdentificate}
                >
                  📋 Gestisci Partite
                </button>
                <button 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setUploadResult(null);
                    setPartiteIdentificate(null);
                  }}
                >
                  Chiudi
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modale per gestire partite identificate */}
      {showModalPartite && partiteIdentificate && (
        <PartiteAnagrafeModal
          isOpen={showModalPartite}
          onClose={() => {
            setShowModalPartite(false);
            loadData(true); // Ricarica dal server per vedere eventuali partite appena confermate
          }}
          partite={partiteIdentificate}
          aziendaId={formDataPartita.azienda_id || aziendaId}
          onConfirm={() => {
            setShowModalPartite(false);
            setPartiteIdentificate(null);
            setUploadResult(null);
            try {
              const { ipcRenderer } = require('electron');
              ipcRenderer.send('sync:trigger');
            } catch (_) {}
            loadData(true);
          }}
        />
      )}

      {/* Modale per dettaglio partita */}
      {selectedPartitaId && (
        <DettaglioPartitaModal
          isOpen={!!selectedPartitaId}
          onClose={() => setSelectedPartitaId(null)}
          partitaId={selectedPartitaId}
          onUpdate={() => {
            loadData();
          }}
          onDelete={() => {
            loadData();
            setSelectedPartitaId(null);
          }}
        />
      )}

      {showTipoMovimentoModal && (
        <BaseModal
          isOpen={showTipoMovimentoModal}
          onClose={() => setShowTipoMovimentoModal(false)}
          title="Scegli tipo movimento"
          size="small"
          className="modal-tipo-movimento"
          footerActions={
            <button className="btn btn-secondary" type="button" onClick={() => setShowTipoMovimentoModal(false)}>
              Chiudi
            </button>
          }
        >
          <div className="movimento-grid">
            <button className="btn movimento-card ingresso" type="button" onClick={() => apriPartita('ingresso', false)}>
              <strong>Ingresso</strong>
              <span className="movimento-hint">Nuova partita in ingresso</span>
            </button>
            <button className="btn movimento-card uscita" type="button" onClick={() => apriPartita('uscita', false)}>
              <strong>Uscita</strong>
              <span className="movimento-hint">Vendita o uscita esterna</span>
            </button>
            <button
              className="btn movimento-card trasferimento"
              type="button"
              onClick={() => {
                setShowTipoMovimentoModal(false);
                setShowTrasferimentoModal(true);
              }}
            >
              <strong>Trasferimento</strong>
              <span className="movimento-hint">Uscita da origine e ingresso in destinazione</span>
            </button>
            <button
              className="btn movimento-card decesso"
              type="button"
              onClick={() => {
                setShowTipoMovimentoModal(false);
                setShowModalDecesso(true);
              }}
            >
              <strong>Decesso</strong>
              <span className="movimento-hint">Registra capi deceduti</span>
            </button>
          </div>
        </BaseModal>
      )}

      {showTrasferimentoModal && (
        <BaseModal
          isOpen={showTrasferimentoModal}
          onClose={() => setShowTrasferimentoModal(false)}
          title="Trasferimento"
          size="large"
          className="modal-trasferimento"
          footerActions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowTrasferimentoModal(false)}>
                Annulla
              </button>
              <button type="submit" form="form-trasferimento" className="btn btn-primary">
                Salva trasferimento (uscita + ingresso)
              </button>
            </>
          }
        >
          <form id="form-trasferimento" onSubmit={handleSubmitTrasferimento}>
            <div className="form-row">
              <div className="form-group">
                <label>Data *</label>
                <input
                  type="date"
                  value={trasferimentoData.data}
                  onChange={(e) => setTrasferimentoData({ ...trasferimentoData, data: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Numero Partita</label>
                <input
                  type="text"
                  value={trasferimentoData.numero_partita}
                  onChange={(e) => setTrasferimentoData({ ...trasferimentoData, numero_partita: e.target.value })}
                  placeholder="Numero partita (opzionale)"
                />
              </div>
              <div className="form-group">
                <label>Numero Modello</label>
                <input
                  type="text"
                  value={trasferimentoData.numero_modello}
                  onChange={(e) => setTrasferimentoData({ ...trasferimentoData, numero_modello: e.target.value })}
                  placeholder="Numero modello (opzionale)"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Sede origine *</label>
                <SmartSelect
                  className="select-compact"
                  options={[{ value: '', label: 'Seleziona sede' }, ...sediOptions]}
                  value={trasferimentoData.sede_origine_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    const sede = (sedi || []).find((s) => String(s.id) === String(value));
                    setTrasferimentoData((prev) => ({
                      ...prev,
                      sede_origine_id: value,
                      codice_stalla_origine: sede?.codice_stalla || prev.codice_stalla_origine,
                    }));
                  }}
                  placeholder="Sede di partenza"
                />
              </div>
              <div className="form-group">
                <label>Codice stalla origine *</label>
                <SmartSelect
                  className="select-compact"
                  options={[{ value: '', label: 'Seleziona' }, ...codiciStallaOptions]}
                  value={trasferimentoData.codice_stalla_origine}
                  onChange={(e) =>
                    setTrasferimentoData({ ...trasferimentoData, codice_stalla_origine: e.target.value })
                  }
                  placeholder="Codice stalla"
                />
              </div>
              <div className="form-group">
                <label>Sede destinazione *</label>
                <SmartSelect
                  className="select-compact"
                  options={[{ value: '', label: 'Seleziona sede' }, ...sediOptions]}
                  value={trasferimentoData.sede_destinazione_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    const sede = (sedi || []).find((s) => String(s.id) === String(value));
                    setTrasferimentoData((prev) => ({
                      ...prev,
                      sede_destinazione_id: value,
                      codice_stalla_destinazione: sede?.codice_stalla || prev.codice_stalla_destinazione,
                    }));
                  }}
                  placeholder="Sede di arrivo"
                />
              </div>
              <div className="form-group">
                <label>Codice stalla destinazione *</label>
                <SmartSelect
                  className="select-compact"
                  options={[{ value: '', label: 'Seleziona' }, ...codiciStallaOptions]}
                  value={trasferimentoData.codice_stalla_destinazione}
                  onChange={(e) =>
                    setTrasferimentoData({ ...trasferimentoData, codice_stalla_destinazione: e.target.value })
                  }
                  placeholder="Codice stalla"
                />
              </div>
            </div>

            <div className="form-row" style={{ alignItems: 'flex-end' }}>
              <div className="form-group">
                <label>Capi da trasferire</label>
                <div className="bovini-summary">
                  <p className="info-text">
                    Bovini selezionati: {trasferimentoAnimali.length}
                  </p>
                  {trasferimentoAnimali.length > 0 ? (
                    <ul className="bovini-summary__list">
                      {trasferimentoAnimali.slice(0, 5).map((animale, idx) => (
                        <li key={`${animale.auricolare || 'vuoto'}-${idx}`}>
                          <span className="monospace">{animale.auricolare || '---'}</span>
                          {animale.peso ? ` · ${animale.peso} kg` : ''}
                        </li>
                      ))}
                      {trasferimentoAnimali.length > 5 && (
                        <li className="bovini-summary__more">+ {trasferimentoAnimali.length - 5} altri</li>
                      )}
                    </ul>
                  ) : (
                    <p className="info-text">Nessun capo selezionato.</p>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openSelezionaCapiTrasferimento(trasferimentoData.sede_origine_id)}
                      disabled={!trasferimentoData.sede_origine_id}
                    >
                      Seleziona capi da origine
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Gestione peso</label>
                <div className="radio-group peso-radio-group">
                  <label className="peso-radio-option">
                    <input
                      type="radio"
                      name="peso-mode-trasferimento"
                      checked={trasferimentoPesoMode === 'per_capo'}
                      onChange={() => {
                        setTrasferimentoPesoMode('per_capo');
                        setTrasferimentoAutoCalcolaPeso(true);
                      }}
                    />
                    <span>Peso per capo</span>
                  </label>
                  <label className="peso-radio-option">
                    <input
                      type="radio"
                      name="peso-mode-trasferimento"
                      checked={trasferimentoPesoMode === 'totale'}
                      onChange={() => {
                        setTrasferimentoPesoMode('totale');
                        setTrasferimentoAutoCalcolaPeso(false);
                      }}
                    />
                    <span>Peso totale</span>
                  </label>
                </div>
                <small className="form-hint">Stesso peso usato per uscita e ingresso.</small>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Peso Totale (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={trasferimentoData.peso_totale}
                  onChange={(e) => setTrasferimentoData({ ...trasferimentoData, peso_totale: e.target.value })}
                  disabled={trasferimentoPesoMode === 'per_capo' && trasferimentoAutoCalcolaPeso}
                  readOnly={trasferimentoPesoMode === 'per_capo' && trasferimentoAutoCalcolaPeso}
                  placeholder={trasferimentoPesoMode === 'per_capo' ? 'Calcolato dai capi' : 'Peso complessivo'}
                />
                <small className="form-hint">
                  {trasferimentoPesoMode === 'per_capo'
                    ? 'Valore calcolato automaticamente dai pesi dei bovini.'
                    : 'Richiesto per peso totale.'}
                </small>
              </div>
              <div className="form-group">
                <label>Peso Medio (kg)</label>
                <input
                  type="number"
                  step="0.01"
                  value={trasferimentoData.peso_medio}
                  onChange={(e) => setTrasferimentoData({ ...trasferimentoData, peso_medio: e.target.value })}
                  disabled={trasferimentoPesoMode === 'per_capo' && trasferimentoAutoCalcolaPeso}
                  readOnly={trasferimentoPesoMode === 'per_capo' && trasferimentoAutoCalcolaPeso}
                  placeholder="Peso medio informativo"
                />
                <small className="form-hint">
                  Calcolato automaticamente se inserisci i pesi per capo.
                </small>
              </div>
            </div>

            {trasferimentoPesoMode === 'per_capo' && (
              <div className="form-group form-group--checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={trasferimentoAutoCalcolaPeso}
                    onChange={(e) => setTrasferimentoAutoCalcolaPeso(e.target.checked)}
                  />
                  {' '}Calcola automaticamente il peso totale dai bovini inseriti
                </label>
              </div>
            )}

            <div className="form-group">
              <label>Note</label>
              <textarea
                value={trasferimentoData.note}
                onChange={(e) => setTrasferimentoData({ ...trasferimentoData, note: e.target.value })}
                rows="2"
              />
            </div>
          </form>
        </BaseModal>
      )}

      {/* Barra di ricerca e pulsanti - direttamente sulla pagina */}
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: '20px'}}>
        <div style={{display:'flex', alignItems:'center', gap: '16px', flex: 1}}>
          <h3 style={{margin: 0, fontSize: '18px', fontWeight: 600, color: '#2c3e50'}}>Lista Partite</h3>
          {/* Filtro di ricerca */}
          <div className="partite-search-input-wrapper" style={{maxWidth: '450px', minWidth: '250px'}}>
            <input
              type="text"
              className="partite-search-input"
              placeholder="Cerca partita (data, codice stalla, numero partita...)"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
            />
          </div>
          {filterSearch && (
            <>
              <span className="partite-search-results-count">
                {partiteFiltrate.length} {partiteFiltrate.length === 1 ? 'partita trovata' : 'partite trovate'}
              </span>
              <button
                className="partite-search-clear"
                onClick={() => setFilterSearch('')}
                title="Cancella filtro"
              >
                ✕ Cancella
              </button>
            </>
          )}
        </div>
        <div style={{display:'flex', gap:12, alignItems:'center'}}>
          <button
            className="btn btn-primary"
            onClick={() => setShowTipoMovimentoModal(true)}
          >
            Nuovo movimento
          </button>
        </div>
      </div>

      <div className="section">

        {loading ? (
          <div className="loading">Caricamento...</div>
        ) : (
          <>

            <div className="table-container">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Data</th>
                  <th>Codice Stalla</th>
                  <th>Numero Capi</th>
                  <th>Peso Totale</th>
                  <th>Peso Medio</th>
                  <th>Trasferimento</th>
                </tr>
              </thead>
              <tbody>
                  {partiteFiltrate.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-state">
                        {filterSearch ? 'Nessuna partita trovata con i criteri di ricerca' : 'Nessuna partita trovata'}
                      </td>
                    </tr>
                  ) : (
                    partitePaginate.map(partita => (
                  <tr 
                    key={partita.id}
                    onClick={() => setSelectedPartitaId(partita.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <span className={`badge ${partita.tipo === 'ingresso' ? 'badge-success' : 'badge-info'}`}>
                        {partita.tipo === 'ingresso' ? 'Ingresso' : 'Uscita'}
                      </span>
                    </td>
                    <td>{new Date(partita.data).toLocaleDateString('it-IT')}</td>
                        <td>{partita.codice_stalla || '-'}</td>
                        <td>{partita.numero_capi || '-'}</td>
                    <td>{partita.peso_totale ? `${parseFloat(partita.peso_totale).toFixed(2)} kg` : '-'}</td>
                    <td>{partita.peso_medio ? `${parseFloat(partita.peso_medio).toFixed(2)} kg` : '-'}</td>
                    <td>
                      <span className={`badge ${partita.is_trasferimento_interno ? 'badge-info' : 'badge-warning'}`}>
                        {partita.is_trasferimento_interno ? 'Interno' : 'Esterno'}
                      </span>
                    </td>
                  </tr>
                    ))
                  )}
              </tbody>
            </table>
            </div>

            {/* Controlli paginazione */}
            {!loading && partiteFiltrate.length > 0 && partiteFiltrate.length > itemsPerPage && (
              <div className="pagination-fixed-bottom">
                <div className="pagination pagination-minimal">
                  <div className="pagination-controls">
                    <button
                      className="pagination-btn-prev"
                      onClick={goToPreviousPage}
                      disabled={currentPage === 1}
                    >
                      ←
                    </button>
                    <div className="pagination-controls-center">
                      {(() => {
                        // Se ci sono meno di 5 pagine, mostra tutte le pagine
                        if (totalPages < 5) {
                          if (totalPages <= 1) {
                            return null; // Nessuna paginazione se c'è solo 1 pagina
                          }
                          // Mostra tutte le pagine (2, 3 o 4)
                          return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <button
                              key={page}
                              className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                              onClick={() => goToPage(page)}
                            >
                              {page}
                            </button>
                          ));
                        }
                        
                        // Se ci sono almeno 5 pagine, mostra sempre 5 numeri con la pagina corrente al centro
                        const startPage = Math.max(1, currentPage - 2);
                        const endPage = Math.min(totalPages, currentPage + 2);
                        
                        let pagesToShow = [];
                        for (let i = startPage; i <= endPage; i++) {
                          pagesToShow.push(i);
                        }
                        
                        // Se abbiamo meno di 5 numeri, aggiungi placeholder
                        if (pagesToShow.length < 5) {
                          if (currentPage <= 3) {
                            while (pagesToShow.length < 5 && pagesToShow[pagesToShow.length - 1] < totalPages) {
                              const nextPage = pagesToShow[pagesToShow.length - 1] + 1;
                              if (nextPage <= totalPages) {
                                pagesToShow.push(nextPage);
                              }
                            }
                            while (pagesToShow.length < 5) {
                              pagesToShow.push(null);
                            }
                          } else if (currentPage >= totalPages - 2) {
                            while (pagesToShow.length < 5 && pagesToShow[0] > 1) {
                              const prevPage = pagesToShow[0] - 1;
                              if (prevPage >= 1) {
                                pagesToShow.unshift(prevPage);
                              }
                            }
                            while (pagesToShow.length < 5) {
                              pagesToShow.unshift(null);
                            }
                          } else {
                            const needed = 5 - pagesToShow.length;
                            const before = Math.floor(needed / 2);
                            const after = needed - before;
                            
                            for (let i = 0; i < before && pagesToShow[0] > 1; i++) {
                              pagesToShow.unshift(pagesToShow[0] - 1);
                            }
                            for (let i = 0; i < after && pagesToShow[pagesToShow.length - 1] < totalPages; i++) {
                              pagesToShow.push(pagesToShow[pagesToShow.length - 1] + 1);
                            }
                            
                            while (pagesToShow.length < 5) {
                              if (pagesToShow[0] === 1) {
                                pagesToShow.push(null);
                              } else {
                                pagesToShow.unshift(null);
                              }
                            }
                          }
                        }
                        
                        while (pagesToShow.length > 5) {
                          if (pagesToShow[0] < currentPage - 2) {
                            pagesToShow.shift();
                          } else {
                            pagesToShow.pop();
                          }
                        }
                        
                        return pagesToShow.map((item, idx) => {
                          if (item === null) {
                            return <span key={`placeholder-${idx}`} className="pagination-btn" style={{ visibility: 'hidden' }}>1</span>;
                          }
                          return (
                            <button
                              key={item}
                              className={`pagination-btn ${item === currentPage ? 'active' : ''}`}
                              onClick={() => goToPage(item)}
                            >
                              {item}
                            </button>
                          );
                        });
                      })()}
                    </div>
                    <button
                      className="pagination-btn-next"
                      onClick={goToNextPage}
                      disabled={currentPage === totalPages}
                    >
                      →
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {showModalPartita && (
        <BaseModal
          isOpen={showModalPartita}
          onClose={() => { setShowModalPartita(false); resetFormPartita(); }}
          title={`Nuova Partita ${tipoPartita === 'ingresso' ? 'Ingresso' : 'Uscita'}`}
          size="xlarge"
          footerActions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModalPartita(false); resetFormPartita(); }}>
                Annulla
              </button>
              <button type="submit" form="form-partita" className="btn btn-primary">Salva</button>
            </>
          }
        >
          <form id="form-partita" onSubmit={handleSubmitPartita}>
              <div className="form-row">
                <div className="form-group">
                  <label>Data *</label>
                  <input
                    type="date"
                    value={formDataPartita.data}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, data: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Codice Stalla *</label>
                  <SmartSelect
                    className="select-compact"
                    options={codiceStallaOptionsWithCurrent}
                    value={formDataPartita.codice_stalla}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, codice_stalla: e.target.value })}
                    required
                    placeholder={
                      tipoPartita === 'uscita'
                        ? 'Codice stalla provenienza'
                        : 'Codice stalla destinazione'
                    }
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Nome Stalla</label>
                  <input
                    type="text"
                    value={formDataPartita.nome_stalla}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, nome_stalla: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Numero Partita</label>
                  <input
                    type="text"
                    value={formDataPartita.numero_partita}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, numero_partita: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Codice Stalla (Mio allevamento)</label>
                  <SmartSelect
                    className="select-compact"
                    options={codiceStallaAziendaOptionsWithCurrent}
                    value={formDataPartita.codice_stalla_azienda}
                    onChange={(e) =>
                      setFormDataPartita({ ...formDataPartita, codice_stalla_azienda: e.target.value })
                    }
                    placeholder="Codice stalla interna (destinazione per ingressi, provenienza per uscite)"
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                    Indica la sede del tuo allevamento collegata alla partita.
                  </small>
                </div>
                <div className="form-group">
                  <label>Modalità di Gestione *</label>
                  <SmartSelect
                    className="select-compact"
                    options={MODALITA_GESTIONE_OPTIONS}
                    value={formDataPartita.modalita_gestione}
                    onChange={(e) =>
                      setFormDataPartita({ ...formDataPartita, modalita_gestione: e.target.value })
                    }
                    displayField="label"
                    valueField="value"
                    required
                    placeholder="Seleziona modalità"
                  />
                  <small style={{ display: 'block', marginTop: '4px', color: '#666' }}>
                    Seleziona se la partita è di proprietà o in soccida.
                  </small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Costo Unitario (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formDataPartita.costo_unitario}
                    onChange={(e) =>
                      setFormDataPartita({ ...formDataPartita, costo_unitario: e.target.value })
                    }
                    placeholder="Costo medio per capo (opzionale)"
                  />
                </div>
                <div className="form-group">
                  <label>Valore Totale (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formDataPartita.valore_totale}
                    onChange={(e) =>
                      setFormDataPartita({ ...formDataPartita, valore_totale: e.target.value })
                    }
                    placeholder="Valore economico complessivo (opzionale)"
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Numero Capi *</label>
                  <input
                    type="number"
                    value={formDataPartita.numero_capi}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, numero_capi: e.target.value })}
                    required
                    min="1"
                  />
                  <small className="form-hint">
                    Animali inseriti: {numeroAnimaliInseriti}
                    {formDataPartita.numero_capi && formDataPartita.numero_capi !== ''
                      ? ` / ${formDataPartita.numero_capi}`
                      : ''}
                  </small>
                </div>
                <div className="form-group">
                  <label>Gestione peso</label>
                  <div className="radio-group peso-radio-group">
                    <label className="peso-radio-option">
                      <input
                        type="radio"
                        name="peso-mode"
                        checked={pesoMode === 'per_capo'}
                        onChange={() => {
                          setPesoMode('per_capo');
                          setAutoCalcolaPeso(true);
                        }}
                      />
                      <span>Peso per capo</span>
                    </label>
                    <label className="peso-radio-option">
                      <input
                        type="radio"
                        name="peso-mode"
                        checked={pesoMode === 'totale'}
                        onChange={() => {
                          setPesoMode('totale');
                          setAutoCalcolaPeso(false);
                        }}
                      />
                      <span>Peso totale</span>
                    </label>
                  </div>
                  <small className="form-hint">
                    Scegli se inserire i pesi dei singoli capi o un peso complessivo.
                  </small>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Peso Totale (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataPartita.peso_totale}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, peso_totale: e.target.value })}
                    disabled={pesoMode === 'per_capo' && autoCalcolaPeso}
                    readOnly={pesoMode === 'per_capo' && autoCalcolaPeso}
                    placeholder={pesoMode === 'per_capo' ? 'Calcolato dai capi' : 'Peso complessivo'}
                  />
                  <small className="form-hint">
                    {pesoMode === 'per_capo'
                      ? 'Valore calcolato automaticamente dai pesi dei bovini.'
                      : 'Richiesto per peso totale.'}
                  </small>
                </div>
                <div className="form-group">
                  <label>Peso Medio (kg)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formDataPartita.peso_medio}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, peso_medio: e.target.value })}
                    disabled={pesoMode === 'per_capo' && autoCalcolaPeso}
                    readOnly={pesoMode === 'per_capo' && autoCalcolaPeso}
                    placeholder="Peso medio informativo"
                  />
                  <small className="form-hint">
                    Calcolato automaticamente se inserisci i pesi per capo.
                  </small>
                </div>
              </div>
              {pesoMode === 'per_capo' && (
                <div className="form-group form-group--checkbox">
                  <label>
                    <input
                      type="checkbox"
                      checked={autoCalcolaPeso}
                      onChange={(e) => setAutoCalcolaPeso(e.target.checked)}
                    />
                    {' '}Calcola automaticamente il peso totale dai bovini inseriti
                  </label>
                </div>
              )}
              <div className="form-row">
                {tipoPartita === 'ingresso' && (
                  <div className="form-group">
                    <label>Fattura di acquisto</label>
                <SmartSelect
                      className="select-compact"
                      options={fattureAcquistoOptions}
                      value={formDataPartita.fattura_amministrazione_id}
                      onChange={(e) =>
                        setFormDataPartita({ ...formDataPartita, fattura_amministrazione_id: e.target.value })
                      }
                      placeholder="Seleziona fattura"
                    />
                  </div>
                )}
                {tipoPartita === 'uscita' && (
                  <div className="form-group">
                    <label>Fattura emessa</label>
                <SmartSelect
                      className="select-compact"
                      options={fattureVenditaOptions}
                      value={formDataPartita.fattura_emessa_id}
                      onChange={(e) =>
                        setFormDataPartita({ ...formDataPartita, fattura_emessa_id: e.target.value })
                      }
                      placeholder="Seleziona fattura"
                    />
                  </div>
                )}
              </div>
              <div className="section-title">Bovini della partita</div>
              <div className="bovini-summary">
                <p className="info-text">
                  Bovini inseriti: {numeroAnimaliInseriti}
                  {formDataPartita.numero_capi && formDataPartita.numero_capi !== ''
                    ? ` / ${formDataPartita.numero_capi}`
                    : ''}
                </p>
                <div className="bovini-table-header">
                  <span className="info-text">Click su una riga per modificare</span>
                  {tipoPartita === 'ingresso' ? (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={openAddBovino}
                    >
                      Inserisci bovino
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={openSelezionaCapi}
                    >
                      Seleziona capi presenti
                    </button>
                  )}
                </div>

                {animaliManuali.length > 0 ? (
                  <div className="bovini-table-wrapper">
                    <table className="bovini-table">
                      <thead>
                        <tr>
                          <th>Auricolare</th>
                          <th>Specie</th>
                          <th>Razza</th>
                          <th>Sesso</th>
                          <th>Madre</th>
                          <th>Data nascita</th>
                          <th>Peso (kg)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {animaliManuali.map((animale, idx) => (
                          <tr
                            key={`${animale.auricolare || 'vuoto'}-${idx}`}
                            onClick={() => openEditBovino(idx)}
                          >
                            <td className="monospace">{animale.auricolare || '—'}</td>
                            <td>{animale.specie || '—'}</td>
                            <td>{animale.razza || '—'}</td>
                            <td>{animale.sesso || '—'}</td>
                            <td>{animale.codice_madre || '—'}</td>
                            <td>{animale.data_nascita || '—'}</td>
                            <td>{animale.peso ? `${animale.peso}` : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="info-text">Nessun bovino inserito.</p>
                )}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>
                    Motivo (codice BDN)
                    {formDataPartita.motivo && CODICI_MOTIVO[formDataPartita.motivo.toUpperCase()] && (
                      <span className="motivo-help-text">
                        {' '}({CODICI_MOTIVO[formDataPartita.motivo.toUpperCase()]})
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={formDataPartita.motivo}
                    onChange={(e) => {
                      // Permette lettere A-Z o numeri, massimo 2 caratteri (per supportare '02' oltre alle lettere)
                      const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
                      setFormDataPartita({ ...formDataPartita, motivo: value });
                    }}
                    placeholder={
                      tipoPartita === 'ingresso'
                        ? 'A (Acquisto), N (Nascita), T (Trasferimento), I (Importazione), R (Rientro)'
                        : 'V (Vendita), K/M (Macellazione), D/02 (Decesso), T (Trasferimento), E (Esportazione), F (Fiera)'
                    }
                    maxLength="2"
                    style={{ textTransform: 'uppercase' }}
                  />
                  <small className="form-hint">
                    {tipoPartita === 'ingresso' ? (
                      <>Codici ingresso: A=Acquisto, N=Nascita, T=Trasferimento, I=Importazione, R=Rientro</>
                    ) : (
                      <>Codici uscita: V=Vendita, K/M=Macellazione, D/02=Decesso/Morte, T=Trasferimento, E=Esportazione, F=Fiera</>
                    )}
                  </small>
                </div>
                <div className="form-group">
                  <label>Numero Modello</label>
                  <input
                    type="text"
                    value={formDataPartita.numero_modello}
                    onChange={(e) => setFormDataPartita({ ...formDataPartita, numero_modello: e.target.value })}
                    placeholder="Numero modello movimento"
                  />
                </div>
              </div>
              {tipoPartita !== 'ingresso' && (
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formDataPartita.is_trasferimento_interno || false}
                      onChange={(e) => setFormDataPartita({ ...formDataPartita, is_trasferimento_interno: e.target.checked })}
                    />
                    {' '}Trasferimento interno (peso opzionale)
                  </label>
                  <small style={{ display: 'block', marginTop: '5px', color: '#666' }}>
                    Se deselezionato, il peso è obbligatorio per trasferimenti esterni
                  </small>
                </div>
              )}
              <div className="form-group">
                <label>Note</label>
                <textarea
                  value={formDataPartita.note}
                  onChange={(e) => setFormDataPartita({ ...formDataPartita, note: e.target.value })}
                />
              </div>
          </form>
        </BaseModal>
      )}

      {showBovinoForm && (
        <BovinoFormModal
          open={showBovinoForm}
          initialValue={bovinoDraft}
          onSave={saveBovino}
          onDelete={editingBovinoIndex !== null ? () => deleteBovino(editingBovinoIndex) : null}
          onClose={closeBovinoForm}
        />
      )}
      {showSelezionaCapiModal && (
        <SelezionaCapiModal
          open={showSelezionaCapiModal}
          onClose={() => setShowSelezionaCapiModal(false)}
          animali={animaliDisponibili}
          loading={loadingAnimaliDisponibili}
          initialSelected={animaliManuali}
          onRefresh={() => {
            const sedeId = filtroSedeSelezione ? parseInt(filtroSedeSelezione, 10) : null;
            loadAnimaliSelezionabili(sedeId);
          }}
          onSave={onSalvaSelezioneCapi}
          sediOptions={sediOptions}
          filtroSede={filtroSedeSelezione}
          onFiltroSedeChange={(value) => {
            setFiltroSedeSelezione(value);
            const sedeId = value ? parseInt(value, 10) : null;
            loadAnimaliSelezionabili(sedeId);
          }}
          hideFilter
        />
      )}
      {showSelezionaCapiTrasferimento && (
        <SelezionaCapiModal
          open={showSelezionaCapiTrasferimento}
          onClose={() => setShowSelezionaCapiTrasferimento(false)}
          animali={animaliDisponibili}
          loading={loadingAnimaliDisponibili}
          initialSelected={trasferimentoAnimali}
          onRefresh={() => {
            const sedeId = filtroSedeSelezione ? parseInt(filtroSedeSelezione, 10) : null;
            loadAnimaliSelezionabili(sedeId);
          }}
          onSave={onSalvaSelezioneCapiTrasferimento}
          sediOptions={sediOptions}
          filtroSede={filtroSedeSelezione}
          onFiltroSedeChange={(value) => {
            setFiltroSedeSelezione(value);
            const sedeId = value ? parseInt(value, 10) : null;
            loadAnimaliSelezionabili(sedeId);
          }}
          hideFilter
        />
      )}
      {showDecessiModal && (
        <DecessiModal
          open={showDecessiModal}
          onClose={() => setShowDecessiModal(false)}
          animali={animaliDecesso}
          onAdd={addAnimaleDecesso}
          onRemove={removeAnimaleDecesso}
          onUpdate={updateAnimaleDecesso}
        />
      )}

      {showModalDecesso && (
        <BaseModal
          isOpen={showModalDecesso}
          onClose={() => { setShowModalDecesso(false); resetFormDecesso(); }}
          title="Aggiungi Decesso"
          size="large"
          footerActions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => { setShowModalDecesso(false); resetFormDecesso(); }}>
                Annulla
              </button>
              <button type="submit" form="form-decesso" className="btn btn-primary">Salva</button>
            </>
          }
        >
          <form id="form-decesso" onSubmit={handleSubmitDecesso}>
              <div className="form-row">
                <div className="form-group">
                  <label>Data smaltimento *</label>
                  <input
                    type="date"
                    value={formDataDecesso.data_uscita}
                    onChange={(e) => setFormDataDecesso({ ...formDataDecesso, data_uscita: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Numero documento smaltimento</label>
                  <input
                    type="text"
                    value={formDataDecesso.numero_certificato_smaltimento}
                    onChange={(e) =>
                      setFormDataDecesso({ ...formDataDecesso, numero_certificato_smaltimento: e.target.value })
                    }
                    placeholder="Numero certificato o documento"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Fattura smaltimento</label>
                <SmartSelect
                  className="select-compact"
                  options={fattureAcquistoOptions}
                  value={formDataDecesso.fattura_smaltimento_id}
                  onChange={(e) =>
                    setFormDataDecesso({ ...formDataDecesso, fattura_smaltimento_id: e.target.value })
                  }
                  displayField="label"
                  valueField="value"
                  placeholder="Nessuna"
                />
              </div>
              <div className="form-group">
                <label>Valore economico totale (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formDataDecesso.valore_economico_totale}
                  onChange={(e) =>
                    setFormDataDecesso({ ...formDataDecesso, valore_economico_totale: e.target.value })
                  }
                  placeholder="Valore economico complessivo (opzionale)"
                />
              </div>
              <div className="section-title">Capi deceduti</div>
              <div className="bovini-summary">
                <p className="info-text">
                  Capi inseriti: {numeroDecessiInseriti}
                </p>
                {animaliDecesso.length > 0 ? (
                  <ul className="bovini-summary__list">
                    {animaliDecesso.slice(0, 5).map((capo, idx) => (
                      <li key={`${capo.auricolare || 'vuoto'}-${idx}`}>
                        <span className="monospace">{capo.auricolare || '---'}</span>
                        {capo.valore ? ` · €${capo.valore}` : ''}
                        {capo.a_carico !== undefined && (
                          <span className={capo.a_carico ? 'badge badge-info' : 'badge badge-warning'}>
                            {capo.a_carico ? 'A carico' : 'Non a carico'}
                          </span>
                        )}
                        {capo.note ? ` · ${capo.note}` : ''}
                      </li>
                    ))}
                    {animaliDecesso.length > 5 && (
                      <li className="bovini-summary__more">+ {animaliDecesso.length - 5} altri</li>
                    )}
                  </ul>
                ) : (
                  <p className="info-text">Nessun capo deceduto inserito.</p>
                )}
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowDecessiModal(true)}
                >
                  Gestisci capi deceduti
                </button>
              </div>
              <div className="form-group">
                <label>Note gruppo</label>
                <textarea
                  value={formDataDecesso.note}
                  onChange={(e) => setFormDataDecesso({ ...formDataDecesso, note: e.target.value })}
                  rows="3"
                  placeholder="Annotazioni aggiuntive sul gruppo (opzionale)"
                />
              </div>
          </form>
        </BaseModal>
      )}
    </div>
  );
};

const BovinoFormModal = ({ open, initialValue, onSave, onDelete, onClose }) => {
  const [form, setForm] = useState(
    initialValue || { auricolare: '', specie: 'bovino', razza: '', sesso: '', codice_madre: '', data_nascita: '', peso: '' }
  );

  useEffect(() => {
    setForm(initialValue || { auricolare: '', specie: 'bovino', razza: '', sesso: '', codice_madre: '', data_nascita: '', peso: '' });
  }, [initialValue]);

  const update = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={initialValue ? 'Modifica bovino' : 'Inserisci bovino'}
      size="large"
      headerActions={
        initialValue && onDelete ? (
          <button type="button" className="btn btn-danger" onClick={onDelete}>
            Elimina
          </button>
        ) : null
      }
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(form)}>
            Salva
          </button>
        </>
      }
    >
      <div className="form-row">
        <div className="form-group">
          <label>Codice capo (auricolare) *</label>
          <input
            type="text"
            value={form.auricolare}
            onChange={(e) => update('auricolare', e.target.value.toUpperCase())}
            placeholder="IT123..."
            required
          />
        </div>
        <div className="form-group">
          <label>Specie</label>
          <input
            type="text"
            value={form.specie}
            onChange={(e) => update('specie', e.target.value)}
            placeholder="bovino"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Razza</label>
          <input
            type="text"
            value={form.razza}
            onChange={(e) => update('razza', e.target.value)}
            placeholder="Razza"
          />
        </div>
        <div className="form-group">
          <label>Sesso</label>
          <SmartSelect
            className="select-compact"
            options={[
              { value: 'M', label: 'Maschio' },
              { value: 'F', label: 'Femmina' },
            ]}
            value={form.sesso || ''}
            onChange={(e) => update('sesso', (e?.target?.value || '').toString().toUpperCase())}
            placeholder="Seleziona"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Codice madre</label>
          <input
            type="text"
            value={form.codice_madre}
            onChange={(e) => update('codice_madre', e.target.value)}
            placeholder="Codice madre"
          />
        </div>
        <div className="form-group">
          <label>Data di nascita</label>
          <input
            type="date"
            value={form.data_nascita}
            onChange={(e) => update('data_nascita', e.target.value)}
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Peso (kg)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.peso}
            onChange={(e) => update('peso', e.target.value)}
            placeholder="Peso opzionale"
          />
        </div>
      </div>
    </BaseModal>
  );
};

const DecessiModal = ({ open, animali, onClose, onAdd, onRemove, onUpdate }) => {
  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Gestisci capi deceduti"
      size="xlarge"
      className="modal-bovini"
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onAdd}>
            Aggiungi capo
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Fatto
          </button>
        </>
      }
    >
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Auricolare *</th>
                  <th>Valore (€)</th>
                  <th>A carico</th>
                  <th>Note</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {animali.map((capo, index) => (
                  <tr key={`${capo.auricolare || 'vuoto'}-${index}`}>
                    <td>
                      <input
                        type="text"
                        value={capo.auricolare}
                        onChange={(e) => onUpdate(index, 'auricolare', e.target.value)}
                        placeholder="IT123..."
                        required
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={capo.valore}
                        onChange={(e) => onUpdate(index, 'valore', e.target.value)}
                        placeholder="Valore (opzionale)"
                      />
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', margin: 0 }}>
                        <input
                          type="checkbox"
                          checked={capo.a_carico !== undefined ? capo.a_carico : true}
                          onChange={(e) => onUpdate(index, 'a_carico', e.target.checked)}
                        />
                        <span style={{ fontSize: '13px' }}>A carico</span>
                      </label>
                    </td>
                    <td>
                      <input
                        type="text"
                        value={capo.note}
                        onChange={(e) => onUpdate(index, 'note', e.target.value)}
                        placeholder="Note (opzionale)"
                      />
                    </td>
                    <td className="table-actions">
                      <button
                        type="button"
                        className="btn btn-danger"
                        onClick={() => onRemove(index)}
                        disabled={animali.length === 1}
                      >
                        Rimuovi
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
    </BaseModal>
  );
};

const SelezionaCapiModal = ({
  open,
  onClose,
  animali,
  loading,
  initialSelected = [],
  onRefresh,
  onSave,
  sediOptions,
  filtroSede,
  onFiltroSedeChange,
  hideFilter = false,
}) => {
  const [selezionati, setSelezionati] = useState(initialSelected || []);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroSesso, setFiltroSesso] = useState('');
  const [filtroRazza, setFiltroRazza] = useState('');
  const [filtroDataArrivoDa, setFiltroDataArrivoDa] = useState('');
  const [filtroDataArrivoA, setFiltroDataArrivoA] = useState('');

  useEffect(() => {
    setSelezionati(initialSelected || []);
    if (!open) {
      setSearchTerm('');
      setFiltroSesso('');
      setFiltroRazza('');
      setFiltroDataArrivoDa('');
      setFiltroDataArrivoA('');
    }
  }, [initialSelected, open]);

  const isSelected = (auricolare) => selezionati.some((a) => a.auricolare === auricolare);

  const razzeUniche = useMemo(() => {
    const razze = new Set();
    animali.forEach((a) => {
      const razza = a.razza || a.breed;
      if (razza) razze.add(razza);
    });
    return Array.from(razze).sort();
  }, [animali]);

  const animaliFiltrati = useMemo(() => {
    return animali.filter((animale) => {
      const matchSearch = !searchTerm || 
        (animale.auricolare || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchSesso = !filtroSesso || (animale.sesso || animale.sex || '') === filtroSesso;
      const matchRazza = !filtroRazza || (animale.razza || animale.breed || '') === filtroRazza;
      
      const dataArrivo = animale.data_ingresso || animale.data_arrivo || animale.data_entrata || '';
      let matchDataArrivo = true;
      if (filtroDataArrivoDa || filtroDataArrivoA) {
        if (dataArrivo) {
          const dataAnimale = new Date(dataArrivo);
          if (filtroDataArrivoDa) {
            const dataDa = new Date(filtroDataArrivoDa);
            if (dataAnimale < dataDa) matchDataArrivo = false;
          }
          if (filtroDataArrivoA && matchDataArrivo) {
            const dataA = new Date(filtroDataArrivoA);
            if (dataAnimale > dataA) matchDataArrivo = false;
          }
        } else {
          matchDataArrivo = false;
        }
      }
      
      return matchSearch && matchSesso && matchRazza && matchDataArrivo;
    });
  }, [animali, searchTerm, filtroSesso, filtroRazza, filtroDataArrivoDa, filtroDataArrivoA]);

  const tuttiSelezionati = useMemo(() => {
    if (animaliFiltrati.length === 0) return false;
    return animaliFiltrati.every((animale) => isSelected(animale.auricolare));
  }, [animaliFiltrati, selezionati]);

  const selezionaTutti = () => {
    const nuoviSelezionati = [...selezionati];
    animaliFiltrati.forEach((animale) => {
      if (!isSelected(animale.auricolare)) {
        nuoviSelezionati.push({
          auricolare: animale.auricolare,
          specie: animale.specie || 'bovino',
          razza: animale.razza || animale.breed || '',
          sesso: animale.sesso || animale.sex || '',
          codice_madre: animale.codice_madre || '',
          data_nascita: animale.data_nascita || animale.data_nascita_presunta || '',
          peso: animale.peso || '',
        });
      }
    });
    setSelezionati(nuoviSelezionati);
  };

  const deselezionaTutti = () => {
    const auricolariFiltrati = new Set(animaliFiltrati.map((a) => a.auricolare));
    setSelezionati((prev) => prev.filter((a) => !auricolariFiltrati.has(a.auricolare)));
  };

  const toggle = (animale) => {
    if (!animale?.auricolare) return;
    const aur = animale.auricolare;
    setSelezionati((prev) => {
      if (prev.some((a) => a.auricolare === aur)) {
        return prev.filter((a) => a.auricolare !== aur);
      }
      return [
        ...prev,
        {
          auricolare: aur,
          specie: animale.specie || 'bovino',
          razza: animale.razza || animale.breed || '',
          sesso: animale.sesso || animale.sex || '',
          codice_madre: animale.codice_madre || '',
          data_nascita: animale.data_nascita || animale.data_nascita_presunta || '',
          peso: animale.peso || '',
        },
      ];
    });
  };

  const updatePeso = (auricolare, peso) => {
    setSelezionati((prev) =>
      prev.map((a) => (a.auricolare === auricolare ? { ...a, peso } : a))
    );
  };

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Seleziona capi presenti"
      size="xlarge"
      footerActions={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Annulla
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSave(selezionati)}>
            Salva selezione
          </button>
        </>
      }
    >
      {!hideFilter && (
        <div className="form-row" style={{ marginBottom: 12 }}>
          <div className="form-group" style={{ minWidth: '220px' }}>
            <label>Filtra per sede</label>
            <SmartSelect
              className="select-compact"
              options={[{ value: '', label: 'Tutte' }, ...sediOptions]}
              value={filtroSede || ''}
              onChange={(e) => onFiltroSedeChange(e.target.value)}
              placeholder="Seleziona sede"
            />
          </div>
          <div className="form-group" style={{ alignSelf: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onRefresh}>
              Aggiorna elenco
            </button>
          </div>
        </div>
      )}
      <div className="filtri-selezione-capi">
        <div className="filtri-selezione-capi__row">
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--search">
            <label className="filtri-selezione-capi__label">Cerca auricolare</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cerca..."
              className="filtri-selezione-capi__input"
            />
          </div>
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--sesso">
            <label className="filtri-selezione-capi__label">Sesso</label>
            <SmartSelect
              className="select-compact"
              options={[
                { value: 'M', label: 'Maschio' },
                { value: 'F', label: 'Femmina' },
              ]}
              value={filtroSesso}
              onChange={(e) => setFiltroSesso(e.target.value)}
              placeholder="Tutti"
              allowEmpty={true}
            />
          </div>
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--razza">
            <label className="filtri-selezione-capi__label">Razza</label>
            <SmartSelect
              className="select-compact"
              options={razzeUniche.map((r) => ({ value: r, label: r }))}
              value={filtroRazza}
              onChange={(e) => setFiltroRazza(e.target.value)}
              placeholder="Tutte"
              allowEmpty={true}
            />
          </div>
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--data">
            <label className="filtri-selezione-capi__label">Data arrivo da</label>
            <input
              type="date"
              value={filtroDataArrivoDa}
              onChange={(e) => setFiltroDataArrivoDa(e.target.value)}
              className="filtri-selezione-capi__input"
            />
          </div>
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--data">
            <label className="filtri-selezione-capi__label">Data arrivo a</label>
            <input
              type="date"
              value={filtroDataArrivoA}
              onChange={(e) => setFiltroDataArrivoA(e.target.value)}
              className="filtri-selezione-capi__input"
            />
          </div>
          <div className="filtri-selezione-capi__field filtri-selezione-capi__field--button">
            <button 
              type="button" 
              className="btn btn-secondary filtri-selezione-capi__button" 
              onClick={tuttiSelezionati ? deselezionaTutti : selezionaTutti}
            >
              {tuttiSelezionati ? 'Deseleziona tutti' : 'Seleziona tutti'}
            </button>
            <small className="filtri-selezione-capi__counter">
              {selezionati.length} / {animaliFiltrati.length}
            </small>
          </div>
        </div>
      </div>
      {loading ? (
        <div className="loading">Caricamento capi presenti...</div>
      ) : (
        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th />
                <th>Auricolare</th>
                <th>Sesso</th>
                <th>Razza</th>
                <th>Data nascita</th>
                <th>Peso (kg)</th>
              </tr>
            </thead>
            <tbody>
              {animaliFiltrati && animaliFiltrati.length > 0 ? (
                animaliFiltrati.map((animale) => (
                  <tr key={animale.auricolare}>
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected(animale.auricolare)}
                        onChange={() => toggle(animale)}
                      />
                    </td>
                    <td className="monospace">{animale.auricolare}</td>
                    <td>{animale.sesso || '-'}</td>
                    <td>{animale.razza || '-'}</td>
                    <td>{animale.data_nascita || '-'}</td>
                    <td>
                      {isSelected(animale.auricolare) ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={
                            selezionati.find((s) => s.auricolare === animale.auricolare)?.peso || ''
                          }
                          onChange={(e) => updatePeso(animale.auricolare, e.target.value)}
                          placeholder="Peso opzionale"
                        />
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="empty-state">
                    {animali && animali.length > 0
                      ? 'Nessun capo corrisponde ai filtri selezionati.'
                      : 'Nessun capo presente per i filtri selezionati.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </BaseModal>
  );
};

export default SincronizzazioneAnagrafe;
