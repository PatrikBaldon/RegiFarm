/**
 * Report - Generazione report amministrativi
 * Componente ristrutturato con sezioni ben organizzate e campi corretti
 */
import React, { useState, useEffect } from 'react';
import { amministrazioneService } from '../services/amministrazioneService';
import hybridDataService from '../../../services/hybridDataService';
import { useAzienda } from '../../../context/AziendaContext';
import SimpleSelect from '../../../components/SimpleSelect';
import BaseModal from '../../../components/BaseModal';
import '../../alimentazione/components/Alimentazione.css';
import './Report.css';

const Report = () => {
  const { azienda } = useAzienda();
  const aziendaId = azienda?.id;

  // ========== STATO TAB ATTIVO ==========
  const [activeTab, setActiveTab] = useState('vendite'); // 'vendite', 'fatture', 'allevamento', 'prima_nota'

  // ========== STATI REPORT ==========
  // Report Sintesi Vendite Prodotti Agricoli
  const [reportVendite, setReportVendite] = useState(null);
  const [loadingVendite, setLoadingVendite] = useState(false);
  const [filtersVendite, setFiltersVendite] = useState({
    data_da: '',
    data_a: '',
  });

  // Report Fatture in Scadenza
  const [fattureScadenza, setFattureScadenza] = useState(null);
  const [loadingFatture, setLoadingFatture] = useState(false);
  const [filtersFatture, setFiltersFatture] = useState({
    giorni_scadenza: 30,
  });

  // Report Allevamento - Conteggi Vendita Animali
  const [contratti, setContratti] = useState([]);
  const [datesUscita, setDatesUscita] = useState([]);
  const [loadingContratti, setLoadingContratti] = useState(false);
  const [loadingDates, setLoadingDates] = useState(false);
  const [reportAllevamentoLoading, setReportAllevamentoLoading] = useState(false);
  const [reportAllevamentoPerPartitaLoading, setReportAllevamentoPerPartitaLoading] = useState(false);
  const [partiteIngresso, setPartiteIngresso] = useState([]);
  const [loadingPartiteIngresso, setLoadingPartiteIngresso] = useState(false);
  const [selectedPartitaIds, setSelectedPartitaIds] = useState([]);
  const [reportPerPartiteSelezionateLoading, setReportPerPartiteSelezionateLoading] = useState(false);
  const [showModalPartiteSelezione, setShowModalPartiteSelezione] = useState(false);
  const [reportAllevamentoTipo, setReportAllevamentoTipo] = useState('per_data'); // 'per_data' | 'per_partite'
  const [reportAllevamentoFilters, setReportAllevamentoFilters] = useState({
    tipo_selezione: 'azienda', // 'azienda' o 'contratto'
    contratto_id: null,
    data_uscita: '',
    usa_range: false,
    data_uscita_da: '',
    data_uscita_a: '',
  });
  
  // Gestione Acconti
  const [accontiConfig, setAccontiConfig] = useState({
    tipo_gestione: 'nessuno', // 'nessuno', 'automatico', 'manuale', 'movimenti_interi', 'fatture_soccida'
    acconto_manuale: '',
    movimenti_pn_selezionati: [],
    fatture_acconto_selezionate: [],
  });
  const [movimentiPN, setMovimentiPN] = useState([]);
  const [fattureAcconto, setFattureAcconto] = useState([]);
  const [loadingMovimentiPN, setLoadingMovimentiPN] = useState(false);
  const [loadingFattureAcconto, setLoadingFattureAcconto] = useState(false);

  // Report Prima Nota - Dare/Avere per Fornitore/Cliente
  const [contropartite, setContropartite] = useState([]);
  const [loadingContropartite, setLoadingContropartite] = useState(false);
  const [reportPrimaNotaLoading, setReportPrimaNotaLoading] = useState(false);
  const [reportPrimaNotaFilters, setReportPrimaNotaFilters] = useState({
    contropartita_nome: '',
    data_da: '',
    data_a: '',
  });

  // ========== FUNZIONI CARICAMENTO DATI ==========
  
  // Carica contratti quando cambia azienda o tipo selezione
  useEffect(() => {
    const loadContratti = async () => {
      if (!azienda?.id || reportAllevamentoFilters.tipo_selezione !== 'contratto') {
        setContratti([]);
        return;
      }
      
      setLoadingContratti(true);
      try {
        const data = await amministrazioneService.getContrattiSoccidaRiepilogo({
          azienda_id: azienda.id,
        });
        setContratti(data || []);
      } catch (error) {
        // Per errori 503, gestisci silenziosamente
        if (error?.status === 503 || error?.isServiceUnavailable) {
          setContratti([]);
        } else {
        alert('Errore nel caricamento dei contratti');
          setContratti([]);
        }
      } finally {
        setLoadingContratti(false);
      }
    };
    
    loadContratti();
  }, [azienda?.id, reportAllevamentoFilters.tipo_selezione]);
  
  // Carica date uscita quando cambia contratto o azienda (solo per selezione singola)
  useEffect(() => {
    const loadDatesUscita = async () => {
      if (!azienda?.id || reportAllevamentoFilters.usa_range) {
        setDatesUscita([]);
        return;
      }
      
      setLoadingDates(true);
      try {
        const params = {};
        if (reportAllevamentoFilters.tipo_selezione === 'contratto' && reportAllevamentoFilters.contratto_id) {
          params.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
        } else {
          params.azienda_id = azienda.id;
        }
        
        const data = await amministrazioneService.getDatesUscitaAllevamento(params);
        setDatesUscita(data.dates || []);
      } catch (error) {
        // Per errori 503, gestisci silenziosamente
        if (error?.status === 503 || error?.isServiceUnavailable) {
          setDatesUscita([]);
        } else {
        alert('Errore nel caricamento delle date di uscita');
          setDatesUscita([]);
        }
      } finally {
        setLoadingDates(false);
      }
    };
    
    loadDatesUscita();
  }, [azienda?.id, reportAllevamentoFilters.tipo_selezione, reportAllevamentoFilters.contratto_id, reportAllevamentoFilters.usa_range]);

  // Carica partite di ingresso (solo esterne, no trasferimenti interni) quando si apre la modale
  const loadPartiteIngressoPerModal = async () => {
    if (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id) return;
    if (reportAllevamentoFilters.tipo_selezione === 'azienda' && !azienda?.id) return;
    setLoadingPartiteIngresso(true);
    try {
      const filters = { tipo: 'ingresso', limit: 500, solo_esterne: true };
      if (reportAllevamentoFilters.tipo_selezione === 'contratto') {
        filters.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
      } else {
        filters.azienda_id = azienda.id;
      }
      const data = await amministrazioneService.getPartite(filters, { forceApi: true });
      setPartiteIngresso(Array.isArray(data) ? data : []);
    } catch (err) {
      setPartiteIngresso([]);
    } finally {
      setLoadingPartiteIngresso(false);
    }
  };

  const handleOpenModalPartite = () => {
    if (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id) {
      alert('Seleziona prima un contratto');
      return;
    }
    if (reportAllevamentoFilters.tipo_selezione === 'azienda' && !aziendaId) {
      alert('Seleziona un\'azienda');
      return;
    }
    setShowModalPartiteSelezione(true);
    loadPartiteIngressoPerModal();
  };

  // Carica contropartite quando cambia azienda
  useEffect(() => {
    const loadContropartite = async () => {
      if (!azienda?.id) {
        setContropartite([]);
        return;
      }
      
      setLoadingContropartite(true);
      try {
        const data = await amministrazioneService.getContropartitePrimaNota(azienda.id);
        setContropartite(data.contropartite || []);
      } catch (error) {
        // Per errori 503, gestisci silenziosamente
        if (error?.status === 503 || error?.isServiceUnavailable) {
          setContropartite([]);
        } else {
        alert('Errore nel caricamento delle contropartite');
          setContropartite([]);
        }
      } finally {
        setLoadingContropartite(false);
      }
    };
    
    loadContropartite();
  }, [azienda?.id]);

  // ========== FUNZIONE CARICAMENTO MOVIMENTI PN ==========
  
  const loadMovimentiPN = async () => {
    if (!aziendaId) {
      return;
    }
    
    // Verifica se c'è un contratto selezionato
    const contrattoId = reportAllevamentoFilters.tipo_selezione === 'contratto' 
      ? reportAllevamentoFilters.contratto_id 
      : null;
    
    if (!contrattoId) {
      // Se non c'è contratto, non caricare
      setMovimentiPN([]);
      return;
    }
    
    setLoadingMovimentiPN(true);
    try {
      // Trova il contratto selezionato per verificare se è monetizzato
      const contrattoIdNum = typeof contrattoId === 'string' ? parseInt(contrattoId, 10) : contrattoId;
      const contrattoSelezionato = contratti.find(c => {
        const cId = c.id || c.value;
        const cIdNum = typeof cId === 'string' ? parseInt(cId, 10) : cId;
        return cId === contrattoId || cIdNum === contrattoIdNum || cId === contrattoIdNum || cIdNum === contrattoId;
      });
      const isMonetizzato = contrattoSelezionato?.monetizzata === true || contrattoSelezionato?.monetizzata === 'true' || contrattoSelezionato?.monetizzata === 1;
      
      // Prepara i filtri per la chiamata API
      const filters = {
        contratto_soccida_id: contrattoId,
        tipo_operazione: 'entrata', // Solo entrate (acconti ricevuti)
      };
      
      // Se il contratto è monetizzato, aggiungi il filtro per il conto "Soccida monetizzata - Acconti"
      if (isMonetizzato) {
        try {
          const conti = await hybridDataService.getPNConti({ azienda_id: aziendaId });
          const contoSoccida = conti.find(c => 
            c.nome && c.nome.toLowerCase() === 'soccida monetizzata - acconti'
          );
          
          if (contoSoccida) {
            filters.conto_id = contoSoccida.id;
          }
        } catch (error) {
          console.warn('Errore nel recupero del conto soccida monetizzata:', error);
        }
      }
      
      // Aggiungi filtri data se presenti
      if (reportAllevamentoFilters.usa_range) {
        if (reportAllevamentoFilters.data_uscita_da) {
          filters.data_da = reportAllevamentoFilters.data_uscita_da;
        }
        if (reportAllevamentoFilters.data_uscita_a) {
          filters.data_a = reportAllevamentoFilters.data_uscita_a;
        }
      } else if (reportAllevamentoFilters.data_uscita) {
        filters.data_da = reportAllevamentoFilters.data_uscita;
        filters.data_a = reportAllevamentoFilters.data_uscita;
      }
      
      // Prepara i filtri per hybridDataService (deve includere azienda_id)
      const hybridFilters = {
        azienda_id: aziendaId,
        ...filters,
      };
      
      const response = await hybridDataService.getPNMovimenti(hybridFilters);
      
      // Estrai i movimenti dalla risposta (può essere array o oggetto con proprietà movimenti)
      let movimentiData = [];
      if (Array.isArray(response)) {
        movimentiData = response;
      } else if (response?.movimenti && Array.isArray(response.movimenti)) {
        movimentiData = response.movimenti;
      } else if (response?.data && Array.isArray(response.data)) {
        movimentiData = response.data;
      }
      
      setMovimentiPN(movimentiData);
      
      // Mantieni solo le selezioni valide (che esistono ancora nella nuova lista)
      const validIds = movimentiData.map(mov => mov.id || mov.value).filter(Boolean);
      const validSelections = accontiConfig.movimenti_pn_selezionati.filter(id => validIds.includes(id));
      
      if (validSelections.length !== accontiConfig.movimenti_pn_selezionati.length) {
        setAccontiConfig({
          ...accontiConfig,
          movimenti_pn_selezionati: validSelections,
        });
      }
    } catch (error) {
      console.error('Errore nel caricamento movimenti PN:', error);
      setMovimentiPN([]);
    } finally {
      setLoadingMovimentiPN(false);
    }
  };

  // Determina automaticamente il tipo dalla data di uscita
  useEffect(() => {
    const determineTipo = async () => {
      if (!aziendaId) return;
      
      // Verifica che ci sia almeno una data selezionata
      const hasDate = reportAllevamentoFilters.data_uscita || 
                     (reportAllevamentoFilters.usa_range && reportAllevamentoFilters.data_uscita_da);
      
      if (!hasDate) return;
      
      try {
        const params = {};
        if (reportAllevamentoFilters.tipo_selezione === 'contratto' && reportAllevamentoFilters.contratto_id) {
          params.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
        } else {
          params.azienda_id = aziendaId;
        }
        
        if (reportAllevamentoFilters.usa_range) {
          if (reportAllevamentoFilters.data_uscita_da) {
            params.data_uscita_da = reportAllevamentoFilters.data_uscita_da;
          }
          if (reportAllevamentoFilters.data_uscita_a) {
            params.data_uscita_a = reportAllevamentoFilters.data_uscita_a;
          }
        } else if (reportAllevamentoFilters.data_uscita) {
          params.data_uscita = reportAllevamentoFilters.data_uscita;
        }
        
        const tipoInfo = await amministrazioneService.getTipoDaDataUscita(params);
        console.log('Tipo determinato dalla data:', tipoInfo);
        
        // Suggerisci il tipo di gestione acconti in base al tipo determinato
        // Solo se l'utente non ha ancora selezionato un tipo o se è 'nessuno'
        // Usa una funzione di aggiornamento per evitare problemi con le dipendenze
        setAccontiConfig(prevConfig => {
          if (prevConfig.tipo_gestione === 'nessuno' && tipoInfo.ha_soccida) {
            // Se c'è soccida monetizzata, suggerisci 'automatico'
            // Se c'è solo soccida fatturata, suggerisci 'fatture_soccida'
            // Altrimenti lascia 'nessuno'
            if (tipoInfo.ha_soccida_monetizzata && !tipoInfo.ha_soccida_fatturata) {
              return {
                ...prevConfig,
                tipo_gestione: 'automatico',
              };
            } else if (tipoInfo.ha_soccida_fatturata && !tipoInfo.ha_soccida_monetizzata) {
              return {
                ...prevConfig,
                tipo_gestione: 'fatture_soccida',
              };
            } else if (tipoInfo.ha_soccida_monetizzata && tipoInfo.ha_soccida_fatturata) {
              // Se ci sono entrambi, suggerisci automatico (più comune)
              return {
                ...prevConfig,
                tipo_gestione: 'automatico',
              };
            }
          }
          return prevConfig;
        });
      } catch (error) {
        console.error('Errore nel determinare il tipo dalla data:', error);
        // Non mostrare errore all'utente, è solo un suggerimento
      }
    };
    
    determineTipo();
  }, [
    aziendaId,
    reportAllevamentoFilters.tipo_selezione,
    reportAllevamentoFilters.contratto_id,
    reportAllevamentoFilters.data_uscita,
    reportAllevamentoFilters.data_uscita_da,
    reportAllevamentoFilters.data_uscita_a,
    reportAllevamentoFilters.usa_range,
  ]);

  // Carica automaticamente i movimenti PN quando si seleziona "movimenti_interi"
  useEffect(() => {
    if (accontiConfig.tipo_gestione === 'movimenti_interi' && aziendaId) {
      // Verifica che ci sia almeno una data selezionata
      const hasDate = reportAllevamentoFilters.data_uscita || 
                     (reportAllevamentoFilters.usa_range && reportAllevamentoFilters.data_uscita_da);
      
      if (hasDate) {
        loadMovimentiPN();
      }
    } else if (accontiConfig.tipo_gestione !== 'movimenti_interi') {
      // Se cambia tipo gestione, svuota i movimenti
      setMovimentiPN([]);
      setAccontiConfig({
        ...accontiConfig,
        movimenti_pn_selezionati: [],
      });
    }
  }, [
    accontiConfig.tipo_gestione,
    aziendaId,
    reportAllevamentoFilters.tipo_selezione,
    reportAllevamentoFilters.contratto_id,
    reportAllevamentoFilters.data_uscita,
    reportAllevamentoFilters.data_uscita_da,
    reportAllevamentoFilters.data_uscita_a,
    reportAllevamentoFilters.usa_range,
    contratti.length, // Ricarica quando i contratti vengono caricati
  ]);

  // ========== FUNZIONI GENERAZIONE REPORT ==========

  const loadReportVendite = async () => {
    if (!aziendaId) {
      alert('Seleziona un\'azienda per generare il report');
      return;
    }
    
    if (!filtersVendite.data_da || !filtersVendite.data_a) {
      alert('Inserisci entrambe le date (Da e A)');
      return;
    }
    
    if (filtersVendite.data_da > filtersVendite.data_a) {
      alert('La data iniziale non può essere successiva alla data finale');
      return;
    }

    setLoadingVendite(true);
    try {
      const params = {
        azienda_id: aziendaId,
        data_da: filtersVendite.data_da,
        data_a: filtersVendite.data_a,
      };
      const data = await amministrazioneService.getReportSintesiVendite(params);
      setReportVendite(data);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setReportVendite(null);
      } else {
      alert('Errore nel caricamento del report');
        setReportVendite(null);
      }
    } finally {
      setLoadingVendite(false);
    }
  };

  const loadFattureScadenza = async () => {
    if (!filtersFatture.giorni_scadenza || filtersFatture.giorni_scadenza < 1) {
      alert('Inserisci un numero di giorni valido (minimo 1)');
      return;
    }

    setLoadingFatture(true);
    try {
      const data = await amministrazioneService.getReportFattureScadenza(filtersFatture.giorni_scadenza);
      setFattureScadenza(data);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        setFattureScadenza(null);
      } else {
      alert('Errore nel caricamento del report');
        setFattureScadenza(null);
      }
    } finally {
      setLoadingFatture(false);
    }
  };

  const handleGenerateReportAllevamento = async () => {
    if (!aziendaId && reportAllevamentoFilters.tipo_selezione === 'azienda') {
      alert('Seleziona un\'azienda per generare il report');
      return;
    }

    const isRange = reportAllevamentoFilters.usa_range;
    if (isRange) {
      if (!reportAllevamentoFilters.data_uscita_da || !reportAllevamentoFilters.data_uscita_a) {
        alert('Seleziona entrambe le date per l\'intervallo');
        return;
      }
      if (reportAllevamentoFilters.data_uscita_da > reportAllevamentoFilters.data_uscita_a) {
        alert('La data iniziale non può essere successiva alla data finale');
        return;
      }
    } else if (!reportAllevamentoFilters.data_uscita) {
      alert('Seleziona una data di uscita');
      return;
    }
    
    if (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id) {
      alert('Seleziona un contratto');
      return;
    }
    
    setReportAllevamentoLoading(true);
    try {
      const params = {};
      if (isRange) {
        params.data_uscita_da = reportAllevamentoFilters.data_uscita_da;
        params.data_uscita_a = reportAllevamentoFilters.data_uscita_a;
      } else {
        params.data_uscita = reportAllevamentoFilters.data_uscita;
      }
      
      if (reportAllevamentoFilters.tipo_selezione === 'contratto') {
        params.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
      } else {
        params.azienda_id = aziendaId;
      }
      
      // Aggiungi parametri acconti se configurati
      if (accontiConfig.tipo_gestione !== 'nessuno') {
        params.tipo_gestione_acconti = accontiConfig.tipo_gestione;
        
        if (accontiConfig.tipo_gestione === 'manuale' && accontiConfig.acconto_manuale) {
          params.acconto_manuale = parseFloat(accontiConfig.acconto_manuale);
        }
        
        if (accontiConfig.tipo_gestione === 'movimenti_interi' && accontiConfig.movimenti_pn_selezionati.length > 0) {
          params.movimenti_pn_ids = accontiConfig.movimenti_pn_selezionati.join(',');
        }
        
        if (accontiConfig.tipo_gestione === 'fatture_soccida' && accontiConfig.fatture_acconto_selezionate.length > 0) {
          params.fatture_acconto_selezionate = JSON.stringify(
            accontiConfig.fatture_acconto_selezionate.map(f => ({
              fattura_id: f.fattura_id,
              importo_utilizzato: f.importo_utilizzato,
            }))
          );
        }
      }
      
      const blob = await amministrazioneService.getReportAllevamento(params);
      if (!blob) {
        throw new Error('Nessun file ricevuto');
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = isRange
        ? `report_allevamento_uscita_dal_${reportAllevamentoFilters.data_uscita_da}_al_${reportAllevamentoFilters.data_uscita_a}`
        : `report_allevamento_uscita_del_${reportAllevamentoFilters.data_uscita}`;
      link.href = url;
      link.download = `${baseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        alert('Il server non è temporaneamente disponibile. Riprova più tardi.');
      } else {
      alert('Errore durante la generazione del report');
      }
    } finally {
      setReportAllevamentoLoading(false);
    }
  };

  const handleGenerateReportAllevamentoPerPartita = async () => {
    if (!aziendaId && reportAllevamentoFilters.tipo_selezione === 'azienda') {
      alert('Seleziona un\'azienda per generare il report');
      return;
    }
    const isRange = reportAllevamentoFilters.usa_range;
    if (isRange) {
      if (!reportAllevamentoFilters.data_uscita_da || !reportAllevamentoFilters.data_uscita_a) {
        alert('Seleziona entrambe le date per l\'intervallo');
        return;
      }
      if (reportAllevamentoFilters.data_uscita_da > reportAllevamentoFilters.data_uscita_a) {
        alert('La data iniziale non può essere successiva alla data finale');
        return;
      }
    } else if (!reportAllevamentoFilters.data_uscita) {
      alert('Seleziona una data di uscita');
      return;
    }
    if (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id) {
      alert('Seleziona un contratto');
      return;
    }
    setReportAllevamentoPerPartitaLoading(true);
    try {
      const params = {};
      if (isRange) {
        params.data_uscita_da = reportAllevamentoFilters.data_uscita_da;
        params.data_uscita_a = reportAllevamentoFilters.data_uscita_a;
      } else {
        params.data_uscita = reportAllevamentoFilters.data_uscita;
      }
      if (reportAllevamentoFilters.tipo_selezione === 'contratto') {
        params.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
      } else {
        params.azienda_id = aziendaId;
      }
      if (accontiConfig.tipo_gestione !== 'nessuno') {
        params.tipo_gestione_acconti = accontiConfig.tipo_gestione;
        if (accontiConfig.tipo_gestione === 'manuale' && accontiConfig.acconto_manuale) {
          params.acconto_manuale = parseFloat(accontiConfig.acconto_manuale);
        }
        if (accontiConfig.tipo_gestione === 'movimenti_interi' && accontiConfig.movimenti_pn_selezionati.length > 0) {
          params.movimenti_pn_ids = accontiConfig.movimenti_pn_selezionati.join(',');
        }
        if (accontiConfig.tipo_gestione === 'fatture_soccida' && accontiConfig.fatture_acconto_selezionate.length > 0) {
          params.fatture_acconto_selezionate = JSON.stringify(
            accontiConfig.fatture_acconto_selezionate.map(f => ({
              fattura_id: f.fattura_id,
              importo_utilizzato: f.importo_utilizzato,
            }))
          );
        }
      }
      const blob = await amministrazioneService.getReportAllevamentoPerPartita(params);
      if (!blob) throw new Error('Nessun file ricevuto');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const baseName = isRange
        ? `report_allevamento_per_partita_dal_${reportAllevamentoFilters.data_uscita_da}_al_${reportAllevamentoFilters.data_uscita_a}`
        : `report_allevamento_per_partita_uscita_del_${reportAllevamentoFilters.data_uscita}`;
      link.href = url;
      link.download = `${baseName}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error?.status === 503 || error?.isServiceUnavailable) {
        alert('Il server non è temporaneamente disponibile. Riprova più tardi.');
      } else {
        alert('Errore durante la generazione del report per partita');
      }
    } finally {
      setReportAllevamentoPerPartitaLoading(false);
    }
  };

  const handleGenerateReportByPartiteSelezionate = async () => {
    if (selectedPartitaIds.length === 0) {
      alert('Seleziona almeno una partita');
      return;
    }
    if (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id) {
      alert('Seleziona un contratto');
      return;
    }
    if (reportAllevamentoFilters.tipo_selezione === 'azienda' && !aziendaId) {
      alert('Seleziona un\'azienda');
      return;
    }
    setReportPerPartiteSelezionateLoading(true);
    try {
      const params = { partita_ids: selectedPartitaIds.join(',') };
      if (reportAllevamentoFilters.tipo_selezione === 'contratto') {
        params.contratto_soccida_id = reportAllevamentoFilters.contratto_id;
      } else {
        params.azienda_id = aziendaId;
      }
      const blob = await amministrazioneService.getReportAllevamentoPerPartita(params);
      if (!blob) throw new Error('Nessun file ricevuto');
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'report_allevamento_per_partite_selezionate.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      if (error?.status === 503 || error?.isServiceUnavailable) {
        alert('Il server non è temporaneamente disponibile. Riprova più tardi.');
      } else {
        alert('Errore durante la generazione del report');
      }
    } finally {
      setReportPerPartiteSelezionateLoading(false);
    }
  };

  const handleGenerateReportPrimaNota = async () => {
    if (!reportPrimaNotaFilters.contropartita_nome) {
      alert('Seleziona un fornitore/cliente');
      return;
    }

    if (reportPrimaNotaFilters.data_da && reportPrimaNotaFilters.data_a) {
      if (reportPrimaNotaFilters.data_da > reportPrimaNotaFilters.data_a) {
        alert('La data iniziale non può essere successiva alla data finale');
        return;
      }
    }
    
    setReportPrimaNotaLoading(true);
    try {
      const params = {
        azienda_id: aziendaId,
        contropartita_nome: reportPrimaNotaFilters.contropartita_nome,
      };
      
      if (reportPrimaNotaFilters.data_da) {
        params.data_da = reportPrimaNotaFilters.data_da;
      }
      if (reportPrimaNotaFilters.data_a) {
        params.data_a = reportPrimaNotaFilters.data_a;
      }
      
      const blob = await amministrazioneService.getReportPrimaNotaDareAvere(params);
      if (!blob) {
        throw new Error('Nessun file ricevuto');
      }
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `report_prima_nota_dare_avere_${reportPrimaNotaFilters.contropartita_nome.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      // Per errori 503, gestisci silenziosamente
      if (error?.status === 503 || error?.isServiceUnavailable) {
        alert('Il server non è temporaneamente disponibile. Riprova più tardi.');
      } else {
      alert('Errore durante la generazione del report');
      }
    } finally {
      setReportPrimaNotaLoading(false);
    }
  };

  // ========== RENDERING ==========

  return (
    <div className="report-module">
      <div className="report-tabs">
        <button
          className={`tab-button ${activeTab === 'vendite' ? 'active' : ''}`}
          onClick={() => setActiveTab('vendite')}
        >
          Vendite Prodotti
        </button>
        <button
          className={`tab-button ${activeTab === 'fatture' ? 'active' : ''}`}
          onClick={() => setActiveTab('fatture')}
        >
          Fatture in Scadenza
        </button>
        <button
          className={`tab-button ${activeTab === 'allevamento' ? 'active' : ''}`}
          onClick={() => setActiveTab('allevamento')}
        >
          Report Allevamento
        </button>
        <button
          className={`tab-button ${activeTab === 'prima_nota' ? 'active' : ''}`}
          onClick={() => setActiveTab('prima_nota')}
        >
          Prima Nota
        </button>
      </div>

      <div className="report-content-wrapper">
        {/* REPORT 1: Sintesi Vendite Prodotti Agricoli */}
        {activeTab === 'vendite' && (
          <div className="report-tab-content">
            <div className="report-section-header">
              <div className="report-header-content">
                <div>
                  <h3>Report Sintesi Vendite Prodotti Agricoli</h3>
                  <p className="report-description">
                    Visualizza un riepilogo delle vendite di prodotti agricoli con ricavi, costi e margini per prodotto
                  </p>
                </div>
                <button 
                  className="btn btn-primary report-header-button"
                  onClick={loadReportVendite}
                  disabled={loadingVendite || !filtersVendite.data_da || !filtersVendite.data_a}
                >
                  {loadingVendite ? 'Caricamento...' : 'Genera Report'}
                </button>
              </div>
            </div>
        
            <div className="filters">
              <div className="form-group">
                <label>Data Da *</label>
                <input
                  type="date"
                  value={filtersVendite.data_da}
                  onChange={(e) => setFiltersVendite({ ...filtersVendite, data_da: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Data A *</label>
                <input
                  type="date"
                  value={filtersVendite.data_a}
                  onChange={(e) => setFiltersVendite({ ...filtersVendite, data_a: e.target.value })}
                  required
                  min={filtersVendite.data_da || undefined}
                />
              </div>
            </div>

        {loadingVendite && <div className="loading-message">Caricamento dati...</div>}
        
        {reportVendite && !loadingVendite && (
          <div className="report-content">
            <div className="summary-cards">
              <div className="card">
                <div className="card-title">Totale Ricavi</div>
                <div className="card-value positive">€{reportVendite.totale_ricavi?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="card">
                <div className="card-title">Totale Costi</div>
                <div className="card-value negative">€{reportVendite.totale_costi?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="card">
                <div className="card-title">Margine Totale</div>
                <div className={`card-value ${(reportVendite.totale_margine || 0) >= 0 ? 'positive' : 'negative'}`}>
                  €{reportVendite.totale_margine?.toFixed(2) || '0.00'}
                </div>
              </div>
              <div className="card">
                <div className="card-title">Numero Vendite</div>
                <div className="card-value">{reportVendite.numero_vendite || 0}</div>
              </div>
            </div>

            {reportVendite.per_prodotto && Object.keys(reportVendite.per_prodotto).length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Prodotto</th>
                      <th>Quantità</th>
                      <th>Ricavi</th>
                      <th>Costi</th>
                      <th>Margine</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(reportVendite.per_prodotto).map(([prodotto, dati]) => (
                      <tr key={prodotto}>
                        <td>{prodotto}</td>
                        <td>{dati.quantita?.toFixed(3) || '0.000'}</td>
                        <td>€{dati.ricavi?.toFixed(2) || '0.00'}</td>
                        <td>€{dati.costi?.toFixed(2) || '0.00'}</td>
                        <td className={(dati.margine || 0) >= 0 ? 'positive' : 'negative'}>
                          €{dati.margine?.toFixed(2) || '0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportVendite && (
              <div className="empty-state">Nessun dato disponibile per il periodo selezionato</div>
            )}
          </div>
        )}
        </div>
        )}

        {/* REPORT 2: Fatture in Scadenza */}
        {activeTab === 'fatture' && (
          <div className="report-tab-content">
            <div className="report-section-header">
              <div className="report-header-content">
                <div>
                  <h3>Report Fatture in Scadenza</h3>
                  <p className="report-description">
                    Visualizza le fatture ricevute che scadono entro i prossimi giorni
                  </p>
                </div>
                <button 
                  className="btn btn-primary report-header-button"
                  onClick={loadFattureScadenza}
                  disabled={loadingFatture || !filtersFatture.giorni_scadenza || filtersFatture.giorni_scadenza < 1}
                >
                  {loadingFatture ? 'Caricamento...' : 'Genera Report'}
                </button>
              </div>
            </div>
        
            <div className="filters">
              <div className="form-group">
                <label>Giorni di Anticipo *</label>
                <input
                  type="number"
                  value={filtersFatture.giorni_scadenza}
                  onChange={(e) => setFiltersFatture({ ...filtersFatture, giorni_scadenza: parseInt(e.target.value) || 30 })}
                  min="1"
                  required
                />
                <small>Mostra fatture che scadono nei prossimi N giorni</small>
              </div>
            </div>

        {loadingFatture && <div className="loading-message">Caricamento dati...</div>}
        
        {fattureScadenza && !loadingFatture && (
          <div className="report-content">
            <div className="summary-cards">
              <div className="card">
                <div className="card-title">Totale Da Pagare</div>
                <div className="card-value negative">€{fattureScadenza.totale_da_pagare?.toFixed(2) || '0.00'}</div>
              </div>
              <div className="card">
                <div className="card-title">Numero Fatture</div>
                <div className="card-value">{fattureScadenza.numero_fatture || 0}</div>
              </div>
            </div>

            {fattureScadenza.fatture && fattureScadenza.fatture.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Numero</th>
                      <th>Data</th>
                      <th>Fornitore</th>
                      <th>Importo Totale</th>
                      <th>Importo Pagato</th>
                      <th>Da Pagare</th>
                      <th>Scadenza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fattureScadenza.fatture.map(fattura => (
                      <tr key={fattura.id}>
                        <td>{fattura.numero || '-'}</td>
                        <td>{fattura.data_fattura ? new Date(fattura.data_fattura).toLocaleDateString('it-IT') : '-'}</td>
                        <td className="fornitore-cell">
                          <span className="fornitore-text">{fattura.fornitore_id || '-'}</span>
                        </td>
                        <td>€{parseFloat(fattura.importo_totale || 0).toFixed(2)}</td>
                        <td>€{parseFloat(fattura.importo_pagato || 0).toFixed(2)}</td>
                        <td className="negative">
                          €{(parseFloat(fattura.importo_netto || 0) - parseFloat(fattura.importo_pagato || 0)).toFixed(2)}
                        </td>
                        <td>{fattura.data_scadenza ? new Date(fattura.data_scadenza).toLocaleDateString('it-IT') : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">Nessuna fattura in scadenza per il periodo selezionato</div>
            )}
          </div>
        )}
        </div>
        )}

        {/* REPORT 3: Report Allevamento - tipo report → ambito → campi condizionali */}
        {activeTab === 'allevamento' && (
          <div className="report-tab-content">
            <h3 className="report-tab-main-title">Report Allevamento</h3>

            {/* Step 1: Tipo di report */}
            <div className="report-allevamento-step">
              <label className="report-step-label">Tipo di report *</label>
              <div className="report-tipo-options">
                <button
                  type="button"
                  className={`report-tipo-card ${reportAllevamentoTipo === 'per_data' ? 'active' : ''}`}
                  onClick={() => setReportAllevamentoTipo('per_data')}
                >
                  <span className="report-tipo-card-title">Per data di uscita</span>
                  <span className="report-tipo-card-desc">Riepilogo o stampa per partita in base alle uscite in una data/intervallo</span>
                </button>
                <button
                  type="button"
                  className={`report-tipo-card ${reportAllevamentoTipo === 'per_partite' ? 'active' : ''}`}
                  onClick={() => setReportAllevamentoTipo('per_partite')}
                >
                  <span className="report-tipo-card-title">Per partita / insiemi di partite</span>
                  <span className="report-tipo-card-desc">Scegli una o più partite di ingresso (dall’esterno) e genera il report</span>
                </button>
              </div>
            </div>

            {/* Step 2: Ambito (azienda o contratto) */}
            <div className="report-allevamento-step">
              <label className="report-step-label">Ambito *</label>
              <div className="report-allevamento-sections report-allevamento-inline">
                <div className="form-group">
                  <SimpleSelect
                    value={reportAllevamentoFilters.tipo_selezione}
                    onChange={(e) => {
                      setReportAllevamentoFilters({
                        ...reportAllevamentoFilters,
                        tipo_selezione: e.target.value,
                        contratto_id: null,
                        data_uscita: '',
                        data_uscita_da: '',
                        data_uscita_a: '',
                      });
                    }}
                    options={[
                      { label: "Tutta l'azienda", value: 'azienda' },
                      { label: 'Contratto specifico', value: 'contratto' },
                    ]}
                    allowEmpty={false}
                  />
                </div>
                {reportAllevamentoFilters.tipo_selezione === 'contratto' && (
                  <div className="form-group">
                    {loadingContratti ? (
                      <span className="loading-message">Caricamento...</span>
                    ) : (
                      <SimpleSelect
                        value={reportAllevamentoFilters.contratto_id || ''}
                        onChange={(e) => {
                          setReportAllevamentoFilters({
                            ...reportAllevamentoFilters,
                            contratto_id: e.target.value ? parseInt(e.target.value) : null,
                            data_uscita: '',
                            data_uscita_da: '',
                            data_uscita_a: '',
                          });
                        }}
                        options={contratti.map((c) => ({
                          label: `${c.numero_contratto || '#' + c.id} - ${c.soccidante?.nome || 'N/A'}`,
                          value: c.id,
                        }))}
                        placeholder="Seleziona contratto"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Step 3a: Campi per "Per data di uscita" (nascosti se tipo = per_partite) */}
            {reportAllevamentoTipo === 'per_data' && (
            <div className="report-allevamento-section-block">
              <label className="report-step-label">Date e opzioni</label>
              <div className="report-allevamento-sections">
                <div className="report-sections-left">
              <div className="report-section-group">
                <div className="form-group checkbox">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className={`toggle-button ${reportAllevamentoFilters.usa_range ? 'active' : ''}`}
                      onClick={() => {
                        setReportAllevamentoFilters({
                          ...reportAllevamentoFilters,
                          usa_range: !reportAllevamentoFilters.usa_range,
                          data_uscita: '',
                          data_uscita_da: '',
                          data_uscita_a: '',
                        });
                      }}
                      aria-label="Intervallo di date"
                    />
                    <span>Intervallo di date</span>
                  </label>
                </div>

                {reportAllevamentoFilters.usa_range ? (
                  <>
                    <div className="form-group">
                      <label>Data Uscita Da *</label>
                      <input
                        type="date"
                        value={reportAllevamentoFilters.data_uscita_da}
                        onChange={(e) =>
                          setReportAllevamentoFilters({
                            ...reportAllevamentoFilters,
                            data_uscita_da: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="form-group">
                      <label>Data Uscita A *</label>
                      <input
                        type="date"
                        value={reportAllevamentoFilters.data_uscita_a}
                        onChange={(e) =>
                          setReportAllevamentoFilters({
                            ...reportAllevamentoFilters,
                            data_uscita_a: e.target.value,
                          })
                        }
                        min={reportAllevamentoFilters.data_uscita_da || undefined}
                      />
                    </div>
                  </>
                ) : (
                  <div className="form-group">
                    <label>Data Uscita *</label>
                    {loadingDates ? (
                      <div className="loading-message">Caricamento date...</div>
                    ) : (
                      <SimpleSelect
                        value={reportAllevamentoFilters.data_uscita}
                        onChange={(e) => {
                          setReportAllevamentoFilters({
                            ...reportAllevamentoFilters,
                            data_uscita: e.target.value,
                          });
                        }}
                        disabled={!datesUscita.length}
                        options={datesUscita.map((date) => ({
                          label: new Date(date).toLocaleDateString('it-IT'),
                          value: date,
                        }))}
                        placeholder="Seleziona data"
                      />
                    )}
                    {datesUscita.length === 0 && !loadingDates && (
                      <small style={{ color: '#666', display: 'block', marginTop: '4px' }}>
                        Nessuna data di uscita disponibile
                      </small>
                    )}
                  </div>
                )}
                </div>
              </div>

              {/* Seconda metà: Gestione Acconti */}
              <div className="report-sections-right">
                <div className="acconti-section">
                <h4 className="acconti-section-title">Gestione Acconti</h4>
            <div className="form-group">
              <label>Tipo Gestione Acconti</label>
              <select
                value={accontiConfig.tipo_gestione}
                onChange={(e) => {
                  const newTipo = e.target.value;
                  setAccontiConfig({
                    ...accontiConfig,
                    tipo_gestione: newTipo,
                    acconto_manuale: newTipo === 'manuale' ? accontiConfig.acconto_manuale : '',
                    movimenti_pn_selezionati: newTipo === 'movimenti_interi' ? accontiConfig.movimenti_pn_selezionati : [],
                    fatture_acconto_selezionate: newTipo === 'fatture_soccida' ? accontiConfig.fatture_acconto_selezionate : [],
                  });
                }}
              >
                <option value="nessuno">Nessun acconto</option>
                <option value="automatico">Automatico</option>
                <option value="manuale">Manuale</option>
                <option value="movimenti_interi">Movimenti Prima Nota</option>
                {reportAllevamentoFilters.tipo_selezione === 'contratto' && (
                  <option value="fatture_soccida">Fatture Soccida</option>
                )}
              </select>
            </div>
            
            {accontiConfig.tipo_gestione === 'manuale' && (
              <div className="form-group">
                <label>Importo Manuale (€)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={accontiConfig.acconto_manuale}
                  onChange={(e) => setAccontiConfig({ ...accontiConfig, acconto_manuale: e.target.value })}
                  placeholder="Inserisci importo"
                />
              </div>
            )}
            
            {accontiConfig.tipo_gestione === 'movimenti_interi' && (
              <div className="form-group">
                <label>Seleziona Movimenti Prima Nota</label>
                {loadingMovimentiPN ? (
                  <p className="acconti-help-text">Caricamento movimenti in corso...</p>
                ) : movimentiPN.length > 0 ? (
                  <div style={{ marginTop: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <p className="acconti-help-text" style={{ margin: 0, fontWeight: 'bold' }}>
                        Seleziona i movimenti da includere ({accontiConfig.movimenti_pn_selezionati.length} selezionati):
                      </p>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          className="btn btn-sm btn-secondary"
                          onClick={() => {
                            const allIds = movimentiPN.map(mov => mov.id || mov.value).filter(Boolean);
                            setAccontiConfig({
                              ...accontiConfig,
                              movimenti_pn_selezionati: allIds,
                            });
                          }}
                          style={{ padding: '4px 8px', fontSize: '12px' }}
                        >
                          Seleziona tutti
                        </button>
                        {accontiConfig.movimenti_pn_selezionati.length > 0 && (
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => {
                              setAccontiConfig({
                                ...accontiConfig,
                                movimenti_pn_selezionati: [],
                              });
                            }}
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            Deseleziona tutti
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5', position: 'sticky', top: 0, zIndex: 1 }}>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd', fontSize: '12px', fontWeight: 'bold' }}>Data</th>
                            <th style={{ padding: '8px', textAlign: 'left', borderBottom: '2px solid #ddd', fontSize: '12px', fontWeight: 'bold' }}>Descrizione</th>
                            <th style={{ padding: '8px', textAlign: 'right', borderBottom: '2px solid #ddd', fontSize: '12px', fontWeight: 'bold' }}>Importo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {movimentiPN.map((mov) => {
                            const movId = mov.id || mov.value;
                            const isSelected = accontiConfig.movimenti_pn_selezionati.includes(movId);
                            return (
                              <tr
                                key={movId}
                                onClick={(e) => {
                                  // Gestisci selezione singola o multipla con Ctrl/Cmd
                                  const isMultiSelect = e.ctrlKey || e.metaKey;
                                  
                                  if (isMultiSelect) {
                                    // Selezione multipla: aggiungi/rimuovi dalla selezione
                                    if (isSelected) {
                                      setAccontiConfig({
                                        ...accontiConfig,
                                        movimenti_pn_selezionati: accontiConfig.movimenti_pn_selezionati.filter(id => id !== movId),
                                      });
                                    } else {
                                      setAccontiConfig({
                                        ...accontiConfig,
                                        movimenti_pn_selezionati: [...accontiConfig.movimenti_pn_selezionati, movId],
                                      });
                                    }
                                  } else {
                                    // Selezione singola: seleziona solo questa riga
                                    setAccontiConfig({
                                      ...accontiConfig,
                                      movimenti_pn_selezionati: isSelected ? [] : [movId],
                                    });
                                  }
                                }}
                                style={{
                                  backgroundColor: isSelected ? '#e8f5e9' : '#fff',
                                  cursor: 'pointer',
                                  transition: 'background-color 0.2s',
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = '#f0f0f0';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = '#fff';
                                  }
                                }}
                              >
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                                  {mov.data ? new Date(mov.data).toLocaleDateString('it-IT') : 'N/A'}
                                </td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px' }}>
                                  {mov.descrizione || mov.note || 'Nessuna descrizione'}
                                </td>
                                <td style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', textAlign: 'right', fontWeight: 'bold', color: '#2e7d32' }}>
                                  €{typeof mov.importo === 'number' ? mov.importo.toFixed(2) : parseFloat(mov.importo || 0).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <p className="acconti-help-text" style={{ marginTop: '8px', fontSize: '11px', color: '#666', fontStyle: 'italic' }}>
                      💡 Click singolo per selezionare una riga, Ctrl/Cmd + Click per selezioni multiple
                    </p>
                  </div>
                ) : (
                  <p className="acconti-help-text" style={{ marginTop: '10px', fontStyle: 'italic', color: '#666' }}>
                    Nessun movimento disponibile per i filtri selezionati.
                  </p>
                )}
              </div>
            )}
            
            {accontiConfig.tipo_gestione === 'fatture_soccida' && reportAllevamentoFilters.tipo_selezione === 'contratto' && (
              <div className="form-group">
                <label>Seleziona Fatture Acconto</label>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={async () => {
                    if (!reportAllevamentoFilters.contratto_id) {
                      alert('Seleziona prima un contratto');
                      return;
                    }
                    setLoadingFattureAcconto(true);
                    try {
                      const data = await amministrazioneService.getFattureAccontoContratto(reportAllevamentoFilters.contratto_id);
                      setFattureAcconto(data.fatture_acconto || []);
                    } catch (error) {
                      alert('Errore nel caricamento delle fatture acconto');
                    } finally {
                      setLoadingFattureAcconto(false);
                    }
                  }}
                  disabled={loadingFattureAcconto || !reportAllevamentoFilters.contratto_id}
                >
                  {loadingFattureAcconto ? 'Caricamento...' : 'Carica Fatture Acconto'}
                </button>
                {fattureAcconto.length > 0 && (
                  <div className="acconti-list-container">
                    {fattureAcconto.map((fattura) => {
                      const selected = accontiConfig.fatture_acconto_selezionate.find(f => f.fattura_id === fattura.id);
                      return (
                        <div key={fattura.id} className="acconti-fattura-item">
                          <div className="acconti-fattura-header">
                            <strong>Fattura {fattura.numero}</strong> - {fattura.data}
                          </div>
                          <div className="acconti-fattura-info">
                            Totale: €{fattura.importo_totale.toFixed(2)} | 
                            Utilizzato: €{fattura.importo_utilizzato.toFixed(2)} | 
                            Disponibile: €{fattura.importo_disponibile.toFixed(2)}
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max={fattura.importo_disponibile}
                            value={selected?.importo_utilizzato || ''}
                            onChange={(e) => {
                              const importo = parseFloat(e.target.value) || 0;
                              if (importo > fattura.importo_disponibile) {
                                alert(`L'importo non può superare €${fattura.importo_disponibile.toFixed(2)}`);
                                return;
                              }
                              const existing = accontiConfig.fatture_acconto_selezionate.findIndex(f => f.fattura_id === fattura.id);
                              if (existing >= 0) {
                                if (importo > 0) {
                                  const updated = [...accontiConfig.fatture_acconto_selezionate];
                                  updated[existing] = { fattura_id: fattura.id, importo_utilizzato: importo };
                                  setAccontiConfig({ ...accontiConfig, fatture_acconto_selezionate: updated });
                                } else {
                                  setAccontiConfig({
                                    ...accontiConfig,
                                    fatture_acconto_selezionate: accontiConfig.fatture_acconto_selezionate.filter(f => f.fattura_id !== fattura.id),
                                  });
                                }
                              } else if (importo > 0) {
                                setAccontiConfig({
                                  ...accontiConfig,
                                  fatture_acconto_selezionate: [...accontiConfig.fatture_acconto_selezionate, { fattura_id: fattura.id, importo_utilizzato: importo }],
                                });
                              }
                            }}
                            placeholder="Importo da utilizzare"
                            className="acconti-importo-input"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              )}
                </div>
              </div>
              <div className="report-header-buttons" style={{ marginTop: '12px', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  className="btn btn-primary"
                  onClick={handleGenerateReportAllevamento}
                  disabled={
                    reportAllevamentoLoading ||
                    reportAllevamentoPerPartitaLoading ||
                    (!reportAllevamentoFilters.usa_range && !reportAllevamentoFilters.data_uscita) ||
                    (reportAllevamentoFilters.usa_range &&
                      (!reportAllevamentoFilters.data_uscita_da || !reportAllevamentoFilters.data_uscita_a)) ||
                    (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id)
                  }
                >
                  {reportAllevamentoLoading ? 'Generazione...' : 'Genera Report PDF'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleGenerateReportAllevamentoPerPartita}
                  disabled={
                    reportAllevamentoPerPartitaLoading ||
                    reportAllevamentoLoading ||
                    (!reportAllevamentoFilters.usa_range && !reportAllevamentoFilters.data_uscita) ||
                    (reportAllevamentoFilters.usa_range &&
                      (!reportAllevamentoFilters.data_uscita_da || !reportAllevamentoFilters.data_uscita_a)) ||
                    (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id)
                  }
                >
                  {reportAllevamentoPerPartitaLoading ? 'Generazione...' : 'Stampa per partita'}
                </button>
              </div>
            </div>
            </div>
            )}

            {/* Step 3b: Blocco per "Per partita / insiemi di partite" (nascosto se tipo = per_data) */}
            {reportAllevamentoTipo === 'per_partite' && (
            <div className="report-allevamento-section-block">
              <label className="report-step-label">Partite di ingresso (solo dall’esterno)</label>
              <p className="report-description">
                Apri la modale per scegliere una o più partite di ingresso. Verranno mostrate solo le partite dall’esterno (escluse i trasferimenti interni).
              </p>
              <div className="report-header-buttons" style={{ marginTop: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleOpenModalPartite}
                  disabled={
                    (reportAllevamentoFilters.tipo_selezione === 'azienda' && !aziendaId) ||
                    (reportAllevamentoFilters.tipo_selezione === 'contratto' && !reportAllevamentoFilters.contratto_id)
                  }
                >
                  Seleziona partite di ingresso
                </button>
                {selectedPartitaIds.length > 0 && (
                  <span className="report-partite-badge">{selectedPartitaIds.length} partita/e selezionate</span>
                )}
              </div>
              {selectedPartitaIds.length > 0 && (
                <div className="report-header-buttons" style={{ marginTop: '12px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handleGenerateReportByPartiteSelezionate}
                    disabled={reportPerPartiteSelezionateLoading}
                  >
                    {reportPerPartiteSelezionateLoading ? 'Generazione...' : 'Genera report per partite selezionate'}
                  </button>
                </div>
              )}
            </div>
            )}

            {/* Modale selezione partite (solo esterne) */}
            <BaseModal
              isOpen={showModalPartiteSelezione}
              onClose={() => setShowModalPartiteSelezione(false)}
              headerLeft={
                <div className="report-modal-header-left">
                  <span className="report-modal-title">Seleziona partite di ingresso</span>
                  <span className="report-modal-subtitle">Solo partite dall’esterno (no trasferimenti interni)</span>
                </div>
              }
              footerActions={
                <>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowModalPartiteSelezione(false)}>
                    Annulla
                  </button>
                  <button type="button" className="btn btn-primary" onClick={() => setShowModalPartiteSelezione(false)}>
                    Conferma ({selectedPartitaIds.length} selezionate)
                  </button>
                </>
              }
              size="large"
            >
              <div className="report-modal-partite-body">
                {loadingPartiteIngresso ? (
                  <p className="loading-message">Caricamento partite...</p>
                ) : partiteIngresso.length === 0 ? (
                  <p className="form-help-text">Nessuna partita di ingresso dall’esterno trovata per l’ambito selezionato.</p>
                ) : (
                  <>
                    <div className="report-modal-partite-actions">
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedPartitaIds(partiteIngresso.map(p => p.id))}>
                        Seleziona tutte
                      </button>
                      <button type="button" className="btn btn-sm btn-secondary" onClick={() => setSelectedPartitaIds([])}>
                        Deseleziona tutte
                      </button>
                      <span className="form-help-text" style={{ margin: 0 }}>{selectedPartitaIds.length} di {partiteIngresso.length} selezionate</span>
                    </div>
                    <div className="report-modal-partite-list">
                      {partiteIngresso.map((p) => {
                        const id = p.id;
                        const checked = selectedPartitaIds.includes(id);
                        const dataStr = p.data ? new Date(p.data).toLocaleDateString('it-IT') : 'N/A';
                        const label = `${p.numero_partita || 'Partita ' + id} — ${dataStr} — ${(p.nome_stalla || p.codice_stalla || '').slice(0, 35)} (${p.numero_capi || 0} capi)`;
                        return (
                          <label key={id} className="report-modal-partite-row">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setSelectedPartitaIds(prev =>
                                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                                );
                              }}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </BaseModal>
          </div>
        )}

        {/* REPORT 4: Report Prima Nota - Dare/Avere per Fornitore/Cliente */}
        {activeTab === 'prima_nota' && (
          <div className="report-tab-content">
            <div className="report-section-header">
              <div className="report-header-content">
                <div>
                  <h3>Report Prima Nota - Dare/Avere per Fornitore/Cliente</h3>
                  <p className="report-description">
                    Genera un PDF con il riepilogo dare/avere per un fornitore o cliente specifico (PDF)
                  </p>
                </div>
                <button
                  className="btn btn-primary report-header-button"
                  onClick={handleGenerateReportPrimaNota}
                  disabled={reportPrimaNotaLoading || !reportPrimaNotaFilters.contropartita_nome}
                >
                  {reportPrimaNotaLoading ? 'Generazione in corso...' : 'Genera Report PDF'}
                </button>
              </div>
            </div>
        
            <div className="filters">
              <div className="form-group">
                <label>Fornitore/Cliente *</label>
                {loadingContropartite ? (
                  <div className="loading-message">Caricamento...</div>
                ) : (
                  <SimpleSelect
                    value={reportPrimaNotaFilters.contropartita_nome}
                    onChange={(e) => {
                      setReportPrimaNotaFilters({
                        ...reportPrimaNotaFilters,
                        contropartita_nome: e.target.value,
                      });
                    }}
                    disabled={!contropartite.length}
                    options={contropartite.map((nome) => ({
                      label: nome,
                      value: nome,
                    }))}
                    placeholder="Seleziona fornitore/cliente"
                  />
                )}
                {contropartite.length === 0 && !loadingContropartite && (
                  <small className="form-help-text">
                    Nessuna contropartita disponibile
                  </small>
                )}
              </div>
              
              <div className="form-group">
                <label>Data Da (opzionale)</label>
                <input
                  type="date"
                  value={reportPrimaNotaFilters.data_da}
                  onChange={(e) => {
                    setReportPrimaNotaFilters({
                      ...reportPrimaNotaFilters,
                      data_da: e.target.value,
                    });
                  }}
                />
              </div>
              
              <div className="form-group">
                <label>Data A (opzionale)</label>
                <input
                  type="date"
                  value={reportPrimaNotaFilters.data_a}
                  onChange={(e) => {
                    setReportPrimaNotaFilters({
                      ...reportPrimaNotaFilters,
                      data_a: e.target.value,
                    });
                  }}
                  min={reportPrimaNotaFilters.data_da || undefined}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Report;