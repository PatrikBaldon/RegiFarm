/**
 * GestioneDDT - Gestione Documenti di Trasporto (DDT) emessi
 */
import React, { useState, useEffect, useMemo, useCallback, useDeferredValue } from 'react';
import { ddtService } from '../services/ddtService';
import { amministrazioneService } from '../services/amministrazioneService';
import api from '../../../services/api';
import SmartSelect from '../../../components/SmartSelect';
import BaseModal from '../../../components/BaseModal';
import './GestioneDDT.css';
import { useAzienda } from '../../../context/AziendaContext';

const DDT_PER_PAGINA = 10;

const GestioneDDT = () => {
  const { azienda } = useAzienda();
  const [ddtList, setDdtList] = useState([]);
  const [clienti, setClienti] = useState([]);
  const [rows, setRows] = useState([]);
  const [filterText, setFilterText] = useState('');
  const deferredFilterText = useDeferredValue(filterText);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showDdtModal, setShowDdtModal] = useState(false);
  const [ddtModalData, setDdtModalData] = useState(null);
  const [ddtModalLoading, setDdtModalLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRow, setSelectedRow] = useState(null);
  const [activeTab, setActiveTab] = useState('header'); // 'header', 'trasporto', 'articoli', 'annotazioni'
  const [ddtForm, setDdtForm] = useState({
    data: new Date().toISOString().split('T')[0],
    cliente_id: null,
    destinatario_nome: '',
    destinatario_indirizzo: '',
    destinatario_cap: '',
    destinatario_comune: '',
    destinatario_provincia: '',
    destinatario_nazione: 'IT',
    destinatario_piva: '',
    destinatario_cf: '',
    luogo_destinazione: '',
    causale_trasporto: '',
    aspetto_beni: '',
    numero_colli: '',
    peso_lordo: '',
    peso_netto: '',
    data_inizio_trasporto: '',
    trasporto_a_mezzo: '',
    vettore: '',
    vettore_ragione_sociale: '',
    vettore_sede_legale: '',
    vettore_partita_iva: '',
    vettore_licenza: '',
    vettore_targhe: '',
    vettore_autista: '',
    data_ritiro: '',
    articoli: [],
    annotazioni: '',
  });

  // Fetch clienti (fornitori con is_cliente = true)
  const fetchClienti = useCallback(async () => {
    try {
      const fornitori = await amministrazioneService.getFornitori({ skip: 0, limit: 10000 });
      const clientiList = Array.isArray(fornitori) 
        ? fornitori.filter(f => f.is_cliente === true)
        : [];
      setClienti(clientiList);
    } catch (error) {
      console.error('Errore nel caricamento clienti:', error);
      setClienti([]);
    }
  }, []);

  // Fetch DDT list
  const fetchDDTData = useCallback(async ({ force = false } = {}) => {
    if (!azienda?.id) return;

    setLoading(true);
    try {
      const data = await ddtService.getDDT({
        azienda_id: azienda.id,
        skip: 0,
        limit: 1000,
      });
      const ddtArray = Array.isArray(data) ? data : [];
      setDdtList(ddtArray);
      buildRows(ddtArray);
    } catch (error) {
      console.error('Errore nel caricamento DDT:', error);
      setDdtList([]);
      buildRows([]);
    } finally {
      setLoading(false);
    }
  }, [azienda?.id]);

  useEffect(() => {
    fetchClienti();
  }, [fetchClienti]);

  useEffect(() => {
    fetchDDTData();
  }, [fetchDDTData]);

  // Reset alla prima pagina quando cambia il filtro
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1);
    }
  }, [filterText]);

  const buildRows = useCallback((ddtData) => {
    const combined = ddtData.map((ddt) => {
      const searchable = [
        ddt.numero,
        ddt.destinatario_nome,
        ddt.destinatario_indirizzo,
        ddt.destinatario_comune,
        ddt.causale_trasporto,
        ddt.luogo_destinazione,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return {
        ...ddt,
        searchIndex: searchable,
      };
    })
    .sort((a, b) => {
      // Ordina per data decrescente, poi per numero decrescente
      const dateA = new Date(a.data);
      const dateB = new Date(b.data);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
      return (b.numero_progressivo || 0) - (a.numero_progressivo || 0);
    });
    setRows(combined);
  }, []);

  const openDdtModal = async (row = null) => {
    setShowDdtModal(true);
    setDdtModalLoading(true);
    setIsEditing(false);
    setDdtModalData(null);
    setSelectedRow(row);
    setActiveTab('header');
    
    // Reset form to default values
    setDdtForm({
      data: new Date().toISOString().split('T')[0],
      numero_progressivo: null,
      anno: new Date().getFullYear(),
      cliente_id: null,
      destinatario_nome: '',
      destinatario_indirizzo: '',
      destinatario_cap: '',
      destinatario_comune: '',
      destinatario_provincia: '',
      destinatario_nazione: 'IT',
      destinatario_piva: '',
      destinatario_cf: '',
      luogo_destinazione: '',
      causale_trasporto: '',
      aspetto_beni: '',
      numero_colli: '',
      peso_lordo: '',
      peso_netto: '',
      data_inizio_trasporto: '',
      trasporto_a_mezzo: '',
      vettore: '',
      vettore_ragione_sociale: '',
      vettore_sede_legale: '',
      vettore_partita_iva: '',
      vettore_licenza: '',
      vettore_targhe: '',
      vettore_autista: '',
      data_ritiro: '',
      articoli: [],
      annotazioni: '',
    });
    
    if (row) {
      // Carica dati completi del DDT
      try {
        console.log('Fetching DDT with ID:', row.id);
        const response = await ddtService.getDDTById(row.id);
        console.log('Raw response from API:', response);
        console.log('Response type:', typeof response);
        console.log('Response is array:', Array.isArray(response));
        console.log('Response keys:', response && typeof response === 'object' ? Object.keys(response) : 'N/A');
        
        // Gestisci la risposta
        // NOTA: response potrebbe essere l'oggetto DDT direttamente, oppure potrebbe essere wrappato in {data: ...}
        // Ma se response ha una proprietà 'data' che è una stringa (la data del DDT), non usarla come wrapper
        let ddtData;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          // Se response ha una proprietà 'id', è probabilmente l'oggetto DDT stesso
          // Se response.data esiste ed è un oggetto (non una stringa/numero), usalo come wrapper
          if (response.id !== undefined || (response.data !== undefined && typeof response.data === 'object' && !Array.isArray(response.data) && response.data.id !== undefined)) {
            // response è già l'oggetto DDT o response.data contiene l'oggetto DDT
            ddtData = (response.id !== undefined) ? response : response.data;
          } else {
            // response è l'oggetto DDT stesso (ha proprietà come 'data', 'numero', etc.)
            ddtData = response;
          }
          console.log('Extracted ddtData:', ddtData);
        } else {
          // Se response non è un oggetto valido, crea un oggetto vuoto
          console.warn('Response is not a valid object, creating empty object');
          ddtData = {};
        }
        
        // Assicurati che ddtData sia un oggetto
        if (typeof ddtData !== 'object' || Array.isArray(ddtData) || ddtData === null) {
          console.warn('ddtData is not a valid object, resetting to empty object');
          ddtData = {};
        }
        
        console.log('DDT Data loaded:', ddtData);
        console.log('DDT ID from row:', row.id);
        console.log('DDT ID from data:', ddtData.id);
        console.log('DDT Data keys:', Object.keys(ddtData));
        console.log('DDT Data sample:', {
          data: ddtData.data,
          destinatario_nome: ddtData.destinatario_nome,
          numero_progressivo: ddtData.numero_progressivo,
          anno: ddtData.anno
        });
        
        // Assicurati che l'ID sia presente
        if (!ddtData.id && row.id) {
          ddtData.id = row.id;
        }
        
        setDdtModalData(ddtData);
        
        // Helper per convertire date
        const formatDate = (dateValue) => {
          if (!dateValue) return '';
          if (typeof dateValue === 'string') {
            return dateValue.split('T')[0];
          }
          try {
            return new Date(dateValue).toISOString().split('T')[0];
          } catch (e) {
            return '';
          }
        };
        
        // Helper per convertire datetime
        const formatDateTime = (dateValue) => {
          if (!dateValue) return '';
          if (typeof dateValue === 'string') {
            return dateValue.slice(0, 16);
          }
          try {
            return new Date(dateValue).toISOString().slice(0, 16);
          } catch (e) {
            return '';
          }
        };
        
        // Popola il form con i dati caricati
        const formData = {
          data: formatDate(ddtData.data) || new Date().toISOString().split('T')[0],
          numero_progressivo: ddtData.numero_progressivo ?? null,
          anno: ddtData.anno ?? new Date().getFullYear(),
          cliente_id: ddtData.cliente_id ?? null,
          destinatario_nome: ddtData.destinatario_nome || '',
          destinatario_indirizzo: ddtData.destinatario_indirizzo || '',
          destinatario_cap: ddtData.destinatario_cap || '',
          destinatario_comune: ddtData.destinatario_comune || '',
          destinatario_provincia: ddtData.destinatario_provincia || '',
          destinatario_nazione: ddtData.destinatario_nazione || 'IT',
          destinatario_piva: ddtData.destinatario_piva || '',
          destinatario_cf: ddtData.destinatario_cf || '',
          luogo_destinazione: ddtData.luogo_destinazione || '',
          causale_trasporto: ddtData.causale_trasporto || '',
          aspetto_beni: ddtData.aspetto_beni || '',
          numero_colli: ddtData.numero_colli ?? '',
          peso_lordo: ddtData.peso_lordo ?? '',
          peso_netto: ddtData.peso_netto ?? '',
          data_inizio_trasporto: formatDateTime(ddtData.data_inizio_trasporto),
          trasporto_a_mezzo: ddtData.trasporto_a_mezzo || '',
          vettore: ddtData.vettore || ddtData.vettore_ragione_sociale || '',
          vettore_ragione_sociale: ddtData.vettore_ragione_sociale || ddtData.vettore || '',
          vettore_sede_legale: ddtData.vettore_sede_legale || '',
          vettore_partita_iva: ddtData.vettore_partita_iva || '',
          vettore_licenza: ddtData.vettore_licenza || '',
          vettore_targhe: ddtData.vettore_targhe || '',
          vettore_autista: ddtData.vettore_autista || '',
          data_ritiro: formatDate(ddtData.data_ritiro),
          articoli: Array.isArray(ddtData.articoli) ? ddtData.articoli : [],
          annotazioni: ddtData.annotazioni || '',
        };
        
        console.log('Form data to set:', formData);
        setDdtForm(formData);
      } catch (error) {
        console.error('Errore nel caricamento DDT:', error);
        alert(`Errore nel caricamento del DDT: ${error.message || 'Errore sconosciuto'}`);
        setShowDdtModal(false);
        setDdtModalLoading(false);
        return;
      }
    } else {
      // Nuovo DDT - carica prossimo numero
      try {
        const nextNumber = await ddtService.getNextDDTNumber(azienda.id);
        const nextNumData = nextNumber.data || nextNumber;
        
        setDdtForm({
          data: new Date().toISOString().split('T')[0],
          numero_progressivo: nextNumData.numero_progressivo || null,
          anno: nextNumData.anno || new Date().getFullYear(),
          cliente_id: null,
          destinatario_nome: '',
          destinatario_indirizzo: '',
          destinatario_cap: '',
          destinatario_comune: '',
          destinatario_provincia: '',
          destinatario_nazione: 'IT',
          destinatario_piva: '',
          destinatario_cf: '',
          luogo_destinazione: '',
          causale_trasporto: '',
          aspetto_beni: '',
          numero_colli: '',
          peso_lordo: '',
          peso_netto: '',
          data_inizio_trasporto: '',
          trasporto_a_mezzo: '',
          vettore: '',
          vettore_ragione_sociale: '',
          vettore_sede_legale: '',
          vettore_partita_iva: '',
          vettore_licenza: '',
          vettore_targhe: '',
          vettore_autista: '',
          data_ritiro: '',
          articoli: [],
          annotazioni: '',
        });
      } catch (error) {
        console.error('Errore nel caricamento numero DDT:', error);
        // In caso di errore, usa valori di default
        setDdtForm({
          data: new Date().toISOString().split('T')[0],
          numero_progressivo: null,
          anno: new Date().getFullYear(),
          cliente_id: null,
          destinatario_nome: '',
          destinatario_indirizzo: '',
          destinatario_cap: '',
          destinatario_comune: '',
          destinatario_provincia: '',
          destinatario_nazione: 'IT',
          destinatario_piva: '',
          destinatario_cf: '',
          luogo_destinazione: '',
          causale_trasporto: '',
          aspetto_beni: '',
          numero_colli: '',
          peso_lordo: '',
          peso_netto: '',
          data_inizio_trasporto: '',
          trasporto_a_mezzo: '',
          vettore: '',
          vettore_ragione_sociale: '',
          vettore_sede_legale: '',
          vettore_partita_iva: '',
          vettore_licenza: '',
          vettore_targhe: '',
          vettore_autista: '',
          data_ritiro: '',
          articoli: [],
          annotazioni: '',
        });
      }
      setIsEditing(true);
    }
    setDdtModalLoading(false);
  };

  const handleStartEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    if (!ddtModalData) {
      setShowDdtModal(false);
      setDdtModalData(null);
      setIsEditing(false);
      setSelectedRow(null);
      return;
    }
    
    // Ripristina dati originali
    setDdtForm({
      data: ddtModalData.data ? (typeof ddtModalData.data === 'string' ? ddtModalData.data.split('T')[0] : new Date(ddtModalData.data).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0],
      numero_progressivo: ddtModalData.numero_progressivo || null,
      anno: ddtModalData.anno || new Date().getFullYear(),
      cliente_id: ddtModalData.cliente_id || null,
      destinatario_nome: ddtModalData.destinatario_nome || '',
      destinatario_indirizzo: ddtModalData.destinatario_indirizzo || '',
      destinatario_cap: ddtModalData.destinatario_cap || '',
      destinatario_comune: ddtModalData.destinatario_comune || '',
      destinatario_provincia: ddtModalData.destinatario_provincia || '',
      destinatario_nazione: ddtModalData.destinatario_nazione || 'IT',
      destinatario_piva: ddtModalData.destinatario_piva || '',
      destinatario_cf: ddtModalData.destinatario_cf || '',
      luogo_destinazione: ddtModalData.luogo_destinazione || '',
      causale_trasporto: ddtModalData.causale_trasporto || '',
      aspetto_beni: ddtModalData.aspetto_beni || '',
      numero_colli: ddtModalData.numero_colli || '',
      peso_lordo: ddtModalData.peso_lordo || '',
      peso_netto: ddtModalData.peso_netto || '',
      data_inizio_trasporto: ddtModalData.data_inizio_trasporto ? (typeof ddtModalData.data_inizio_trasporto === 'string' ? ddtModalData.data_inizio_trasporto.slice(0, 16) : new Date(ddtModalData.data_inizio_trasporto).toISOString().slice(0, 16)) : '',
      trasporto_a_mezzo: ddtModalData.trasporto_a_mezzo || '',
      vettore: ddtModalData.vettore || ddtModalData.vettore_ragione_sociale || '',
      vettore_ragione_sociale: ddtModalData.vettore_ragione_sociale || ddtModalData.vettore || '',
      vettore_sede_legale: ddtModalData.vettore_sede_legale || '',
      vettore_partita_iva: ddtModalData.vettore_partita_iva || '',
      vettore_licenza: ddtModalData.vettore_licenza || '',
      vettore_targhe: ddtModalData.vettore_targhe || '',
      vettore_autista: ddtModalData.vettore_autista || '',
      data_ritiro: ddtModalData.data_ritiro ? (typeof ddtModalData.data_ritiro === 'string' ? ddtModalData.data_ritiro.split('T')[0] : new Date(ddtModalData.data_ritiro).toISOString().split('T')[0]) : '',
      articoli: Array.isArray(ddtModalData.articoli) ? ddtModalData.articoli : [],
      annotazioni: ddtModalData.annotazioni || '',
    });
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!ddtModalData || !confirm(`Eliminare definitivamente il DDT "${ddtModalData.numero}"?`)) return;
    try {
      await ddtService.deleteDDT(ddtModalData.id);
      setShowDdtModal(false);
      setDdtModalData(null);
      await fetchDDTData({ force: true });
    } catch (error) {
      console.error('Errore eliminazione DDT:', error);
      alert('Impossibile eliminare il DDT');
    }
  };

  const handleSaveDDT = async (printAfterSave = false) => {
    if (!azienda?.id) {
      alert('Errore: nessuna azienda selezionata');
      return;
    }

    // Prepara payload
    const payload = {};
    
    // Se è una creazione, includi tutti i campi necessari
    if (!ddtModalData) {
      payload.azienda_id = azienda.id;
      payload.data = ddtForm.data;
      payload.numero_progressivo = ddtForm.numero_progressivo || null;
      payload.anno = ddtForm.anno || new Date().getFullYear();
    } else {
      // Se è un aggiornamento, escludi campi immutabili (numero_progressivo, anno, numero, azienda_id)
      payload.data = ddtForm.data;
    }
    
    payload.cliente_id = ddtForm.cliente_id || null;
    payload.destinatario_indirizzo = ddtForm.destinatario_indirizzo || null;
    payload.destinatario_cap = ddtForm.destinatario_cap || null;
    payload.destinatario_comune = ddtForm.destinatario_comune || null;
    payload.destinatario_provincia = ddtForm.destinatario_provincia || null;
    payload.destinatario_nazione = ddtForm.destinatario_nazione || 'IT';
    payload.destinatario_piva = ddtForm.destinatario_piva || null;
    payload.destinatario_cf = ddtForm.destinatario_cf || null;
    payload.luogo_destinazione = ddtForm.luogo_destinazione || null;
    payload.causale_trasporto = ddtForm.causale_trasporto || null;
    payload.aspetto_beni = ddtForm.aspetto_beni || null;
    payload.numero_colli = ddtForm.numero_colli ? parseInt(ddtForm.numero_colli) : null;
    payload.peso_lordo = ddtForm.peso_lordo ? parseFloat(ddtForm.peso_lordo) : null;
    payload.peso_netto = ddtForm.peso_netto ? parseFloat(ddtForm.peso_netto) : null;
    payload.data_inizio_trasporto = ddtForm.data_inizio_trasporto || null;
    payload.trasporto_a_mezzo = ddtForm.trasporto_a_mezzo || null;
    // Usa vettore_ragione_sociale anche per vettore (per retrocompatibilità)
    payload.vettore = ddtForm.vettore_ragione_sociale || null;
    payload.vettore_ragione_sociale = ddtForm.vettore_ragione_sociale || null;
    payload.vettore_sede_legale = ddtForm.vettore_sede_legale || null;
    payload.vettore_partita_iva = ddtForm.vettore_partita_iva || null;
    payload.vettore_licenza = ddtForm.vettore_licenza || null;
    payload.vettore_targhe = ddtForm.vettore_targhe || null;
    payload.vettore_autista = ddtForm.vettore_autista || null;
    payload.data_ritiro = ddtForm.data_ritiro || null;
    payload.articoli = ddtForm.articoli || [];
    payload.annotazioni = ddtForm.annotazioni || null;

    try {
      let ddtId;
      
      if (ddtModalData && (ddtModalData.id || selectedRow?.id)) {
        // Modifica - usa l'ID da ddtModalData o da selectedRow come fallback
        const ddtIdToUpdate = ddtModalData.id || selectedRow.id;
        console.log('Updating DDT with ID:', ddtIdToUpdate);
        const response = await ddtService.updateDDT(ddtIdToUpdate, payload);
        ddtId = ddtIdToUpdate;
        
        // Gestisci la risposta - potrebbe essere response.data o response stesso
        let updatedData;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          updatedData = response.data || response;
        } else {
          updatedData = {};
        }
        
        // Assicurati che updatedData sia un oggetto
        if (typeof updatedData !== 'object' || Array.isArray(updatedData)) {
          updatedData = {};
        }
        
        // Assicurati che l'ID sia presente nella risposta
        if (!updatedData.id) {
          updatedData.id = ddtIdToUpdate;
        }
        setDdtModalData(updatedData);
      } else {
        // Creazione
        const response = await ddtService.createDDT(payload);
        
        // Gestisci la risposta - potrebbe essere response.data o response stesso
        let createdData;
        if (response && typeof response === 'object' && !Array.isArray(response)) {
          createdData = response.data || response;
        } else {
          createdData = {};
        }
        
        // Assicurati che createdData sia un oggetto
        if (typeof createdData !== 'object' || Array.isArray(createdData)) {
          createdData = {};
        }
        
        ddtId = createdData.id;
        setDdtModalData(createdData);
      }

      setIsEditing(false);
      
      // Trigger sync per salvare nel database locale
      try {
        const { ipcRenderer } = require('electron');
        ipcRenderer.send('sync:trigger');
      } catch (error) {
        console.error('Errore nel trigger sync:', error);
      }
      
      await fetchDDTData({ force: true });

      // Se printAfterSave è true, scarica il PDF
      if (printAfterSave && ddtId) {
        try {
          // Usa il DDT appena salvato per ottenere l'ID corretto
          const finalDdtId = ddtModalData?.id || ddtId;
          const pdfBlob = await ddtService.downloadPDF(finalDdtId);
          if (!pdfBlob) {
            throw new Error('Nessun file ricevuto');
          }
          
          // Converti blob in buffer per Electron
          const arrayBuffer = await pdfBlob.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          
          // Usa Electron IPC per salvare il file con dialog
          const { ipcRenderer } = require('electron');
          const ddtNumero = ddtModalData?.numero || `${ddtForm.numero_progressivo}/${ddtForm.anno}`;
          const defaultFilename = `DDT_${ddtNumero.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
          
          const result = await ipcRenderer.invoke('save-pdf', buffer, defaultFilename);
          
          if (result.success) {
            alert(`PDF salvato con successo!\n\nPercorso: ${result.path}`);
          } else if (result.canceled) {
            // Utente ha annullato, non mostrare errore
          } else {
            throw new Error(result.error || 'Errore nel salvataggio del file');
          }
        } catch (error) {
          console.error('Errore nel download PDF:', error);
          if (error.message !== 'Salvataggio annullato') {
            alert(`DDT salvato ma errore nel download del PDF: ${error.message}`);
          }
        }
      }
    } catch (error) {
      console.error('Errore nel salvataggio DDT:', error);
      alert(`Errore nel salvataggio: ${error.message || 'Errore sconosciuto'}`);
    }
  };

  // Funzione per stampare PDF (senza salvare)
  const handlePrintPDF = async () => {
    if (!ddtModalData || !ddtModalData.id) {
      alert('Errore: DDT non disponibile per la stampa');
      return;
    }

    try {
      const pdfBlob = await ddtService.downloadPDF(ddtModalData.id);
      if (!pdfBlob) {
        throw new Error('Nessun file ricevuto');
      }
      
      // Converti blob in buffer per Electron
      const arrayBuffer = await pdfBlob.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Usa Electron IPC per salvare il file con dialog
      const { ipcRenderer } = require('electron');
      const ddtNumero = ddtModalData.numero || `${ddtModalData.numero_progressivo}/${ddtModalData.anno}`;
      const defaultFilename = `DDT_${ddtNumero.replace(/\//g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      const result = await ipcRenderer.invoke('save-pdf', buffer, defaultFilename);
      
      if (result.success) {
        alert(`PDF salvato con successo!\n\nPercorso: ${result.path}`);
      } else if (result.canceled) {
        // Utente ha annullato, non mostrare errore
      } else {
        throw new Error(result.error || 'Errore nel salvataggio del file');
      }
    } catch (error) {
      console.error('Errore nel download PDF:', error);
      if (error.message !== 'Salvataggio annullato') {
        alert(`Errore nel download del PDF: ${error.message}`);
      }
    }
  };

  // Autocompletamento destinatario quando si seleziona un nome esistente
  const handleDestinatarioNomeChange = (value) => {
    setDdtForm({ ...ddtForm, destinatario_nome: value });
    
    // Se il nome corrisponde a un DDT esistente, popola gli altri campi
    if (value && ddtList.length > 0) {
      const matchingDdt = ddtList.find(d => d.destinatario_nome === value);
      if (matchingDdt) {
        setDdtForm(prev => ({
          ...prev,
          destinatario_nome: value,
          destinatario_indirizzo: matchingDdt.destinatario_indirizzo || prev.destinatario_indirizzo,
          destinatario_cap: matchingDdt.destinatario_cap || prev.destinatario_cap,
          destinatario_comune: matchingDdt.destinatario_comune || prev.destinatario_comune,
          destinatario_provincia: matchingDdt.destinatario_provincia || prev.destinatario_provincia,
          destinatario_nazione: matchingDdt.destinatario_nazione || prev.destinatario_nazione,
          destinatario_piva: matchingDdt.destinatario_piva || prev.destinatario_piva,
          destinatario_cf: matchingDdt.destinatario_cf || prev.destinatario_cf,
        }));
      }
    }
  };

  // Autocompletamento vettore quando si seleziona una ragione sociale esistente
  const handleVettoreRagioneSocialeChange = (value) => {
    setDdtForm({ ...ddtForm, vettore_ragione_sociale: value });
    
    // Se la ragione sociale corrisponde a un DDT esistente, popola gli altri campi
    if (value && ddtList.length > 0) {
      const matchingDdt = ddtList.find(d => d.vettore_ragione_sociale === value);
      if (matchingDdt) {
        setDdtForm(prev => ({
          ...prev,
          vettore_ragione_sociale: value,
          vettore: value, // Usa la ragione sociale anche per il campo vettore (per retrocompatibilità)
          vettore_sede_legale: matchingDdt.vettore_sede_legale || prev.vettore_sede_legale,
          vettore_partita_iva: matchingDdt.vettore_partita_iva || prev.vettore_partita_iva,
          vettore_licenza: matchingDdt.vettore_licenza || prev.vettore_licenza,
          vettore_targhe: matchingDdt.vettore_targhe || prev.vettore_targhe,
          vettore_autista: matchingDdt.vettore_autista || prev.vettore_autista,
        }));
      }
    }
  };

  // Gestione cliente selezionato - popola destinatario
  useEffect(() => {
    if (ddtForm.cliente_id && clienti.length > 0) {
      const cliente = clienti.find(c => c.id === ddtForm.cliente_id);
      if (cliente) {
        setDdtForm(prev => ({
          ...prev,
          destinatario_nome: cliente.nome || prev.destinatario_nome,
          destinatario_indirizzo: cliente.indirizzo || prev.destinatario_indirizzo,
          destinatario_cap: cliente.indirizzo_cap || prev.destinatario_cap,
          destinatario_comune: cliente.indirizzo_comune || prev.destinatario_comune,
          destinatario_provincia: cliente.indirizzo_provincia || prev.destinatario_provincia,
          destinatario_nazione: cliente.indirizzo_nazione || prev.destinatario_nazione || 'IT',
          destinatario_piva: cliente.partita_iva || prev.destinatario_piva,
        }));
      }
    }
  }, [ddtForm.cliente_id, clienti]);

  // Gestione articoli
  const addArticolo = () => {
    setDdtForm(prev => ({
      ...prev,
      articoli: [...prev.articoli, { descrizione: '', unita_misura: 'kg', quantita: 0 }]
    }));
  };

  const removeArticolo = (index) => {
    setDdtForm(prev => ({
      ...prev,
      articoli: prev.articoli.filter((_, i) => i !== index)
    }));
  };

  const updateArticolo = (index, field, value) => {
    setDdtForm(prev => ({
      ...prev,
      articoli: prev.articoli.map((art, i) => 
        i === index ? { ...art, [field]: value } : art
      )
    }));
  };

  const filteredRows = useMemo(() => {
    let filtered = rows;
    
    const term = (deferredFilterText || '').trim().toLowerCase();
    if (term) {
      filtered = filtered.filter((row) => {
        if (!row.searchIndex) return false;
        return row.searchIndex.includes(term);
      });
    }
    
    return filtered;
  }, [rows, deferredFilterText]);
  
  // Paginazione sui risultati filtrati
  const totalPages = Math.ceil(filteredRows.length / DDT_PER_PAGINA);
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * DDT_PER_PAGINA;
    const endIndex = startIndex + DDT_PER_PAGINA;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage]);

  // Render modale content
  const renderModalContent = () => {
    return (
      <BaseModal
        isOpen={showDdtModal}
        onClose={() => {
          if (!isEditing) {
            setShowDdtModal(false);
            setDdtModalData(null);
            setIsEditing(false);
            setSelectedRow(null);
          }
        }}
        title={ddtModalData ? (isEditing ? 'Modifica DDT' : 'Dettagli DDT') : 'Nuovo DDT'}
        identifier={ddtModalData?.numero ? `DDT ${ddtModalData.numero}` : null}
        size="xlarge"
        headerActions={
          <>
            {!isEditing && ddtModalData && (
              <>
                <button className="btn btn-secondary" onClick={handleStartEdit}>
                  Modifica
                </button>
                <button className="btn btn-danger" onClick={handleDelete}>
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
                onClick={handleCancelEdit}
              >
                Annulla
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveDDT(false);
                }}
              >
                Salva
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={(e) => {
                  e.preventDefault();
                  handleSaveDDT(true);
                }}
              >
                Salva e Stampa
              </button>
            </>
          ) : (
            <>
              {ddtModalData && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handlePrintPDF}
                >
                  Stampa
                </button>
              )}
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setShowDdtModal(false);
                  setDdtModalData(null);
                  setIsEditing(false);
                  setSelectedRow(null);
                }}
              >
                Chiudi
              </button>
            </>
          )
        }
      >
        {ddtModalLoading && <div className="loading">Caricamento dettagli...</div>}
        {!ddtModalLoading && (
          <form onSubmit={(e) => { e.preventDefault(); handleSaveDDT(false); }} className="ddt-form">
            {/* Tabs */}
            <div className="ddt-modal-tabs">
              <button
                type="button"
                className={`ddt-tab ${activeTab === 'header' ? 'active' : ''}`}
                onClick={() => setActiveTab('header')}
              >
                Intestazione
              </button>
              <button
                type="button"
                className={`ddt-tab ${activeTab === 'trasporto' ? 'active' : ''}`}
                onClick={() => setActiveTab('trasporto')}
              >
                Trasporto
              </button>
              <button
                type="button"
                className={`ddt-tab ${activeTab === 'articoli' ? 'active' : ''}`}
                onClick={() => setActiveTab('articoli')}
              >
                Articoli
              </button>
              <button
                type="button"
                className={`ddt-tab ${activeTab === 'annotazioni' ? 'active' : ''}`}
                onClick={() => setActiveTab('annotazioni')}
              >
                Annotazioni
              </button>
            </div>

            {/* Tab Content */}
            <div className="ddt-tab-content">
              {activeTab === 'header' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Data *</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={ddtForm.data}
                        onChange={(e) => setDdtForm({ ...ddtForm, data: e.target.value })}
                        required
                      />
                    ) : (
                      <span>{ddtForm.data || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Cliente/Destinatario</label>
                    {isEditing ? (
                      <SmartSelect
                        className="select-compact"
                        options={clienti.map(c => ({ value: c.id, label: c.nome }))}
                        value={ddtForm.cliente_id}
                        onChange={(e) => setDdtForm({ ...ddtForm, cliente_id: e.target.value ? parseInt(e.target.value) : null })}
                        displayField="label"
                        valueField="value"
                        allowEmpty={true}
                      />
                    ) : (
                      <span>{clienti.find(c => c.id === ddtForm.cliente_id)?.nome || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Nome Destinatario</label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={ddtForm.destinatario_nome}
                          onChange={(e) => handleDestinatarioNomeChange(e.target.value)}
                          onBlur={(e) => {
                            // Quando perde il focus, verifica se c'è una corrispondenza esatta
                            if (e.target.value) {
                              handleDestinatarioNomeChange(e.target.value);
                            }
                          }}
                          placeholder="Nome destinatario"
                          list="destinatari-nome-list"
                        />
                        <datalist id="destinatari-nome-list">
                          {Array.from(new Set(ddtList.filter(d => d.destinatario_nome).map(d => d.destinatario_nome))).map((n, i) => (
                            <option key={i} value={n} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span>{ddtForm.destinatario_nome || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Indirizzo</label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={ddtForm.destinatario_indirizzo}
                          onChange={(e) => setDdtForm({ ...ddtForm, destinatario_indirizzo: e.target.value })}
                          placeholder="Indirizzo"
                          list="destinatari-indirizzo-list"
                        />
                        <datalist id="destinatari-indirizzo-list">
                          {Array.from(new Set(ddtList.filter(d => d.destinatario_indirizzo).map(d => d.destinatario_indirizzo))).map((i, idx) => (
                            <option key={idx} value={i} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span>{ddtForm.destinatario_indirizzo || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>CAP</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_cap}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_cap: e.target.value })}
                        placeholder="CAP"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_cap || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Comune</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_comune}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_comune: e.target.value })}
                        placeholder="Comune"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_comune || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Provincia</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_provincia}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_provincia: e.target.value.toUpperCase() })}
                        placeholder="Provincia"
                        maxLength="2"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_provincia || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Nazione</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_nazione}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_nazione: e.target.value.toUpperCase() })}
                        placeholder="Nazione"
                        maxLength="2"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_nazione || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Partita IVA</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_piva}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_piva: e.target.value })}
                        placeholder="Partita IVA"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_piva || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Codice Fiscale</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.destinatario_cf}
                        onChange={(e) => setDdtForm({ ...ddtForm, destinatario_cf: e.target.value })}
                        placeholder="Codice Fiscale"
                      />
                    ) : (
                      <span>{ddtForm.destinatario_cf || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Luogo di Destinazione</label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={ddtForm.luogo_destinazione}
                          onChange={(e) => setDdtForm({ ...ddtForm, luogo_destinazione: e.target.value })}
                          placeholder="Luogo di destinazione"
                          list="luoghi-destinazione-list"
                        />
                        <datalist id="luoghi-destinazione-list">
                          {Array.from(new Set(ddtList.filter(d => d.luogo_destinazione).map(d => d.luogo_destinazione))).map((l, i) => (
                            <option key={i} value={l} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span>{ddtForm.luogo_destinazione || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Causale del Trasporto</label>
                    {isEditing ? (
                      <>
                        <input
                          type="text"
                          value={ddtForm.causale_trasporto}
                          onChange={(e) => setDdtForm({ ...ddtForm, causale_trasporto: e.target.value })}
                          placeholder="Causale del trasporto"
                          list="causali-trasporto-list"
                        />
                        <datalist id="causali-trasporto-list">
                          {Array.from(new Set(ddtList.filter(d => d.causale_trasporto).map(d => d.causale_trasporto))).map((c, i) => (
                            <option key={i} value={c} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      <span>{ddtForm.causale_trasporto || '-'}</span>
                    )}
                  </div>

                  <div className="form-group span-4">
                    <label>Aspetto dei Beni</label>
                    {isEditing ? (
                      <input
                        type="text"
                        value={ddtForm.aspetto_beni}
                        onChange={(e) => setDdtForm({ ...ddtForm, aspetto_beni: e.target.value })}
                        placeholder="Es. Imballati, Sfusi, etc."
                      />
                    ) : (
                      <span>{ddtForm.aspetto_beni || '-'}</span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'trasporto' && (
                <div className="form-grid">
                  <div className="form-group">
                    <label>Numero Colli</label>
                    {isEditing ? (
                      <input
                        type="number"
                        value={ddtForm.numero_colli}
                        onChange={(e) => setDdtForm({ ...ddtForm, numero_colli: e.target.value })}
                        placeholder="Numero colli"
                        min="0"
                      />
                    ) : (
                      <span>{ddtForm.numero_colli || '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Peso Lordo (kg)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.001"
                        value={ddtForm.peso_lordo}
                        onChange={(e) => setDdtForm({ ...ddtForm, peso_lordo: e.target.value })}
                        placeholder="Peso lordo"
                        min="0"
                      />
                    ) : (
                      <span>{ddtForm.peso_lordo ? `${ddtForm.peso_lordo} kg` : '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Peso Netto (kg)</label>
                    {isEditing ? (
                      <input
                        type="number"
                        step="0.001"
                        value={ddtForm.peso_netto}
                        onChange={(e) => setDdtForm({ ...ddtForm, peso_netto: e.target.value })}
                        placeholder="Peso netto"
                        min="0"
                      />
                    ) : (
                      <span>{ddtForm.peso_netto ? `${ddtForm.peso_netto} kg` : '-'}</span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Data Inizio Trasporto</label>
                    {isEditing ? (
                      <input
                        type="datetime-local"
                        value={ddtForm.data_inizio_trasporto}
                        onChange={(e) => setDdtForm({ ...ddtForm, data_inizio_trasporto: e.target.value })}
                      />
                    ) : (
                      <span>{ddtForm.data_inizio_trasporto ? new Date(ddtForm.data_inizio_trasporto).toLocaleString('it-IT') : '-'}</span>
                    )}
                  </div>

                  {ddtForm.trasporto_a_mezzo === 'vettore' && (
                    <>
                      <div className="form-group span-4">
                        <label>Ragione Sociale</label>
                        {isEditing ? (
                          <>
                            <input
                              type="text"
                              value={ddtForm.vettore_ragione_sociale}
                              onChange={(e) => handleVettoreRagioneSocialeChange(e.target.value)}
                              onBlur={(e) => {
                                // Quando perde il focus, verifica se c'è una corrispondenza esatta
                                if (e.target.value) {
                                  handleVettoreRagioneSocialeChange(e.target.value);
                                }
                              }}
                              placeholder="Ragione sociale vettore"
                              list="vettori-ragione-sociale-list"
                            />
                            <datalist id="vettori-ragione-sociale-list">
                              {Array.from(new Set(ddtList.filter(d => d.vettore_ragione_sociale).map(d => d.vettore_ragione_sociale))).map((v, i) => (
                                <option key={i} value={v} />
                              ))}
                            </datalist>
                          </>
                        ) : (
                          <span>{ddtForm.vettore_ragione_sociale || '-'}</span>
                        )}
                      </div>

                      <div className="form-group span-4">
                        <label>Sede Legale</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={ddtForm.vettore_sede_legale}
                            onChange={(e) => setDdtForm({ ...ddtForm, vettore_sede_legale: e.target.value })}
                            placeholder="Sede legale vettore"
                          />
                        ) : (
                          <span>{ddtForm.vettore_sede_legale || '-'}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Partita IVA</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={ddtForm.vettore_partita_iva}
                            onChange={(e) => setDdtForm({ ...ddtForm, vettore_partita_iva: e.target.value })}
                            placeholder="P.IVA vettore"
                          />
                        ) : (
                          <span>{ddtForm.vettore_partita_iva || '-'}</span>
                        )}
                      </div>

                      <div className="form-group">
                        <label>Licenza</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={ddtForm.vettore_licenza}
                            onChange={(e) => setDdtForm({ ...ddtForm, vettore_licenza: e.target.value })}
                            placeholder="Licenza di trasporto"
                          />
                        ) : (
                          <span>{ddtForm.vettore_licenza || '-'}</span>
                        )}
                      </div>

                      <div className="form-group span-2">
                        <label>Targhe</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={ddtForm.vettore_targhe}
                            onChange={(e) => setDdtForm({ ...ddtForm, vettore_targhe: e.target.value })}
                            placeholder="Targhe veicoli (es. AB123CD, EF456GH)"
                          />
                        ) : (
                          <span>{ddtForm.vettore_targhe || '-'}</span>
                        )}
                      </div>

                      <div className="form-group span-2">
                        <label>Autista</label>
                        {isEditing ? (
                          <input
                            type="text"
                            value={ddtForm.vettore_autista}
                            onChange={(e) => setDdtForm({ ...ddtForm, vettore_autista: e.target.value })}
                            placeholder="Autista designato"
                          />
                        ) : (
                          <span>{ddtForm.vettore_autista || '-'}</span>
                        )}
                      </div>
                    </>
                  )}

                  <div className="form-group ddt-trasporto-mezzo-select">
                    <label>Trasporto a Mezzo</label>
                    {isEditing ? (
                      <SmartSelect
                        className="select-compact"
                        options={[
                          { value: 'mittente', label: 'Mittente' },
                          { value: 'vettore', label: 'Vettore' },
                          { value: 'destinatario', label: 'Destinatario' }
                        ]}
                        value={ddtForm.trasporto_a_mezzo}
                        onChange={(e) => setDdtForm({ ...ddtForm, trasporto_a_mezzo: e.target.value })}
                        displayField="label"
                        valueField="value"
                        allowEmpty={true}
                        placeholder="Seleziona..."
                      />
                    ) : (
                      <span>
                        {ddtForm.trasporto_a_mezzo === 'mittente' ? 'Mittente' :
                         ddtForm.trasporto_a_mezzo === 'vettore' ? 'Vettore' :
                         ddtForm.trasporto_a_mezzo === 'destinatario' ? 'Destinatario' : '-'}
                      </span>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Data Ritiro</label>
                    {isEditing ? (
                      <input
                        type="date"
                        value={ddtForm.data_ritiro}
                        onChange={(e) => setDdtForm({ ...ddtForm, data_ritiro: e.target.value })}
                      />
                    ) : (
                      <span>{ddtForm.data_ritiro || '-'}</span>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'articoli' && (
                <div className="articoli-section">
                  {isEditing && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addArticolo}
                      style={{ marginBottom: '0.5rem' }}
                    >
                      Aggiungi Articolo
                    </button>
                  )}
                  
                  {ddtForm.articoli.length === 0 ? (
                    <p>Nessun articolo aggiunto</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Descrizione</th>
                          <th>Unità di Misura</th>
                          <th>Quantità</th>
                          {isEditing && <th>Azioni</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {ddtForm.articoli.map((articolo, index) => (
                          <tr key={index}>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={articolo.descrizione || ''}
                                  onChange={(e) => updateArticolo(index, 'descrizione', e.target.value)}
                                  placeholder="Descrizione"
                                  style={{ width: '100%' }}
                                />
                              ) : (
                                <span>{articolo.descrizione || '-'}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  type="text"
                                  value={articolo.unita_misura || ''}
                                  onChange={(e) => updateArticolo(index, 'unita_misura', e.target.value)}
                                  placeholder="U.M."
                                  style={{ width: '100%' }}
                                />
                              ) : (
                                <span>{articolo.unita_misura || '-'}</span>
                              )}
                            </td>
                            <td>
                              {isEditing ? (
                                <input
                                  type="number"
                                  step="0.001"
                                  value={articolo.quantita || ''}
                                  onChange={(e) => updateArticolo(index, 'quantita', parseFloat(e.target.value) || 0)}
                                  placeholder="Quantità"
                                  style={{ width: '100%' }}
                                />
                              ) : (
                                <span>{articolo.quantita || '-'}</span>
                              )}
                            </td>
                            {isEditing && (
                              <td>
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => removeArticolo(index)}
                                >
                                  Rimuovi
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {activeTab === 'annotazioni' && (
                <div className="form-group">
                  <label>Annotazioni</label>
                  {isEditing ? (
                    <textarea
                      value={ddtForm.annotazioni}
                      onChange={(e) => setDdtForm({ ...ddtForm, annotazioni: e.target.value })}
                      rows={10}
                      placeholder="Annotazioni aggiuntive sul trasporto..."
                    />
                  ) : (
                    <div style={{ whiteSpace: 'pre-wrap', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', minHeight: '200px' }}>
                      {ddtForm.annotazioni || '-'}
                    </div>
                  )}
                </div>
              )}
            </div>
          </form>
        )}
      </BaseModal>
    );
  };

  const isAnyModalOpen = showDdtModal;

  return (
    <div className={`gestione-ddt ${isAnyModalOpen ? 'modal-open' : ''}`}>
      {/* Pulsanti azioni */}
      <div className="filters-actions">
        <button className="btn btn-primary" onClick={() => {
          openDdtModal(null);
          setIsEditing(true);
        }}>
          Nuovo DDT
        </button>
      </div>

      {/* Barra filtri */}
      <div className="filters-bar">
        <div className="filters-row">
          <div className="filter-group search">
            <label>Cerca</label>
            <input
              type="text"
              placeholder="Numero, destinatario, luogo..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading">Caricamento...</div>
      ) : (
        <>
          <div className="table-wrapper">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Numero</th>
                    <th>Data</th>
                    <th>Destinatario</th>
                    <th>Luogo Destinazione</th>
                    <th>Causale</th>
                    <th>Articoli</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">
                        Nessun DDT trovato
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => (
                      <tr 
                        key={row.id}
                        onClick={() => openDdtModal(row)}
                        className="table-row-clickable"
                      >
                        <td>{row.numero || '-'}</td>
                        <td>{row.data ? new Date(row.data).toLocaleDateString('it-IT') : '-'}</td>
                        <td>{row.destinatario_nome || '-'}</td>
                        <td>{row.luogo_destinazione || '-'}</td>
                        <td>{row.causale_trasporto || '-'}</td>
                        <td>{Array.isArray(row.articoli) ? row.articoli.length : 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Controlli paginazione */}
          {filteredRows.length > DDT_PER_PAGINA && (
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
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      let page;
                      if (totalPages <= 5) {
                        page = i + 1;
                      } else if (currentPage <= 3) {
                        page = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        page = totalPages - 4 + i;
                      } else {
                        page = currentPage - 2 + i;
                      }
                      return (
                        <button
                          key={page}
                          className={`pagination-btn ${page === currentPage ? 'active' : ''}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      );
                    })}
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
        </>
      )}

      {showDdtModal && renderModalContent()}
    </div>
  );
};

export default GestioneDDT;

