/**
 * AnimalSearch - Ricerca animali con filtri estesi ed esportazione
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { allevamentoService } from '../services/allevamentoService';
import { useAzienda } from '../../../context/AziendaContext';
import SimpleSelect from '../../../components/SimpleSelect';
import '../../alimentazione/components/Alimentazione.css';
import './AnimalSearch.css';
import AnimaleDetail from './AnimaleDetail';
import { prefetchAnimali, getCachedAnimali } from '../prefetchers';

const AnimalSearch = ({
  mode = 'ricerca',
  selection = null,
  onSelectionChange = null,
  onRequestAssignBox = null,
  onRequestCreatePiano = null,
  onRequestAddToPiano = null,
  selectedPiano = null,
}) => {
  const { azienda, loading: aziendaLoading } = useAzienda();
  const aziendaId = azienda?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterAzienda, setFilterAzienda] = useState('');
  const [filterSede, setFilterSede] = useState('');
  const [filterStabilimento, setFilterStabilimento] = useState('');
  const [filterBox, setFilterBox] = useState('');
  const [filterStato, setFilterStato] = useState('presente'); // Default a 'presente'
  const [filterSesso, setFilterSesso] = useState('');
  const [filterRazza, setFilterRazza] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [filterContrattoSoccida, setFilterContrattoSoccida] = useState('');
  const [filterDataArrivoDa, setFilterDataArrivoDa] = useState('');
  const [filterDataArrivoA, setFilterDataArrivoA] = useState('');
  const [filterPesoMin, setFilterPesoMin] = useState('');
  const [filterPesoMax, setFilterPesoMax] = useState('');

  const [sedi, setSedi] = useState([]);
  const [stabilimenti, setStabilimenti] = useState([]);
  const [boxesByStabilimento, setBoxesByStabilimento] = useState({});
  const [contrattoOptions, setContrattoOptions] = useState([
    { value: '', label: 'Tutti' },
    { value: '__proprieta__', label: 'Solo proprietà' },
  ]);

  const [baseAnimali, setBaseAnimali] = useState([]);
  const [animali, setAnimali] = useState([]);
  const [selectedAnimale, setSelectedAnimale] = useState(null);
  const [loadingDetailId, setLoadingDetailId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const [loading, setLoading] = useState(false);
  const [loadingBoxes, setLoadingBoxes] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [internalSelectedIds, setInternalSelectedIds] = useState([]);
  const [internalSelectedItems, setInternalSelectedItems] = useState([]);
  const filtersPanelRef = useRef(null);
  const resultsPanelRef = useRef(null);
  const [resultsPanelHeight, setResultsPanelHeight] = useState(null);

  const controlledSelection = Boolean(selection);
  const selectedIds = controlledSelection ? selection.ids || [] : internalSelectedIds;
  const selectedItems = controlledSelection ? selection.items || [] : internalSelectedItems;

  const sedeOptions = useMemo(() => {
    const mapLabel = (sede) => {
      if (!sede) return 'Sede non disponibile';
      if (sede.nome && sede.codice_stalla) {
        return `${sede.nome} (${sede.codice_stalla})`;
      }
      if (sede.nome) return sede.nome;
      if (sede.codice_stalla) return sede.codice_stalla;
      if (sede.descrizione) return sede.descrizione;
      return `Sede #${sede.id}`;
    };

    return [
      { value: '', label: 'Tutte' },
      ...sedi.map((sede) => ({
        value: String(sede.id),
        label: mapLabel(sede),
      })),
    ];
  }, [sedi]);

  const [stabilimentoOptions, setStabilimentoOptions] = useState([{ value: '', label: 'Tutti' }]);
  const [boxOptions, setBoxOptions] = useState([{ value: '', label: 'Tutti' }]);
  const [sessoOptions, setSessoOptions] = useState([{ value: '', label: 'Tutti' }]);
  const [razzaOptions, setRazzaOptions] = useState([{ value: '', label: 'Tutte' }]);
  const [statoOptions, setStatoOptions] = useState([{ value: '', label: 'Tutti' }]);

  const buildOptionsFromList = useCallback((values, { labelFn = (v) => v, allowAllLabel = 'Tutti' }) => {
    const unique = Array.from(new Set(values.filter(Boolean)));
    return allowAllLabel
      ? [{ value: '', label: allowAllLabel }, ...unique.map((value) => ({ value, label: labelFn(value) }))]
      : unique.map((value) => ({ value, label: labelFn(value) }));
  }, []);

  const [categoriaOptions, setCategoriaOptions] = useState([{ value: '', label: 'Tutte' }]);

  const updateSessoOptions = useCallback(
    (animaliList) => {
      const values = new Set();
      animaliList.forEach((a) => {
        if (a.sesso) values.add(a.sesso);
      });
      const dynamicOptions = [
        { value: '', label: 'Tutti' },
        ...Array.from(values).map((sesso) => ({ value: sesso, label: sesso })),
      ];
      setSessoOptions(dynamicOptions);
      if (filterSesso && !values.has(filterSesso)) {
        setFilterSesso('');
      }
    },
    [filterSesso],
  );

  const updateRazzaOptions = useCallback(
    (animaliList) => {
      const values = new Set();
      animaliList.forEach((a) => {
        if (a.razza) values.add(a.razza);
      });
      const dynamicOptions = [
        { value: '', label: 'Tutte' },
        ...Array.from(values).map((razza) => ({ value: razza, label: razza })),
      ];
      setRazzaOptions(dynamicOptions);
      if (filterRazza && !values.has(filterRazza)) {
        setFilterRazza('');
      }
    },
    [filterRazza],
  );

  const updateStatoOptions = useCallback(
    (animaliList) => {
      const values = new Set();
      animaliList.forEach((a) => {
        if (a.stato) values.add(a.stato);
      });
      const dynamicOptions = [
        { value: '', label: 'Tutti' },
        ...Array.from(values).map((stato) => ({ value: stato, label: stato })),
      ];
      setStatoOptions(dynamicOptions);
      if (filterStato && !values.has(filterStato)) {
        setFilterStato('');
      }
    },
    [filterStato],
  );

  const updateCategoriaOptions = useCallback(
    (animaliList) => {
      const categorie = new Set();
      animaliList.forEach((a) => {
        const cat = a.categoria || a.categoria_produttiva || a.classe || null;
        if (cat) categorie.add(cat);
      });
      const dynamicOptions = [
        { value: '', label: 'Tutte' },
        ...Array.from(categorie).map((cat) => ({ value: cat, label: cat })),
      ];
      setCategoriaOptions(dynamicOptions.length > 1 ? dynamicOptions : [{ value: '', label: 'Tutte' }]);
      if (filterCategoria && !categorie.has(filterCategoria)) {
        setFilterCategoria('');
      }
    },
    [filterCategoria],
  );

  useEffect(() => {
    const stabilizeOptions = () => {
      const stabValues = stabilimenti.map((stab) => ({
        value: String(stab.id),
        label: stab.nome || `Stabilimento #${stab.id}`,
      }));
      setStabilimentoOptions([{ value: '', label: 'Tutti' }, ...stabValues]);
    };

    const boxValues =
      boxesByStabilimento[filterStabilimento] || [];
    setBoxOptions(
      [{ value: '', label: 'Tutti' }].concat(
        boxValues.map((box) => ({
          value: String(box.id),
          label: box.nome ? `${box.nome}${box.codice ? ` (${box.codice})` : ''}` : `Box #${box.id}`,
        })),
      ),
    );

    stabilizeOptions();
  }, [stabilimenti, boxesByStabilimento, filterStabilimento]);

  useEffect(() => {
    if (aziendaId) {
      setFilterAzienda(String(aziendaId));
      loadSedi(String(aziendaId));
    } else {
      setFilterAzienda('');
      setSedi([]);
      setStabilimenti([]);
      setBoxesByStabilimento({});
    }
  }, [aziendaId]);

  const updateContrattoOptions = useCallback(
    (animaliList) => {
      const baseOptions = [{ value: '', label: 'Tutti' }];
      const propertyPresent = animaliList.some(
        (animale) => !animale.contratto_soccida_id || animale.contratto_soccida_id === null,
      );
      const uniqueContratti = Array.from(
        new Set(
          animaliList
            .map((animale) => animale.contratto_soccida_id)
            .filter((id) => id !== null && id !== undefined),
        ),
      );

      const dynamicOptions = [...baseOptions];
      if (propertyPresent) {
        dynamicOptions.push({ value: '__proprieta__', label: 'Solo proprietà' });
      }
      uniqueContratti.forEach((id) => {
        dynamicOptions.push({
          value: String(id),
          label: `Contratto #${id}`,
        });
      });

      setContrattoOptions(dynamicOptions);

      if (filterContrattoSoccida === '__proprieta__' && !propertyPresent) {
        setFilterContrattoSoccida('');
      } else if (
        filterContrattoSoccida &&
        filterContrattoSoccida !== '__proprieta__' &&
        !uniqueContratti.includes(parseInt(filterContrattoSoccida, 10))
      ) {
        setFilterContrattoSoccida('');
      }
    },
    [filterContrattoSoccida],
  );

  useEffect(() => {
    if (filterAzienda) {
      loadSedi(filterAzienda);
      hydrateBaseAnimali({ force: true, aziendaTargetId: parseInt(filterAzienda, 10) });
    } else {
      setSedi([]);
      setStabilimenti([]);
      setBaseAnimali([]);
    }
    setFilterSede('');
    setFilterStabilimento('');
    setFilterBox('');
  }, [filterAzienda, hydrateBaseAnimali]);

  useEffect(() => {
    if (filterSede) {
      loadStabilimenti(filterSede);
    } else {
      setStabilimenti([]);
    }
    setFilterStabilimento('');
    setFilterBox('');
  }, [filterSede]);

  useEffect(() => {
    if (filterStabilimento) {
      setFilterBox('');
      loadBoxesForStabilimento(filterStabilimento);
    } else {
      setFilterBox('');
    }
  }, [filterStabilimento, loadBoxesForStabilimento]);

  useEffect(() => {
    if (!loading && baseAnimali.length > 0 && animali.length === 0) {
      handleSearch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseAnimali]);

  // Ricerca automatica quando cambiano i filtri
  useEffect(() => {
    if (aziendaId || filterAzienda) {
      // Debounce per evitare troppe chiamate
      const timeoutId = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    searchTerm,
    filterAzienda,
    filterSede,
    filterStabilimento,
    filterBox,
    filterStato,
    filterSesso,
    filterRazza,
    filterCategoria,
    filterContrattoSoccida,
    filterDataArrivoDa,
    filterDataArrivoA,
    filterPesoMin,
    filterPesoMax,
  ]);

  useEffect(() => {
    if (!controlledSelection) {
      setInternalSelectedIds((prev) => prev.filter((id) => animali.some((a) => a.id === id)));
      setInternalSelectedItems((prev) =>
        prev.filter((item) => animali.some((a) => a.id === item.id)),
      );
    }
  }, [animali, controlledSelection]);

  const hydrateBaseAnimali = useCallback(
    async ({ force = false, aziendaTargetId } = {}) => {
      const targetId = aziendaTargetId ?? (filterAzienda ? parseInt(filterAzienda, 10) : aziendaId);
      if (!targetId) {
        setBaseAnimali([]);
        return [];
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && baseAnimali.length > 0) {
        return baseAnimali;
      }

      const cached = getCachedAnimali(targetId, filterStato === 'presente');
      if (!force && Array.isArray(cached)) {
        setBaseAnimali(cached);
        return cached;
      }

      try {
        const data = await prefetchAnimali(targetId, { soloPresenti: filterStato === 'presente', force });
        const list = Array.isArray(data) ? data : [];
        setBaseAnimali(list);
        return list;
      } catch (err) {
        // Per errori 503, gestisci silenziosamente
        if (err.status === 503 || err.isServiceUnavailable) {
          // Prova a usare i dati cached
          const cached = getCachedAnimali(aziendaId, { soloPresenti: true });
          if (cached) {
            setBaseAnimali(cached);
          } else {
            setBaseAnimali([]);
          }
        } else {

        }
        if (!force && Array.isArray(cached)) {
          setBaseAnimali(cached);
          return cached;
        }
        return [];
      }
    },
    [aziendaId, filterAzienda, filterStato, baseAnimali.length],
  );

  const loadSedi = async (aziendaIdValue) => {
    try {
      const data = await allevamentoService.getSedi(aziendaIdValue);
      setSedi(data || []);
    } catch (err) {

      setSedi([]);
    }
  };

  const loadStabilimenti = async (sedeId) => {
    try {
      const data = await allevamentoService.getStabilimenti(sedeId);
      setStabilimenti(data || []);
    } catch (err) {

      setStabilimenti([]);
    }
  };

  const loadBoxesForStabilimento = useCallback(
    async (stabilimentoId) => {
      if (!stabilimentoId || boxesByStabilimento[stabilimentoId]) {
        return boxesByStabilimento[stabilimentoId] || [];
      }
      setLoadingBoxes(true);
      try {
        const data = await allevamentoService.getBox(parseInt(stabilimentoId, 10));
        setBoxesByStabilimento((prev) => ({
          ...prev,
          [stabilimentoId]: data || [],
        }));
        return data || [];
      } catch (err) {

        setBoxesByStabilimento((prev) => ({
          ...prev,
          [stabilimentoId]: [],
        }));
        return [];
      } finally {
        setLoadingBoxes(false);
      }
    },
    [boxesByStabilimento],
  );

  const getBoxIdsForSede = useCallback(
    async (sedeId) => {
      if (!sedeId) return [];
      const stabilimentiList = await allevamentoService.getStabilimenti(parseInt(sedeId, 10));
      const allBoxIds = [];
      for (const stabilimento of stabilimentiList || []) {
        const boxes = await loadBoxesForStabilimento(String(stabilimento.id));
        boxes.forEach((box) => {
          if (box?.id) {
            allBoxIds.push(box.id);
          }
        });
      }
      return allBoxIds;
    },
    [loadBoxesForStabilimento],
  );

  const escapeCsvValue = (value) => {
    if (value === null || value === undefined) return '';
    const stringValue = String(value);
    if (/[;"\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };

  const escapeHtml = (value) => {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  const formatDate = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('it-IT');
  };

  const handleExport = (type) => {
    if (!animali.length || exporting) return;
    setExporting(true);
    const headers = [
      'Auricolare',
      'Stato',
      'Sesso',
      'Razza',
      'Categoria',
      'Sede',
      'Stabilimento',
      'Box',
      'Data Arrivo',
      'Peso Arrivo',
    ];

    const rows = animali.map((a) => [
      a.auricolare || '',
      a.stato || '',
      a.sesso || '',
      a.razza || '',
      a.categoria || a.categoria_produttiva || a.classe || '',
      a.nome_sede || a.sede_nome || '',
      a.nome_stabilimento || a.stabilimento_nome || '',
      a.nome_box || a.box_nome || '',
      formatDate(a.data_arrivo_originale || dataArrivoOriginaleCache[a.id] || a.data_arrivo),
      a.peso_arrivo || '',
    ]);

    try {
      if (type === 'csv') {
        const csvContent = [
          headers.map(escapeCsvValue).join(';'),
          ...rows.map((row) => row.map(escapeCsvValue).join(';')),
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ricerca_animali_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const headerHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        const rowsHtml = rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('');
        const tableHtml = `<table><thead>${headerHtml}</thead><tbody>${rowsHtml}</tbody></table>`;
        const blob = new Blob([`\uFEFF${tableHtml}`], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `ricerca_animali_${Date.now()}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } finally {
      setExporting(false);
    }
  };

  const handleSearch = useCallback(async () => {
    // Preserva la posizione del pannello filtri rispetto al viewport prima del caricamento
    const filtersPanel = filtersPanelRef.current;
    let filtersPanelTopFromViewport = null;
    if (filtersPanel) {
      const rect = filtersPanel.getBoundingClientRect();
      filtersPanelTopFromViewport = rect.top;
    }
    const scrollPosition = window.scrollY || window.pageYOffset;

    // Blocca temporaneamente l'altezza del pannello risultati per evitare salti di layout
    if (resultsPanelRef.current) {
      setResultsPanelHeight(resultsPanelRef.current.offsetHeight);
    }
    
    setLoading(true);
    setError(null);
    try {
      const targetAziendaId = filterAzienda ? parseInt(filterAzienda, 10) : aziendaId;
      if (!targetAziendaId) {
        setAnimali([]);
        return;
      }

      let allAnimali = [];

      // Se c'è un filtro sede/stabilimento/box, usa direttamente il backend per efficienza
      // Altrimenti usa il prefetch per performance
      const hasHierarchicalFilter = filterSede || filterStabilimento || filterBox;
      
      if (hasHierarchicalFilter) {
        // Chiamata diretta al backend con filtri gerarchici
        const filters = {
          azienda_id: targetAziendaId,
        };
        
        if (filterStato) {
          filters.stato = filterStato;
        }
        
        if (filterBox) {
          filters.box_id = parseInt(filterBox, 10);
          allAnimali = await allevamentoService.getAnimali(filters);
        } else if (filterStabilimento) {
          // Per stabilimento, dobbiamo ancora filtrare lato client
          // perché il backend non ha ancora filtro stabilimento_id diretto
          const boxes = await loadBoxesForStabilimento(filterStabilimento);
          const boxIds = boxes.map((box) => box.id);
          if (boxIds.length > 0) {
            // Filtra per tutti i box dello stabilimento
            const results = await Promise.all(
              boxIds.map(boxId => allevamentoService.getAnimali({ ...filters, box_id: boxId }))
            );
            allAnimali = results.flat();
          } else {
            allAnimali = [];
          }
        } else if (filterSede) {
          // Usa il nuovo filtro sede_id lato backend (molto più efficiente!)
          // Il backend filtra automaticamente per:
          // - codice_azienda_anagrafe = sede.codice_stalla E data_uscita IS NULL
          // - OPPURE box_id che appartiene alla sede E data_uscita IS NULL
          filters.sede_id = parseInt(filterSede, 10);
          allAnimali = await allevamentoService.getAnimali(filters);
        }
      } else {
        // Nessun filtro gerarchico: 
        // Se il filtro stato è diverso da "presente", chiama direttamente il backend
        // Altrimenti usa prefetch per performance
        if (filterStato && filterStato !== 'presente') {
          // Chiamata diretta al backend quando si cerca uno stato specifico diverso da "presente"
          const filters = {
            azienda_id: targetAziendaId,
            stato: filterStato,
          };
          allAnimali = await allevamentoService.getAnimali(filters);
    } else if (targetAziendaId === aziendaId) {
      allAnimali =
        baseAnimali.length > 0
          ? baseAnimali
          : await hydrateBaseAnimali({ force: false, aziendaTargetId: targetAziendaId });
    } else {
      const fetched = await prefetchAnimali(targetAziendaId, { soloPresenti: filterStato === 'presente', force: true });
      allAnimali = Array.isArray(fetched) ? fetched : [];
    }
      }


      if (searchTerm) {
        const term = searchTerm.trim();
        if (term.length >= 4) {
          const last4 = term.slice(-4);
          allAnimali = allAnimali.filter(
            (a) => a.auricolare && a.auricolare.slice(-4) === last4,
          );
          } else {
          allAnimali = allAnimali.filter(
            (a) => a.auricolare && a.auricolare.toLowerCase().includes(term.toLowerCase()),
          );
        }
      }

      // Salva una copia di allAnimali prima di applicare i filtri dinamici
      // per generare le opzioni basate su tutti gli animali disponibili
      // Se il filtro stato è "presente" o vuoto, carica tutti gli animali
      // (senza filtro stato) per generare le opzioni complete
      let animaliForOptions = [...allAnimali];
      if (!filterStato || filterStato === 'presente') {
        // Carica tutti gli animali (non solo presenti) per generare le opzioni complete
        try {
          const filtersForOptions = {
            azienda_id: targetAziendaId,
          };
          // Mantieni i filtri gerarchici se presenti
          if (filterBox) {
            filtersForOptions.box_id = parseInt(filterBox, 10);
            animaliForOptions = await allevamentoService.getAnimali(filtersForOptions);
          } else if (filterStabilimento) {
            const boxes = await loadBoxesForStabilimento(filterStabilimento);
            const boxIds = boxes.map((box) => box.id);
            if (boxIds.length > 0) {
              const results = await Promise.all(
                boxIds.map(boxId => allevamentoService.getAnimali({ ...filtersForOptions, box_id: boxId }))
              );
              animaliForOptions = results.flat();
            } else {
              animaliForOptions = [];
            }
          } else if (filterSede) {
            filtersForOptions.sede_id = parseInt(filterSede, 10);
            animaliForOptions = await allevamentoService.getAnimali(filtersForOptions);
          } else {
            // Nessun filtro gerarchico: carica tutti gli animali
            animaliForOptions = await allevamentoService.getAnimali(filtersForOptions);
          }
          if (!Array.isArray(animaliForOptions)) {
            animaliForOptions = allAnimali;
          }
        } catch (err) {

          // Usa allAnimali come fallback
          animaliForOptions = allAnimali;
        }
      }

      // Aggiorna le opzioni dei filtri dinamici basandosi su animaliForOptions
      updateStatoOptions(animaliForOptions);
      updateSessoOptions(animaliForOptions);
      updateRazzaOptions(animaliForOptions);
      updateCategoriaOptions(animaliForOptions);
      updateContrattoOptions(animaliForOptions);

      if (filterStato) {
        allAnimali = allAnimali.filter((a) => a.stato === filterStato);
      }

      if (filterSesso) {
        allAnimali = allAnimali.filter((a) => a.sesso === filterSesso);
      }

      if (filterRazza) {
        allAnimali = allAnimali.filter((a) => a.razza === filterRazza);
      }

      if (filterCategoria) {
        allAnimali = allAnimali.filter(
          (a) =>
            a.categoria === filterCategoria ||
            a.categoria_produttiva === filterCategoria ||
            a.classe === filterCategoria,
        );
      }

      if (filterContrattoSoccida === '__proprieta__') {
        allAnimali = allAnimali.filter(
          (a) => !a.contratto_soccida_id || a.contratto_soccida_id === null,
        );
      } else if (filterContrattoSoccida) {
        const contrattoId = parseInt(filterContrattoSoccida, 10);
        if (!Number.isNaN(contrattoId)) {
          allAnimali = allAnimali.filter((a) => a.contratto_soccida_id === contrattoId);
        }
      }

      if (filterDataArrivoDa) {
        const fromDate = new Date(filterDataArrivoDa);
        allAnimali = allAnimali.filter((a) => {
          // Usa data_arrivo_originale se disponibile, altrimenti usa data_arrivo o la cache
          const dataArrivo = a.data_arrivo_originale || dataArrivoOriginaleCache[a.id] || a.data_arrivo;
          if (!dataArrivo) return false;
          const animalDate = new Date(dataArrivo);
          return animalDate >= fromDate;
        });
      }

      if (filterDataArrivoA) {
        const toDate = new Date(filterDataArrivoA);
        allAnimali = allAnimali.filter((a) => {
          // Usa data_arrivo_originale se disponibile, altrimenti usa data_arrivo o la cache
          const dataArrivo = a.data_arrivo_originale || dataArrivoOriginaleCache[a.id] || a.data_arrivo;
          if (!dataArrivo) return false;
          const animalDate = new Date(dataArrivo);
          return animalDate <= toDate;
        });
      }

      if (filterPesoMin) {
        const min = parseFloat(filterPesoMin.replace(',', '.'));
        if (!Number.isNaN(min)) {
          allAnimali = allAnimali.filter((a) => parseFloat(a.peso_arrivo) >= min);
        }
      }

      if (filterPesoMax) {
        const max = parseFloat(filterPesoMax.replace(',', '.'));
        if (!Number.isNaN(max)) {
          allAnimali = allAnimali.filter((a) => parseFloat(a.peso_arrivo) <= max);
        }
      }
      
      setAnimali(allAnimali);
      setCurrentPage(1); // Reset alla prima pagina quando cambiano i risultati
      setLastUpdated(new Date());
      
      // Ripristina la posizione del pannello filtri dopo il rendering per evitare salti
      // Usa doppio requestAnimationFrame per assicurarsi che il DOM sia completamente aggiornato
      if (filtersPanelTopFromViewport !== null) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const currentFiltersPanel = filtersPanelRef.current;
            if (!currentFiltersPanel) return;
            
            const newRect = currentFiltersPanel.getBoundingClientRect();
            const newTopFromViewport = newRect.top;
            const difference = newTopFromViewport - filtersPanelTopFromViewport;
            
            // Se il pannello filtri si è spostato (più di 1px), aggiusta lo scroll
            if (Math.abs(difference) > 1) {
              const newScrollPosition = scrollPosition - difference;
              window.scrollTo({
                top: Math.max(0, newScrollPosition),
                behavior: 'instant'
              });
            }
          });
        });
      }

      // Sblocca l'altezza del pannello risultati dopo il rendering
      requestAnimationFrame(() => {
        setResultsPanelHeight(null);
      });
    } catch (err) {
      // Per errori 503, gestisci silenziosamente
      if (err.status === 503 || err.isServiceUnavailable) {
        setError(null); // Non mostrare errore per 503
        setAnimali([]);
      } else {

      setError(err.message || 'Errore durante la ricerca');
      setAnimali([]);
      }
    } finally {
      setResultsPanelHeight(null);
      setLoading(false);
    }
  }, [
    filterAzienda,
    filterBox,
    filterCategoria,
    filterContrattoSoccida,
    filterDataArrivoA,
    filterDataArrivoDa,
    filterPesoMax,
    filterPesoMin,
    filterRazza,
    filterSede,
    filterSesso,
    filterStabilimento,
    filterStato,
    searchTerm,
    sedi,
    loadBoxesForStabilimento,
    getBoxIdsForSede,
    aziendaId,
    baseAnimali,
    hydrateBaseAnimali,
    updateContrattoOptions,
    updateStatoOptions,
    updateSessoOptions,
    updateRazzaOptions,
    updateCategoriaOptions,
  ]);

  const syncSelection = useCallback(
    (nextIds, nextItems) => {
      if (onSelectionChange) {
        onSelectionChange({ ids: nextIds, items: nextItems });
      }
      if (!controlledSelection) {
        setInternalSelectedIds(nextIds);
        setInternalSelectedItems(nextItems);
      }
    },
    [controlledSelection, onSelectionChange],
  );

  const handleToggleSelection = useCallback(
    (animale) => {
      const exists = selectedIds.includes(animale.id);
      const nextIds = exists
        ? selectedIds.filter((id) => id !== animale.id)
        : [...selectedIds, animale.id];
      const nextItems = exists
        ? selectedItems.filter((item) => item.id !== animale.id)
        : [...selectedItems, animale];
      syncSelection(nextIds, nextItems);
    },
    [selectedIds, selectedItems, syncSelection],
  );

  const handleSelectAll = useCallback(() => {
    if (selectedIds.length === animali.length) {
      syncSelection([], []);
    } else {
      syncSelection(
        animali.map((a) => a.id),
        animali,
      );
    }
  }, [animali, selectedIds.length, syncSelection]);

  // Cache per le date di arrivo originali (dalla partita di ingresso esterno)
  const [dataArrivoOriginaleCache, setDataArrivoOriginaleCache] = useState({});

  const handleAnimaleClick = async (animale) => {
    setLoadingDetailId(animale.id);
    try {
      const dettaglio = await allevamentoService.getAnimaleDetail(animale.id);
      setSelectedAnimale(dettaglio);
      
      // Salva la data di arrivo originale dalla partita di ingresso esterno se disponibile
      if (dettaglio.partita_ingresso_esterno?.data) {
        setDataArrivoOriginaleCache(prev => ({
          ...prev,
          [animale.id]: dettaglio.partita_ingresso_esterno.data
        }));
      }
    } catch (err) {
      alert(`Errore nel caricamento dettagli: ${err.message}`);
    } finally {
      setLoadingDetailId(null);
    }
  };

  const handleReset = () => {
    setSearchTerm('');
    setFilterSede('');
    setFilterStabilimento('');
    setFilterBox('');
    setFilterStato('');
    setFilterSesso('');
    setFilterRazza('');
    setFilterCategoria('');
    setFilterContrattoSoccida('');
    setFilterDataArrivoDa('');
    setFilterDataArrivoA('');
    setFilterPesoMin('');
    setFilterPesoMax('');
    setFilterStato('presente');
    setAnimali(baseAnimali);
    updateStatoOptions(baseAnimali);
    updateSessoOptions(baseAnimali);
    updateRazzaOptions(baseAnimali);
    updateCategoriaOptions(baseAnimali);
    updateContrattoOptions(baseAnimali);
    setCurrentPage(1); // Reset alla prima pagina quando cambiano i risultati
    syncSelection([], []);
  };

  const totalDisponibili = baseAnimali.length;
  const risultati = animali.length;
  
  // Calcola gli animali da mostrare nella pagina corrente
  const totalPages = Math.ceil(animali.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAnimali = animali.slice(startIndex, endIndex);
  
  // Funzioni per la paginazione
  const goToPage = (page) => {
    const newPage = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(newPage);
    // Scroll in alto quando cambia pagina
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
  const isGestioneMode = mode === 'gestione';
  const headerTitle = isGestioneMode ? 'Gestione Animali' : 'Ricerca Animali';
  const headerSubtitle = isGestioneMode
    ? 'Ricerca, organizza e assegna gli animali alle operazioni di stalla e uscita.'
    : 'Consulta e filtra gli animali dell’azienda per gestire anagrafica e movimentazioni.';
  const hasSelection = selectedIds.length > 0;
  const canAssign = hasSelection && isGestioneMode && typeof onRequestAssignBox === 'function';
  const canCreatePiano = hasSelection && isGestioneMode && typeof onRequestCreatePiano === 'function';
  const canAddToExisting =
    hasSelection &&
    isGestioneMode &&
    selectedPiano &&
    typeof onRequestAddToPiano === 'function';
  const activeRowId = loadingDetailId || selectedAnimale?.id || null;

  return (
    <div className="animal-search">
      {selectedAnimale ? (
        <AnimaleDetail 
          animale={selectedAnimale} 
          initialDetail={selectedAnimale}
          onClose={() => setSelectedAnimale(null)}
          onUpdate={handleSearch}
        />
      ) : (
        <>
          {!isGestioneMode && (
          <div className="search-header">
            <div>
              <h2>{headerTitle}</h2>
              <p className="search-subtitle">{headerSubtitle}</p>
            </div>
            <div className="header-actions">
              <button className="btn-tertiary" onClick={handleReset}>
                Resetta filtri
              </button>
            </div>
          </div>
          )}

          {error && (
            <div className="alert alert-error">
              <strong>Errore:</strong> {error}
            </div>
          )}

          <div className="animal-search-layout">
            <aside className="filters-panel" ref={filtersPanelRef}>
              <div className="filters-section">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 className="filters-title" style={{ margin: 0 }}>Filtri di ricerca</h3>
                  <span style={{ fontSize: '12px', color: '#9ca3af', fontWeight: 400 }}>
                    {risultati} / {totalDisponibili || 0}
                  </span>
                </div>
                
                <label className="filter-field">
                  <span>Ricerca auricolare</span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Es: 1000 (min 4 cifre)"
                    maxLength={20}
                  />
                </label>

                <label className="filter-field">
                  <span>Sede</span>
                <SimpleSelect
                  className="select-compact"
                  options={sedeOptions}
                  value={filterSede}
                  onChange={(e) => setFilterSede(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Tutte le sedi"
                  disabled={!filterAzienda}
                  allowEmpty={false}
                />
                </label>

                <label className="filter-field">
                  <span>Stabilimento</span>
                <SimpleSelect
                  className="select-compact"
                  options={stabilimentoOptions}
                  value={filterStabilimento}
                  onChange={(e) => setFilterStabilimento(e.target.value)}
                  displayField="label"
                  valueField="value"
                  placeholder="Tutti gli stabilimenti"
                  disabled={!filterSede}
                  allowEmpty={false}
                />
                </label>

                <label className="filter-field">
                  <span>Box</span>
                  <SimpleSelect
                    className="select-compact"
                    options={boxOptions}
                    value={filterBox}
                    onChange={(e) => setFilterBox(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti i box"
                    disabled={!filterStabilimento || loadingBoxes}
                    allowEmpty={false}
                  />
                {loadingBoxes && <p className="filters-hint">Caricamento box...</p>}
                </label>

                <label className="filter-field">
                  <span>Stato</span>
                  <SimpleSelect
                    className="select-compact"
                    options={statoOptions}
                    value={filterStato}
                    onChange={(e) => setFilterStato(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti"
                    allowEmpty={false}
                  />
                </label>

                <label className="filter-field">
                  <span>Sesso</span>
                  <SimpleSelect
                    className="select-compact"
                    options={sessoOptions}
                    value={filterSesso}
                    onChange={(e) => setFilterSesso(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti"
                    allowEmpty={false}
                  />
                </label>

                <label className="filter-field">
                  <span>Razza</span>
                  <SimpleSelect
                    className="select-compact"
                    options={razzaOptions}
                    value={filterRazza}
                    onChange={(e) => setFilterRazza(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutte"
                    allowEmpty={false}
                  />
                </label>

                {categoriaOptions.length > 1 && (
                  <label className="filter-field">
                    <span>Categoria</span>
                    <SimpleSelect
                      className="select-compact"
                      options={categoriaOptions}
                      value={filterCategoria}
                      onChange={(e) => setFilterCategoria(e.target.value)}
                      displayField="label"
                      valueField="value"
                      placeholder="Tutte"
                      allowEmpty={false}
                    />
                  </label>
                )}

                <label className="filter-field">
                  <span>Contratto di soccida</span>
                  <SimpleSelect
                    className="select-compact"
                    options={contrattoOptions}
                    value={filterContrattoSoccida}
                    onChange={(e) => setFilterContrattoSoccida(e.target.value)}
                    displayField="label"
                    valueField="value"
                    placeholder="Tutti"
                    allowEmpty={false}
                  />
                </label>

                <div className="filter-divider"></div>
              <div className="filter-grid">
                <label className="filter-field">
                  <span>Data arrivo da</span>
                  <input
                    type="date"
                    value={filterDataArrivoDa}
                    onChange={(e) => setFilterDataArrivoDa(e.target.value)}
                  />
                </label>
                <label className="filter-field">
                  <span>Data arrivo a</span>
                  <input
                    type="date"
                    value={filterDataArrivoA}
                    onChange={(e) => setFilterDataArrivoA(e.target.value)}
                  />
                </label>
                <label className="filter-field">
                  <span>Peso minimo (kg)</span>
                  <input
                    type="number"
                    value={filterPesoMin}
                    onChange={(e) => setFilterPesoMin(e.target.value)}
                    min="0"
                    step="0.1"
                  />
                </label>
                <label className="filter-field">
                  <span>Peso massimo (kg)</span>
                  <input
                    type="number"
                    value={filterPesoMax}
                    onChange={(e) => setFilterPesoMax(e.target.value)}
                    min="0"
                    step="0.1"
                  />
                </label>
              </div>

              <div className="filter-actions-vertical">
                <button className="btn-secondary" onClick={handleReset}>
                  Reset filtri
                </button>
                </div>
              </div>
            </aside>

            <section
              className="results-panel"
              ref={resultsPanelRef}
              style={resultsPanelHeight ? { minHeight: resultsPanelHeight } : undefined}
            >
              {isGestioneMode && hasSelection && (
                <div className="selection-toolbar">
                  <span>
                    {selectedIds.length} animal{selectedIds.length === 1 ? 'e' : 'i'} selezionat
                    {selectedIds.length === 1 ? 'o' : 'i'}
                  </span>
                  <div className="selection-toolbar-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        if (canAssign) {
                          onRequestAssignBox?.(selectedItems);
                        }
                      }}
                      disabled={!canAssign}
                    >
                      Assegna a box
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => {
                        if (canCreatePiano) {
                          onRequestCreatePiano?.(selectedItems);
                        }
                      }}
                      disabled={!canCreatePiano}
                    >
                      Nuovo piano di uscita
                    </button>
                    {selectedPiano && (
                      <button
                        className="btn-secondary"
                        onClick={() => {
                          if (canAddToExisting) {
                            onRequestAddToPiano?.(selectedPiano, selectedItems);
                          }
                        }}
                        disabled={!canAddToExisting}
                      >
                        Aggiungi a “{selectedPiano?.nome || selectedPiano?.name || 'Piano selezionato'}”
                      </button>
                    )}
                    <button
                      className="btn-tertiary"
                      onClick={() => syncSelection([], [])}
                    >
                      Deseleziona tutto
                    </button>
                  </div>
                </div>
              )}
              {loading ? (
                <div className="results-loading">Caricamento risultati...</div>
              ) : risultati > 0 ? (
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        {isGestioneMode && (
                          <th className="selection-col">
                            <input
                              type="checkbox"
                              checked={hasSelection && selectedIds.length === animali.length && animali.length > 0}
                              onChange={handleSelectAll}
                              aria-label="Seleziona tutti gli animali"
                            />
                          </th>
                        )}
                        <th>Auricolare</th>
                        <th>Stato</th>
                        <th>Sesso</th>
                        <th>Razza</th>
                        <th>Data arrivo</th>
                        <th>Peso arrivo (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAnimali.map((animale) => {
                        const isSelected = selectedIds.includes(animale.id);
                        const isActiveRow = activeRowId === animale.id;
                        const rowClassNames = [
                          isSelected ? 'selected-row' : '',
                          isActiveRow ? 'row-active' : '',
                          loadingDetailId === animale.id ? 'row-loading' : '',
                        ]
                          .filter(Boolean)
                          .join(' ')
                          .trim();
                        return (
                          <tr
                            key={animale.id}
                            onClick={() => handleAnimaleClick(animale)}
                            className={rowClassNames}
                          >
                            {isGestioneMode && (
                              <td className="selection-col">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelection(animale);
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                  aria-label={`Seleziona ${animale.auricolare || 'animale'}`}
                                />
                              </td>
                            )}
                          <td className="cell-strong">{animale.auricolare || '—'}</td>
                          <td>
                            <span className={`status-pill ${animale.stato || 'default'}`}>
                              {animale.stato || '—'}
                            </span>
                          </td>
                          <td>{animale.sesso || '—'}</td>
                          <td>{animale.razza || '—'}</td>
                          <td>{formatDate(animale.data_arrivo_originale || dataArrivoOriginaleCache[animale.id] || animale.data_arrivo)}</td>
                          <td>{animale.peso_arrivo ? `${animale.peso_arrivo}` : '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="results-empty">
                  <p>Prova a modificare i filtri o ad ampliare il periodo di ricerca.</p>
                </div>
              )}
            </section>
          </div>
          
          {/* Controlli paginazione */}
          {!loading && risultati > 0 && animali.length > itemsPerPage && (
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
  );
};

export default AnimalSearch;

