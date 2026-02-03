import React, { useEffect, useMemo, useState } from 'react';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { amministrazioneService } from '../services/amministrazioneService';
import { useAzienda } from '../../../context/AziendaContext';
import '../../alimentazione/components/Alimentazione.css';
import './GestionePrimaNota.css';

// Solo Cassa e Banca: i conti sistema (Vendite, IVA, Crediti/Debiti, ecc.) sono creati automaticamente
const TIPO_CONTO_OPTIONS = [
  { value: 'cassa', label: 'Cassa' },
  { value: 'banca', label: 'Banca' },
];

const GIROCONTO_OPTIONS = [
  { value: 'automatico', label: 'Giroconto automatico' },
  { value: 'manuale', label: 'Gestione manuale' },
];

const MOVIMENTO_TIPO_OPTIONS = [
  { value: 'entrata', label: 'Entrata' },
  { value: 'uscita', label: 'Uscita' },
  { value: 'giroconto', label: 'Giroconto' },
];

const MOVIMENTO_STATO_OPTIONS = [
  { value: 'definitivo', label: 'Definitivo' },
  { value: 'provvisorio', label: 'Da confermare' },
];

const FILTRO_TIPO_OPTIONS = [
  ...MOVIMENTO_TIPO_OPTIONS,
];

const FILTRO_STATO_OPTIONS = [
  { value: 'tutti', label: 'Tutti' },
  ...MOVIMENTO_STATO_OPTIONS,
];

const TIPO_LABEL_MAP = TIPO_CONTO_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {}
);

const GIROCONTO_LABEL_MAP = GIROCONTO_OPTIONS.reduce(
  (acc, option) => ({ ...acc, [option.value]: option.label }),
  {}
);

const MODALITA_GESTIONE_LABELS = {
  proprieta: 'Proprietà',
  soccida_monetizzata: 'Soccida monetizzata',
  soccida_fatturata: 'Soccida fatturata',
};

const EMPTY_FILTERS = {
  contoId: 'tutti',
  tipo: '',
  stato: 'tutti',
  categoria: 'tutte',
  attrezzatura: 'tutte',
  partita: 'tutte',
  contratto_soccida: 'tutti',
  search: '',
  from: '',
  to: '',
};

const TODAY = new Date().toISOString().split('T')[0];

const GestionePrimaNota = () => {
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;

  const [setupLoading, setSetupLoading] = useState(false);
  const [conti, setConti] = useState([]);
  const [showContoModal, setShowContoModal] = useState(false);
  const [editingConto, setEditingConto] = useState(null);
  const [showIbanModal, setShowIbanModal] = useState(false);
  const [ibanConto, setIbanConto] = useState(null);
  const [categorie, setCategorie] = useState([]);
  const [preferenze, setPreferenze] = useState({});
  const [partite, setPartite] = useState([]);
  const [partiteLoading, setPartiteLoading] = useState(false);
  const [partiteLoaded, setPartiteLoaded] = useState(false);
  const [attrezzature, setAttrezzature] = useState([]);
  const [contrattiSoccida, setContrattiSoccida] = useState([]);
  const [contrattiSoccidaLoading, setContrattiSoccidaLoading] = useState(false);

  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [movimenti, setMovimenti] = useState([]);
  const [movimentiLoading, setMovimentiLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [showContoDetailsModal, setShowContoDetailsModal] = useState(false);
  const [selectedContoForDetails, setSelectedContoForDetails] = useState(null);
  const [showAccountsView, setShowAccountsView] = useState(true); // Vista iniziale card conti
  const [contoSearchFilter, setContoSearchFilter] = useState(''); // Filtro ricerca conti
  const [accountsCurrentPage, setAccountsCurrentPage] = useState(1); // Pagina corrente per le card
  const [accountsPerPage] = useState(12); // Card per pagina
  const [showFiltriAvanzati, setShowFiltriAvanzati] = useState(false); // Filtri movimenti: Categoria, Attrezzatura, Partita, Contratto

  const contoOptions = useMemo(
    () =>
      conti.map((conto) => ({
        value: String(conto.id),
        label: conto.nome,
      })),
    [conti]
  );

  const contoFilterOptions = useMemo(
    () => [{ value: 'tutti', label: 'Tutti' }, ...contoOptions],
    [contoOptions]
  );

  // Solo Cassa/Banca per movimento manuale e riconciliazione (i conti sistema non sono selezionabili)
  const contiCassaBanca = useMemo(() => {
    return conti.filter((c) => {
      const t = (typeof c.tipo === 'string' ? c.tipo : c.tipo?.value || '').toLowerCase();
      return t === 'cassa' || t === 'banca';
    });
  }, [conti]);

  const categoriaOptions = useMemo(() => {
    return categorie.map((categoria) => ({
      value: String(categoria.id ?? categoria.value),
      label: categoria.label || categoria.nome || `Categoria #${categoria.id ?? categoria.value}`,
      tipo_operazione: categoria.tipo_operazione,
    }));
  }, [categorie]);

  const categoriaFilterOptions = useMemo(
    () => [{ value: 'tutte', label: 'Tutte' }, ...categoriaOptions.map(({ value, label }) => ({ value, label }))],
    [categoriaOptions]
  );

  const attrezzaturaOptions = useMemo(() => {
    if (!Array.isArray(attrezzature) || attrezzature.length === 0) {
      return [];
    }
    return attrezzature.map((att) => {
      const chunks = [att.nome];
      const tipoValue = typeof att.tipo === 'string' ? att.tipo : att.tipo?.value;
      if (tipoValue) {
        chunks.push(tipoValue);
      }
      if (att.targa) {
        chunks.push(att.targa);
      }
      return {
        value: String(att.id),
        label: chunks.filter(Boolean).join(' · '),
      };
    });
  }, [attrezzature]);

  const attrezzaturaFilterOptions = useMemo(
    () => [{ value: 'tutte', label: 'Tutte' }, ...attrezzaturaOptions],
    [attrezzaturaOptions]
  );

  const partitaFilterOptions = useMemo(
    () => {
      if (!partiteLoaded || partite.length === 0) {
        return [{ value: 'tutte', label: 'Tutte' }];
      }
      return [
        { value: 'tutte', label: 'Tutte' },
        ...partite.map((p) => ({
          value: String(p.id),
          label: p.numero_partita
            ? `Partita ${p.numero_partita} - ${p.numero_capi} capi`
            : `Partita #${p.id} - ${p.numero_capi || 0} capi`,
        })),
      ];
    },
    [partite, partiteLoaded]
  );

  const contrattoSoccidaFilterOptions = useMemo(
    () => {
      if (contrattiSoccida.length === 0) {
        return [{ value: 'tutti', label: 'Tutti' }];
      }
      return [
        { value: 'tutti', label: 'Tutti' },
        ...contrattiSoccida.map((c) => ({
          value: String(c.id),
          label: c.numero_contratto
            ? `${c.numero_contratto} - ${c.soccidante?.nome || 'N/A'}`
            : `Contratto #${c.id} - ${c.soccidante?.nome || 'N/A'}`,
        })),
      ];
    },
    [contrattiSoccida]
  );

  const fetchContrattiSoccida = async (targetAziendaId) => {
    if (!targetAziendaId) {
      setContrattiSoccida([]);
      return;
    }
    try {
      setContrattiSoccidaLoading(true);
      const contratti = await amministrazioneService.getContrattiSoccida({
        azienda_id: targetAziendaId,
        attivo: true,
      });
      setContrattiSoccida(Array.isArray(contratti) ? contratti : []);
    } catch (error) {
      setContrattiSoccida([]);
    } finally {
      setContrattiSoccidaLoading(false);
    }
  };

  const fetchAttrezzature = async (targetAziendaId) => {
    if (!targetAziendaId) {
      setAttrezzature([]);
      return;
    }
    try {
      // Usa hybridDataService per leggere dal database locale (più veloce)
      const { default: hybridDataService } = await import('../../../services/hybridDataService');
      const attrezzature = await hybridDataService.getAttrezzature({ 
        azienda_id: targetAziendaId,
        attiva: true 
      });
      
      // Normalizza la risposta (può essere array o oggetto con proprietà attrezzature)
      if (Array.isArray(attrezzature)) {
        setAttrezzature(attrezzature);
      } else if (attrezzature?.attrezzature && Array.isArray(attrezzature.attrezzature)) {
        setAttrezzature(attrezzature.attrezzature);
      } else {
        setAttrezzature([]);
      }
    } catch (error) {

      setAttrezzature([]);
    }
  };

  const [showMovimentoModal, setShowMovimentoModal] = useState(false);
  const [editingMovimento, setEditingMovimento] = useState(null);

  const [showReconcilModal, setShowReconcilModal] = useState(false);
  const [documentiDisponibili, setDocumentiDisponibili] = useState([]);
  const [documentiLoading, setDocumentiLoading] = useState(false);
  const [syncFattureLoading, setSyncFattureLoading] = useState(false);

  const canOperate = Boolean(aziendaId);

  useEffect(() => {
    setPartite([]);
    setPartiteLoaded(false);
    if (!aziendaId) {
      setConti([]);
      setCategorie([]);
      setMovimenti([]);
      setAttrezzature([]);
      setPartite([]);
      // Resetta tutti i loading quando non c'è aziendaId
      setSetupLoading(false);
      setPartiteLoading(false);
      setMovimentiLoading(false);
      setDocumentiLoading(false);
      setSyncFattureLoading(false);
      return;
    }
    fetchSetup(aziendaId);
    fetchAttrezzature(aziendaId);
    fetchPartite(aziendaId);
    fetchContrattiSoccida(aziendaId);
  }, [aziendaId]);

  const contiById = useMemo(() => {
    const map = new Map();
    conti.forEach((conto) => map.set(Number(conto.id), conto));
    return map;
  }, [conti]);

  // Determina la tab attiva per usarla nel fetchMovimenti
  const activeTabContoId = filters.contoId !== 'tutti' && filters.contoId ? String(filters.contoId) : (conti.length > 0 ? String(conti[0].id) : null);

  const filtersKey = useMemo(() => JSON.stringify({ ...filters, activeTabContoId }), [filters, activeTabContoId]);

  useEffect(() => {
    if (!aziendaId) {
      setMovimenti([]);
      setMovimentiLoading(false);
      return;
    }
    fetchMovimenti(aziendaId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aziendaId, filtersKey]);

  const handleSyncFatture = async () => {
    if (!aziendaId || syncFattureLoading) return;
    setSyncFattureLoading(true);
    setErrorMessage(null);
    try {
      const res = await amministrazioneService.syncPrimaNotaFatture(aziendaId);
      const data = res?.data ?? res;
      const processed = data?.processed ?? 0;
      const total = data?.total ?? 0;
      const errors = data?.errors ?? [];
      await fetchSetup(aziendaId);
      if (filters.contoId) fetchMovimenti(aziendaId);
      if (errors.length > 0) {
        const details = errors.slice(0, 5).map((e) => `${e.numero || '#' + e.fattura_id}: ${e.error || ''}`).join('; ');
        const more = errors.length > 5 ? ` ... e altri ${errors.length - 5} errori` : '';
        setErrorMessage(`${processed}/${total} fatture sincronizzate. ${errors.length} errore/i (backend): ${details}${more}`);
      } else {
        setErrorMessage(null);
        if (total > 0) {
          setErrorMessage(`Sincronizzate ${processed} fatture su ${total}.`);
          setTimeout(() => setErrorMessage(null), 4000);
        }
      }
    } catch (err) {
      const detail = err?.response?.data?.detail;
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e) => e?.msg ?? e).join(', ')
          : err?.response?.data?.detail || err?.message || 'Errore sincronizzazione fatture (controlla i log del backend).';
      setErrorMessage(msg);
    } finally {
      setSyncFattureLoading(false);
    }
  };

  const fetchSetup = async (id, options = {}) => {
    const { focusContoId = null } = options;
    setSetupLoading(true);
    setErrorMessage(null);

    let contiData = [];
    let categorieData = [];
    let preferenzeData = {};

    try {
      const response = await amministrazioneService.getPrimaNotaSetup(id);
      contiData = Array.isArray(response) ? response : response?.conti || [];
      categorieData = Array.isArray(response?.categorie) ? response.categorie : [];
      preferenzeData = response?.preferenze || {};

      setConti(contiData);
      setCategorie(categorieData);
      setPreferenze(preferenzeData);

      if (contiData.length > 0) {
        const contoDefaultRaw =
          focusContoId !== null && focusContoId !== undefined
            ? focusContoId
            : filters.contoId !== 'tutti'
              ? filters.contoId
              : preferenzeData.conto_predefinito_id || contiData[0]?.id;

        if (contoDefaultRaw !== null && contoDefaultRaw !== undefined) {
          setFilters((prev) => ({ ...prev, contoId: String(contoDefaultRaw) }));
        }
      } else {
        setFilters((prev) => ({ ...prev, contoId: 'tutti' }));
      }
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setErrorMessage(null); // Non mostrare errore per 503
        // Usa valori di default
        setConti([]);
        setCategorie([]);
        setPreferenze({});
      } else {

      setErrorMessage('Impossibile recuperare i dati della prima nota.');
      }
    } finally {
      setSetupLoading(false);
    }

    return {
      conti: contiData,
      categorie: categorieData,
      preferenze: preferenzeData,
    };
  };

  const fetchPartite = async (id) => {
    setPartiteLoading(true);
    try {
      const response = await amministrazioneService.getPartite({
        azienda_id: id,
        limit: 500,
      });
      const elenco = Array.isArray(response?.items)
        ? response.items
        : Array.isArray(response)
          ? response
          : response?.results || [];
      setPartite(elenco);
      setPartiteLoaded(true);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setPartite([]);
        setPartiteLoaded(false);
      } else {

      setPartite([]);
      setPartiteLoaded(false);
      }
    } finally {
      setPartiteLoading(false);
    }
  };

  const fetchMovimenti = async (id) => {
    setMovimentiLoading(true);
    setErrorMessage(null);
    try {
      // Determina il conto attivo per il filtro
      const currentActiveContoId = filters.contoId !== 'tutti' && filters.contoId ? String(filters.contoId) : (conti.length > 0 ? String(conti[0].id) : null);
      const params = {
        conto_id: currentActiveContoId ? currentActiveContoId : undefined,
        tipo_operazione: filters.tipo && filters.tipo !== 'tutti' ? filters.tipo : undefined,
        stato: filters.stato !== 'tutti' ? filters.stato : undefined,
        categoria_id: filters.categoria !== 'tutte' ? filters.categoria : undefined,
        attrezzatura_id: filters.attrezzatura !== 'tutte' ? filters.attrezzatura : undefined,
        partita_id: filters.partita !== 'tutte' ? filters.partita : undefined,
        contratto_soccida_id: filters.contratto_soccida !== 'tutti' ? filters.contratto_soccida : undefined,
        search: filters.search || undefined,
        data_da: filters.from || undefined,
        data_a: filters.to || undefined,
      };
      const response = await amministrazioneService.getPrimaNotaMovimenti(id, params);
      const movimentiData = Array.isArray(response) ? response : response?.movimenti || [];
      setMovimenti(movimentiData);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setErrorMessage(null); // Non mostrare errore per 503
        setMovimenti([]);
      } else {

      setErrorMessage('Errore durante il caricamento dei movimenti.');
      setMovimenti([]);
      }
    } finally {
      setMovimentiLoading(false);
    }
  };

  const movimentiTotals = useMemo(() => {
    const totale = movimenti.reduce(
      (acc, movimento) => {
        const valore = Number(movimento.importo || 0);
        if (movimento.tipo_operazione === 'entrata') acc.entrate += valore;
        if (movimento.tipo_operazione === 'uscita') acc.uscite += valore;
        return acc;
      },
      { entrate: 0, uscite: 0 }
    );
    return {
      entrate: totale.entrate,
      uscite: totale.uscite,
      saldo: totale.entrate - totale.uscite,
    };
  }, [movimenti]);

  // Calcola statistiche mensili per ogni conto
  const [contiStats, setContiStats] = useState({});
  const [contiStatsLoading, setContiStatsLoading] = useState(false);

  const fetchContiStats = async (targetAziendaId) => {
    if (!targetAziendaId || conti.length === 0) {
      setContiStats({});
      return;
    }

    setContiStatsLoading(true);
    try {
      const oggi = new Date();
      const primoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth(), 1);
      const ultimoGiornoMese = new Date(oggi.getFullYear(), oggi.getMonth() + 1, 0);

      const statsPromises = conti.map(async (conto) => {
        try {
          const params = {
            conto_id: String(conto.id),
            data_da: primoGiornoMese.toISOString().split('T')[0],
            data_a: ultimoGiornoMese.toISOString().split('T')[0],
          };
          const movimentiConto = await amministrazioneService.getPrimaNotaMovimenti(targetAziendaId, params);
          const movimentiArray = Array.isArray(movimentiConto) ? movimentiConto : movimentiConto?.movimenti || [];

          const stats = movimentiArray.reduce(
            (acc, movimento) => {
              const valore = Number(movimento.importo || 0);
              if (movimento.tipo_operazione === 'entrata') acc.entrate += valore;
              if (movimento.tipo_operazione === 'uscita') acc.uscite += valore;
              acc.numeroMovimenti += 1;
              return acc;
            },
            { entrate: 0, uscite: 0, numeroMovimenti: 0 }
          );

          // Calcola saldo corrente (tutti i movimenti fino ad oggi)
          const paramsSaldo = {
            conto_id: String(conto.id),
            data_a: oggi.toISOString().split('T')[0],
          };
          const movimentiSaldo = await amministrazioneService.getPrimaNotaMovimenti(targetAziendaId, paramsSaldo);
          const movimentiSaldoArray = Array.isArray(movimentiSaldo) ? movimentiSaldo : movimentiSaldo?.movimenti || [];
          const saldo = movimentiSaldoArray.reduce((acc, movimento) => {
            const valore = Number(movimento.importo || 0);
            if (movimento.tipo_operazione === 'entrata') return acc + valore;
            if (movimento.tipo_operazione === 'uscita') return acc - valore;
            return acc;
          }, 0);

          return {
            contoId: conto.id,
            entrate: stats.entrate,
            uscite: stats.uscite,
            saldo: saldo,
            numeroMovimenti: stats.numeroMovimenti,
          };
        } catch (error) {
          return {
            contoId: conto.id,
            entrate: 0,
            uscite: 0,
            saldo: 0,
            numeroMovimenti: 0,
          };
        }
      });

      const statsResults = await Promise.all(statsPromises);
      const statsMap = {};
      statsResults.forEach((stat) => {
        statsMap[stat.contoId] = stat;
      });
      setContiStats(statsMap);
    } catch (error) {
      setContiStats({});
    } finally {
      setContiStatsLoading(false);
    }
  };

  useEffect(() => {
    if (showAccountsView && aziendaId && conti.length > 0) {
      fetchContiStats(aziendaId);
    }
  }, [showAccountsView, aziendaId, conti.length]);

  // Paginazione
  const paginatedMovimenti = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    return movimenti.slice(start, end);
  }, [movimenti, currentPage, itemsPerPage]);

  const totalPages = useMemo(() => {
    return Math.ceil(movimenti.length / itemsPerPage);
  }, [movimenti.length, itemsPerPage]);

  // Reset pagina quando cambiano i filtri
  useEffect(() => {
    setCurrentPage(1);
  }, [filtersKey]);

  const partiteById = useMemo(() => {
    const map = new Map();
    partite.forEach((partita) => map.set(Number(partita.id), partita));
    return map;
  }, [partite]);

  const describePartita = (partitaId) => {
    if (!partitaId) return '—';
    const partita = partiteById.get(Number(partitaId));
    if (!partita) return `Partita #${partitaId}`;

    const parts = [];
    if (partita.numero_partita) {
      parts.push(partita.numero_partita);
    } else {
      parts.push(`Partita #${partita.id}`);
    }

    if (partita.modalita_gestione) {
      const modalitaLabel = formatModalitaLabel(partita.modalita_gestione);
      if (modalitaLabel) {
        parts.push(modalitaLabel);
      }
    }

    if (typeof partita.numero_capi === 'number' && partita.numero_capi > 0) {
      parts.push(`${partita.numero_capi} capi`);
    }

    return parts.join(' · ');
  };

  const handleSelectConto = (contoId) => {
    setFilters((prev) => ({ ...prev, contoId: String(contoId) }));
  };

  const handleOpenContoModal = (conto = null) => {
    setEditingConto(conto);
    setShowContoModal(true);
  };

  const handleSaveConto = async (payload, contoId = null) => {
    if (!aziendaId) {
      window.alert('Seleziona un\'azienda prima di gestire i conti.');
      return;
    }

    try {
      if (contoId) {
        await amministrazioneService.updatePrimaNotaConto(contoId, payload);
        await fetchSetup(aziendaId, { focusContoId: contoId });
        setFilters((prev) => ({ ...prev, contoId: String(contoId) }));
      } else {
        const response = await amministrazioneService.createPrimaNotaConto({
          ...payload,
          azienda_id: aziendaId,
        });
        const nuovoContoId = response?.id ?? null;
        await fetchSetup(aziendaId, { focusContoId: nuovoContoId });
        if (nuovoContoId) {
          setFilters((prev) => ({ ...prev, contoId: String(nuovoContoId) }));
        }
      }

      setShowContoModal(false);
      setEditingConto(null);
    } catch (error) {
      const detail = error?.response?.data?.detail;
      const message = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
          ? detail.map((e) => e?.msg ?? e).join(', ')
          : error?.response?.data?.detail || error?.message || 'Operazione non riuscita. Controlla i dati inseriti.';
      window.alert(message);
    }
  };

  const handleOpenIbanModal = (conto = null) => {
    if (!conto) return;
    const contoTarget = contiById.get(Number(conto.id)) || conto;
    setIbanConto(contoTarget);
    setShowIbanModal(true);
  };

  const handleCreateIban = async (contoId, payload) => {
    if (!aziendaId) {
      throw new Error('Seleziona un\'azienda prima di gestire gli IBAN.');
    }
    try {
      await amministrazioneService.createPrimaNotaContoIban(contoId, payload);
      const data = await fetchSetup(aziendaId, { focusContoId: contoId });
      const updated = data.conti.find((item) => Number(item.id) === Number(contoId));
      if (updated) {
        setIbanConto(updated);
      }
    } catch (error) {

      throw new Error(resolveErrorMessage(error, 'Impossibile aggiungere l\'IBAN.'));
    }
  };

  const handleUpdateIban = async (ibanId, payload, contoId) => {
    if (!aziendaId) {
      throw new Error('Seleziona un\'azienda prima di gestire gli IBAN.');
    }
    try {
      await amministrazioneService.updatePrimaNotaContoIban(ibanId, payload);
      const data = await fetchSetup(aziendaId, { focusContoId: contoId });
      const updated = data.conti.find((item) => Number(item.id) === Number(contoId));
      if (updated) {
        setIbanConto(updated);
      }
    } catch (error) {

      throw new Error(resolveErrorMessage(error, 'Impossibile aggiornare l\'IBAN selezionato.'));
    }
  };

  const handleDeleteIban = async (ibanId, contoId) => {
    if (!aziendaId) {
      throw new Error('Seleziona un\'azienda prima di gestire gli IBAN.');
    }
    try {
      await amministrazioneService.deletePrimaNotaContoIban(ibanId);
      const data = await fetchSetup(aziendaId, { focusContoId: contoId });
      const updated = data.conti.find((item) => Number(item.id) === Number(contoId));
      if (updated) {
        setIbanConto(updated);
      }
    } catch (error) {

      throw new Error(resolveErrorMessage(error, 'Impossibile eliminare l\'IBAN selezionato.'));
    }
  };

  const handleToggleContoAttivo = async (conto, prossimoStato) => {
    if (!aziendaId) {
      window.alert('Seleziona un\'azienda prima di gestire i conti.');
      return;
    }
    try {
      await amministrazioneService.updatePrimaNotaConto(conto.id, { attivo: prossimoStato });
      await fetchSetup(aziendaId, { focusContoId: conto.id });
    } catch (error) {

      window.alert(resolveErrorMessage(error, 'Impossibile aggiornare lo stato del conto.'));
    }
  };

  const handleDeleteConto = async (conto) => {
    if (!aziendaId) {
      window.alert('Seleziona un\'azienda prima di gestire i conti.');
      return;
    }
    if (!window.confirm(`Vuoi eliminare definitivamente il conto "${conto.nome}"?`)) return;

    try {
      await amministrazioneService.deletePrimaNotaConto(conto.id);
      await fetchSetup(aziendaId);
      setFilters((prev) => {
        if (String(prev.contoId) === String(conto.id)) {
          return { ...prev, contoId: 'tutti' };
        }
        return prev;
      });
    } catch (error) {

      window.alert(resolveErrorMessage(error, 'Impossibile eliminare il conto selezionato.'));
    }
  };

  const handleResetFilters = () => {
    setFilters((prev) => ({
      ...EMPTY_FILTERS,
      contoId: prev.contoId,
    }));
  };

  const handleOpenMovimentoModal = async (movimento = null) => {
    if (aziendaId && !partiteLoaded && !partiteLoading) {
      await fetchPartite(aziendaId);
    }
    // Se stiamo modificando un movimento, ricaricalo per avere tutte le relazioni (incluse partite collegate)
    if (movimento?.id) {
      try {
        const movimentoCompleto = await amministrazioneService.getPrimaNotaMovimento(movimento.id);
        setEditingMovimento(movimentoCompleto);
      } catch (error) {
        console.error('Errore nel caricamento movimento:', error);
        // Fallback al movimento dalla lista se il caricamento fallisce
    setEditingMovimento(movimento);
      }
    } else {
      setEditingMovimento(movimento);
    }
    setShowMovimentoModal(true);
  };

  const handleSaveMovimento = async (payload, movimentoId = null) => {
    try {
      if (movimentoId) {
        await amministrazioneService.updatePrimaNotaMovimento(movimentoId, payload);
      } else if (payload.tipo_operazione === 'giroconto') {
        await amministrazioneService.createPrimaNotaGiroconto(payload);
      } else {
        await amministrazioneService.createPrimaNotaMovimento(payload);
      }
      setShowMovimentoModal(false);
      setEditingMovimento(null);
      await fetchMovimenti(aziendaId);
      await fetchSetup(aziendaId);
    } catch (error) {

      window.alert('Impossibile salvare il movimento. Verifica i dati inseriti.');
    }
  };

  const handleDeleteMovimento = async (movimento) => {
    if (!window.confirm('Vuoi eliminare il movimento selezionato?')) return;
    try {
      await amministrazioneService.deletePrimaNotaMovimento(movimento.id);
      await fetchMovimenti(aziendaId);
      await fetchSetup(aziendaId);
    } catch (error) {

      window.alert('Eliminazione non riuscita.');
    }
  };

  const handleConfirmMovimento = async (movimento) => {
    try {
      await amministrazioneService.confirmPrimaNotaMovimento(movimento.id);
      await fetchMovimenti(aziendaId);
    } catch (error) {

      window.alert('Non è stato possibile confermare il movimento.');
    }
  };

  const handleOpenReconcil = async () => {
    if (!aziendaId) return;
    setShowReconcilModal(true);
    setDocumentiLoading(true);
    try {
      const response = await amministrazioneService.getPrimaNotaDocumenti(aziendaId);
      setDocumentiDisponibili(normalizeDocumenti(response));
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setDocumentiDisponibili([]);
      } else {

      setDocumentiDisponibili([]);
      }
    } finally {
      setDocumentiLoading(false);
    }
  };

  const handleSaveReconcil = async (payload) => {
    try {
      await amministrazioneService.createPrimaNotaMovimento(payload);
      setShowReconcilModal(false);
      setDocumentiDisponibili([]);
      await fetchMovimenti(aziendaId);
      await fetchSetup(aziendaId);
    } catch (error) {

      window.alert('Operazione non riuscita. Controlla i dati e riprova.');
    }
  };

  // Determina il conto attivo per la visualizzazione (già calcolato sopra)
  const contoAttivo = activeTabContoId ? contiById.get(Number(activeTabContoId)) : null;

  const handleSelectContoFromCard = (contoId) => {
    setShowAccountsView(false);
    handleSelectConto(String(contoId));
  };

  const handleBackToAccountsView = () => {
    setShowAccountsView(true);
    setFilters(EMPTY_FILTERS);
  };

  // Filtra conti per ricerca e tipo
  const contiFiltrati = useMemo(() => {
    let filtered = conti;
    
    // Filtro per ricerca testo
    if (contoSearchFilter.trim()) {
      const searchLower = contoSearchFilter.toLowerCase();
      filtered = filtered.filter((conto) =>
        conto.nome.toLowerCase().includes(searchLower)
      );
    }
    
    // Filtro per tipo
    const tipoFilter = filters.contoTipo || '';
    if (tipoFilter && tipoFilter !== 'tutti') {
      filtered = filtered.filter((conto) => {
        const tipoValue = typeof conto.tipo === 'string' ? conto.tipo : conto.tipo?.value;
        return tipoValue === tipoFilter;
      });
    }
    
    return filtered;
  }, [conti, contoSearchFilter, filters.contoTipo]);

  // Paginazione card conti
  const contiPaginati = useMemo(() => {
    const startIndex = (accountsCurrentPage - 1) * accountsPerPage;
    const endIndex = startIndex + accountsPerPage;
    return contiFiltrati.slice(startIndex, endIndex);
  }, [contiFiltrati, accountsCurrentPage, accountsPerPage]);

  const totalAccountsPages = Math.ceil(contiFiltrati.length / accountsPerPage);

  // Reset pagina quando cambiano i filtri
  useEffect(() => {
    setAccountsCurrentPage(1);
  }, [contoSearchFilter, filters.contoTipo]);

  const isAnyModalOpen = showContoModal || showIbanModal || showContoDetailsModal || showMovimentoModal || showReconcilModal;

  return (
    <div className={`gestione-prima-nota ${isAnyModalOpen ? 'modal-open' : ''}`}>

      {errorMessage && <div className="alert warning">{errorMessage}</div>}

      {/* Sistema a tabs per i conti */}
      {setupLoading ? (
        <div className="empty-state">Caricamento conti...</div>
      ) : contiCassaBanca.length === 0 ? (
        <div className="empty-state">
          <p>Crea almeno un conto <strong>Cassa</strong> o <strong>Banca</strong> per iniziare.</p>
          <p className="empty-state-hint">Vendite, acquisti, IVA e crediti/debiti verso clienti e fornitori sono gestiti automaticamente in base alle fatture.</p>
          <div className="empty-state__actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={!canOperate}
              onClick={() => handleOpenContoModal()}
            >
              Aggiungi conto Cassa o Banca
            </button>
          </div>
        </div>
      ) : showAccountsView ? (
        /* Vista iniziale: Card conti con statistiche */
        <div className="accounts-view">
          <div className="accounts-view-header">
            <button
              type="button"
              className="btn btn-secondary btn-sync-fatture"
              onClick={handleSyncFatture}
              disabled={!canOperate || syncFattureLoading}
              title="Genera i movimenti di Prima Nota per tutte le fatture esistenti"
            >
              {syncFattureLoading ? 'Sincronizzazione...' : 'Sincronizza fatture'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => handleOpenContoModal()}
              disabled={!canOperate || setupLoading}
            >
              Nuovo Conto
            </button>
          </div>
          
          {contiStatsLoading ? (
            <div className="loading">Caricamento statistiche...</div>
          ) : (
            <>
              <div className="accounts-view-layout">
              {/* Sidebar filtri conti */}
              <div className="accounts-sidebar">
                <div className="accounts-sidebar-header">
                  <h3>Filtra Conti</h3>
                </div>
                <div className="accounts-sidebar-content">
                  <div className="filter-group-vertical">
                    <label>Ricerca</label>
                    <input
                      type="text"
                      placeholder="Cerca conto..."
                      value={contoSearchFilter}
                      onChange={(e) => setContoSearchFilter(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <div className="filter-group-vertical">
                    <label>Tipo</label>
                    <SmartSelect
                      options={[
                        { value: 'cassa', label: 'Cassa' },
                        { value: 'banca', label: 'Banca' },
                        { value: 'altro', label: 'Altro' },
                      ]}
                      value={filters.contoTipo || ''}
                      onChange={(e) => setFilters((prev) => ({ ...prev, contoTipo: e.target.value }))}
                      displayField="label"
                      valueField="value"
                      placeholder="Tutti"
                      allowEmpty={true}
                    />
                  </div>
                  <div className="accounts-count">
                    <span className="accounts-count-label">
                      {contiFiltrati.length} di {conti.length} conti
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Grid conti */}
              <div className="accounts-grid">
                {contiPaginati.map((conto) => {
                const stats = contiStats[conto.id] || {
                  entrate: 0,
                  uscite: 0,
                  saldo: 0,
                  numeroMovimenti: 0,
                };
                const tipoValue = typeof conto.tipo === 'string' ? conto.tipo : conto.tipo?.value;
                
                return (
                  <div
                    key={conto.id}
                    className="account-card"
                    onClick={() => handleSelectContoFromCard(conto.id)}
                  >
                    <div className="account-card-header">
                      <h3 className="account-card-title">{conto.nome}</h3>
                      <span className={`account-badge account-badge--${tipoValue || 'altro'}`}>
                        {formatContoTipo(tipoValue)}
                      </span>
                      {conto.sistema && (
                        <span className="account-badge account-badge--sistema" title="Conto di sistema (sola lettura)">
                          Sistema
                        </span>
                      )}
                    </div>
                    
                    <div className="account-card-balance">
                      <span className="account-balance-label">Saldo Corrente</span>
                      <span className={`account-balance-value ${stats.saldo >= 0 ? 'positive' : 'negative'}`}>
                        {formatCurrency(stats.saldo)}
                      </span>
                    </div>
                    
                    <div className="account-card-stats">
                      <div className="account-stat">
                        <span className="account-stat-label">Entrate (Mese)</span>
                        <span className="account-stat-value positive">{formatCurrency(stats.entrate)}</span>
                      </div>
                      <div className="account-stat">
                        <span className="account-stat-label">Uscite (Mese)</span>
                        <span className="account-stat-value negative">{formatCurrency(stats.uscite)}</span>
                      </div>
                      <div className="account-stat">
                        <span className="account-stat-label">Movimenti (Mese)</span>
                        <span className="account-stat-value">{stats.numeroMovimenti}</span>
                      </div>
                    </div>
                    
                    {!conto.attivo && (
                      <div className="account-card-status">
                        <span className="account-status-badge">Disattivato</span>
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
              </div>

              {/* Paginazione card conti - minimal style, fuori dal layout flex */}
              {totalAccountsPages > 1 && (
                <div className="pagination-fixed-bottom">
                  <div className="pagination pagination-minimal">
                    <div className="pagination-controls">
                      <button
                        className="pagination-btn-prev"
                        onClick={() => setAccountsCurrentPage(prev => Math.max(1, prev - 1))}
                        disabled={accountsCurrentPage === 1}
                      >
                        ←
                      </button>
                    {Array.from({ length: totalAccountsPages }, (_, i) => i + 1).map((page) => {
                      // Mostra sempre la prima, l'ultima, la corrente e quelle adiacenti
                      const showPage = 
                        page === 1 ||
                        page === totalAccountsPages ||
                        (page >= accountsCurrentPage - 1 && page <= accountsCurrentPage + 1);
                      
                      if (!showPage) {
                        // Mostra ellissi solo se necessario
                        if (page === accountsCurrentPage - 2 || page === accountsCurrentPage + 2) {
                          return <span key={page} className="pagination-ellipsis">...</span>;
                        }
                        return null;
                      }
                      
                      return (
                        <button
                          key={page}
                          className={`pagination-btn ${page === accountsCurrentPage ? 'active' : ''}`}
                          onClick={() => setAccountsCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}
                    <button
                      className="pagination-btn-next"
                      onClick={() => setAccountsCurrentPage(prev => Math.min(totalAccountsPages, prev + 1))}
                      disabled={accountsCurrentPage === totalAccountsPages}
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
      ) : (
        <>
          {/* Header con pulsante indietro e azioni */}
          <div className="prima-nota-tabs">
            <div className="prima-nota-tabs-scroll">
              <button
                type="button"
                className="btn btn-secondary btn-sm btn-back-to-accounts"
                onClick={handleBackToAccountsView}
              >
                ← Vista Conti
              </button>
            </div>

            <div className="prima-nota-actions-inline">
              <button
                type="button"
                className="btn btn-secondary btn-sync-fatture"
                onClick={handleSyncFatture}
                disabled={!canOperate || syncFattureLoading}
                title="Genera i movimenti di Prima Nota per tutte le fatture esistenti"
              >
                {syncFattureLoading ? 'Sincronizzazione...' : 'Sincronizza fatture'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!canOperate || setupLoading}
                onClick={handleOpenReconcil}
              >
                Registra incasso / pagamento
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canOperate || setupLoading}
                onClick={() => handleOpenMovimentoModal()}
              >
                Nuovo movimento manuale
              </button>
            </div>
          </div>

          {/* Contenuto della tab attiva */}
          {contoAttivo && (
            <div className="prima-nota-tab-content">
              {/* Sezione sottile statistiche conto */}
              <div className="conto-stats-bar">
                <div className="conto-stats-item">
                  <span className="conto-stats-label">Entrate</span>
                  <span className="conto-stats-value positive">{formatCurrency(movimentiTotals.entrate)}</span>
                </div>
                <div className="conto-stats-item">
                  <span className="conto-stats-label">Uscite</span>
                  <span className="conto-stats-value negative">{formatCurrency(movimentiTotals.uscite)}</span>
                </div>
                <div className="conto-stats-item">
                  <span className="conto-stats-label">Saldo iniziale</span>
                  <span className="conto-stats-value">{formatCurrency(contoAttivo.saldo_iniziale)}</span>
                </div>
                <div className="conto-stats-item">
                  <span className="conto-stats-label">Saldo attuale</span>
                  <span className="conto-stats-value">{formatCurrency(contoAttivo.saldo_attuale)}</span>
                </div>
                <div className="conto-stats-item">
                  <span className="conto-stats-label">Movimenti provvisori</span>
                  <span className="conto-stats-value">{contoAttivo.movimenti_provvisori || 0}</span>
                </div>
              </div>

              {/* Sezione movimenti - Layout a 2 colonne: filtri verticali + tabella */}
              <section className="movimenti-panel">
                <div className="movimenti-layout">
                  {/* Filtri verticali a sinistra */}
                  <div className="movimenti-filters-sidebar">
                    <div className="filters-sidebar-header">
                      <h3 className="filters-title">Filtri</h3>
                      <button 
                        type="button" 
                        className="btn btn-tertiary btn-sm" 
                        onClick={handleResetFilters}
                      >
                        Pulisci
                      </button>
                    </div>
                    
                    <div className="filters-sidebar-content">
                      <div className="filter-group-vertical">
                        <label>Tipo movimento</label>
                        <SmartSelect
                          options={FILTRO_TIPO_OPTIONS}
                          value={filters.tipo}
                          onChange={(e) => setFilters((prev) => ({ ...prev, tipo: e.target.value }))}
                          displayField="label"
                          valueField="value"
                          placeholder="Tutti"
                          allowEmpty={true}
                        />
                      </div>
                      
                      <div className="filter-group-vertical">
                        <label>Stato</label>
                        <SmartSelect
                          options={FILTRO_STATO_OPTIONS}
                          value={filters.stato}
                          onChange={(e) => setFilters((prev) => ({ ...prev, stato: e.target.value }))}
                          displayField="label"
                          valueField="value"
                          placeholder="Tutti"
                          allowEmpty={false}
                        />
                      </div>
                      
                      <div className="filter-group-vertical">
                        <button
                          type="button"
                          className="btn btn-tertiary btn-sm"
                          onClick={() => setShowFiltriAvanzati((v) => !v)}
                          style={{ padding: '0.25rem 0', fontSize: '0.85rem' }}
                        >
                          {showFiltriAvanzati ? '▼ Nascondi filtri avanzati' : '▶ Filtri avanzati'}
                        </button>
                        {showFiltriAvanzati && (
                          <>
                            <div className="filter-group-vertical">
                              <label>Categoria</label>
                              <SmartSelect
                                options={categoriaFilterOptions}
                                value={filters.categoria}
                                onChange={(e) => setFilters((prev) => ({ ...prev, categoria: e.target.value }))}
                                displayField="label"
                                valueField="value"
                                placeholder="Tutte"
                                allowEmpty={false}
                              />
                            </div>
                            <div className="filter-group-vertical">
                              <label>Attrezzatura</label>
                              <SmartSelect
                                options={attrezzaturaFilterOptions}
                                value={filters.attrezzatura}
                                onChange={(e) => setFilters((prev) => ({ ...prev, attrezzatura: e.target.value }))}
                                displayField="label"
                                valueField="value"
                                placeholder="Tutte"
                                allowEmpty={false}
                              />
                            </div>
                            <div className="filter-group-vertical">
                              <label>Partita</label>
                              <SmartSelect
                                options={partitaFilterOptions}
                                value={filters.partita}
                                onChange={(e) => setFilters((prev) => ({ ...prev, partita: e.target.value }))}
                                displayField="label"
                                valueField="value"
                                placeholder="Tutte"
                                allowEmpty={false}
                              />
                            </div>
                            <div className="filter-group-vertical">
                              <label>Contratto Soccida</label>
                              <SmartSelect
                                options={contrattoSoccidaFilterOptions || [{ value: 'tutti', label: 'Tutti' }]}
                                value={filters.contratto_soccida}
                                onChange={(e) => setFilters((prev) => ({ ...prev, contratto_soccida: e.target.value }))}
                                displayField="label"
                                valueField="value"
                                placeholder="Tutti"
                                allowEmpty={false}
                              />
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="filter-group-vertical">
                        <label>Ricerca</label>
                        <input
                          type="text"
                          placeholder="Descrizione o controparte"
                          value={filters.search}
                          onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                        />
                      </div>
                      
                      <div className="filter-group-vertical">
                        <label>Periodo</label>
                        <div className="date-range-vertical">
                          <input
                            type="date"
                            value={filters.from}
                            onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                            placeholder="Da"
                            title="Data da"
                          />
                          <span className="date-separator">→</span>
                          <input
                            type="date"
                            value={filters.to}
                            onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                            placeholder="A"
                            title="Data a"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Tabella movimenti a destra */}
                  <div className="movimenti-table-wrapper">

          {movimentiLoading ? (
          <div className="loading">Caricamento movimenti...</div>
          ) : (
          <>
          <div className="table-container">
            <table className="data-table">
              <thead className="table-header-sticky">
                <tr>
                  <th>Data</th>
                  <th>Descrizione</th>
                  <th>Categoria</th>
                  <th>Controparte</th>
                  <th className="align-right">Dare</th>
                  <th className="align-right">Avere</th>
                  <th>Stato</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMovimenti.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Nessun movimento per i criteri scelti
                    </td>
                  </tr>
                ) : (
                  paginatedMovimenti.map((movimento) => (
                  <tr 
                    key={movimento.id}
                    onClick={() => handleOpenMovimentoModal(movimento)}
                  >
                    <td>{formatDate(movimento.data)}</td>
                    <td>{movimento.descrizione}</td>
                    <td>{movimento.categoria_label || movimento.categoria_nome || '-'}</td>
                    <td>{movimento.contropartita_nome || '-'}</td>
                    <td className="align-right">
                      {movimento.tipo_operazione === 'uscita'
                        ? formatCurrency(movimento.importo)
                        : '—'}
                    </td>
                    <td className="align-right">
                      {movimento.tipo_operazione === 'entrata'
                        ? formatCurrency(movimento.importo)
                        : '—'}
                    </td>
                    <td>
                      <span
                        className={`badge ${
                          movimento.stato === 'definitivo' ? 'badge-success' : 'badge-warning'
                        }`}
                      >
                        {movimento.stato || '—'}
                      </span>
                    </td>
                  </tr>
                  ))
                )}
              </tbody>
            </table>
        </div>
        </>
        )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {showContoModal && (
        <ContoModal
          open={showContoModal}
          conto={editingConto}
          onClose={() => {
            setShowContoModal(false);
            setEditingConto(null);
          }}
          onSave={handleSaveConto}
        />
      )}

      {showContoDetailsModal && selectedContoForDetails && (
        <ContoDetailsModal
          open={showContoDetailsModal}
          conto={selectedContoForDetails}
          onClose={() => {
            setShowContoDetailsModal(false);
            setSelectedContoForDetails(null);
          }}
          onEdit={selectedContoForDetails.sistema ? undefined : () => {
            setShowContoDetailsModal(false);
            handleOpenContoModal(selectedContoForDetails);
          }}
          onToggleActive={selectedContoForDetails.sistema ? undefined : () => {
            handleToggleContoAttivo(selectedContoForDetails, !selectedContoForDetails.attivo);
            setShowContoDetailsModal(false);
            setSelectedContoForDetails(null);
          }}
          onManageIban={selectedContoForDetails.sistema ? undefined : () => {
            setShowContoDetailsModal(false);
            handleOpenIbanModal(selectedContoForDetails);
          }}
          onDelete={selectedContoForDetails.sistema ? undefined : () => {
            handleDeleteConto(selectedContoForDetails);
            setShowContoDetailsModal(false);
            setSelectedContoForDetails(null);
          }}
        />
      )}

      {showIbanModal && ibanConto && (
        <ContoIbanModal
          open={showIbanModal}
          conto={ibanConto}
          onClose={() => {
            setShowIbanModal(false);
            setIbanConto(null);
          }}
          onCreate={handleCreateIban}
          onUpdate={handleUpdateIban}
          onDelete={handleDeleteIban}
        />
      )}

      {showMovimentoModal && (
        <MovimentoModal
          open={showMovimentoModal}
          onClose={() => {
            setShowMovimentoModal(false);
            setEditingMovimento(null);
          }}
          onSave={handleSaveMovimento}
          onDelete={handleDeleteMovimento}
          conti={contiCassaBanca}
          categorie={categorie}
          movimento={editingMovimento}
          preferenze={preferenze}
          filtroContoId={filters.contoId}
          partite={partite}
          partiteLoading={partiteLoading}
          attrezzature={attrezzature}
        />
      )}

      {showReconcilModal && (
        <ReconciliaModal
          open={showReconcilModal}
          loading={documentiLoading}
          documenti={documentiDisponibili}
          conti={contiCassaBanca}
          preferenze={preferenze}
          categorie={categorie}
          onClose={() => {
            setShowReconcilModal(false);
            setDocumentiDisponibili([]);
          }}
          onSave={handleSaveReconcil}
        />
      )}

      {/* Sezione paginazione fissa in basso - solo nella vista movimenti */}
      {!showAccountsView && contoAttivo && movimenti.length > itemsPerPage && (
        <div className="pagination-fixed-bottom">
          <div className="pagination pagination-minimal">
            <div className="pagination-controls">
              <button
                className="pagination-btn-prev"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </button>
                    ));
                  }
                  
                  // Se ci sono almeno 5 pagine, mostra sempre 5 numeri con la pagina corrente al centro
                  // 2 numeri prima e 2 numeri dopo la pagina corrente
                  const startPage = Math.max(1, currentPage - 2);
                  const endPage = Math.min(totalPages, currentPage + 2);
                  
                  let pagesToShow = [];
                  for (let i = startPage; i <= endPage; i++) {
                    pagesToShow.push(i);
                  }
                  
                  // Se abbiamo meno di 5 numeri, aggiungi placeholder
                  if (pagesToShow.length < 5) {
                    if (currentPage <= 3) {
                      // Siamo all'inizio, aggiungi placeholder alla fine
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
                      // Siamo alla fine, aggiungi placeholder all'inizio
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
                      // Nel mezzo, bilancia placeholder
                      const needed = 5 - pagesToShow.length;
                      const before = Math.floor(needed / 2);
                      const after = needed - before;
                      
                      for (let i = 0; i < before && pagesToShow[0] > 1; i++) {
                        pagesToShow.unshift(pagesToShow[0] - 1);
                      }
                      for (let i = 0; i < after && pagesToShow[pagesToShow.length - 1] < totalPages; i++) {
                        pagesToShow.push(pagesToShow[pagesToShow.length - 1] + 1);
                      }
                      
                      // Se ancora non abbiamo 5, aggiungi placeholder
                      while (pagesToShow.length < 5) {
                        if (pagesToShow[0] === 1) {
                          pagesToShow.push(null);
                        } else {
                          pagesToShow.unshift(null);
                        }
                      }
                    }
                  }
                  
                  // Assicurati di avere esattamente 5 elementi
                  while (pagesToShow.length > 5) {
                    if (pagesToShow[0] < currentPage - 2) {
                      pagesToShow.shift();
                    } else {
                      pagesToShow.pop();
                    }
                  }
                  
                  return pagesToShow.map((item, idx) => {
                    if (item === null) {
                      // Placeholder invisibile per mantenere la larghezza
                      return <span key={`placeholder-${idx}`} className="pagination-btn pagination-btn-placeholder">1</span>;
                    }
                    return (
                      <button
                        key={item}
                        className={`pagination-btn ${item === currentPage ? 'active' : ''}`}
                        onClick={() => setCurrentPage(item)}
                      >
                        {item}
                      </button>
                    );
                  });
                })()}
              </div>
              <button
                className="pagination-btn-next"
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ContoModal = ({ open, onClose, onSave, conto }) => {
  const isEditing = Boolean(conto);
  const [nome, setNome] = useState('');
  const [tipo, setTipo] = useState('cassa');
  const [giroconto, setGiroconto] = useState('automatico');
  const [saldoIniziale, setSaldoIniziale] = useState('0');
  const [saldoAttuale, setSaldoAttuale] = useState('0');
  const [note, setNote] = useState('');
  const [attivo, setAttivo] = useState(true);
  useEffect(() => {
    if (!open) return;

    if (conto) {
      setNome(conto.nome || '');
      setTipo(typeof conto.tipo === 'string' ? conto.tipo : conto.tipo?.value || 'cassa');
      const strategia = typeof conto.giroconto_strategia === 'string'
        ? conto.giroconto_strategia
        : conto.giroconto_strategia?.value;
      setGiroconto(strategia || 'automatico');
      setSaldoIniziale(
        conto.saldo_iniziale !== undefined && conto.saldo_iniziale !== null
          ? String(conto.saldo_iniziale)
          : '0'
      );
      setSaldoAttuale(
        conto.saldo_attuale !== undefined && conto.saldo_attuale !== null
          ? String(conto.saldo_attuale)
          : ''
      );
      setNote(conto.note || '');
      setAttivo(conto.attivo ?? true);
    } else {
      setNome('');
      setTipo('cassa');
      setGiroconto('automatico');
      setSaldoIniziale('0');
      setSaldoAttuale('0');
      setNote('');
      setAttivo(true);
    }
  }, [open, conto]);

  const handleSubmit = (event) => {
    event.preventDefault();

    const trimmedName = nome.trim();
    if (!trimmedName) {
      window.alert('Inserisci il nome del conto.');
      return;
    }

    const saldoInizialeNumber = Number(saldoIniziale || 0);
    if (Number.isNaN(saldoInizialeNumber)) {
      window.alert('Saldo iniziale non valido.');
      return;
    }

    const payload = {
      nome: trimmedName,
      tipo,
      attivo,
      giroconto_strategia: giroconto,
      note: note && note.trim() ? note.trim() : null,
    };

    if (!isEditing || saldoIniziale !== '') {
      payload.saldo_iniziale = saldoInizialeNumber;
    }

    if (saldoAttuale !== '' && saldoAttuale !== null) {
      const saldoAttualeNumber = Number(saldoAttuale);
      if (Number.isNaN(saldoAttualeNumber)) {
        window.alert('Saldo attuale non valido.');
        return;
      }
      payload.saldo_attuale = saldoAttualeNumber;
    } else if (!isEditing) {
      payload.saldo_attuale = saldoInizialeNumber;
    }

    onSave(payload, conto?.id || null);
  };

  const footerActions = (
    <>
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Annulla
      </button>
      <button type="submit" className="btn btn-primary" form="conto-form">
        Salva
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Modifica conto' : 'Nuovo conto prima nota'}
      size="medium"
      footerActions={footerActions}
    >
      <form id="conto-form" className="movimento-form conto-modal-form" onSubmit={handleSubmit}>
          <div className="conto-modal-form__grid">
            <div className="conto-modal-form__field">
              <label htmlFor="conto-nome">Nome conto *</label>
              <input
                id="conto-nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Es: Cassa, Banca principale"
                required
              />
            </div>
            <div className="conto-modal-form__field">
              <label htmlFor="conto-tipo">Tipo *</label>
              <SmartSelect
                id="conto-tipo"
                className="select-compact"
                options={TIPO_CONTO_OPTIONS}
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                displayField="label"
                valueField="value"
                required
              />
            </div>
            <div className="conto-modal-form__field">
              <label htmlFor="conto-giroconto">Strategia giroconto</label>
              <SmartSelect
                id="conto-giroconto"
                className="select-compact"
                options={GIROCONTO_OPTIONS}
                value={giroconto}
                onChange={(e) => setGiroconto(e.target.value)}
                displayField="label"
                valueField="value"
              />
            </div>
            <div className="conto-modal-form__field">
              <label htmlFor="conto-saldo-iniziale">Saldo iniziale (€)</label>
              <input
                id="conto-saldo-iniziale"
                type="number"
                min="0"
                step="0.01"
                value={saldoIniziale}
                onChange={(e) => setSaldoIniziale(e.target.value)}
              />
              <small className="form-hint">Valore di partenza alla creazione del conto.</small>
            </div>
            <div className="conto-modal-form__field">
              <label htmlFor="conto-saldo-attuale">Saldo attuale (€)</label>
              <input
                id="conto-saldo-attuale"
                type="number"
                step="0.01"
                value={saldoAttuale}
                onChange={(e) => setSaldoAttuale(e.target.value)}
                placeholder="Vuoto = invariato"
              />
              <small className="form-hint">Solo in modifica: imposta manualmente il saldo.</small>
            </div>
          </div>

          <div className="conto-modal-form__row conto-modal-form__row--checkbox">
            <label className="conto-modal-form__checkbox-label">
              <input
                type="checkbox"
                checked={attivo}
                onChange={(e) => setAttivo(e.target.checked)}
              />
              <span>Conto attivo</span>
            </label>
            <small className="form-hint">Disattiva per escluderlo dai nuovi movimenti.</small>
          </div>

          <div className="conto-modal-form__field conto-modal-form__field--full">
            <label htmlFor="conto-note">Note (opzionale)</label>
            <textarea
              id="conto-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Eventuali note sul conto"
              rows={2}
            />
          </div>

        </form>
    </BaseModal>
  );
};

const ContoIbanModal = ({
  open,
  conto,
  onClose,
  onCreate,
  onUpdate,
  onDelete,
}) => {
  const [formData, setFormData] = useState({
    iban: '',
    descrizione: '',
    predefinito: false,
    attivo: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  const sortedIbans = useMemo(() => {
    if (!conto?.ibans) return [];
    return [...conto.ibans].sort((a, b) => {
      if (a.predefinito !== b.predefinito) {
        return a.predefinito ? -1 : 1;
      }
      if (a.attivo !== b.attivo) {
        return a.attivo ? -1 : 1;
      }
      return a.iban.localeCompare(b.iban);
    });
  }, [conto]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setFormData({
        iban: '',
        descrizione: '',
        predefinito: false,
        attivo: true,
      });
    } else if (conto && editingId === null) {
      setFormData({
        iban: '',
        descrizione: '',
        predefinito: sortedIbans.length === 0,
        attivo: true,
      });
    }
  }, [open, conto?.id, sortedIbans.length, editingId]);

  if (!open || !conto) return null;

  const resetForm = () => {
    setEditingId(null);
    setFormData({
      iban: '',
      descrizione: '',
      predefinito: sortedIbans.length === 0,
      attivo: true,
    });
  };

  const handleEdit = (ibanRecord) => {
    setEditingId(ibanRecord.id);
    setFormData({
      iban: ibanRecord.iban,
      descrizione: ibanRecord.descrizione || '',
      predefinito: ibanRecord.predefinito,
      attivo: ibanRecord.attivo,
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const sanitizedIban = formData.iban.replace(/\s+/g, '').toUpperCase();
    if (!sanitizedIban) {
      window.alert('Inserisci un IBAN valido.');
      return;
    }
    setSaving(true);
    const payload = {
      iban: sanitizedIban,
      descrizione: formData.descrizione.trim() || null,
      predefinito: formData.predefinito,
      attivo: formData.attivo,
    };
    try {
      if (editingId) {
        await onUpdate(editingId, payload, conto.id);
      } else {
        await onCreate(conto.id, payload);
      }
      resetForm();
    } catch (error) {
      window.alert(error.message || 'Operazione non riuscita.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ibanRecord) => {
    if (!window.confirm(`Vuoi eliminare l'IBAN ${ibanRecord.iban}?`)) return;
    setSaving(true);
    try {
      await onDelete(ibanRecord.id, conto.id);
      if (editingId === ibanRecord.id) {
        resetForm();
      }
    } catch (error) {
      window.alert(error.message || 'Impossibile eliminare l\'IBAN selezionato.');
    } finally {
      setSaving(false);
    }
  };

  const footerActions = (
    <>
      {editingId && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={resetForm}
          disabled={saving}
        >
          Annulla modifica
          </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
        Chiudi
      </button>
      <button type="submit" className="btn btn-primary" form="iban-form" disabled={saving}>
        {editingId ? 'Salva IBAN' : 'Aggiungi IBAN'}
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Gestione IBAN · ${conto?.nome || ''}`}
      size="large"
      footerActions={footerActions}
    >
          {sortedIbans.length === 0 ? (
            <div className="empty-state">
              Nessun IBAN associato. Aggiungi il primo IBAN per questo conto banca.
            </div>
          ) : (
            <div className="iban-list">
              {sortedIbans.map((ibanRecord) => (
                <div key={ibanRecord.id} className="iban-list__item">
                  <div className="iban-list__info">
                    <span className="iban-list__value">{formatIban(ibanRecord.iban)}</span>
                    {ibanRecord.descrizione && (
                      <span className="iban-list__description">{ibanRecord.descrizione}</span>
                    )}
                  </div>
                  <div className="iban-list__tags">
                    {ibanRecord.predefinito && <span className="tag tag--primary">Predefinito</span>}
                    <span className={`tag ${ibanRecord.attivo ? 'tag--success' : 'tag--danger'}`}>
                      {ibanRecord.attivo ? 'Attivo' : 'Disattivato'}
                    </span>
                  </div>
                  <div className="iban-list__actions">
                    <button
                      type="button"
                      className="btn-link"
                      onClick={() => handleEdit(ibanRecord)}
                      disabled={saving}
                    >
                      Modifica
                    </button>
                    <button
                      type="button"
                      className="btn-link danger"
                      onClick={() => handleDelete(ibanRecord)}
                      disabled={saving}
                    >
                      Elimina
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
      <form id="iban-form" className="movimento-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>{editingId ? 'Modifica IBAN' : 'Nuovo IBAN'}</label>
              <input
                type="text"
                value={formData.iban}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, iban: e.target.value.toUpperCase() }))
                }
                placeholder="IT00 X000 0000 0000 0000 0000 000"
                required
              />
              <small className="form-hint">
                Inserisci il codice completo. Verranno accettati solo IBAN validi.
              </small>
            </div>
            <div className="form-group">
              <label>Descrizione</label>
              <input
                type="text"
                value={formData.descrizione}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, descrizione: e.target.value }))
                }
                placeholder="Es. Conto operativo, Filiale Milano"
              />
            </div>
            <div className="form-group form-group--checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.predefinito}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, predefinito: e.target.checked }))
                  }
                />
                <span>Imposta come IBAN predefinito</span>
              </label>
            </div>
            <div className="form-group form-group--checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.attivo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, attivo: e.target.checked }))
                  }
                />
                <span>IBAN attivo</span>
              </label>
            </div>
          </div>

        </form>
    </BaseModal>
  );
};

const MovimentoModal = ({
  open,
  onClose,
  onSave,
  onDelete,
  conti,
  categorie,
  movimento,
  preferenze,
  filtroContoId,
  partite,
  partiteLoading,
  attrezzature,
}) => {
  const isEditing = Boolean(movimento);
  const isAutomatico = movimento?.origine === 'automatico';

  const defaultContoId = () => {
    if (isEditing && movimento?.conto_id) return String(movimento.conto_id);
    if (filtroContoId && filtroContoId !== 'tutti') return filtroContoId;
    if (preferenze.conto_predefinito_id) return String(preferenze.conto_predefinito_id);
    return conti.length > 0 ? String(conti[0].id) : '';
  };

  const [tipoOperazione, setTipoOperazione] = useState(movimento?.tipo_operazione || 'entrata');
  const [contoId, setContoId] = useState(defaultContoId());
  const [contoDestinazioneId, setContoDestinazioneId] = useState(
    movimento?.conto_destinazione_id ? String(movimento.conto_destinazione_id) : ''
  );
  const [categoriaId, setCategoriaId] = useState(
    movimento?.categoria_id ? String(movimento.categoria_id) : ''
  );
  const [data, setData] = useState(movimento?.data ? movimento.data.split('T')[0] : TODAY);
  const [importo, setImporto] = useState(movimento?.importo ? String(movimento.importo) : '');
  const [descrizione, setDescrizione] = useState(movimento?.descrizione || '');
  const [note, setNote] = useState(movimento?.note || '');
  const [stato, setStato] = useState(movimento?.stato || 'definitivo');
  const [contropartitaNome, setContropartitaNome] = useState(movimento?.contropartita_nome || '');
  const [attrezzaturaId, setAttrezzaturaId] = useState(
    movimento?.attrezzatura_id ? String(movimento.attrezzatura_id) : ''
  );
  const [showAltriDettagli, setShowAltriDettagli] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!isEditing) {
      setTipoOperazione('entrata');
      setContoId(defaultContoId());
      setContoDestinazioneId('');
      setCategoriaId('');
      setData(TODAY);
      setImporto('');
      setDescrizione('');
      setNote('');
      setStato('definitivo');
      setContropartitaNome('');
      setAttrezzaturaId('');
      setShowAltriDettagli(false);
    } else {
      setAttrezzaturaId(movimento?.attrezzatura_id ? String(movimento.attrezzatura_id) : '');
      setShowAltriDettagli(Boolean(movimento?.contropartita_nome || movimento?.attrezzatura_id || movimento?.note));
    }
  }, [open, isEditing, movimento?.attrezzatura_id, movimento?.contropartita_nome, movimento?.note]);

  const categorieCompatibili = useMemo(() => {
    return categorie.filter((categoria) => {
      if (!categoria.tipo_operazione) return true;
      if (tipoOperazione === 'giroconto') return categoria.tipo_operazione === 'giroconto';
      return categoria.tipo_operazione === tipoOperazione;
    });
  }, [categorie, tipoOperazione]);

  const categoriaSelectOptions = useMemo(() => {
    return categorieCompatibili.map((categoria) => ({
      value: String(categoria.id ?? categoria.value),
      label: categoria.label || categoria.nome || `Categoria #${categoria.id ?? categoria.value}`,
    }));
  }, [categorieCompatibili]);

  useEffect(() => {
    if (tipoOperazione !== 'uscita' && attrezzaturaId) {
      setAttrezzaturaId('');
    }
  }, [tipoOperazione, attrezzaturaId]);

  const contoSelectOptions = useMemo(
    () =>
      conti.map((conto) => ({
        value: String(conto.id),
        label: conto.nome,
      })),
    [conti]
  );

  const contoDestinazioneOptions = useMemo(
    () => contoSelectOptions.filter((option) => option.value !== contoId),
    [contoId, contoSelectOptions]
  );

  const partitaOptions = useMemo(() => {
    if (!Array.isArray(partite)) return [];
    const toTimestamp = (value) => {
      if (!value) return 0;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
    };
    return partite
      .slice()
      .sort((a, b) => toTimestamp(b?.data) - toTimestamp(a?.data))
      .map((partita) => {
        const chunks = [];
        if (partita.numero_partita) {
          chunks.push(partita.numero_partita);
        } else {
          chunks.push(`Partita #${partita.id}`);
        }
        if (partita.data) {
          chunks.push(formatDate(partita.data));
        }
        const modalitaLabel = formatModalitaLabel(partita.modalita_gestione);
        if (modalitaLabel) {
          chunks.push(modalitaLabel);
        }
        if (typeof partita.numero_capi === 'number' && partita.numero_capi > 0) {
          chunks.push(`${partita.numero_capi} capi`);
        }
        return {
          value: String(partita.id),
          label: chunks.join(' · '),
        };
      });
  }, [partite]);

  const attrezzaturaOptions = useMemo(() => {
    if (!Array.isArray(attrezzature) || attrezzature.length === 0) {
      return [{ value: '', label: 'Nessuna attrezzatura' }];
    }
    const mapped = attrezzature.map((att) => {
      const chunks = [att.nome];
      const tipoValue = typeof att.tipo === 'string' ? att.tipo : att.tipo?.value;
      if (tipoValue) {
        chunks.push(tipoValue);
      }
      if (att.targa) {
        chunks.push(att.targa);
      }
      return {
        value: String(att.id),
        label: chunks.filter(Boolean).join(' · '),
      };
    });
    return [{ value: '', label: 'Nessuna attrezzatura' }, ...mapped];
  }, [attrezzature]);

  const attrezzaturaFilterOptions = useMemo(() => {
    const mapped = attrezzaturaOptions
      .filter((option) => option.value !== '')
      .map(({ value, label }) => ({ value, label }));
    return [{ value: 'tutte', label: 'Tutte' }, ...mapped];
  }, [attrezzaturaOptions]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!contoId) {
      window.alert('Seleziona il conto di riferimento.');
      return;
    }
    if (!importo || Number(importo) <= 0) {
      window.alert('Inserisci un importo valido.');
      return;
    }
    if (tipoOperazione === 'giroconto') {
      if (!contoDestinazioneId) {
        window.alert('Seleziona il conto destinatario del giroconto.');
        return;
      }
      if (contoDestinazioneId === contoId) {
        window.alert('I conti del giroconto devono essere differenti.');
        return;
      }
    }

    const payload = {
      conto_id: Number(contoId),
      tipo_operazione: tipoOperazione,
      categoria_id: categoriaId || null,
      data,
      importo: Number(importo),
      descrizione,
      note: note || null,
      stato,
      contropartita_nome: contropartitaNome || null,
    };

    if (tipoOperazione === 'giroconto') {
      payload.conto_destinazione_id = Number(contoDestinazioneId);
    }

    // partita_id rimosso: le partite vengono collegate tramite PartitaMovimentoFinanziario
    payload.attrezzatura_id = attrezzaturaId ? Number(attrezzaturaId) : null;

    onSave(payload, movimento?.id || null);
  };

  const handleDelete = async () => {
    if (!movimento) return;
    
    const hasPartiteCollegate = movimento.partite_collegate && movimento.partite_collegate.length > 0;
    const message = hasPartiteCollegate
      ? `Vuoi eliminare questo movimento?\n\nAttenzione: verranno eliminati anche ${movimento.partite_collegate.length} movimento/i finanziario/i collegato/i alle partite.`
      : 'Vuoi eliminare questo movimento?';
    
    if (!window.confirm(message)) return;
    
    try {
      await onDelete(movimento);
      onClose();
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
    }
  };

  const footerActions = (
    <>
      {isEditing && onDelete && (
        <button 
          type="button" 
          className="btn btn-danger btn-delete-auto" 
          onClick={handleDelete}
        >
          Elimina
        </button>
      )}
      <button type="button" className="btn btn-secondary" onClick={onClose}>
        Annulla
      </button>
      <button type="submit" className="btn btn-primary" form="movimento-form">
        Salva
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={isEditing ? 'Modifica movimento' : 'Nuovo movimento manuale'}
      size="large"
      footerActions={footerActions}
    >
      <form id="movimento-form" className="movimento-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Tipo operazione *</label>
            <SmartSelect
              className="select-compact"
              options={MOVIMENTO_TIPO_OPTIONS}
              value={tipoOperazione}
              onChange={(e) => {
                setTipoOperazione(e.target.value);
                setCategoriaId('');
              }}
              displayField="label"
              valueField="value"
            />
            </div>
            <div className="form-group">
              <label>Conto *</label>
            <SmartSelect
              className="select-compact"
              options={contoSelectOptions}
              value={contoId}
              onChange={(e) => setContoId(e.target.value)}
              displayField="label"
              valueField="value"
              required
              placeholder="Seleziona conto"
              allowEmpty={false}
            />
            </div>
            {tipoOperazione === 'giroconto' && (
              <div className="form-group">
                <label>Conto destinazione *</label>
              <SmartSelect
                className="select-compact"
                options={contoDestinazioneOptions}
                value={contoDestinazioneId}
                onChange={(e) => setContoDestinazioneId(e.target.value)}
                displayField="label"
                valueField="value"
                required
                placeholder="Seleziona conto"
                allowEmpty={false}
              />
              </div>
            )}
            <div className="form-group">
              <label>Categoria (opzionale)</label>
            <SmartSelect
              className="select-compact"
              options={categoriaSelectOptions}
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              displayField="label"
              valueField="value"
              disabled={tipoOperazione === 'giroconto' && categorieCompatibili.length === 0}
              placeholder="Nessuna"
              allowEmpty={true}
            />
            </div>
            <div className="form-group">
              <label>Data *</label>
              <input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Importo (€) *</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={importo}
                onChange={(e) => setImporto(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Stato</label>
            <SmartSelect
              className="select-compact"
              options={MOVIMENTO_STATO_OPTIONS}
              value={stato}
              onChange={(e) => setStato(e.target.value)}
              displayField="label"
              valueField="value"
            />
            </div>
          </div>

          <div className="form-group">
            <label>Descrizione *</label>
            <input
              type="text"
              value={descrizione}
              onChange={(e) => setDescrizione(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <button
              type="button"
              className="btn btn-secondary btn-link"
              onClick={() => setShowAltriDettagli((v) => !v)}
              style={{ padding: '0.25rem 0', fontSize: '0.9rem' }}
            >
              {showAltriDettagli ? '▼ Nascondi dettagli' : '▶ Altri dettagli (controparte, attrezzatura, note)'}
            </button>
            {showAltriDettagli && (
              <div className="altri-dettagli-movimento" style={{ marginTop: '0.75rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '6px', backgroundColor: '#f9fafb' }}>
                <div className="form-group">
                  <label>Controparte</label>
                  <input
                    type="text"
                    value={contropartitaNome}
                    onChange={(e) => setContropartitaNome(e.target.value)}
                    placeholder="Cliente, fornitore o descrizione"
                  />
                </div>
                {tipoOperazione === 'uscita' && (
                  <div className="form-group">
                    <label>Attrezzatura</label>
                    <SmartSelect
                      className="select-compact"
                      options={attrezzaturaOptions}
                      value={attrezzaturaId}
                      onChange={(e) => setAttrezzaturaId(e.target.value)}
                      displayField="label"
                      valueField="value"
                      placeholder="Nessuna attrezzatura"
                    />
                  </div>
                )}
                <div className="form-group">
                  <label>Note</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          {isAutomatico && (
            <div className="alert info">
              Questo movimento è stato generato automaticamente. Puoi modificarlo per correggere eventuali errori.
            </div>
          )}

          {/* Partite collegate */}
          {isEditing && movimento && movimento.partite_collegate && movimento.partite_collegate.length > 0 && (
            <div className="form-group partite-collegate-section">
              <label className="partite-collegate-label">Partite Collegate</label>
              <div className="partite-collegate-grid">
                {movimento.partite_collegate.map((partita) => (
                  <div
                    key={partita.id}
                    className="partita-item"
                  >
                    <div>
                      <strong>Partita:</strong> {partita.numero_partita || `#${partita.id}`}
                    </div>
                    <div>
                      <strong>Data:</strong> {formatDate(partita.data)}
                    </div>
                    <div>
                      <strong>Tipo:</strong> {partita.tipo}
                    </div>
                    {partita.numero_capi && (
                      <div>
                        <strong>Capi:</strong> {partita.numero_capi}
                      </div>
                    )}
                    <div>
                      <strong>Importo:</strong> {formatCurrency(partita.importo)}
                    </div>
                    <div>
                      <strong>Direzione:</strong> {partita.direzione}
                    </div>
                    <div>
                      <strong>Movimento:</strong> {partita.tipo_movimento}
                    </div>
                  </div>
                ))}
              </div>
              <small className="form-hint form-hint-block">
                Le partite sono collegate tramite movimenti finanziari. Per modificare le associazioni, utilizza la gestione partite.
              </small>
            </div>
          )}
        </form>
    </BaseModal>
  );
};

const ReconciliaModal = ({
  open,
  onClose,
  onSave,
  loading,
  documenti,
  conti,
  preferenze,
  categorie,
}) => {
  const [tipoOperazione, setTipoOperazione] = useState('entrata');
  const [contoId, setContoId] = useState('');
  const [data, setData] = useState(TODAY);
  const [descrizione, setDescrizione] = useState('Pagamento multiplo');
  const [collegamenti, setCollegamenti] = useState([]);
  const [importoExtra, setImportoExtra] = useState('');
  const [note, setNote] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [fornitoreSelezionato, setFornitoreSelezionato] = useState('');
  const [fattureSelezionate, setFattureSelezionate] = useState([]); // Array di ID fatture selezionate
  const [showFattureModal, setShowFattureModal] = useState(false);
  const [filtroDataDa, setFiltroDataDa] = useState('');
  const [filtroDataA, setFiltroDataA] = useState('');
  const [filtroImportoMin, setFiltroImportoMin] = useState('');
  const [filtroImportoMax, setFiltroImportoMax] = useState('');

  // Filtra documenti in base al tipo operazione (entrata/uscita)
  const documentiFiltratiPerTipo = useMemo(() => {
    return documenti.filter((doc) => {
      // Se il documento ha tipo_fattura, usalo per filtrare
      if (doc.tipo_fattura) {
        if (tipoOperazione === 'entrata') {
          return doc.tipo_fattura === 'entrata';
        } else if (tipoOperazione === 'uscita') {
          return doc.tipo_fattura === 'uscita';
        }
      }
      // Fallback: se non c'è tipo_fattura, usa il tipo documento
      // FATTURA_EMESSA = entrata, FATTURA_AMMINISTRAZIONE = potrebbe essere entrata o uscita
      if (tipoOperazione === 'entrata') {
        return doc.tipo === 'fattura_emessa' || (doc.tipo === 'fattura_amministrazione' && doc.tipo_fattura === 'entrata');
      } else if (tipoOperazione === 'uscita') {
        return doc.tipo === 'fattura_amministrazione' && (doc.tipo_fattura === 'uscita' || !doc.tipo_fattura);
      }
      return true;
    });
  }, [documenti, tipoOperazione]);

  // Estrai fornitori unici dai documenti filtrati per tipo operazione
  const fornitoriUnici = useMemo(() => {
    const fornitoriSet = new Set();
    documentiFiltratiPerTipo.forEach((doc) => {
      const contropartita = doc.contropartita;
      // Normalizza il nome: rimuovi spazi extra e caratteri problematici
      if (contropartita && contropartita !== '-' && contropartita.trim() !== '') {
        const nomeNormalizzato = contropartita.trim();
        fornitoriSet.add(nomeNormalizzato);
      }
    });
    return Array.from(fornitoriSet)
      .sort((a, b) => a.localeCompare(b, 'it', { sensitivity: 'base' }))
      .map((nome) => ({
        value: nome,
        label: nome,
      }));
  }, [documentiFiltratiPerTipo]);

  // Filtra documenti in base al fornitore selezionato (già filtrati per tipo operazione)
  const documentiFiltrati = useMemo(() => {
    if (!fornitoreSelezionato) return [];
    return documentiFiltratiPerTipo.filter((doc) => doc.contropartita === fornitoreSelezionato);
  }, [documentiFiltratiPerTipo, fornitoreSelezionato]);

  // Filtra documenti per la modale di selezione (con filtri data e importo)
  const documentiFiltratiPerSelezione = useMemo(() => {
    let filtrati = [...documentiFiltrati];
    
    // Filtro per data
    if (filtroDataDa) {
      const dataDa = new Date(filtroDataDa).getTime();
      filtrati = filtrati.filter((doc) => {
        if (!doc.data) return false;
        return new Date(doc.data).getTime() >= dataDa;
      });
    }
    if (filtroDataA) {
      const dataA = new Date(filtroDataA).getTime();
      filtrati = filtrati.filter((doc) => {
        if (!doc.data) return false;
        return new Date(doc.data).getTime() <= dataA;
      });
    }
    
    // Filtro per importo
    if (filtroImportoMin) {
      const importoMin = Number(filtroImportoMin);
      if (!Number.isNaN(importoMin)) {
        filtrati = filtrati.filter((doc) => {
          const residuo = Number(doc.residuo || 0);
          return residuo >= importoMin;
        });
      }
    }
    if (filtroImportoMax) {
      const importoMax = Number(filtroImportoMax);
      if (!Number.isNaN(importoMax)) {
        filtrati = filtrati.filter((doc) => {
          const residuo = Number(doc.residuo || 0);
          return residuo <= importoMax;
        });
      }
    }
    
    // Ordina dalla meno recente alla più recente
    return filtrati.sort((a, b) => {
      const dataA = a.data ? new Date(a.data).getTime() : 0;
      const dataB = b.data ? new Date(b.data).getTime() : 0;
      return dataA - dataB;
    });
  }, [documentiFiltrati, filtroDataDa, filtroDataA, filtroImportoMin, filtroImportoMax]);

  // Opzioni per select delle fatture (ordinate dalla meno recente alla più recente)
  const fattureOptions = useMemo(() => {
    const documentiOrdinati = [...documentiFiltrati].sort((a, b) => {
      const dataA = a.data ? new Date(a.data).getTime() : 0;
      const dataB = b.data ? new Date(b.data).getTime() : 0;
      return dataA - dataB; // Ordine crescente: dalla meno recente alla più recente
    });
    return documentiOrdinati.map((doc) => {
      const totaleFattura = parseFloat(doc.importo_totale || doc.totale || 0);
      const residuo = parseFloat(doc.residuo || 0);
      // Se non c'è importo_totale, calcola come residuo + importo già pagato/incassato
      const totaleCalcolato = totaleFattura > 0 ? totaleFattura : (residuo + parseFloat(doc.importo_pagato || doc.importo_incassato || 0));
      return {
        value: `${doc.tipo}-${doc.id}`,
        label: `${doc.riferimento || `Documento #${doc.id}`} - Totale: ${formatCurrency(totaleCalcolato)} | Residuo: ${formatCurrency(residuo)} (${formatDate(doc.data)})`,
        doc: doc,
      };
    });
  }, [documentiFiltrati]);

  // Aggiorna collegamenti quando vengono selezionate le fatture
  useEffect(() => {
    if (fattureSelezionate.length === 0) {
      setCollegamenti([]);
      return;
    }
    
    setCollegamenti((prevCollegamenti) => {
      // Mantieni i collegamenti esistenti che sono ancora selezionati
      const collegamentiEsistenti = prevCollegamenti.filter((c) => 
        fattureSelezionate.includes(`${c.tipo}-${c.id}`)
      );
      
      // Aggiungi nuovi collegamenti per le fatture appena selezionate
      const nuoviCollegamenti = fattureSelezionate
        .filter((fatturaId) => !prevCollegamenti.find((c) => `${c.tipo}-${c.id}` === fatturaId))
        .map((fatturaId) => {
          const selectedOption = fattureOptions.find((opt) => opt.value === fatturaId);
          if (selectedOption && selectedOption.doc) {
            const doc = selectedOption.doc;
            // Usa importo_totale se disponibile, altrimenti calcola come residuo + importo già pagato/incassato
            const totaleFattura = parseFloat(doc.importo_totale || doc.totale || 0);
            const residuo = parseFloat(doc.residuo || 0);
            // Se non c'è importo_totale, calcola come residuo + importo già pagato/incassato
            const totaleCalcolato = totaleFattura > 0 ? totaleFattura : (residuo + parseFloat(doc.importo_pagato || doc.importo_incassato || 0));
            return {
              ...doc,
              selected: true,
              importo: totaleCalcolato > 0 ? String(totaleCalcolato) : String(residuo || 0),
            };
          }
          return null;
        })
        .filter(Boolean);
      
      const tuttiCollegamenti = [...collegamentiEsistenti, ...nuoviCollegamenti];
      
      return tuttiCollegamenti;
    });
  }, [fattureSelezionate, fattureOptions]);

  useEffect(() => {
    if (!open) return;
    setTipoOperazione('entrata');
    setContoId('');
    setData(TODAY);
    setDescrizione('');
    setImportoExtra('');
    setNote('');
    setCategoriaId('');
    setFornitoreSelezionato('');
    setFattureSelezionate([]);
    setCollegamenti([]);
    setShowFattureModal(false);
    setFiltroDataDa('');
    setFiltroDataA('');
    setFiltroImportoMin('');
    setFiltroImportoMax('');
  }, [open, documenti, conti, preferenze]);

  // Genera descrizione automatica quando cambiano le fatture selezionate
  useEffect(() => {
    if (riepilogoFatture.length > 0 && fornitoreSelezionato) {
      const tipoLabel = tipoOperazione === 'entrata' ? 'Incasso' : 'Pagamento';
      const controparteLabel = fornitoreSelezionato;
      if (riepilogoFatture.length === 1) {
        const doc = riepilogoFatture[0];
        setDescrizione(`${tipoLabel} ${doc.riferimento || `Documento #${doc.id}`} - ${controparteLabel}`);
      } else {
        setDescrizione(`${tipoLabel} multiplo - ${riepilogoFatture.length} documenti - ${controparteLabel}`);
      }
    } else if (!fornitoreSelezionato) {
      setDescrizione('');
    }
  }, [riepilogoFatture, fornitoreSelezionato, tipoOperazione]);

  const totaleSelezionato = collegamenti.reduce((acc, doc) => {
    if (!doc.selected) return acc;
    const valore = Number(doc.importo || 0);
    if (Number.isNaN(valore)) return acc;
    
    // Le note credito (TD04) devono essere sottratte invece di aggiunte
    const isNotaCredito = doc.tipo_documento === 'TD04' || String(doc.tipo_documento || '').toUpperCase() === 'TD04';
    
    return isNotaCredito ? acc - valore : acc + valore;
  }, 0);

  const totaleExtra = Number(importoExtra || 0);
  const totaleMovimento = totaleSelezionato + (Number.isNaN(totaleExtra) ? 0 : totaleExtra);

  // Calcola il totale delle fatture rimanenti (residuo totale di tutte le fatture aperte)
  const totaleRimanente = useMemo(() => {
    return documentiFiltrati.reduce((acc, doc) => {
      const residuo = parseFloat(doc.residuo || 0);
      // Le note credito (TD04) devono essere sottratte
      const isNotaCredito = doc.tipo_documento === 'TD04' || String(doc.tipo_documento || '').toUpperCase() === 'TD04';
      return isNotaCredito ? acc - residuo : acc + residuo;
    }, 0);
  }, [documentiFiltrati]);

  const categorieCompatibili = useMemo(() => {
    return categorie.filter((categoria) => {
      if (!categoria.tipo_operazione) return true;
      return categoria.tipo_operazione === tipoOperazione;
    });
  }, [categorie, tipoOperazione]);

  const categoriaSelectOptions = useMemo(() => {
    const mapped = categorieCompatibili.map((categoria) => ({
      value: String(categoria.id ?? categoria.value),
      label: categoria.label || categoria.nome || `Categoria #${categoria.id ?? categoria.value}`,
    }));
    return mapped;
  }, [categorieCompatibili]);

  const contoSelectOptions = useMemo(
    () =>
      conti.map((conto) => ({
        value: String(conto.id),
        label: conto.nome,
      })),
    [conti]
  );

  const updateDocumento = (docId, tipo, values) => {
    setCollegamenti((prev) =>
      prev.map((doc) =>
        doc.id === docId && doc.tipo === tipo
          ? { ...doc, ...values }
          : doc
      )
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!contoId) {
      window.alert('Seleziona un conto.');
      return;
    }
    if (!fornitoreSelezionato) {
      window.alert('Seleziona un fornitore/cliente.');
      return;
    }
    if (fattureSelezionate.length === 0) {
      window.alert('Seleziona almeno una fattura.');
      return;
    }
    if (totaleMovimento <= 0) {
      window.alert('Inserisci almeno un importo da registrare.');
      return;
    }

    const collegamentiSelezionati = collegamenti
      .filter((doc) => doc.selected && Number(doc.importo) > 0)
      .map((doc) => ({
        documento_tipo: doc.tipo,
        documento_id: doc.id,
        importo: Number(doc.importo),
      }));

    const payload = {
      tipo_operazione: tipoOperazione,
      conto_id: Number(contoId),
      categoria_id: categoriaId || null,
      data,
      importo: totaleMovimento,
      descrizione,
      contropartita_nome: fornitoreSelezionato || null,
      note: note || null,
      stato: 'definitivo',
      collegamenti: collegamentiSelezionati,
      quota_extra: totaleExtra > 0 ? totaleExtra : null,
    };

    onSave(payload);
  };

  if (!open) return null;

  const toggleFattura = (fatturaId) => {
    setFattureSelezionate((prev) => {
      if (prev.includes(fatturaId)) {
        return prev.filter((id) => id !== fatturaId);
      }
      return [...prev, fatturaId];
    });
  };

  const handleConfermaSelezioneFatture = () => {
    setShowFattureModal(false);
    // I collegamenti vengono aggiornati automaticamente dal useEffect
  };

  // Riepilogo fatture selezionate con ricalcolo automatico del residuo
  const riepilogoFatture = useMemo(() => {
    return fattureSelezionate.map((fatturaId) => {
      const selectedOption = fattureOptions.find((opt) => opt.value === fatturaId);
      if (selectedOption && selectedOption.doc) {
        const doc = selectedOption.doc;
        const collegamento = collegamenti.find((c) => c.id === doc.id && c.tipo === doc.tipo);
        // Usa importo_totale se disponibile, altrimenti calcola come residuo + importo già pagato/incassato
        const totaleFattura = parseFloat(doc.importo_totale || doc.totale || 0);
        const residuo = parseFloat(doc.residuo || 0);
        // Se non c'è importo_totale, calcola come residuo + importo già pagato/incassato
        const totaleCalcolato = totaleFattura > 0 ? totaleFattura : (residuo + parseFloat(doc.importo_pagato || doc.importo_incassato || 0));
        const importoInserito = parseFloat(collegamento?.importo || totaleCalcolato || 0);
        const residuoCalcolato = Math.max(0, totaleCalcolato - importoInserito);
        
        return {
          ...doc,
          importo: collegamento?.importo || (totaleCalcolato > 0 ? String(totaleCalcolato) : String(residuo || 0)),
          residuo_calcolato: residuoCalcolato,
          totale_fattura: totaleCalcolato,
        };
      }
      return null;
    }).filter(Boolean);
  }, [fattureSelezionate, fattureOptions, collegamenti]);

  const footerActions = (
    <>
      <button 
        type="button" 
        className="btn btn-secondary" 
        onClick={onClose}
      >
        Annulla
      </button>
      <button 
        type="submit" 
        className="btn btn-primary" 
        form="reconcilia-form"
      >
        Registra
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title="Riconciliazione pagamenti multipli"
      size="xlarge"
      footerActions={footerActions}
    >
        {loading ? (
        <div>Caricamento documenti...</div>
        ) : (
        <form id="reconcilia-form" className="movimento-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-group">
                <label>Tipo operazione *</label>
                <SmartSelect
                  className="select-compact"
                  options={[
                    { value: 'entrata', label: 'Incasso' },
                    { value: 'uscita', label: 'Pagamento' },
                  ]}
                  value={tipoOperazione}
                  onChange={(e) => {
                    setTipoOperazione(e.target.value);
                    // Reset fornitore e fatture quando cambia il tipo
                    setFornitoreSelezionato('');
                    setFattureSelezionate([]);
                    setCollegamenti([]);
                    setDescrizione('');
                  }}
                  displayField="label"
                  valueField="value"
                />
              </div>
              <div className="form-group">
                <label>Conto *</label>
                <SmartSelect
                  className="select-compact"
                  options={contoSelectOptions}
                  value={contoId}
                  onChange={(e) => setContoId(e.target.value)}
                  displayField="label"
                  valueField="value"
                  required
                  placeholder="Seleziona conto"
                  allowEmpty={false}
                />
              </div>
              <div className="form-group">
                <label>Categoria</label>
                <SmartSelect
                  className="select-compact"
                  options={categoriaSelectOptions}
                  value={categoriaId}
                  onChange={(e) => setCategoriaId(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Nessuna"
                  allowEmpty={true}
                />
              </div>
              <div className="form-group">
                <label>Data *</label>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} required />
              </div>
            </div>

            <div className="form-group span-12">
              <label>{tipoOperazione === 'entrata' ? 'Cliente *' : 'Fornitore *'}</label>
              {fornitoriUnici.length === 0 ? (
                <div className="empty-state small">Nessun {tipoOperazione === 'entrata' ? 'cliente' : 'fornitore'} disponibile nei documenti aperti.</div>
              ) : (
                <SmartSelect
                  className="select-compact"
                  options={fornitoriUnici}
                  value={fornitoreSelezionato}
                  onChange={(e) => {
                    setFornitoreSelezionato(e.target.value);
                    setFattureSelezionate([]);
                    setCollegamenti([]);
                    setDescrizione('');
                  }}
                  displayField="label"
                  valueField="value"
                  placeholder={`Cerca o seleziona ${tipoOperazione === 'entrata' ? 'cliente' : 'fornitore'}`}
                  required
                />
              )}
            </div>

            {fornitoreSelezionato && (
              <div className="form-group span-12">
                <label>Fatture da associare *</label>
                {documentiFiltrati.length === 0 ? (
                  <div className="empty-state small">Nessuna fattura disponibile per questo {tipoOperazione === 'entrata' ? 'cliente' : 'fornitore'}.</div>
              ) : (
                  <>
                    <div className="fatture-selection-header">
                      <button
                        type="button"
                        className="btn btn-secondary btn-select-fatture"
                        onClick={() => setShowFattureModal(true)}
                      >
                        {fattureSelezionate.length === 0
                          ? 'Seleziona fatture'
                          : `${fattureSelezionate.length} fatture selezionate`}
                      </button>
                      {documentiFiltrati.length > 0 && (
                        <span className="totale-rimanente-text">
                          Totale rimanente: <strong className="totale-rimanente-value">{formatCurrency(totaleRimanente)}</strong>
                        </span>
                      )}
                    </div>
                    {riepilogoFatture.length > 0 && (
                      <div className="riepilogo-fatture">
                        <h4>Fatture selezionate</h4>
                        {riepilogoFatture.map((doc) => {
                          const tipoDocumentoLabel = getDocumentoTipoLabel(doc.tipo_documento, doc.tipo);
                          const totaleFattura = doc.totale_fattura || parseFloat(doc.importo_totale || doc.totale || 0);
                          const residuoCalcolato = doc.residuo_calcolato !== undefined ? doc.residuo_calcolato : (doc.residuo || 0);
                          return (
                            <div key={`${doc.tipo}-${doc.id}`} className="riepilogo-fattura-item">
                              <div className="riepilogo-fattura-row">
                                <span className="riepilogo-fattura-tipo">
                                  {tipoDocumentoLabel}
                                </span>
                                <span className="riepilogo-fattura-riferimento">{doc.riferimento || `Documento #${doc.id}`}</span>
                                <span className="riepilogo-fattura-del">del</span>
                                <span className="riepilogo-fattura-data">{formatDate(doc.data)}</span>
                                <span className="riepilogo-fattura-importo-label">
                                  Importo:
                                </span>
                                <span className="riepilogo-fattura-totale">
                                  {formatCurrency(totaleFattura)}
                                </span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  max={totaleFattura}
                                  value={doc.importo || String(totaleFattura || 0)}
                                  onChange={(e) => {
                                    const valore = e.target.value;
                                    updateDocumento(doc.id, doc.tipo, {
                                      selected: true,
                                      importo: valore,
                                    });
                                  }}
                                  className="riepilogo-fattura-importo-input-compact"
                                  required
                                  onFocus={(e) => e.target.select()}
                                />
                                <span className="riepilogo-fattura-residuo">
                                  Residuo: {formatCurrency(residuoCalcolato)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            <div className="form-group span-12">
              <label>Descrizione *</label>
              <input
                type="text"
                value={descrizione}
                onChange={(e) => setDescrizione(e.target.value)}
                required
                placeholder={riepilogoFatture.length > 0 ? 'Descrizione generata automaticamente' : 'Inserisci descrizione'}
              />
            </div>

            <div className="form-group span-6">
              <label>Importo extra (senza documento)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={importoExtra}
                onChange={(e) => setImportoExtra(e.target.value)}
                placeholder="0,00"
              />
            </div>

            {/* Totale movimento - nella griglia */}
            <div className="form-group span-12">
              <label>Totale movimento</label>
              <div className="totale-movimento-display">
                {formatCurrency(totaleMovimento)}
              </div>
            </div>

            {/* Note - fuori dalla griglia */}
            <div className="form-group">
              <label>Note</label>
              <textarea 
                value={note} 
                onChange={(e) => setNote(e.target.value)} 
                rows={3}
              />
            </div>
          </form>
        )}

      {/* Modale selezione fatture */}
      {showFattureModal && (
        <BaseModal
          isOpen={showFattureModal}
          onClose={() => setShowFattureModal(false)}
          title="Seleziona fatture"
          size="large"
          footerActions={
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setShowFattureModal(false)}>
                Annulla
              </button>
              <button type="button" className="btn btn-primary" onClick={handleConfermaSelezioneFatture}>
                Conferma ({fattureSelezionate.length})
              </button>
            </>
          }
        >
              {/* Filtri */}
              <div className="fatture-filters">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Data da</label>
                    <input
                      type="date"
                      value={filtroDataDa}
                      onChange={(e) => setFiltroDataDa(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Data a</label>
                    <input
                      type="date"
                      value={filtroDataA}
                      onChange={(e) => setFiltroDataA(e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Importo minimo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filtroImportoMin}
                      onChange={(e) => setFiltroImportoMin(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                  <div className="form-group">
                    <label>Importo massimo</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={filtroImportoMax}
                      onChange={(e) => setFiltroImportoMax(e.target.value)}
                      placeholder="0,00"
                    />
                  </div>
                </div>
              </div>

              {/* Lista fatture */}
              <div className="fatture-selection-list-modal">
                {documentiFiltratiPerSelezione.length === 0 ? (
                  <div className="empty-state">Nessuna fattura trovata con i filtri selezionati.</div>
                ) : (
                  documentiFiltratiPerSelezione.map((doc) => {
                    const fatturaId = `${doc.tipo}-${doc.id}`;
                    const isSelected = fattureSelezionate.includes(fatturaId);
                    const tipoDocumentoLabel = getDocumentoTipoLabel(doc.tipo_documento, doc.tipo);
                    
                    return (
                      <div key={fatturaId} className={`fattura-selection-item-modal ${isSelected ? 'selected' : ''}`}>
                        <label className="fattura-checkbox-modal">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleFattura(fatturaId)}
                          />
                          <div className="fattura-info-modal">
                            <span className="fattura-riferimento">{doc.riferimento || `Documento #${doc.id}`}</span>
                            <span className="fattura-tipo">
                              {tipoDocumentoLabel}
                            </span>
                            <span className="fattura-data">{formatDate(doc.data)}</span>
                            {(() => {
                              const totaleFattura = parseFloat(doc.importo_totale || doc.totale || 0);
                              const residuo = parseFloat(doc.residuo || 0);
                              const totaleCalcolato = totaleFattura > 0 ? totaleFattura : (residuo + parseFloat(doc.importo_pagato || doc.importo_incassato || 0));
                              return (
                                <>
                                  <span className="fattura-totale-modal">
                                    Totale: {formatCurrency(totaleCalcolato)}
                                  </span>
                                  <span className="fattura-residuo-modal">
                                    Residuo: {formatCurrency(residuo)}
                                  </span>
                                </>
                              );
                            })()}
                          </div>
                        </label>
                      </div>
                    );
                  })
                )}
              </div>
        </BaseModal>
      )}
    </BaseModal>
  );
};

export default GestionePrimaNota;

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '€0,00';
  const numero = Number(value);
  if (Number.isNaN(numero)) return String(value);
  return numero.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('it-IT');
}

// Mapping codici tipo documento FatturaPA
const TIPO_DOCUMENTO_MAP = {
  'TD01': 'Fattura',
  'TD02': 'Acconto/Anticipo su fattura',
  'TD03': 'Acconto/Anticipo su parcella',
  'TD04': 'Nota di credito',
  'TD05': 'Nota di debito',
  'TD06': 'Parcella',
  'TD16': 'Integrazione fattura reverse charge interno',
  'TD17': 'Integrazione/autofattura per acquisto servizi dall\'estero',
  'TD18': 'Integrazione per acquisto di beni intracomunitari',
  'TD19': 'Integrazione/autofattura per acquisto di beni ex art.17 c.2 DPR 633/72',
  'TD20': 'Autofattura per regolarizzazione e integrazione',
  'TD21': 'Autofattura per splafonamento',
  'TD22': 'Estrazione beni da Deposito IVA',
  'TD23': 'Estrazione beni da Deposito IVA con versamento dell\'IVA',
  'TD24': 'Fattura differita di cui all\'art.21, comma 4, lett. a)',
  'TD25': 'Fattura differita di cui all\'art.21, comma 4, terzo periodo lett. b)',
  'TD26': 'Cessione di beni ammortizzabili e per passaggi interni (ex art.36 DPR 633/72)',
  'TD27': 'Autofattura per acquisto servizi da soggetti non residenti',
};

// Mapping codici condizioni pagamento FatturaPA
const CONDIZIONI_PAGAMENTO_MAP = {
  'TP01': 'Pagamento a rate',
  'TP02': 'Pagamento completo',
  'TP03': 'Anticipo',
};

function getTipoDocumentoLabel(codice) {
  if (!codice) return null;
  return TIPO_DOCUMENTO_MAP[codice] || codice;
}

function getCondizioniPagamentoLabel(codice) {
  if (!codice) return null;
  return CONDIZIONI_PAGAMENTO_MAP[codice] || codice;
}

function getDocumentoTipoBadgeClass(tipoDocumento, tipoFattura) {
  if (!tipoDocumento) {
    // Fallback al tipo fattura se non c'è tipo_documento
    return tipoFattura === 'fattura_emessa' ? 'badge-fattura-emessa' : 'badge-fattura-ricevuta';
  }
  
  const codice = String(tipoDocumento).toUpperCase();
  if (codice === 'TD04') return 'badge-nota-credito';
  if (codice === 'TD05') return 'badge-nota-debito';
  if (codice === 'TD02' || codice === 'TD03') return 'badge-acconto';
  if (codice === 'TD06') return 'badge-parcella';
  if (codice === 'TD20' || codice === 'TD21') return 'badge-autofattura';
  
  // Default per fatture
  return tipoFattura === 'fattura_emessa' ? 'badge-fattura-emessa' : 'badge-fattura-ricevuta';
}

function getDocumentoTipoLabel(tipoDocumento, tipoFattura) {
  if (!tipoDocumento) {
    return tipoFattura === 'fattura_emessa' ? 'Fattura Emessa' : 'Fattura Ricevuta';
  }
  
  const codice = String(tipoDocumento).toUpperCase();
  const label = getTipoDocumentoLabel(codice);
  return label || codice;
}

function normalizeDocumenti(response) {
  if (!response) return [];
  const elenco = Array.isArray(response) ? response : response.documenti || [];
  return elenco.map((item) => ({
    id: item.id,
    tipo: item.tipo || item.documento_tipo || 'fattura',
    riferimento: item.riferimento || item.numero || `${item.tipo || 'Documento'} #${item.id}`,
    data: item.data || item.data_documento || null,
    contropartita: item.contropartita || item.intestatario || item.denominazione || '-',
    residuo: item.residuo || item.importo_residuo || item.totale_residuo || 0,
    importo_totale: item.importo_totale || item.totale || null,
    tipo_documento: item.tipo_documento || null,
    condizioni_pagamento: item.condizioni_pagamento || null,
  }));
}

function formatContoTipo(value) {
  if (!value) return TIPO_LABEL_MAP.cassa || 'Cassa';
  const key = String(value).toLowerCase();
  return TIPO_LABEL_MAP[key] || value;
}

function formatGirocontoStrategia(value) {
  if (!value) return GIROCONTO_LABEL_MAP.automatico || 'Giroconto automatico';
  const key = String(value).toLowerCase();
  return GIROCONTO_LABEL_MAP[key] || value;
}

function formatIban(value) {
  if (!value) return '—';
  const raw = String(value).replace(/\s+/g, '').toUpperCase();
  return raw.replace(/(.{4})/g, '$1 ').trim();
}

function formatModalitaLabel(value) {
  if (!value) return '';
  const key = String(value).toLowerCase();
  return MODALITA_GESTIONE_LABELS[key] || value;
}

function resolveErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (error.response?.detail) return error.response.detail;
  if (error.detail) return error.detail;
  if (error.message) return error.message;
  return fallback;
}

// Modale dettagli conto (click destro)
const ContoDetailsModal = ({ open, conto, onClose, onEdit, onToggleActive, onManageIban, onDelete }) => {
  if (!open || !conto) return null;

  const tipoValue = typeof conto.tipo === 'string' ? conto.tipo : conto.tipo?.value;
  const isBanca = String(tipoValue || '').toLowerCase() === 'banca';
  const strategiaValue = typeof conto.giroconto_strategia === 'string'
    ? conto.giroconto_strategia
    : conto.giroconto_strategia?.value;
  const ibans = Array.isArray(conto.ibans) ? conto.ibans : [];

  const footerActions = (
    <>
      {onEdit && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            onEdit();
            onClose();
          }}
        >
          Modifica
        </button>
      )}
      {onManageIban && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            onManageIban();
            onClose();
          }}
        >
          Gestisci IBAN
        </button>
      )}
      {onToggleActive && (
        <button
          className="btn btn-secondary"
          onClick={() => {
            onToggleActive();
            onClose();
          }}
        >
          {conto.attivo ? 'Disattiva' : 'Attiva'}
        </button>
      )}
      {onDelete && (
        <button
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm(`Sei sicuro di voler eliminare il conto "${conto.nome}"?`)) {
              onDelete();
              onClose();
            }
          }}
        >
          Elimina
        </button>
      )}
      <button className="btn btn-secondary" onClick={onClose}>
        Chiudi
      </button>
    </>
  );

  return (
    <BaseModal
      isOpen={open}
      onClose={onClose}
      title={`Dettagli Conto: ${conto?.nome || ''}`}
      size="medium"
      footerActions={footerActions}
    >
          <div className="conto-details-grid">
            <div className="detail-item">
              <span className="detail-label">Tipo</span>
              <span className="detail-value">{formatContoTipo(tipoValue)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Stato</span>
              <span className="detail-value">
                <span className={`badge ${conto.attivo ? 'badge-success' : 'badge-secondary'}`}>
                  {conto.attivo ? 'Attivo' : 'Disattivato'}
                </span>
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Saldo iniziale</span>
              <span className="detail-value">{formatCurrency(conto.saldo_iniziale)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Saldo attuale</span>
              <span className="detail-value">{formatCurrency(conto.saldo_attuale)}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Movimenti provvisori</span>
              <span className="detail-value">{conto.movimenti_provvisori || 0}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Strategia giroconto</span>
              <span className="detail-value">{formatGirocontoStrategia(strategiaValue)}</span>
            </div>
            {isBanca && ibans.length > 0 && (
              <div className="detail-item detail-item-full">
                <span className="detail-label">IBAN</span>
                <div className="detail-value">
                  {ibans.map((iban) => (
                    <div key={iban.id} className="iban-item">
                      {formatIban(iban.iban)}
                      {iban.predefinito && <span className="tag-small tag-small-spaced">Predefinito</span>}
                      {!iban.attivo && <span className="tag-small tag-danger tag-small-spaced">Disattivato</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {conto.note && (
              <div className="detail-item detail-item-full">
                <span className="detail-label">Note</span>
                <span className="detail-value">{conto.note}</span>
              </div>
            )}
          </div>
    </BaseModal>
  );
};

