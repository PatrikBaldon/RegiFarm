/**
 * GestioneFatture - Gestione unificata fatture (emesse e ricevute)
 */
import React, { useState, useEffect, useCallback, useMemo, useImperativeHandle, forwardRef } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import api from '../../../services/api';
import { terreniService } from '../../terreni/services/terreniService';
import { alimentazioneService } from '../../alimentazione/services/alimentazioneService';
import { impostazioniService } from '../../../services/impostazioniService';
import { attrezzaturaService } from '../../attrezzatura/services/attrezzaturaService';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import { useAzienda } from '../../../context/AziendaContext';
import { useRequest } from '../../../context/RequestContext';
import './GestioneFatture.css';
import { prefetchFatture, getCachedFatture } from '../prefetchers';
import AssociaPartiteFatturaModal from './AssociaPartiteFatturaModal';

// Opzioni stato pagamento per fatture ricevute (uscite)
const STATO_PAGAMENTO_USCITA = [
  { value: 'da_pagare', label: 'Da Pagare' },
  { value: 'pagata', label: 'Pagata' },
  { value: 'parziale', label: 'Parziale' },
  { value: 'scaduta', label: 'Scaduta' },
  { value: 'annullata', label: 'Annullata' },
];

// Opzioni stato pagamento per fatture emesse (entrate)
const STATO_PAGAMENTO_ENTRATA = [
  { value: 'da_incassare', label: 'Da Incassare' },
  { value: 'incassata', label: 'Incassata' },
  { value: 'parziale', label: 'Parziale' },
  { value: 'scaduta', label: 'Scaduta' },
  { value: 'annullata', label: 'Annullata' },
];

const TIPO_FATTURA_OPTIONS = [
  { value: 'entrata', label: 'Entrata' },
  { value: 'uscita', label: 'Uscita' },
];

const MACROCATEGORIE_OPTIONS = [
  { value: 'nessuna', label: 'Nessuna' },
  { value: 'alimento', label: 'Alimento' },
  { value: 'terreno', label: 'Terreno' },
  { value: 'attrezzatura', label: 'Attrezzatura' },
  { value: 'sanitario', label: 'Sanitario' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'personale', label: 'Personale' },
  { value: 'servizi', label: 'Servizi' },
  { value: 'assicurazioni', label: 'Assicurazioni' },
  { value: 'finanziario', label: 'Finanziario' },
  { value: 'amministrativo', label: 'Amministrativo' },
];

const FATTURE_PER_PAGINA = 12;

const GestioneFatture = forwardRef((props, ref) => {
  const [fatture, setFatture] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Filtri
  const [filterTipo, setFilterTipo] = useState('tutti'); // 'tutti', 'ricevuta', 'emessa'
  const [filterFornitore, setFilterFornitore] = useState('');
  const [filterDataDa, setFilterDataDa] = useState('');
  const [filterDataA, setFilterDataA] = useState('');
  const [filterNumero, setFilterNumero] = useState('');
  const [filterImportoDa, setFilterImportoDa] = useState('');
  const [filterImportoA, setFilterImportoA] = useState('');
  const [exporting, setExporting] = useState(false);
  const [fornitori, setFornitori] = useState([]);
  const [terreni, setTerreni] = useState([]);
  const [categorie, setCategorie] = useState([]); // Array di { value, label, macrocategoria }
  const [fornitoriTipi, setFornitoriTipi] = useState([]); // Per precompilare macrocategoria da fornitore
  const [attrezzature, setAttrezzature] = useState([]);
  const [contrattiSoccida, setContrattiSoccida] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedFattura, setSelectedFattura] = useState(null);
  
  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  
  const [showImportXMLModal, setShowImportXMLModal] = useState(false);
  const [importingXML, setImportingXML] = useState(false);
  const [importXMLResult, setImportXMLResult] = useState(null);
  const [showImportExportMenu, setShowImportExportMenu] = useState(false);
  const [importProgress, setImportProgress] = useState({
    current: 0,
    total: 0,
    progress: 0,
    importate_emesse: 0,
    importate_amministrazione: 0,
    errate: 0,
    duplicate_emesse: 0,
    duplicate_amministrazione: 0,
    current_file: '',
    errori_recenti: []  // Lista degli ultimi errori
  });
  
  // Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [fatturaModalLoading, setFatturaModalLoading] = useState(false);
  const [fatturaModalData, setFatturaModalData] = useState(null);
  
  // Modal per associare partite di uscita
  const [showAssociaPartiteModal, setShowAssociaPartiteModal] = useState(false);
  
  // Quick Category Edit State
  const [editingCategory, setEditingCategory] = useState(false);
  const [quickCategoryValue, setQuickCategoryValue] = useState('');
  const [quickMacrocategoriaValue, setQuickMacrocategoriaValue] = useState('');

  const [formData, setFormData] = useState({
    azienda_id: null,
    numero: '',
    data_fattura: new Date().toISOString().split('T')[0],
    data_registrazione: new Date().toISOString().split('T')[0],
    fornitore_id: null, // usato per fatture ricevute
    cliente_id: null,   // usato per fatture emesse
    cliente_nome: '',   // usato per fatture emesse
    tipo: 'uscita', // 'uscita' (ricevuta) o 'entrata' (emessa)
    importo_totale: '',
    importo_iva: '0',
    importo_netto: '',
    importo_pagato: '0', // o importo_incassato
    stato_pagamento: 'da_pagare',
    data_scadenza: '',
    data_pagamento: '', // o data_incasso
    condizioni_pagamento: '',
    divisa: 'EUR',
    tipo_documento: '',
    periodo_da: '',
    periodo_a: '',
    periodo_attribuzione: '',
    categoria: '',
    macrocategoria: '',
    terreno_id: null,
    attrezzatura_id: null,
    contratto_soccida_id: null,
    importo_iva: '0',
    note: '',
  });
  const [formPayments, setFormPayments] = useState([]);
  const [formLinee, setFormLinee] = useState([]);
  const createEmptyPayment = useCallback(
    () => ({
      id: null,
      codice: '',
      label: '',
      importo: '',
      scadenza: '',
      banca: '',
      iban: '',
      note: '',
    }),
    []
  );
  const { azienda, loading: aziendaLoading } = useAzienda();
  const canOperate = Boolean(azienda?.id);

  // Mock for categories that trigger fields (replace with real logic if available)
  const categorieTerrenoValues = ['prodotti_agricoli', 'sementi', 'concimi', 'fitofarmaci'];
  const isCategoriaAttrezzatura = (cat) => ['riparazioni', 'manutenzione', 'carburante', 'ricambi', 'attrezzature'].includes(cat);

  // Carica tutti i dati iniziali con un singolo endpoint batch
  useEffect(() => {
    
    const loadInitialData = async () => {
      // Carica impostazioni separatamente (non fa parte del batch)
      loadImpostazioni();
      
      // Usa endpoint batch per caricare tutto il resto in una chiamata
      try {
        const initData = await amministrazioneService.getInitData(azienda?.id);
        if (initData) {
          setFornitori(initData.fornitori || []);
          setFornitoriTipi(initData.fornitori_tipi || []);
          setAttrezzature(initData.attrezzature || []);
          setContrattiSoccida(initData.contratti_soccida || []);
          setTerreni(initData.terreni || []);
        }
      } catch (error) {

        // Fallback: carica singolarmente
        loadFornitori();
        loadFornitoriTipi();
        if (azienda?.id) {
          loadAttrezzature();
          loadContrattiSoccida(azienda.id);
        }
      }
    };
    
    loadInitialData();
  }, [azienda?.id]);

  const fetchFattureData = useCallback(
    async ({ aziendaId, force = false, showErrors = true } = {}) => {
      const effectiveId = aziendaId ?? azienda?.id;

      if (!effectiveId) {
        setFatture([]);
        setLoading(false);
        return null;
      }

      // Se i dati sono già nello state e non è forzato, non ricaricare
      if (!force && fatture.length > 0) {
        return null;
      }

        setLoading(true);

      try {
        // Fetch unificato: tutte le fatture (ricevute e emesse) vengono da un solo endpoint
        const fattureData = await prefetchFatture(effectiveId, { force });

        // Filtra e marca le fatture in base al tipo
        const listaRicevute = Array.isArray(fattureData) 
          ? fattureData.filter(f => f.tipo === 'uscita').map(f => ({ ...f, sourceType: 'ricevuta', isEmessa: false })) 
          : [];
        const listaEmesse = Array.isArray(fattureData) 
          ? fattureData.filter(f => f.tipo === 'entrata').map(f => ({ ...f, sourceType: 'emessa', isEmessa: true })) 
          : [];

        // Unisci e ordina per data fattura (più recenti prima)
        const unificate = [...listaRicevute, ...listaEmesse].sort((a, b) => {
          const dateA = new Date(a.data_fattura || 0);
          const dateB = new Date(b.data_fattura || 0);
          return dateB - dateA;
        });

        setFatture(unificate);
        return unificate;
      } catch (error) {
        // Per errori 503, gestisci silenziosamente
        if (error?.status === 503 || error?.isServiceUnavailable) {
          setFatture([]);
          return null;
        }

        if (showErrors) {
          alert('Errore nel caricamento dei dati');
        }
        setFatture([]);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [azienda?.id, fatture.length]
  );

  useEffect(() => {
    if (!azienda?.id) {
      setFatture([]);
      return;
    }
    setFormData((prev) => ({
      ...prev,
      azienda_id: prev.azienda_id ?? azienda.id,
    }));
    fetchFattureData({ aziendaId: azienda.id });
    // loadTerreni ora caricato dal batch iniziale
  }, [azienda?.id, fetchFattureData]);

  useEffect(() => {
    if (!showModal) {
      setFormPayments([]);
      setFormLinee([]);
      return;
    }
    if (!fatturaModalData) {
      if (!selectedFattura) {
        setFormPayments([]);
      }
      return;
    }
    // Carica sempre i pagamenti quando fatturaModalData cambia, anche in editing
    setFormPayments(mapPaymentsFromDetails(fatturaModalData));
  }, [showModal, fatturaModalData, selectedFattura, mapPaymentsFromDetails]);
  
  // Reset alla prima pagina quando cambiano i filtri
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterTipo, filterFornitore, filterDataDa, filterDataA, filterNumero, filterImportoDa, filterImportoA]);

  // Chiudi menu importa/esporta quando si clicca fuori
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showImportExportMenu && !event.target.closest('.import-export-dropdown')) {
        setShowImportExportMenu(false);
      }
    };

    if (showImportExportMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showImportExportMenu]);

  const loadImpostazioni = async () => {
    if (!azienda?.id) {

      return;
    }
    try {
      const impostazioni = await impostazioniService.getImpostazioni(azienda.id);
      const costi = impostazioni?.amministrazione?.categorie_costi || [];
      const ricavi = impostazioni?.amministrazione?.categorie_ricavi || [];
      
      // Combina costi e ricavi, rimuovendo duplicati per value
      const allCats = [...new Map([...costi, ...ricavi].map(c => {
        const value = typeof c === 'string' ? c : (c.value || c.id || c.codice || '');
        const label = typeof c === 'string' ? c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : (c.label || c.nome || value || '');
        const macrocategoria = typeof c === 'string' ? 'nessuna' : (c.macrocategoria || c.associazione || 'nessuna');
        return [value, { value, label, macrocategoria }];
      })).values()].filter(c => c.value);
      
      setCategorie(allCats);
    } catch (error) {

    }
  };

  const loadFornitoriTipi = async () => {
    try {
      const response = await amministrazioneService.getFornitoriTipi();
      // La risposta potrebbe essere response.data o direttamente l'array
      const tipi = Array.isArray(response) ? response : (response?.data || []);
      setFornitoriTipi(tipi);
    } catch (error) {

      setFornitoriTipi([]);
    }
  };

  const loadFornitori = async () => {
    try {
      const fornitoriData = await amministrazioneService.getFornitori();
      setFornitori(fornitoriData || []);
    } catch (error) {

    }
  };

  const loadTerreni = async (aziendaId) => {
    if (!aziendaId) return;
    try {
      const terreniData = await terreniService.getTerreni({ azienda_id: aziendaId });
      setTerreni(terreniData || []);
    } catch (error) {

    }
  };

  const loadAttrezzature = async () => {
    if (!azienda?.id) return;
    try {
      const data = await amministrazioneService.getAttrezzature(azienda.id);
      setAttrezzature(data || []);
    } catch (error) {

      setAttrezzature([]);
    }
  };

  const loadContrattiSoccida = async (aziendaId) => {
    if (!aziendaId) return;
    try {
      const data = await amministrazioneService.getContrattiSoccida({ azienda_id: aziendaId });
      setContrattiSoccida(data || []);
    } catch (error) {

      setContrattiSoccida([]);
    }
  };

  const handleShowModal = (fattura = null, edit = false) => {
    setSelectedFattura(fattura);
    setIsEditing(edit || !fattura);
    setEditingCategory(false); // Reset quick edit
        setFatturaModalData(null);
    
    if (fattura) {
      const isEmessa = fattura.sourceType === 'emessa';
      setFormData({
        ...fattura,
        tipo: isEmessa ? 'entrata' : 'uscita',
    data_fattura: fattura.data_fattura ? fattura.data_fattura.split('T')[0] : '',
    data_registrazione: fattura.data_registrazione ? fattura.data_registrazione.split('T')[0] : '',
    data_scadenza: fattura.data_scadenza ? fattura.data_scadenza.split('T')[0] : '',
        data_pagamento: (isEmessa ? fattura.data_incasso : fattura.data_pagamento) ? (isEmessa ? fattura.data_incasso : fattura.data_pagamento).split('T')[0] : '',
    periodo_da: fattura.periodo_da ? fattura.periodo_da.split('T')[0] : '',
    periodo_a: fattura.periodo_a ? fattura.periodo_a.split('T')[0] : '',
        // Mappatura specifica per importo pagato/incassato
        importo_pagato: isEmessa ? (fattura.importo_incassato || '0') : (fattura.importo_pagato || '0'),
        // Mappatura Cliente per emesse
        cliente_id: isEmessa ? fattura.cliente_id : null,
        cliente_nome: isEmessa ? fattura.cliente_nome : '',
        fornitore_id: !isEmessa ? fattura.fornitore_id : null,
        macrocategoria: fattura.macrocategoria || '',
      });
      setQuickCategoryValue(fattura.categoria || '');
      
      // Se la fattura ha un fornitore ma non ha macrocategoria, prova a precompilarla
      if (!fattura.macrocategoria && !isEmessa && fattura.fornitore_id) {
        const fornitoreTipo = fornitoriTipi.find(ft => ft.fornitore_id === fattura.fornitore_id);
        if (fornitoreTipo?.macrocategoria && fornitoreTipo.macrocategoria !== 'nessuna') {
          setFormData(prev => ({ ...prev, macrocategoria: fornitoreTipo.macrocategoria }));
        }
      }
      
      // Load full details if needed
      loadFatturaDetails(fattura.id, isEmessa);
    } else {
      resetForm();
      setFormPayments([]);
    }
    setShowModal(true);
  };

  const loadFatturaDetails = async (id, isEmessa) => {
    setFatturaModalLoading(true);
    try {
      // Usa sempre getFattura (endpoint unificato)
      const details = await amministrazioneService.getFattura(id);
      
      // Determina isEmessa dal campo tipo se non passato
      const isEmessaFromDetails = details?.tipo === 'entrata';
      const effectiveIsEmessa = isEmessa !== undefined ? isEmessa : isEmessaFromDetails;
        
      // Priorità: usa righe JSON se disponibile, altrimenti fallback a linee o dati_xml
      // Per le fatture emesse, le linee potrebbero essere in dati_xml
      // Per le fatture ricevute, le linee sono nella relazione linee
      if (details) {
        // Normalizza le linee: priorità a righe JSON, poi dati_xml, poi relazione linee
        const linee = details.righe && Array.isArray(details.righe) && details.righe.length > 0
          ? details.righe  // Usa righe JSON se disponibile
          : effectiveIsEmessa 
            ? (details.dati_xml?.linee || details.dati_xml?.dettaglio_linee || [])
            : (details.linee || []);
        
        setFatturaModalData({
          ...details,
          linee: linee, // Assicura che linee sia sempre presente
          righe: details.righe || linee  // Mantieni anche righe per riferimento
        });
        setFormPayments(mapPaymentsFromDetails(details));
        // Carica le linee di dettaglio nello stato editabile
        const lineeToLoad = Array.isArray(linee) && linee.length > 0 ? linee : [];
        setFormLinee(lineeToLoad.map(l => ({ ...l })));
        
         setFormData(prev => {
            // Se non c'è macrocategoria ma c'è un fornitore, prova a precompilarla
            let macrocategoria = details.macrocategoria || prev.macrocategoria;
            if (!macrocategoria && !effectiveIsEmessa && details.fornitore_id) {
              const fornitoreTipo = fornitoriTipi.find(ft => ft.fornitore_id === details.fornitore_id);
              if (fornitoreTipo?.macrocategoria && fornitoreTipo.macrocategoria !== 'nessuna') {
                macrocategoria = fornitoreTipo.macrocategoria;
              }
            }
            
            return {
              ...prev,
              ...details,
              data_fattura: details.data_fattura ? details.data_fattura.split('T')[0] : prev.data_fattura,
              // Reinforce source logic
              tipo: effectiveIsEmessa ? 'entrata' : 'uscita',
              importo_pagato: effectiveIsEmessa ? (details.importo_incassato || prev.importo_pagato) : (details.importo_pagato || prev.importo_pagato),
              data_pagamento: (effectiveIsEmessa ? details.data_incasso : details.data_pagamento) ? (effectiveIsEmessa ? details.data_incasso : details.data_pagamento).split('T')[0] : prev.data_pagamento,
              periodo_da: details.periodo_da ? details.periodo_da.split('T')[0] : prev.periodo_da,
              periodo_a: details.periodo_a ? details.periodo_a.split('T')[0] : prev.periodo_a,
              macrocategoria: macrocategoria || prev.macrocategoria || '',
            };
         });
      }
    } catch (error) {

    } finally {
      setFatturaModalLoading(false);
    }
  };

  const handleAddPaymentMode = useCallback(() => {
    if (!isEditing) return;
    setFormPayments((prev) => [...prev, createEmptyPayment()]);
  }, [isEditing, createEmptyPayment]);

  const handlePaymentFieldChange = useCallback((index, field, value) => {
    setFormPayments((prev) => {
      if (!prev[index]) return prev;
      const updated = [...prev];
      const next = { ...updated[index], [field]: value };
      if (field === 'codice') {
        next.label = getModalitaPagamentoLabel(value);
      }
      updated[index] = next;
      return updated;
    });
  }, []);

  const handleRemovePayment = useCallback((indexToRemove) => {
    setFormPayments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  }, []);

  const resetForm = () => {
    setFormLinee([]);
    setFormData({
      azienda_id: azienda?.id || null,
      numero: '',
      data_fattura: new Date().toISOString().split('T')[0],
      data_registrazione: new Date().toISOString().split('T')[0],
      fornitore_id: null,
      cliente_id: null,
      cliente_nome: '',
      tipo: 'uscita',
      importo_totale: '',
      importo_iva: '0',
      importo_netto: '',
      importo_pagato: '0',
      stato_pagamento: 'da_pagare',
      data_scadenza: '',
      data_pagamento: '',
      condizioni_pagamento: '',
      divisa: 'EUR',
      tipo_documento: '',
      periodo_da: '',
      periodo_a: '',
      periodo_attribuzione: '',
      categoria: '',
      macrocategoria: '',
      terreno_id: null,
      attrezzatura_id: null,
      contratto_soccida_id: null,
      importo_iva: '0',
      aliquota_iva: '22',
      note: '',
    });
    setFormPayments([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isEmessa = formData.tipo === 'entrata';
    
    try {
      const payload = {
        ...formData,
        azienda_id: azienda?.id,
        importo_totale: parseFloat(formData.importo_totale) || 0,
        importo_iva: parseFloat(formData.importo_iva) || 0,
        importo_netto: parseFloat(formData.importo_netto) || (parseFloat(formData.importo_totale) - parseFloat(formData.importo_iva)),
        importo_pagato: isEmessa ? null : parseFloat(formData.importo_pagato) || 0,
        importo_incassato: isEmessa ? parseFloat(formData.importo_pagato) || 0 : null,
        terreno_id: formData.terreno_id || null,
        attrezzatura_id: formData.attrezzatura_id || null,
        contratto_soccida_id: formData.contratto_soccida_id || null,
        fornitore_id: isEmessa ? null : (formData.fornitore_id || null),
        cliente_id: isEmessa ? (formData.cliente_id || null) : null,
        categoria: formData.categoria || null,
        macrocategoria: formData.macrocategoria && formData.macrocategoria !== 'nessuna' ? formData.macrocategoria : null,
        data_scadenza: formData.data_scadenza || null,
        righe: formLinee.length > 0 ? formLinee : null,
        data_pagamento: isEmessa ? null : (formData.data_pagamento || null),
        data_incasso: isEmessa ? (formData.data_pagamento || null) : null,
        periodo_da: formData.periodo_da && formData.periodo_da.trim() !== '' ? formData.periodo_da : null,
        periodo_a: formData.periodo_a && formData.periodo_a.trim() !== '' ? formData.periodo_a : null,
        periodo_attribuzione: formData.periodo_attribuzione || null,
      };
      const paymentsPayload = formPayments
        .map((payment) => {
          const hasImportoValue =
            payment.importo !== '' && payment.importo !== null && payment.importo !== undefined;
          const parsedImporto = hasImportoValue ? parseFloat(payment.importo) : null;
          return {
            modalita_pagamento: payment.codice || null,
            importo: parsedImporto !== null && !Number.isNaN(parsedImporto) ? parsedImporto : null,
            data_scadenza: payment.scadenza || null,
            iban: payment.iban || null,
            banca: payment.banca || null,
            note: payment.note || null,
          };
        })
        .filter(
          (p) =>
            p.modalita_pagamento ||
            p.importo !== null ||
            p.data_scadenza ||
            (p.iban && p.iban.trim() !== '') ||
            (p.banca && p.banca.trim() !== '') ||
            (p.note && p.note.trim() !== '')
        );
      payload.pagamenti_programmati = paymentsPayload;

      // Usa sempre gli endpoint unificati
      if (selectedFattura) {
        // Update - usa sempre updateFattura
        await amministrazioneService.updateFattura(selectedFattura.id, payload);
      } else {
        // Create - usa sempre createFattura
        await amministrazioneService.createFattura(payload);
      }

      setShowModal(false);
      resetForm();
      fetchFattureData({ force: true });
    } catch (error) {

      alert('Errore nel salvataggio: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleQuickCategorySave = async (e) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    if (!selectedFattura) return;
    
    try {
      const isEmessa = selectedFattura.sourceType === 'emessa';
      
      // Logica identica a handleSubmit: usa la macrocategoria selezionata o quella della categoria
      let macrocategoriaFinale = quickMacrocategoriaValue && quickMacrocategoriaValue !== 'nessuna' 
        ? quickMacrocategoriaValue 
        : null;
      
      // Se abbiamo una categoria selezionata, verifica se ha una macrocategoria
      if (quickCategoryValue) {
        const categoriaSelezionata = categorie.find(c => c.value === quickCategoryValue);
        if (categoriaSelezionata?.macrocategoria && categoriaSelezionata.macrocategoria !== 'nessuna') {
          // La categoria ha una macrocategoria: usala (ha priorità)
          macrocategoriaFinale = categoriaSelezionata.macrocategoria;
        }
      }
      
      // Se non abbiamo ancora una macrocategoria, usa quella corrente del formData
      if (!macrocategoriaFinale && formData.macrocategoria && formData.macrocategoria !== 'nessuna') {
        macrocategoriaFinale = formData.macrocategoria;
      }
      
      const payload = { 
        categoria: quickCategoryValue && quickCategoryValue !== '' ? quickCategoryValue : null,
        macrocategoria: macrocategoriaFinale && macrocategoriaFinale !== '' && macrocategoriaFinale !== 'nessuna' ? macrocategoriaFinale : null
      };
      
      // Usa sempre updateFattura (endpoint unificato)
      await amministrazioneService.updateFattura(selectedFattura.id, payload);
      
      // Aggiorna stato locale immediatamente per feedback visivo
      setFormData(prev => ({ 
        ...prev, 
        categoria: quickCategoryValue && quickCategoryValue !== '' ? quickCategoryValue : null, 
        macrocategoria: macrocategoriaFinale && macrocategoriaFinale !== '' && macrocategoriaFinale !== 'nessuna' ? macrocategoriaFinale : null
      }));
      setEditingCategory(false);
      setQuickCategoryValue('');
      setQuickMacrocategoriaValue('');
      
      // Ricarica lista e dettagli per sincronizzare con il backend (forza refresh per evitare dati stale)
      await fetchFattureData({ force: true });
      // Ricarica i dettagli della fattura per aggiornare il formData
      if (selectedFattura) {
        const isEmessa = selectedFattura.tipo === 'entrata' || selectedFattura.isEmessa || selectedFattura.sourceType === 'emessa';
        await loadFatturaDetails(selectedFattura.id, isEmessa);
      }
      
    } catch (error) {

      alert('Errore durante l\'aggiornamento della categoria: ' + (error.response?.data?.detail || error.message));
    }
  };

  const handleDelete = async (e, fattura) => {
    e.stopPropagation(); // Prevent modal open
    if (!confirm('Sei sicuro di voler eliminare questa fattura?')) return;
    try {
      // Usa sempre deleteFattura (endpoint unificato) - passa azienda_id per invalidare cache
      await amministrazioneService.deleteFattura(fattura.id, fattura.azienda_id || azienda?.id);
      fetchFattureData({ force: true });
    } catch (error) {

      alert('Errore nell\'eliminazione');
    }
  };

  const formatDate = (value) => {
    if (!value) return '-';
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch (error) {
      return value;
    }
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) {
      return value;
    }
    return `€${numberValue.toFixed(2)}`;
  };

  const getStatoLabel = (stato) => {
    const allOptions = [...STATO_PAGAMENTO_USCITA, ...STATO_PAGAMENTO_ENTRATA];
    const option = allOptions.find(opt => opt.value === stato);
    return option ? option.label : stato ? stato.replace(/_/g, ' ') : '-';
  };
  
  const getFornitoreName = (id) => {
    const f = fornitori.find(i => i.id === id);
    return f ? f.nome : '-';
  };

  const getClienteName = (fattura) => {
    if (fattura.cliente_nome) return fattura.cliente_nome;
    if (fattura.cliente_id) {
        const f = fornitori.find(i => i.id === fattura.cliente_id);
        return f ? f.nome : 'N/A';
    }
    return '-';
  };

  const formatCategoria = (cat) => {
    return cat ? cat.replace(/_/g, ' ') : '-';
  };

  const getTerrenoName = (id) => {
      const t = terreni.find(i => i.id === id);
      return t ? t.denominazione : '-';
  };

  const getAttrezzaturaName = (id) => {
      if (!id) return '-';
      const a = attrezzature.find(i => i.id === id);
      return a ? (a.nome || a.denominazione || `Attrezzatura #${id}`) : '-';
  };

  const getContrattoSoccidaName = (id) => {
      if (!id) return '-';
      const c = contrattiSoccida.find(i => i.id === id);
      return c ? (c.numero_contratto || `Contratto #${id}`) : '-';
  };

  // Helper for rendering JSON/XML
  const renderJson = (data) => <pre>{JSON.stringify(data, null, 2)}</pre>;
  const formatXml = (xml) => xml;
  const normalizePaymentFromBackend = useCallback(
    (payment) => {
      const rawScadenza = payment?.data_scadenza
        ? String(payment.data_scadenza)
        : '';
      return {
        id: payment?.id ?? null,
        codice: payment?.modalita_pagamento || '',
        label: getModalitaPagamentoLabel(payment?.modalita_pagamento),
        importo: payment?.importo != null ? String(payment.importo) : '',
        scadenza: rawScadenza ? rawScadenza.split('T')[0] : '',
        banca: payment?.banca || payment?.istituto_finanziario || '',
        iban: payment?.iban || '',
        note: payment?.note || '',
      };
    },
    []
  );
  const mapPaymentsFromDetails = useCallback(
    (details) => {
      if (!details?.pagamenti_programmati) {
        return [];
      }
      return details.pagamenti_programmati.map(normalizePaymentFromBackend);
    },
    [normalizePaymentFromBackend]
  );

  // Modalità di pagamento (da pagamenti_programmati)
  const modalitaPagamenti = useMemo(() => {
    if (!Array.isArray(formPayments)) {
      return [];
    }
    return formPayments.map((p, index) => ({
      key: p.id || `pag-${index}`,
      codice: p.codice || '',
      label: getModalitaPagamentoLabel(p.codice),
      importo: p.importo,
      scadenza: p.scadenza,
      banca: p.banca || p.istituto_finanziario || '',
      note: p.note,
      iban: p.iban,
    }));
  }, [formPayments]);

  const showLegacyPaymentFields = !isEditing && modalitaPagamenti.length === 0;
  const effectiveIsEmessa = useMemo(() => {
    if (selectedFattura) {
      return (
        selectedFattura.tipo === 'entrata' ||
        selectedFattura.sourceType === 'emessa' ||
        selectedFattura.isEmessa === true
      );
    }
    return formData.tipo === 'entrata';
  }, [selectedFattura, formData.tipo]);

  // Filtraggio fatture
  const filteredFatture = useMemo(() => {
    let filtered = [...fatture];
    
    // Filtro per tipo
    if (filterTipo !== 'tutti') {
      if (filterTipo === 'ricevuta') {
        filtered = filtered.filter(f => f.tipo === 'uscita' || f.sourceType === 'ricevuta');
      } else if (filterTipo === 'emessa') {
        filtered = filtered.filter(f => f.tipo === 'entrata' || f.sourceType === 'emessa');
      }
    }
    
    // Filtro per fornitore/cliente
    if (filterFornitore) {
      const fornitoreId = parseInt(filterFornitore);
      filtered = filtered.filter(f => {
        const isEmessa = f.sourceType === 'emessa';
        if (isEmessa) {
          return f.cliente_id === fornitoreId;
        } else {
          return f.fornitore_id === fornitoreId;
        }
      });
    }
    
    // Filtro per range date
    if (filterDataDa) {
      const dataDa = new Date(filterDataDa);
      filtered = filtered.filter(f => {
        const dataFattura = new Date(f.data_fattura);
        return dataFattura >= dataDa;
      });
    }
    if (filterDataA) {
      const dataA = new Date(filterDataA);
      dataA.setHours(23, 59, 59, 999); // Fine giornata
      filtered = filtered.filter(f => {
        const dataFattura = new Date(f.data_fattura);
        return dataFattura <= dataA;
      });
    }
    
    // Filtro per numero fattura
    if (filterNumero) {
      const numeroLower = filterNumero.toLowerCase();
      filtered = filtered.filter(f => 
        f.numero && f.numero.toLowerCase().includes(numeroLower)
      );
    }
    
    // Filtro per range importo
    if (filterImportoDa) {
      const importoDa = parseFloat(filterImportoDa);
      if (!isNaN(importoDa)) {
        filtered = filtered.filter(f => {
          const importo = parseFloat(f.importo_totale) || 0;
          return importo >= importoDa;
        });
      }
    }
    if (filterImportoA) {
      const importoA = parseFloat(filterImportoA);
      if (!isNaN(importoA)) {
        filtered = filtered.filter(f => {
          const importo = parseFloat(f.importo_totale) || 0;
          return importo <= importoA;
        });
      }
    }
    
    return filtered;
  }, [fatture, filterTipo, filterFornitore, filterDataDa, filterDataA, filterNumero, filterImportoDa, filterImportoA]);

  // Esportazione CSV/XLSX
  const handleExport = (type) => {
    if (!filteredFatture.length || exporting) return;
    setExporting(true);
    
    try {
      const headers = [
        'Tipo',
        'Numero',
        'Data Fattura',
        'Data Registrazione',
        'Fornitore/Cliente',
        'P.IVA',
        'Importo Totale',
        'Importo IVA',
        'Importo Netto',
        'Importo Pagato/Incassato',
        'Stato Pagamento',
        'Data Scadenza',
        'Data Pagamento/Incasso',
        'Categoria',
        'Macrocategoria',
        'Divisa',
        'Tipo Documento',
        'Note'
      ];

      const rows = filteredFatture.map((f) => {
        const isEmessa = f.sourceType === 'emessa';
        const fornitoreCliente = isEmessa ? getClienteName(f) : getFornitoreName(f.fornitore_id);
        const fornitoreObj = isEmessa 
          ? fornitori.find(i => i.id === f.cliente_id)
          : fornitori.find(i => i.id === f.fornitore_id);
        const piva = fornitoreObj?.partita_iva || '';
        
        return [
          isEmessa ? 'Emessa' : 'Ricevuta',
          f.numero || '',
          formatDate(f.data_fattura) || '',
          formatDate(f.data_registrazione) || '',
          fornitoreCliente || '',
          piva,
          f.importo_totale || '0',
          f.importo_iva || '0',
          f.importo_netto || '0',
          isEmessa ? (f.importo_incassato || '0') : (f.importo_pagato || '0'),
          getStatoLabel(f.stato_pagamento) || '',
          formatDate(f.data_scadenza) || '',
          formatDate(isEmessa ? f.data_incasso : f.data_pagamento) || '',
          f.categoria || '',
          f.macrocategoria || '',
          f.divisa || 'EUR',
          f.tipo_documento || '',
          f.note || ''
        ];
      });

      const escapeCsvValue = (value) => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(';') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      if (type === 'csv') {
        const csvContent = [
          headers.map(escapeCsvValue).join(';'),
          ...rows.map((row) => row.map(escapeCsvValue).join(';')),
        ].join('\n');
        const blob = new Blob([`\uFEFF${csvContent}`], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fatture_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else if (type === 'xlsx') {
        // Per XLSX usiamo un formato HTML che Excel può aprire
        const escapeHtml = (value) => {
          if (value === null || value === undefined) return '';
          return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
        };
        
        const headerHtml = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
        const rowsHtml = rows
          .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
          .join('');
        const tableHtml = `<table><thead>${headerHtml}</thead><tbody>${rowsHtml}</tbody></table>`;
        const blob = new Blob([`\uFEFF${tableHtml}`], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `fatture_${new Date().toISOString().slice(0, 10)}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch (error) {

      alert('Errore durante l\'esportazione: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  // Reconstructed Modal Render with Unified Grid
  const renderModalContent = () => {
      const isEmessa = formData.tipo === 'entrata';
      const statusOptions = isEmessa ? STATO_PAGAMENTO_ENTRATA : STATO_PAGAMENTO_USCITA;
    const summarySubjectLabel = isEmessa ? 'Cliente' : 'Fornitore';
    const summarySubjectValue = isEmessa ? getClienteName(formData) : getFornitoreName(formData.fornitore_id);
    const primaryPayment = modalitaPagamenti[0];
    const summaryDueDate = primaryPayment?.scadenza || formData.data_scadenza;
    const summaryPaymentLabel = primaryPayment?.label || 'Modalità non specificata';
    const summaryPaymentCode = primaryPayment?.codice;

                        return (
        <BaseModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title={selectedFattura ? (isEditing ? 'Modifica Fattura' : 'Dettagli Fattura') : 'Nuova Fattura'}
          size="xlarge"
          headerActions={
            <>
              {!isEditing && selectedFattura && (
                <>
                  <button className="btn btn-secondary" onClick={() => {
                    setIsEditing(true);
                    // Assicura che i pagamenti siano caricati quando si entra in editing
                    if (fatturaModalData) {
                      setFormPayments(mapPaymentsFromDetails(fatturaModalData));
                    }
                  }}>
                    Modifica
                  </button>
                  <button
                    className="btn btn-danger" 
                    onClick={async () => {
                      if (confirm('Sei sicuro di voler eliminare questa fattura?')) {
                        await handleDelete({ preventDefault: () => {} }, selectedFattura);
                        setShowModal(false);
                      }
                    }}
                  >
                    Elimina
                  </button>
                </>
              )}
            </>
          }
          footerActions={
            isEditing ? (
              <>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => { 
                    // Se si sta creando una nuova fattura (selectedFattura è null), chiudi direttamente la modale
                    if (!selectedFattura) {
                      setShowModal(false);
                      resetForm();
                      setIsEditing(false);
                      setEditingCategory(false);
                      return;
                    }
                    
                    // Se si sta modificando una fattura esistente, ripristina i dati originali
                    setIsEditing(false); 
                    setEditingCategory(false);
                    const isEmessa = selectedFattura.sourceType === 'emessa';
                    setFormData({
                      ...selectedFattura,
                      tipo: effectiveIsEmessa ? 'entrata' : 'uscita',
                      data_fattura: selectedFattura.data_fattura ? selectedFattura.data_fattura.split('T')[0] : '',
                      data_registrazione: selectedFattura.data_registrazione ? selectedFattura.data_registrazione.split('T')[0] : '',
                      data_scadenza: selectedFattura.data_scadenza ? selectedFattura.data_scadenza.split('T')[0] : '',
                      data_pagamento: (isEmessa ? selectedFattura.data_incasso : selectedFattura.data_pagamento) ? (isEmessa ? selectedFattura.data_incasso : selectedFattura.data_pagamento).split('T')[0] : '',
                      importo_pagato: isEmessa ? (selectedFattura.importo_incassato || '0') : (selectedFattura.importo_pagato || '0'),
                      cliente_id: isEmessa ? selectedFattura.cliente_id : null,
                      cliente_nome: isEmessa ? selectedFattura.cliente_nome : '',
                      fornitore_id: !isEmessa ? selectedFattura.fornitore_id : null,
                    });
                    if (fatturaModalData) {
                      setFormPayments(mapPaymentsFromDetails(fatturaModalData));
                    }
                  }}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={(e) => {
                    e.preventDefault();
                    handleSubmit(e);
                  }}
                >
                  Salva
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowModal(false)}
              >
                Chiudi
              </button>
            )
          }
        >
              {fatturaModalLoading && <div className="loading">Caricamento dettagli...</div>}
              {!fatturaModalLoading && (
                <form onSubmit={handleSubmit} className="movimento-form">
                  <div className="form-grid">
                    {/* Numero Fattura */}
                    <div className="form-group">
                      <label>Numero Fattura</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.numero || ''}
                          onChange={(e) => setFormData({ ...formData, numero: e.target.value })}
                        />
                      ) : (
                        <span>{formData.numero || '-'}</span>
                      )}
                    </div>

                    {/* Tipo */}
                    <div className="form-group">
                      <label>Tipo</label>
                      {isEditing && !selectedFattura ? (
                        <SmartSelect
                          className="select-compact"
                          options={TIPO_FATTURA_OPTIONS}
                          value={formData.tipo}
                          onChange={(e) => setFormData({ ...formData, tipo: e.target.value })}
                          displayField="label"
                          valueField="value"
                        />
                      ) : (
                        <span>{getDocumentoTipoLabel(formData.tipo_documento, formData.tipo)}</span>
                      )}
                    </div>

                    {/* Data Fattura */}
                    <div className="form-group">
                      <label>Data Fattura</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={formData.data_fattura}
                          onChange={(e) => setFormData({ ...formData, data_fattura: e.target.value })}
                        />
                      ) : (
                        <span>{formatDate(formData.data_fattura) || '-'}</span>
                      )}
                    </div>

                    {/* Data Registrazione */}
                    <div className="form-group">
                      <label>Data Registrazione</label>
                      {isEditing ? (
                        <input
                          type="date"
                          value={formData.data_registrazione}
                          onChange={(e) => setFormData({ ...formData, data_registrazione: e.target.value })}
                        />
                      ) : (
                        <span>{formatDate(formData.data_registrazione) || '-'}</span>
                      )}
                    </div>

                    {/* Fornitore / Cliente */}
                    <div className="form-group">
                      <label>{isEmessa ? 'Cliente' : 'Fornitore'}</label>
                      {isEditing ? (
                        isEmessa ? (
                          <SmartSelect
                            className="select-compact"
                            options={fornitori}
                            value={formData.cliente_id || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, cliente_id: e.target.value ? parseInt(e.target.value) : null })
                            }
                            placeholder="Seleziona cliente..."
                            displayField="nome"
                            valueField="id"
                          />
                        ) : (
                          <SmartSelect
                            className="select-compact"
                            options={fornitori}
                            value={formData.fornitore_id || ''}
                            onChange={async (e) => {
                              const fornitoreId = e.target.value ? parseInt(e.target.value) : null;
                              let macrocategoria = formData.macrocategoria;
                              let categoria = formData.categoria;
                              
                              if (fornitoreId) {
                                if (!macrocategoria && !categoria) {
                                  try {
                                    const predizione = await amministrazioneService.prediciCategoriaFattura({
                                      fornitore_id: fornitoreId,
                                      tipo: formData.tipo || 'uscita',
                                      importo_totale: formData.importo_totale ? parseFloat(formData.importo_totale) : null,
                                    });
                                    if (predizione.macrocategoria) {
                                      macrocategoria = predizione.macrocategoria;
                                    }
                                    if (predizione.categoria) {
                                      categoria = predizione.categoria;
                                    }
                                  } catch (error) {
                                    // Ignora errori
                                  }
                                }
                                
                                let fornitoreTipo = fornitoriTipi.find((ft) => ft.fornitore_id === fornitoreId);
                                if (!fornitoreTipo) {
                                  try {
                                    const response = await amministrazioneService.getFornitoriTipi(null, fornitoreId);
                                    const tipi = Array.isArray(response) ? response : response?.data || [];
                                    fornitoreTipo = tipi.find((ft) => ft.fornitore_id === fornitoreId);
                                  } catch (error) {
                                    // Ignora errori
                                  }
                                }
                                
                                if (!macrocategoria && fornitoreTipo?.macrocategoria && fornitoreTipo.macrocategoria !== 'nessuna') {
                                  macrocategoria = fornitoreTipo.macrocategoria;
                                  const categorieFiltrate = categorie.filter((c) => c.macrocategoria === macrocategoria);
                                  if (categoria && !categorieFiltrate.find((c) => c.value === categoria)) {
                                    categoria = '';
                                  }
                                }
                              }
                              
                              setFormData({ ...formData, fornitore_id: fornitoreId, macrocategoria, categoria });
                            }}
                            placeholder="Seleziona fornitore..."
                            displayField="nome"
                            valueField="id"
                          />
                        )
                      ) : (
                        <span>{summarySubjectValue}</span>
                      )}
                    </div>

                    {/* Macrocategoria */}
                    <div className="form-group">
                      <label>Macrocategoria</label>
                      {isEditing ? (
                        <SmartSelect
                          className="select-compact"
                          options={MACROCATEGORIE_OPTIONS}
                          value={formData.macrocategoria || 'nessuna'}
                          onChange={(e) => {
                            const newValue = e.target.value;
                            const categoriaAttuale = categorie.find((c) => c.value === formData.categoria);
                            if (
                              categoriaAttuale &&
                              categoriaAttuale.macrocategoria &&
                              categoriaAttuale.macrocategoria !== newValue &&
                              newValue !== 'nessuna'
                            ) {
                              setFormData({ ...formData, macrocategoria: newValue, categoria: '' });
                            } else {
                              setFormData({ ...formData, macrocategoria: newValue === 'nessuna' ? '' : newValue });
                            }
                          }}
                          displayField="label"
                          valueField="value"
                        />
                      ) : (
                        <span>{getMacrocategoriaLabel(formData.macrocategoria)}</span>
                      )}
                    </div>

                    {/* Categoria */}
                    <div className="form-group">
                      <label>Categoria</label>
                      {isEditing ? (
                        <SmartSelect
                          className="select-compact"
                          options={(() => {
                            const macroRef = formData.macrocategoria;
                            if (!macroRef || macroRef === 'nessuna') {
                              return categorie;
                            }
                            const filtrate = categorie.filter((c) => (c.macrocategoria || 'nessuna') === macroRef);
                            return filtrate.length > 0 ? filtrate : categorie;
                          })()}
                          value={formData.categoria || ''}
                          onChange={(e) => {
                            const categoriaSelezionata = categorie.find((c) => c.value === e.target.value);
                            const newMacro = categoriaSelezionata?.macrocategoria || formData.macrocategoria || 'nessuna';
                            setFormData({
                              ...formData,
                              categoria: e.target.value,
                              macrocategoria: newMacro !== 'nessuna' ? newMacro : formData.macrocategoria,
                            });
                          }}
                          displayField="label"
                          valueField="value"
                          allowEmpty
                          placeholder="Nessuna"
                        />
                      ) : (
                        <span>{getCategoriaLabel(formData.categoria, categorie)}</span>
                      )}
                    </div>

                    {/* Associazione Partite - Solo per categoria animali */}
                    {formData.categoria === 'animali' && selectedFattura && !isEditing && (
                      <PartiteAssociateSection 
                        fattura={selectedFattura}
                        aziendaId={azienda?.id}
                        onAssociaClick={() => setShowAssociaPartiteModal(true)}
                        onRefresh={() => {
                          if (selectedFattura) {
                            const isEmessa = selectedFattura.tipo === 'entrata' || selectedFattura.sourceType === 'emessa' || selectedFattura.isEmessa;
                            loadFatturaDetails(selectedFattura.id, isEmessa);
                          }
                        }}
                      />
                    )}

                    {/* Terreno - condizionale */}
                    {categorieTerrenoValues.includes(formData.categoria) && (
                      <div className="form-group">
                        <label>Terreno</label>
                        {isEditing ? (
                          <SmartSelect
                            className="select-compact"
                            options={terreni}
                            value={formData.terreno_id || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, terreno_id: e.target.value ? parseInt(e.target.value) : null })
                            }
                            placeholder="Seleziona terreno..."
                            displayField="denominazione"
                            valueField="id"
                          />
                        ) : (
                          <span>{getTerrenoName(formData.terreno_id)}</span>
                        )}
                      </div>
                    )}

                    {/* Attrezzatura - condizionale */}
                    {isCategoriaAttrezzatura(formData.categoria) && (
                      <div className="form-group">
                        <label>Attrezzatura</label>
                        {isEditing ? (
                          <SmartSelect
                            className="select-compact"
                            options={attrezzature.map((a) => ({
                              value: a.id,
                              label: a.nome || a.denominazione || `Attrezzatura #${a.id}`,
                            }))}
                            value={formData.attrezzatura_id || ''}
                            onChange={(e) =>
                              setFormData({ ...formData, attrezzatura_id: e.target.value ? parseInt(e.target.value) : null })
                            }
                            placeholder="Seleziona attrezzatura..."
                            displayField="label"
                            valueField="value"
                          />
                        ) : (
                          <span>{getAttrezzaturaName(formData.attrezzatura_id)}</span>
                        )}
                      </div>
                    )}

                    {/* Contratto Soccida */}
                    <div className="form-group">
                      <label>Contratto Soccida</label>
                      {isEditing ? (
                        <SmartSelect
                          className="select-compact"
                          options={contrattiSoccida.map((c) => ({
                            value: c.id,
                            label: c.numero_contratto || `Contratto #${c.id}`,
                          }))}
                          value={formData.contratto_soccida_id || ''}
                          onChange={(e) =>
                            setFormData({ ...formData, contratto_soccida_id: e.target.value ? parseInt(e.target.value) : null })
                          }
                          placeholder="Seleziona contratto..."
                          displayField="label"
                          valueField="value"
                        />
                      ) : (
                        <span>{getContrattoSoccidaName(formData.contratto_soccida_id)}</span>
                      )}
                    </div>

                    {/* Importo Totale */}
                    <div className="form-group">
                      <label>Importo Totale (€)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.importo_totale}
                          onChange={(e) => {
                            const totale = parseFloat(e.target.value) || 0;
                            const iva = parseFloat(formData.importo_iva) || 0;
                            setFormData({
                              ...formData,
                              importo_totale: e.target.value,
                              importo_netto: (totale - iva).toFixed(2),
                            });
                          }}
                        />
                      ) : (
                        <span>{formatCurrency(formData.importo_totale)}</span>
                      )}
                    </div>

                    {/* IVA */}
                    <div className="form-group">
                      <label>Importo IVA (€)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.importo_iva}
                          onChange={(e) => {
                            const totale = parseFloat(formData.importo_totale) || 0;
                            const iva = parseFloat(e.target.value) || 0;
                            setFormData({
                              ...formData,
                              importo_iva: e.target.value,
                              importo_netto: (totale - iva).toFixed(2),
                            });
                          }}
                        />
                      ) : (
                        <span>{formatCurrency(formData.importo_iva)}</span>
                      )}
                    </div>

                    {/* Importo Netto */}
                    <div className="form-group">
                      <label>Importo Netto (€)</label>
                      {isEditing ? (
                        <input
                          type="number"
                          step="0.01"
                          value={formData.importo_netto}
                          readOnly
                        />
                      ) : (
                        <span>{formatCurrency(formData.importo_netto)}</span>
                      )}
                    </div>

                    {/* Importo Pagato/Incassato */}
                    {showLegacyPaymentFields && (
                      <div className="form-group">
                        <label>{effectiveIsEmessa ? 'Importo Incassato (€)' : 'Importo Pagato (€)'}</label>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={formData.importo_pagato}
                            onChange={(e) => setFormData({ ...formData, importo_pagato: e.target.value })}
                          />
                        ) : (
                          <span>{formatCurrency(formData.importo_pagato)}</span>
                        )}
                      </div>
                    )}

                    {/* Stato Pagamento/Incasso */}
                    <div className="form-group">
                      <label>{isEmessa ? 'Stato Incasso' : 'Stato Pagamento'}</label>
                      {isEditing ? (
                        <SmartSelect
                          className="select-compact"
                          options={statusOptions}
                          value={formData.stato_pagamento}
                          onChange={(e) => setFormData({ ...formData, stato_pagamento: e.target.value })}
                          displayField="label"
                          valueField="value"
                        />
                      ) : (
                        <span>{getStatoLabel(formData.stato_pagamento)}</span>
                      )}
                    </div>
                    
                    {/* Data Pagamento/Incasso */}
                    {showLegacyPaymentFields && (
                      <div className="form-group">
                        <label>{effectiveIsEmessa ? 'Data Incasso' : 'Data Pagamento'}</label>
                        {isEditing ? (
                          <input
                            type="date"
                            value={effectiveIsEmessa ? formData.data_incasso : formData.data_pagamento}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                [effectiveIsEmessa ? 'data_incasso' : 'data_pagamento']: e.target.value,
                              })
                            }
                          />
                        ) : (
                          <span>{formatDate(effectiveIsEmessa ? formData.data_incasso : formData.data_pagamento) || '-'}</span>
                        )}
                      </div>
                    )}

                    {/* Divisa */}
                    <div className="form-group">
                      <label>Divisa</label>
                      {isEditing ? (
                        <input
                          type="text"
                          value={formData.divisa || ''}
                          onChange={(e) => setFormData({ ...formData, divisa: e.target.value })}
                          placeholder="EUR"
                          maxLength={5}
                        />
                      ) : (
                        <span>{formData.divisa || '-'}</span>
                      )}
                    </div>
                  </div>

                  {/* Modalità di Pagamento/Incasso - fuori dalla griglia */}
                  <div className="form-group">
                    <label>{isEmessa ? 'Modalità di Incasso' : 'Modalità di Pagamento'}</label>
                    {modalitaPagamenti.length > 0 ? (
                      <div className="modalita-pagamento-wrapper">
                        {modalitaPagamenti.map((p, index) => (
                          <div key={p.key} className={`modalita-pagamento-editor ${isEditing ? 'is-editing' : ''}`}>
                            <div className="modalita-pagamento-row">
                              {isEditing ? (
                                <SmartSelect
                                  className="select-compact"
                                  options={[
                                    { value: '', label: 'Seleziona...' },
                                    ...Object.entries(MODALITA_PAGAMENTO_MAP).map(([code, label]) => ({
                                      value: code,
                                      label: `${code} - ${label}`
                                    }))
                                  ]}
                                  value={p.codice || ''}
                                  onChange={(e) => handlePaymentFieldChange(index, 'codice', e.target.value)}
                                  displayField="label"
                                  valueField="value"
                                />
                              ) : (
                                <>
                                  <strong>{p.label || 'Modalità non specificata'}</strong>
                                  <span>({p.codice || 'N/D'})</span>
                                </>
                              )}
                            </div>

                            <div className="modalita-pagamento-details">
                              <div className="modalita-field">
                                <label>Importo</label>
                                {isEditing ? (
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={p.importo ?? ''}
                                    onChange={(e) => handlePaymentFieldChange(index, 'importo', e.target.value)}
                                  />
                                ) : (
                                  <span>{p.importo ? formatCurrency(p.importo) : '-'}</span>
                                )}
                              </div>
                              <div className="modalita-field">
                                <label>Scadenza</label>
                                {isEditing ? (
                                  <input
                                    type="date"
                                    value={p.scadenza ? p.scadenza.slice(0, 10) : ''}
                                    onChange={(e) => handlePaymentFieldChange(index, 'scadenza', e.target.value)}
                                  />
                                ) : (
                                  <span>{p.scadenza ? formatDate(p.scadenza) : '-'}</span>
                                )}
                              </div>
                              {p.codice === 'MP05' && (
                                <>
                                  <div className="modalita-field modalita-field-full">
                                    <label>IBAN</label>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={p.iban || ''}
                                        onChange={(e) => handlePaymentFieldChange(index, 'iban', e.target.value)}
                                      />
                                    ) : (
                                      <span>{p.iban || '-'}</span>
                                    )}
                                  </div>
                                  <div className="modalita-field modalita-field-full">
                                    <label>Banca/Istituto</label>
                                    {isEditing ? (
                                      <input
                                        type="text"
                                        value={p.banca || ''}
                                        onChange={(e) => handlePaymentFieldChange(index, 'banca', e.target.value)}
                                      />
                                    ) : (
                                      <span>{p.banca || '-'}</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>

                            <div className="modalita-note">
                              <label>Note</label>
                              {isEditing ? (
                                <textarea
                                  value={p.note || ''}
                                  onChange={(e) => handlePaymentFieldChange(index, 'note', e.target.value)}
                                  rows={2}
                                />
                              ) : (
                                <span>{p.note || '—'}</span>
                              )}
                            </div>

                            {isEditing && (
                              <div className="modalita-actions">
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  onClick={() => handleRemovePayment(index)}
                                >
                                  Rimuovi
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span>Nessuna modalità registrata</span>
                    )}

                    {isEditing && formPayments.length === 0 && (
                      <button type="button" className="btn btn-secondary" onClick={handleAddPaymentMode}>
                        Aggiungi modalità
                      </button>
                    )}
                  </div>

                  {/* Note - fuori dalla griglia */}
                  <div className="form-group">
                    <label>Note</label>
                    {isEditing ? (
                      <textarea
                        value={formData.note || ''}
                        onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                        rows={3}
                      />
                    ) : (
                      <span>{formData.note || '-'}</span>
                    )}
                  </div>
                  {/* Linee di Dettaglio */}
                  {(isEditing ? formLinee.length > 0 : (fatturaModalData && ((fatturaModalData.righe && Array.isArray(fatturaModalData.righe) && fatturaModalData.righe.length > 0) || (fatturaModalData.linee && Array.isArray(fatturaModalData.linee) && fatturaModalData.linee.length > 0)))) && (
                    <div className="form-group">
                      <label>Linee di Dettaglio</label>
                      <div className="table-container">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Descrizione</th>
                              <th>Q.ta</th>
                              <th>Prezzo</th>
                              <th>Aliquota IVA</th>
                              <th>Totale</th>
                              {isEditing && <th>Azioni</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {(isEditing ? formLinee : (fatturaModalData.righe || fatturaModalData.linee || [])).map((linea, idx) => (
                              <tr key={idx}>
                                <td>
                                  {isEditing ? (
                                    <input
                                      type="text"
                                      value={linea.descrizione || ''}
                                      onChange={(e) => {
                                        const updated = [...formLinee];
                                        updated[idx] = { ...updated[idx], descrizione: e.target.value };
                                        setFormLinee(updated);
                                      }}
                                      className="table-input"
                                    />
                                  ) : (
                                    linea.descrizione || '-'
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={linea.quantita || ''}
                                      onChange={(e) => {
                                        const updated = [...formLinee];
                                        const quantita = parseFloat(e.target.value) || 0;
                                        const prezzoUnitario = parseFloat(updated[idx].prezzo_unitario) || 0;
                                        updated[idx] = {
                                          ...updated[idx],
                                          quantita,
                                          prezzo_totale: quantita * prezzoUnitario
                                        };
                                        setFormLinee(updated);
                                      }}
                                      className="table-input"
                                    />
                                  ) : (
                                    linea.quantita ? (typeof linea.quantita === 'number' ? linea.quantita.toFixed(2) : linea.quantita) : '-'
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={linea.prezzo_unitario || ''}
                                      onChange={(e) => {
                                        const updated = [...formLinee];
                                        const prezzoUnitario = parseFloat(e.target.value) || 0;
                                        const quantita = parseFloat(updated[idx].quantita) || 0;
                                        updated[idx] = {
                                          ...updated[idx],
                                          prezzo_unitario: prezzoUnitario,
                                          prezzo_totale: quantita * prezzoUnitario
                                        };
                                        setFormLinee(updated);
                                      }}
                                      className="table-input"
                                    />
                                  ) : (
                                    linea.prezzo_unitario ? formatCurrency(linea.prezzo_unitario) : '-'
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={linea.aliquota_iva || ''}
                                      onChange={(e) => {
                                        const updated = [...formLinee];
                                        updated[idx] = { ...updated[idx], aliquota_iva: parseFloat(e.target.value) || 0 };
                                        setFormLinee(updated);
                                      }}
                                      className="table-input"
                                    />
                                  ) : (
                                    linea.aliquota_iva ? `${typeof linea.aliquota_iva === 'number' ? linea.aliquota_iva.toFixed(2) : linea.aliquota_iva}%` : '-'
                                  )}
                                </td>
                                <td>
                                  {isEditing ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      value={linea.prezzo_totale || ''}
                                      onChange={(e) => {
                                        const updated = [...formLinee];
                                        updated[idx] = { ...updated[idx], prezzo_totale: parseFloat(e.target.value) || 0 };
                                        setFormLinee(updated);
                                      }}
                                      className="table-input"
                                    />
                                  ) : (
                                    linea.prezzo_totale ? formatCurrency(linea.prezzo_totale) : '-'
                                  )}
                                </td>
                                {isEditing && (
                                  <td>
                                    <button
                                      type="button"
                                      className="btn btn-danger btn-sm"
                                      onClick={() => {
                                        const updated = formLinee.filter((_, i) => i !== idx);
                                        setFormLinee(updated);
                                      }}
                                    >
                                      Rimuovi
                                    </button>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {isEditing && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setFormLinee([...formLinee, {
                              descrizione: '',
                              quantita: 0,
                              prezzo_unitario: 0,
                              aliquota_iva: 0,
                              prezzo_totale: 0
                            }]);
                          }}
                          style={{ marginTop: '10px' }}
                        >
                          Aggiungi Linea
                        </button>
                      )}
                    </div>
                  )}
                  {isEditing && formLinee.length === 0 && (
                    <div className="form-group">
                      <label>Linee di Dettaglio</label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setFormLinee([{
                            descrizione: '',
                            quantita: 0,
                            prezzo_unitario: 0,
                            aliquota_iva: 0,
                            prezzo_totale: 0
                          }]);
                        }}
                      >
                        Aggiungi Linea
                      </button>
                    </div>
                  )}
                </form>
              )}
        </BaseModal>
      );
  };

  const handleXMLFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImportXMLResult({
        success: false,
        error: 'Nessun file selezionato. Seleziona un file ZIP o XML prima di procedere.'
      });
      return;
    }
    
    // Verifica dimensione del file (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      setImportXMLResult({
        success: false,
        error: `File troppo grande. Dimensione massima: 100MB. File selezionato: ${(file.size / 1024 / 1024).toFixed(2)}MB`
      });
      e.target.value = '';
      return;
    }
    
    handleXMLImport(file);
  };

  const handleXMLImport = async (file) => {
    if (!file) {
      setImportXMLResult({
        success: false,
        error: 'Nessun file selezionato. Seleziona un file ZIP o XML prima di procedere.'
      });
      return;
    }
    
    // Verifica che il file abbia un'estensione valida
    const fileName = file.name || '';
    const validExtensions = ['.zip', '.ZIP', '.xml', '.XML'];
    const hasValidExtension = validExtensions.some(ext => fileName.toLowerCase().endsWith(ext.toLowerCase()));
    
    if (!hasValidExtension) {
      setImportXMLResult({
        success: false,
        error: `Formato file non supportato. Il file deve essere un ZIP (.zip) o XML (.xml). File selezionato: ${fileName}`
      });
      return;
    }
    
    setImportingXML(true);
    setImportXMLResult(null);
    setImportProgress({
      current: 0,
      total: 0,
      progress: 0,
      importate_emesse: 0,
      importate_amministrazione: 0,
      errate: 0,
      duplicate_emesse: 0,
      duplicate_amministrazione: 0,
      current_file: '',
      errori_recenti: []
    });
    
    try {
      await amministrazioneService.importFattureXMLStream(
        file,
        true,
        // onProgress
        (data) => {
          if (data.type === 'progress') {
            setImportProgress(prev => {
              const errori_recenti = [...prev.errori_recenti];
              // Se c'è un nuovo errore, aggiungilo alla lista (mantieni solo gli ultimi 10)
              if (data.ultimo_errore) {
                errori_recenti.push(data.ultimo_errore);
                if (errori_recenti.length > 10) {
                  errori_recenti.shift(); // Rimuovi il più vecchio
                }
              }
              return {
                current: data.current || 0,
                total: data.total || 0,
                progress: data.progress || 0,
                importate_emesse: data.importate_emesse || 0,
                importate_amministrazione: data.importate_amministrazione || 0,
                errate: data.errate || 0,
                duplicate_emesse: data.duplicate_emesse || 0,
                duplicate_amministrazione: data.duplicate_amministrazione || 0,
                current_file: data.current_file || '',
                errori_recenti: errori_recenti
              };
            });
          }
        },
        // onComplete
        (result) => {
          setImportXMLResult(result);
          setImportingXML(false);
          
          // Se ci sono errori ma anche successi, mostra comunque il risultato
          if (result.success || (result.importate_emesse > 0 || result.importate_amministrazione > 0)) {
            fetchFattureData({ force: true }); // Ricarica le fatture dopo l'import
          }
          
          // Reset dell'input file dopo l'import
          const fileInput = document.getElementById('import-xml-file-input');
          if (fileInput) {
            fileInput.value = '';
          }
        },
        // onError
        (error) => {

          setImportXMLResult({
            success: false,
            error: error || 'Errore durante l\'importazione'
          });
          setImportingXML(false);
        }
      );
    } catch (error) {

      setImportXMLResult({
        success: false,
        error: error.message || 'Errore durante l\'importazione'
      });
      setImportingXML(false);
    }
  };

  // Espone metodi pubblici tramite ref
  useImperativeHandle(ref, () => ({
    openFattura: async (fatturaId) => {
      try {
        // Carica la fattura completa
        const fattura = await amministrazioneService.getFattura(fatturaId);
        if (fattura) {
          handleShowModal(fattura, false);
        }
      } catch (error) {
        console.error('Errore nel caricamento fattura:', error);
        alert('Impossibile aprire la fattura');
      }
    }
  }));

  const isAnyModalOpen = showModal || showImportModal || showImportXMLModal || showAssociaPartiteModal;

  return (
    <div className={`gestione-fatture ${isAnyModalOpen ? 'modal-open' : ''}`}>
      {/* Pulsanti azioni */}
      <div className="filters-actions">
        <button className="btn btn-primary" onClick={() => handleShowModal(null, true)} disabled={!canOperate}>
          Nuova Fattura
        </button>
        <div className="import-export-dropdown">
          <button 
            className="btn btn-secondary" 
            onClick={() => setShowImportExportMenu(!showImportExportMenu)}
            disabled={!canOperate || exporting}
          >
            Importa/Esporta
          </button>
          {showImportExportMenu && (
            <div className="import-export-menu">
              <button
                className="import-export-menu-item"
                onClick={() => {
                  setShowImportXMLModal(true);
                  setShowImportExportMenu(false);
                }}
                disabled={!canOperate}
              >
                Importa XML
              </button>
              <button
                className="import-export-menu-item"
                onClick={() => {
                  handleExport('csv');
                  setShowImportExportMenu(false);
                }}
                disabled={!filteredFatture.length || exporting}
              >
                {exporting ? 'Esportazione...' : 'Esporta CSV'}
              </button>
              <button
                className="import-export-menu-item"
                onClick={() => {
                  handleExport('xlsx');
                  setShowImportExportMenu(false);
                }}
                disabled={!filteredFatture.length || exporting}
              >
                {exporting ? 'Esportazione...' : 'Esporta XLSX'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Barra filtri */}
      <div className="filters-bar">
        <div className="filters-row">
          <div className="filter-group filter-group-small">
            <label>Tipo</label>
            <SmartSelect
              options={[
                { value: 'tutti', label: 'Tutte' },
                { value: 'ricevuta', label: 'Ricevute' },
                { value: 'emessa', label: 'Emesse' }
              ]}
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value)}
              displayField="label"
              valueField="value"
              allowEmpty={false}
            />
          </div>
          
          <div className="filter-group search">
            <label>Fornitore/Cliente</label>
            <SmartSelect
              options={fornitori.map(f => ({ value: String(f.id), label: f.nome }))}
              value={filterFornitore}
              onChange={(e) => setFilterFornitore(e.target.value || '')}
              displayField="label"
              valueField="value"
              placeholder="Tutti"
              allowEmpty={true}
            />
          </div>
          
          <div className="filter-group filter-group-small">
            <label>Data da</label>
            <input
              type="date"
              value={filterDataDa}
              onChange={(e) => setFilterDataDa(e.target.value)}
            />
          </div>
          
          <div className="filter-group filter-group-small">
            <label>Data a</label>
            <input
              type="date"
              value={filterDataA}
              onChange={(e) => setFilterDataA(e.target.value)}
            />
          </div>
          
          <div className="filter-group filter-group-small">
            <label>Numero</label>
            <input
              type="text"
              value={filterNumero}
              onChange={(e) => setFilterNumero(e.target.value)}
              placeholder="Cerca numero..."
            />
          </div>
          
          <div className="filter-group filter-group-small">
            <label>Importo da</label>
            <input
              type="number"
              step="0.01"
              value={filterImportoDa}
              onChange={(e) => setFilterImportoDa(e.target.value)}
              placeholder="0.00"
            />
          </div>
          
          <div className="filter-group filter-group-small">
            <label>Importo a</label>
            <input
              type="number"
              step="0.01"
              value={filterImportoA}
              onChange={(e) => setFilterImportoA(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>
      </div>
      
      {/* Wrapper tabella con altezza limitata */}
      <div className="table-wrapper">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tipo</th>
                <th>Numero</th>
                <th>Data</th>
                <th>Fornitore/Cliente</th>
                <th>Totale</th>
                <th>Stato</th>
                <th>Scadenza</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Paginazione: mostra solo le fatture filtrate della pagina corrente
                const startIndex = (currentPage - 1) * FATTURE_PER_PAGINA;
                const endIndex = startIndex + FATTURE_PER_PAGINA;
                const paginatedFatture = filteredFatture.slice(startIndex, endIndex);
                
                if (filteredFatture.length === 0) {
                  return (
                    <tr><td colSpan="7" className="empty-state">Nessuna fattura trovata</td></tr>
                  );
                }
                
                return paginatedFatture.map(f => {
                  const isEmessa = f.sourceType === 'emessa';
                  return (
                    <tr key={`${f.sourceType}-${f.id}`} className="table-row-clickable" onClick={() => handleShowModal(f, false)}>
                      <td>
                        <span className={`fattura-type-badge fattura-type-${isEmessa ? 'entrata' : 'uscita'}`}>
                          {isEmessa ? 'Emessa' : 'Ricevuta'}
                        </span>
                      </td>
                      <td>{f.numero}</td>
                      <td>{formatDate(f.data_fattura)}</td>
                      <td>{isEmessa ? getClienteName(f) : getFornitoreName(f.fornitore_id)}</td>
                      <td>{formatCurrency(f.importo_totale)}</td>
                      <td>
                        <span>
                          {getStatoLabel(f.stato_pagamento)}
                        </span>
                      </td>
                      <td>{formatDate(f.data_scadenza)}</td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Sezione paginazione fissa in basso */}
      {filteredFatture.length > FATTURE_PER_PAGINA && (() => {
        const totalPages = Math.ceil(filteredFatture.length / FATTURE_PER_PAGINA);
        return (
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
                        return <span key={`placeholder-${idx}`} className="pagination-btn" style={{ visibility: 'hidden' }}>1</span>;
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
        );
      })()}
      
      {showModal && renderModalContent()}

      {/* Modal Import XML */}
      {showImportXMLModal && (
        <div className="modal-overlay" onClick={() => { if (!importingXML) {
          setShowImportXMLModal(false); 
          setImportXMLResult(null);
          const fileInput = document.getElementById('import-xml-file-input');
          if (fileInput) {
            fileInput.value = '';
          }
        }}}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Importa Fatture da XML/ZIP FatturaPA</h3>
              <button 
                className="close-button" 
                onClick={() => { 
                  setShowImportXMLModal(false); 
                  setImportXMLResult(null);
                  const fileInput = document.getElementById('import-xml-file-input');
                  if (fileInput) {
                    fileInput.value = '';
                  }
                }}
                disabled={importingXML}
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div>
                <p><strong>Carica una cartella compressa (ZIP) o un file XML FatturaPA</strong></p>
                <p>
                  Puoi caricare:
                </p>
                <ul>
                  <li>Un file <strong>ZIP</strong> contenente uno o più file XML FatturaPA (come scaricati dai gestionali)</li>
                  <li>Un singolo file <strong>XML</strong> FatturaPA</li>
                </ul>
                <p>
                  Il sistema decomprimerà automaticamente l'archivio e importerà tutti i file XML trovati,
                  anche se presenti in sottocartelle. Determina automaticamente se le fatture sono emesse
                  o ricevute confrontando i dati anagrafici (P.IVA/Codice Fiscale) con le aziende registrate.
                  Le fatture verranno assegnate automaticamente all'azienda corrispondente trovata nel sistema.
                </p>
              </div>

              {importingXML ? (
                <div>
                  <p>Importazione in corso...</p>
                  
                  {importProgress.total > 0 && (
                    <div>
                      <div>
                        <span>File: {importProgress.current} / {importProgress.total}</span>
                        <span>{Math.round(importProgress.progress)}%</span>
                      </div>
                      <div>
                        <div>
                          {importProgress.progress > 10 && `${Math.round(importProgress.progress)}%`}
                        </div>
                      </div>
                      {importProgress.current_file && (
                        <p>
                          File corrente: <strong>{importProgress.current_file}</strong>
                        </p>
                      )}
                    </div>
                  )}
                  
                  <div>
                    <div>
                      {importProgress.importate_emesse > 0 && (
                        <div>✓ Fatture emesse: <strong>{importProgress.importate_emesse}</strong></div>
                      )}
                      {importProgress.importate_amministrazione > 0 && (
                        <div>✓ Fatture ricevute: <strong>{importProgress.importate_amministrazione}</strong></div>
                      )}
                      {importProgress.errate > 0 && (
                        <div>
                          ✗ Errori: <strong>{importProgress.errate}</strong>
                        </div>
                      )}
                      {importProgress.duplicate_emesse > 0 && (
                        <div>
                          ⊘ Duplicate emesse: <strong>{importProgress.duplicate_emesse}</strong>
                        </div>
                      )}
                      {importProgress.duplicate_amministrazione > 0 && (
                        <div>
                          ⊘ Duplicate ricevute: <strong>{importProgress.duplicate_amministrazione}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Mostra errori recenti durante l'import */}
                  {importProgress.errori_recenti.length > 0 && (
                    <div>
                      <div>
                        Ultimi errori ({importProgress.errori_recenti.length}):
                      </div>
                      <ul>
                        {importProgress.errori_recenti.slice(-5).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {importProgress.errori_recenti.length > 5 && (
                          <li>
                            ... e altri {importProgress.errori_recenti.length - 5} errori
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label>
                    Seleziona file:
                  </label>
                  <input
                    type="file"
                    accept=".zip,.ZIP,.xml,.XML"
                    onChange={handleXMLFileChange}
                    id="import-xml-file-input"
                  />
                  <p>
                    Formati supportati: ZIP (.zip), XML FatturaPA (.xml) - Dimensione massima: 100MB
                  </p>
                </div>
              )}

              {importXMLResult && (
                <div>
                  {importXMLResult.success ? (
                    <div>
                      <p><strong>Importazione completata!</strong></p>
                      {importXMLResult.importate_emesse > 0 && (
                        <p>Fatture emesse importate: {importXMLResult.importate_emesse}</p>
                      )}
                      {importXMLResult.importate_amministrazione > 0 && (
                        <p>Fatture ricevute importate: {importXMLResult.importate_amministrazione}</p>
                      )}
                      {importXMLResult.errate > 0 && (
                        <p>Fatture con errori: {importXMLResult.errate}</p>
                      )}
                      {importXMLResult.duplicate_emesse > 0 && (
                        <p>Fatture emesse duplicate saltate: {importXMLResult.duplicate_emesse}</p>
                      )}
                      {importXMLResult.duplicate_amministrazione > 0 && (
                        <p>Fatture ricevute duplicate saltate: {importXMLResult.duplicate_amministrazione}</p>
                      )}
                      {importXMLResult.errori && importXMLResult.errori.length > 0 && (
                        <div>
                          <strong>Errori:</strong>
                          <ul>
                            {importXMLResult.errori.slice(0, 10).map((err, idx) => (
                              <li key={idx}>{err}</li>
                            ))}
                            {importXMLResult.errori.length > 10 && (
                              <li>... e altri {importXMLResult.errori.length - 10} errori</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p><strong>Errore durante l'importazione:</strong></p>
                      <p>{importXMLResult.error || 'Errore sconosciuto'}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => { 
                  setShowImportXMLModal(false); 
                  setImportXMLResult(null); 
                }}
                disabled={importingXML}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal per associare partite alla fattura */}
      {showAssociaPartiteModal && selectedFattura && (
        <AssociaPartiteFatturaModal
          fattura={selectedFattura}
          aziendaId={azienda?.id}
          onClose={() => setShowAssociaPartiteModal(false)}
          onSuccess={() => {
            // Ricarica i dettagli della fattura per vedere le partite associate
            if (selectedFattura) {
              const isEmessa = selectedFattura.tipo === 'entrata' || selectedFattura.sourceType === 'emessa' || selectedFattura.isEmessa;
              loadFatturaDetails(selectedFattura.id, isEmessa);
            }
          }}
        />
      )}
    </div>
  );
});

// Mapping codici tipo documento FatturaPA (stesso di GestionePrimaNota)
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

function getTipoDocumentoLabel(codice) {
  if (!codice) return null;
  return TIPO_DOCUMENTO_MAP[codice] || codice;
}

function getDocumentoTipoBadgeClass(tipoDocumento, tipoFattura) {
  if (!tipoDocumento) {
    // Fallback al tipo fattura se non c'è tipo_documento
    return tipoFattura === 'entrata' ? 'fattura-type-badge fattura-type-entrata' : 'fattura-type-badge fattura-type-uscita';
  }
  
  const codice = String(tipoDocumento).toUpperCase();
  if (codice === 'TD04') return 'fattura-type-badge badge-nota-credito';
  if (codice === 'TD05') return 'fattura-type-badge badge-nota-debito';
  if (codice === 'TD02' || codice === 'TD03') return 'fattura-type-badge badge-acconto';
  if (codice === 'TD06') return 'fattura-type-badge badge-parcella';
  if (codice === 'TD20' || codice === 'TD21') return 'fattura-type-badge badge-autofattura';
  
  // Default per fatture
  return tipoFattura === 'entrata' ? 'fattura-type-badge fattura-type-entrata' : 'fattura-type-badge fattura-type-uscita';
}

function getDocumentoTipoLabel(tipoDocumento, tipoFattura) {
  if (!tipoDocumento) {
    return tipoFattura === 'entrata' ? 'Fattura Emessa' : 'Fattura Ricevuta';
  }
  
  const codice = String(tipoDocumento).toUpperCase();
  const label = getTipoDocumentoLabel(codice);
  return label || codice;
}

// Funzione per ottenere la classe CSS del badge macrocategoria
function getMacrocategoriaBadgeClass(macrocategoria) {
  if (!macrocategoria || macrocategoria === 'nessuna') {
    return 'badge-macrocategoria badge-macrocategoria-none';
  }
  return `badge-macrocategoria badge-macrocategoria-${macrocategoria}`;
}

// Funzione per ottenere il label della macrocategoria
function getMacrocategoriaLabel(macrocategoria) {
  if (!macrocategoria || macrocategoria === 'nessuna') {
    return 'Nessuna';
  }
  return MACROCATEGORIE_OPTIONS.find(m => m.value === macrocategoria)?.label || macrocategoria;
}

// Funzione per ottenere il label della categoria
function getCategoriaLabel(categoria, categorie) {
  if (!categoria) {
    return 'Nessuna';
  }
  const categoriaObj = categorie.find(c => c.value === categoria);
  return categoriaObj?.label || categoria;
}

// Mapping codici modalità pagamento FatturaPA
const MODALITA_PAGAMENTO_MAP = {
  MP01: 'Contanti',
  MP02: 'Assegno',
  MP03: 'Assegno circolare',
  MP04: 'Contanti presso Tesoreria',
  MP05: 'Bonifico bancario',
  MP06: 'Vaglia cambiario',
  MP07: 'Bollettino bancario o postale',
  MP08: 'Carta di pagamento',
  MP09: 'RID',
  MP10: 'RID utenze',
  MP11: 'RID veloce',
  MP12: 'RIBA',
  MP13: 'MAV',
  MP14: 'Quietanza erario',
  MP15: 'Giroconto su conti di contabilità speciale',
  MP16: 'Domiciliazione bancaria',
  MP17: 'Domiciliazione su conto presso PSP',
  MP18: 'Bollettino CBILL',
  MP19: 'Avviso pagoPA',
  MP20: 'PagoPA',
  MP21: 'PagoPA (carta di credito/debito)',
  MP22: 'PagoPA (conto corrente)',
  MP23: 'PagoPA (altri strumenti)',
  MP24: 'SEPA Direct Debit',
  MP25: 'Factoring',
  MP26: 'Girofondo',
};

function getModalitaPagamentoLabel(codice) {
  if (!codice) return 'Modalità non specificata';
  return MODALITA_PAGAMENTO_MAP[codice] || `Modalità ${codice}`;
}

// Componente per visualizzare le partite associate alla fattura
const PartiteAssociateSection = ({ fattura, aziendaId, onAssociaClick, onRefresh }) => {
  const [partiteAssociate, setPartiteAssociate] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null);

  const isFatturaEmessa = fattura?.tipo === 'entrata' || fattura?.sourceType === 'emessa' || fattura?.isEmessa;

  const formatDate = (value) => {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch {
      return value;
    }
  };

  const formatCurrency = (value) => {
    if (!value) return '€0.00';
    try {
      return `€${parseFloat(value).toFixed(2)}`;
    } catch {
      return `€${value}`;
    }
  };

  const getTipoMovimentoLabel = (tipo) => {
    const labels = {
      'acconto': 'Acconto',
      'saldo': 'Saldo',
      'mortalita': 'Mortalità',
      'altro': 'Altro'
    };
    return labels[tipo] || tipo;
  };

  const loadPartiteAssociate = async () => {
    if (!fattura?.id || !aziendaId) return;
    
    setLoading(true);
    try {
      // Carica tutte le partite (ingresso e uscita) con i loro movimenti finanziari
      const [partiteIngresso, partiteUscita] = await Promise.all([
        amministrazioneService.getPartite({ azienda_id: aziendaId, tipo: 'ingresso', limit: 1000 }),
        amministrazioneService.getPartite({ azienda_id: aziendaId, tipo: 'uscita', limit: 1000 })
      ]);

      const allPartite = [...(Array.isArray(partiteIngresso) ? partiteIngresso : []), 
                          ...(Array.isArray(partiteUscita) ? partiteUscita : [])];

      // Filtra le partite che hanno movimenti finanziari che referenziano questa fattura
      const associate = [];
      for (const partita of allPartite) {
        if (partita.movimenti_finanziari && Array.isArray(partita.movimenti_finanziari)) {
          for (const movimento of partita.movimenti_finanziari) {
            if (movimento.attivo !== false) {
              if (isFatturaEmessa && movimento.fattura_emessa_id === fattura.id) {
                associate.push({ partita, movimento });
                break;
              } else if (!isFatturaEmessa && movimento.fattura_amministrazione_id === fattura.id) {
                associate.push({ partita, movimento });
                break;
              }
            }
          }
        }
      }

      setPartiteAssociate(associate);
    } catch (error) {
      console.error('Errore nel caricamento delle partite associate:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPartiteAssociate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fattura?.id, aziendaId, isFatturaEmessa]);

  const handleRemove = async (movimentoId) => {
    if (!window.confirm('Rimuovere l\'associazione di questa partita dalla fattura?')) {
      return;
    }

    setRemoving(movimentoId);
    try {
      await amministrazioneService.deletePartitaMovimentoFinanziario(movimentoId);
      await loadPartiteAssociate();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Errore nella rimozione:', error);
      alert('Errore nella rimozione dell\'associazione: ' + (error.message || 'Errore sconosciuto'));
    } finally {
      setRemoving(null);
    }
  };

  const getPartitaLabel = (partita) => {
    const tipoLabel = partita.tipo === 'ingresso' ? 'Ingresso' : 'Uscita';
    return `${partita.numero_partita || `Partita #${partita.id}`} (${tipoLabel})`;
  };

  return (
    <div className="form-group" style={{ gridColumn: 'span 2' }}>
      <label style={{ marginBottom: '8px', display: 'block' }}>
        Partite Associate
      </label>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px' }}>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={onAssociaClick}
        >
          Associa Partite
        </button>
        <span className="color-muted font-size-small">
          Collega partite di ingresso/uscite per associare animali a questa fattura
        </span>
      </div>

      {loading ? (
        <div className="color-muted">Caricamento partite associate...</div>
      ) : partiteAssociate.length === 0 ? (
        <div className="color-muted" style={{ padding: '12px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
          Nessuna partita associata
        </div>
      ) : (
        <div style={{ border: '1px solid #ddd', borderRadius: '4px', padding: '12px', backgroundColor: '#fafafa' }}>
          <div style={{ display: 'grid', gap: '12px' }}>
            {partiteAssociate.map(({ partita, movimento }) => (
              <div key={partita.id} style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'flex-start',
                padding: '8px',
                backgroundColor: 'white',
                borderRadius: '4px',
                border: '1px solid #e0e0e0'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                    {getPartitaLabel(partita)}
                  </div>
                  <div style={{ fontSize: '13px', color: '#666', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '8px' }}>
                    <span><strong>Data:</strong> {formatDate(partita.data)}</span>
                    {partita.tipo === 'ingresso' ? (
                      <span><strong>Provenienza:</strong> {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                    ) : (
                      <span><strong>Destinazione:</strong> {partita.codice_stalla} {partita.nome_stalla ? `(${partita.nome_stalla})` : ''}</span>
                    )}
                    <span><strong>Capi:</strong> {partita.numero_capi}</span>
                    {partita.peso_totale && <span><strong>Peso:</strong> {parseFloat(partita.peso_totale).toFixed(2)} kg</span>}
                    {partita.contratto_soccida_id && <span><strong>Contratto:</strong> #{partita.contratto_soccida_id}</span>}
                    <span><strong>Movimento:</strong> {getTipoMovimentoLabel(movimento.tipo)}</span>
                    <span><strong>Importo:</strong> {formatCurrency(movimento.importo)}</span>
                    <span><strong>Data Movimento:</strong> {formatDate(movimento.data)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => handleRemove(movimento.id)}
                  disabled={removing === movimento.id}
                  style={{ marginLeft: '12px' }}
                >
                  {removing === movimento.id ? 'Rimozione...' : 'Rimuovi'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

GestioneFatture.displayName = 'GestioneFatture';

export default GestioneFatture;
