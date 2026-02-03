/**
 * Service for Amministrazione module API calls
 * Usa hybridDataService per letture (database locale) e API per scritture/operazioni speciali
 */
import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';
import { clearCache } from '../../../services/prefetchCache';
import { setCachedFatture } from '../prefetchers';

// Chiavi cache per invalidazione dopo CRUD
const FATTURE_CACHE_KEY_PREFIX = 'amministrazione/fatture';
const PARTITE_CACHE_KEY_PREFIX = 'amministrazione/partite';

// Helper per invalidare cache fatture
const invalidateFattureCache = (aziendaId) => {
  if (aziendaId) {
    clearCache(`${FATTURE_CACHE_KEY_PREFIX}?azienda_id=${aziendaId}&limit=1000`);
  }
  // Invalida anche senza aziendaId per sicurezza
  clearCache(`${FATTURE_CACHE_KEY_PREFIX}?azienda_id=__none__&limit=1000`);
};

// Helper per invalidare cache partite
const invalidatePartiteCache = (aziendaId) => {
  if (aziendaId) {
    clearCache(`${PARTITE_CACHE_KEY_PREFIX}?azienda_id=${aziendaId}`);
  }
};

export const amministrazioneService = {
  // Endpoint batch per caricare tutti i dati iniziali in una chiamata
  getInitData: (aziendaId) =>
    api.get('/amministrazione/init-data', { azienda_id: aziendaId }),

  // Fornitori - usa database locale per letture base
  getFornitori: async (params = {}) => {
    const queryParams = {
      include_tipi: params.include_tipi !== undefined ? params.include_tipi : false,
      skip: params.skip || 0,
      limit: params.limit || 100,
      azienda_id: params.azienda_id || null,
    };
    
    // Use persistent cache for base list (no filters, no pagination)
    const isBaseList = !params.azienda_id && params.skip === 0 && (params.limit === 100 || !params.limit);
    if (isBaseList && !params.force) {
      const { getOrSet, CACHE_KEYS } = await import('../../../services/persistentCache');
      return getOrSet(
        CACHE_KEYS.FORNITORI,
        () => api.get('/amministrazione/fornitori/', queryParams),
        { force: params.force, ttl: 7 * 24 * 60 * 60 * 1000 } // 7 giorni
      );
    }
    
    return api.get('/amministrazione/fornitori/', queryParams);
  },
  getFornitore: async (id) => hybridDataService.getFornitore(id),
  createFornitore: async (data) => {
    const result = await hybridDataService.insertFornitore(data);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI);
    return result;
  },
  updateFornitore: async (id, data) => {
    const result = await hybridDataService.updateFornitore(id, data);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI);
    return result;
  },
  deleteFornitore: async (id) => {
    const result = await hybridDataService.deleteFornitore(id);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI);
    return result;
  },

  // Fornitori Tipi
  getFornitoriTipi: async (categoria = null, fornitoreId = null, options = {}) => {
    // Use persistent cache for base list (no filters)
    if (!categoria && !fornitoreId && !options.force) {
      const { getOrSet, CACHE_KEYS } = await import('../../../services/persistentCache');
      return getOrSet(
        CACHE_KEYS.FORNITORI_TIPI,
        () => api.get('/amministrazione/fornitori-tipi', { categoria, fornitore_id: fornitoreId }),
        { force: options.force, ttl: 7 * 24 * 60 * 60 * 1000 } // 7 giorni
      );
    }
    return api.get('/amministrazione/fornitori-tipi', { categoria, fornitore_id: fornitoreId });
  },
  getFornitoreTipo: (id) => api.get(`/amministrazione/fornitori-tipi/${id}`),
  createFornitoreTipo: async (data) => {
    const result = await api.post('/amministrazione/fornitori-tipi', data);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI_TIPI);
    return result;
  },
  updateFornitoreTipo: async (id, data) => {
    const result = await api.put(`/amministrazione/fornitori-tipi/${id}`, data);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI_TIPI);
    return result;
  },
  deleteFornitoreTipo: async (id) => {
    const result = await api.delete(`/amministrazione/fornitori-tipi/${id}`);
    // Invalidate cache
    const { clear, CACHE_KEYS } = await import('../../../services/persistentCache');
    clear(CACHE_KEYS.FORNITORI_TIPI);
    return result;
  },

  // Vendite Prodotti Agricoli
  getVenditeProdotti: (filters = {}) => api.get('/amministrazione/vendite-prodotti', filters),
  getVenditaProdotto: (id) => api.get(`/amministrazione/vendite-prodotti/${id}`),
  createVenditaProdotto: (data) => api.post('/amministrazione/vendite-prodotti', data),
  updateVenditaProdotto: (id, data) => api.put(`/amministrazione/vendite-prodotti/${id}`, data),
  deleteVenditaProdotto: (id) => api.delete(`/amministrazione/vendite-prodotti/${id}`),

  // Prodotti Derivati
  getProdottiDerivati: (filters = {}) => api.get('/amministrazione/prodotti-derivati', filters),
  getProdottoDerivato: (id) => api.get(`/amministrazione/prodotti-derivati/${id}`),
  createProdottoDerivato: (data) => api.post('/amministrazione/prodotti-derivati', data),
  updateProdottoDerivato: (id, data) => api.put(`/amministrazione/prodotti-derivati/${id}`, data),
  deleteProdottoDerivato: (id) => api.delete(`/amministrazione/prodotti-derivati/${id}`),

  // Fatture Amministrazione - usa database locale per letture
  getFatture: async (filters = {}) => hybridDataService.getFatture(filters),
  getFattura: async (id) => hybridDataService.getFattura(id),
  createFattura: async (data) => {
    const result = await hybridDataService.insertFattura(data);
    // Invalida cache dopo creazione
    invalidateFattureCache(data.azienda_id);
    return result;
  },
  updateFattura: async (id, data) => {
    const result = await hybridDataService.updateFattura(id, data);
    // Invalida cache dopo aggiornamento
    invalidateFattureCache(data.azienda_id);
    return result;
  },
  deleteFattura: async (id, aziendaId = null) => {
    const result = await hybridDataService.deleteFattura(id);
    // Invalida cache dopo eliminazione
    invalidateFattureCache(aziendaId);
    return result;
  },

  // Classificatore ML per categorie
  prediciCategoriaFattura: (data = {}) => 
    api.post('/amministrazione/fatture/predici-categoria', data),

  // Partite Animali
  getPartite: async (filters = {}, options = {}) => hybridDataService.getPartite(filters, options),
  getPartiteAnimale: (auricolare) => api.get(`/amministrazione/animali/${auricolare}/partite`),
  getPartita: async (id) => hybridDataService.getPartita(id),
  getPartitaAnimali: (id) => api.get(`/amministrazione/partite/${id}/animali`), // Query complessa, sempre online
  createPartita: async (data) => {
    const result = await hybridDataService.insertPartita(data);
    // Invalida cache dopo creazione
    invalidatePartiteCache(data.azienda_id);
    return result;
  },
  updatePartita: async (id, data) => {
    const result = await hybridDataService.updatePartita(id, data);
    // Invalida cache dopo aggiornamento
    invalidatePartiteCache(data.azienda_id);
    return result;
  },
  deletePartita: async (id, aziendaId = null) => {
    const result = await hybridDataService.deletePartita(id);
    // Invalida cache dopo eliminazione
    invalidatePartiteCache(aziendaId);
    return result;
  },
  
  // Movimenti Finanziari Partite
  createPartitaMovimentoFinanziario: (partitaId, data) => 
    api.post(`/amministrazione/partite/${partitaId}/movimenti-finanziari`, data),
  updatePartitaMovimentoFinanziario: (movimentoId, data) => 
    api.put(`/amministrazione/partite/movimenti-finanziari/${movimentoId}`, data),
  deletePartitaMovimentoFinanziario: (movimentoId) => 
    api.delete(`/amministrazione/partite/movimenti-finanziari/${movimentoId}`),

  // Sincronizzazione Anagrafe
  sincronizzaAnagrafe: (file, aziendaId) => {
    const formData = new FormData();
    formData.append('file', file);
    // Non impostare Content-Type manualmente - il browser lo farà automaticamente con il boundary
    // Timeout aumentato a 5 minuti (300000ms) per permettere il processamento di file grandi
    return api.post(`/amministrazione/sincronizza-anagrafe?azienda_id=${aziendaId}`, formData, {
      timeout: 300000 // 5 minuti (300000ms) - sufficiente per processare file anche molto grandi
    });
  },

  // Conferma partita anagrafe
  confirmPartita: (partitaData) => {
    return api.post('/amministrazione/partite/confirm', partitaData);
  },

  // Conferma gruppo decessi anagrafe
  confirmGruppoDecessi: (gruppoData) => {
    return api.post('/amministrazione/gruppi-decessi/confirm', gruppoData);
  },

  // Report
  getReportSintesiVendite: (filters = {}) => 
    api.get('/amministrazione/report/sintesi-vendite', filters),
  getReportFattureScadenza: (giorni = 30) => 
    api.get('/amministrazione/report/fatture-scadenza', { giorni }),
  getReportLayoutPreview: (aziendaId = null) =>
    api.get(
      '/amministrazione/report/layout-preview',
      { azienda_id: aziendaId },
      { responseType: 'blob' }
    ),
  
  // Report Allevamento
  getDatesUscitaAllevamento: (params = {}) =>
    api.get('/amministrazione/report/allevamento/dates-uscita', params),
  getTipoDaDataUscita: (params = {}) =>
    api.get('/amministrazione/report/allevamento/tipo-da-data', params),
  getFattureAccontoContratto: (contrattoId) =>
    api.get(`/amministrazione/report/allevamento/fatture-acconto/${contrattoId}`),

  getReportAllevamento: (params = {}) =>
    api.get(
      '/amministrazione/report/allevamento',
      params,
      { responseType: 'blob' }
    ),
  
  // Report Prima Nota Dare/Avere
  getContropartitePrimaNota: (aziendaId) =>
    api.get('/amministrazione/report/prima-nota/contropartite', { azienda_id: aziendaId }),
  getReportPrimaNotaDareAvere: (params = {}) =>
    api.get(
      '/amministrazione/report/prima-nota/dare-avere',
      params,
      { responseType: 'blob' }
    ),

  // Fatture Emesse
  getFattureEmesse: (aziendaId, filters = {}) => 
    api.get('/amministrazione/fatture-emesse', { azienda_id: aziendaId, ...filters }),
  getFatturaEmessa: (id) => api.get(`/amministrazione/fatture-emesse/${id}`),
  createFatturaEmessa: (data) => api.post('/amministrazione/fatture-emesse', data),
  updateFatturaEmessa: (id, data) => api.put(`/amministrazione/fatture-emesse/${id}`, data),
  deleteFatturaEmessa: (id) => api.delete(`/amministrazione/fatture-emesse/${id}`),

  // Prima Nota - Nuovo modello
  getPrimaNotaSetup: async (aziendaId) => {
    try {
      const response = await api.get('/amministrazione/prima-nota/setup', { azienda_id: aziendaId });
      // Se la risposta ha dati, usala
      if (response && (response.conti?.length > 0 || Array.isArray(response))) {
        return response;
      }
    } catch (error) {
      // Se errore 503 o altro, usa fallback locale
      // Silenzioso - usa fallback locale
    }
    
    // Fallback: usa dati locali
    try {
      const conti = await hybridDataService.getPNConti({ azienda_id: aziendaId });
      const categorie = await hybridDataService.getPNCategorie({ azienda_id: aziendaId });
      
      return {
        conti: Array.isArray(conti) ? conti : [],
        categorie: Array.isArray(categorie) ? categorie : [],
        preferenze: {}, // Preferenze non sono nel database locale, usa default
      };
    } catch (localError) {
      return { conti: [], categorie: [], preferenze: {} };
    }
  },
  getPrimaNotaMovimenti: async (aziendaId, filters = {}) =>
    hybridDataService.getPNMovimenti({ azienda_id: aziendaId, ...filters }),
  getPrimaNotaMovimento: async (movimentoId) =>
    api.get(`/amministrazione/prima-nota/movimenti/${movimentoId}`),
  // Conti Prima Nota: sempre via API quando si usa il backend (Fly.io), così create/update/delete
  // persistono sul server e la lista da getPrimaNotaSetup li include
  createPrimaNotaConto: async (data) => {
    const res = await api.post('/amministrazione/prima-nota/conti', data);
    return res?.data ?? res;
  },
  updatePrimaNotaConto: async (id, data) => {
    const res = await api.put(`/amministrazione/prima-nota/conti/${id}`, data);
    return res?.data ?? res;
  },
  deletePrimaNotaConto: async (id) =>
    api.delete(`/amministrazione/prima-nota/conti/${id}`),
  createPrimaNotaContoIban: async (contoId, data) => {
    const res = await api.post(`/amministrazione/prima-nota/conti/${contoId}/iban`, data);
    return res?.data ?? res;
  },
  updatePrimaNotaContoIban: async (ibanId, data) => {
    const res = await api.put(`/amministrazione/prima-nota/conti/iban/${ibanId}`, data);
    return res?.data ?? res;
  },
  deletePrimaNotaContoIban: async (ibanId) =>
    api.delete(`/amministrazione/prima-nota/conti/iban/${ibanId}`),
  createPrimaNotaMovimento: async (data) =>
    hybridDataService.insertPNMovimento(data),
  registraAccontoSoccida: async (data) =>
    api.post('/amministrazione/prima-nota/soccida-acconto', data), // Sempre online (operazione speciale)
  // Timeout 5 min: la sync può richiedere molto tempo con molte fatture
  syncPrimaNotaFatture: async (aziendaId) =>
    api.post('/amministrazione/prima-nota/sync-fatture', null, {
      params: aziendaId != null ? { azienda_id: aziendaId } : {},
      timeout: 300000,
    }),
  updatePrimaNotaMovimento: async (id, data) =>
    hybridDataService.updatePNMovimento(id, data),
  deletePrimaNotaMovimento: async (id) =>
    hybridDataService.deletePNMovimento(id),
  confirmPrimaNotaMovimento: (id) =>
    api.post(`/amministrazione/prima-nota/movimenti/${id}/conferma`, {}), // Sempre online (operazione speciale)
  createPrimaNotaGiroconto: (data) =>
    api.post('/amministrazione/prima-nota/giroconto', data), // Sempre online (operazione speciale)
  getPrimaNotaDocumenti: async (aziendaId, filters = {}) =>
    hybridDataService.getPrimaNotaDocumenti(aziendaId), // Usa database locale per performance ottimali
  confirmGruppoDecessi: (data) =>
    api.post('/amministrazione/gruppi-decessi/confirm', data),

  // Attrezzature - usa database locale per letture
  getAttrezzature: async (aziendaId, filters = {}) => 
    hybridDataService.getAttrezzature({ azienda_id: aziendaId, ...filters }),
  getAttrezzatura: async (id) => hybridDataService.getAttrezzatura(id),
  createAttrezzatura: async (data) => hybridDataService.insertAttrezzatura(data),
  updateAttrezzatura: async (id, data) => hybridDataService.updateAttrezzatura(id, data),
  deleteAttrezzatura: async (id) => hybridDataService.deleteAttrezzatura(id),
  getAttrezzatureCosti: (aziendaId) =>
    api.get('/amministrazione/attrezzature/costi-riepilogo', { azienda_id: aziendaId }),

  // Scadenze Attrezzature
  getScadenzeAttrezzatura: (attrezzaturaId, filters = {}) => 
    api.get(`/amministrazione/attrezzature/${attrezzaturaId}/scadenze`, filters),
  createScadenzaAttrezzatura: (attrezzaturaId, data) => 
    api.post(`/amministrazione/attrezzature/${attrezzaturaId}/scadenze`, data),
  updateScadenzaAttrezzatura: (id, data) => 
    api.put(`/amministrazione/scadenze-attrezzature/${id}`, data),
  deleteScadenzaAttrezzatura: (id) => 
    api.delete(`/amministrazione/scadenze-attrezzature/${id}`),

  // Ammortamenti
  getAmmortamentiAttrezzatura: (attrezzaturaId, filters = {}) => 
    api.get(`/amministrazione/attrezzature/${attrezzaturaId}/ammortamenti`, filters),
  createAmmortamento: (attrezzaturaId, data) => 
    api.post(`/amministrazione/attrezzature/${attrezzaturaId}/ammortamenti`, data),
  updateAmmortamento: (id, data) => 
    api.put(`/amministrazione/ammortamenti/${id}`, data),
  deleteAmmortamento: (id) => 
    api.delete(`/amministrazione/ammortamenti/${id}`),

  // Assicurazioni Aziendali
  getAssicurazioniAziendali: async (aziendaId, filters = {}) => 
    hybridDataService.getAssicurazioni({ azienda_id: aziendaId, ...filters }),
  getAssicurazioneAziendale: async (id) => {
    // Cerca nel database locale
    const assicurazioni = await hybridDataService.getAssicurazioni({ id });
    return assicurazioni && assicurazioni.length > 0 ? assicurazioni[0] : null;
  },
  createAssicurazioneAziendale: async (data) => hybridDataService.insertAssicurazione(data),
  updateAssicurazioneAziendale: async (id, data) => hybridDataService.updateAssicurazione(id, data),
  deleteAssicurazioneAziendale: async (id) => hybridDataService.deleteAssicurazione(id),

  // Import Fatture
  importFattureEmesse: (file, aziendaId, skipDuplicates = true) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/amministrazione/import/fatture-emesse?azienda_id=${aziendaId}&skip_duplicates=${skipDuplicates}`, formData);
  },
  importFattureAmministrazione: (file, aziendaId, skipDuplicates = true) => {
    const formData = new FormData();
    formData.append('file', file);
    const params = new URLSearchParams();
    if (aziendaId) {
      params.append('azienda_id', aziendaId);
    }
    params.append('skip_duplicates', skipDuplicates ? 'true' : 'false');
    return api.post(`/amministrazione/import/fatture-amministrazione?${params.toString()}`, formData);
  },
  importFattureXML: (file, skipDuplicates = true) => {
    const formData = new FormData();
    formData.append('file', file);
    // Timeout aumentato a 10 minuti (600000ms) per permettere l'importazione di file ZIP grandi con molti XML
    // Per file di ~11MB con 295 elementi, potrebbe richiedere diversi minuti
    return api.post(`/amministrazione/import/fatture-xml?skip_duplicates=${skipDuplicates}`, formData);
  },
  importFattureXMLStream: (file, skipDuplicates = true, onProgress = null, onComplete = null, onError = null) => {
    // Usa fetch direttamente per supportare SSE
    const formData = new FormData();
    formData.append('file', file);
    
    // Ottieni l'URL base dall'API service
    const API_BASE_URL = 'https://regifarm-backend.fly.dev/api/v1'; // Backend su fly.io
    const url = `${API_BASE_URL}/amministrazione/import/fatture-xml-stream?skip_duplicates=${skipDuplicates}`;
    
    // Ottieni il token di autenticazione se presente
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    const headers = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    
    return fetch(url, {
      method: 'POST',
      headers: headers,
      body: formData
    }).then(response => {
      if (!response.ok) {
        return response.text().then(text => {
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.detail || errorData.error || `HTTP error! status: ${response.status}`);
          } catch {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
        });
      }
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      
      const processStream = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            // Se non abbiamo ricevuto un messaggio di complete, potrebbe essere un errore
            if (onError && buffer.trim()) {
              try {
                const data = JSON.parse(buffer.trim());
                if (data.type === 'error') {
                  onError(data.error);
                }
              } catch (e) {
                // Ignora errori di parsing
              }
            }
            return;
          }
          
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Mantieni l'ultima linea incompleta
          
          for (const line of lines) {
            if (line.trim() && line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                
                if (data.type === 'progress' && onProgress) {
                  onProgress(data);
                } else if (data.type === 'complete' && onComplete) {
                  onComplete(data.result);
                  return; // Termina dopo il completamento
                } else if (data.type === 'error' && onError) {
                  onError(data.error);
                  return; // Termina dopo l'errore
                } else if (data.type === 'start' && onProgress) {
                  onProgress({ type: 'start', message: data.message });
                }
              } catch (e) {
                // Errore parsing SSE - silenzioso
              }
            }
          }
          
          processStream();
        }).catch(error => {
          if (onError) {
            onError(error.message || 'Errore durante la lettura dello stream');
          }
        });
      };
      
      processStream();
    }).catch(error => {
      if (onError) {
        onError(error.message || 'Errore durante la richiesta');
      }
    });
  },

  // Contratti Soccida
  getContrattiSoccida: async (filters = {}) => 
    hybridDataService.getContrattiSoccida(filters),
  getContrattiSoccidaRiepilogo: (filters = {}) => 
    api.get('/amministrazione/contratti-soccida/riepilogo', filters), // Riepilogo complesso, rimane online
  getContrattoSoccida: async (id, params = {}) =>
    hybridDataService.getContrattoSoccida(id),
  createContrattoSoccida: async (data) => hybridDataService.insertContrattoSoccida(data),
  updateContrattoSoccida: async (id, data) => hybridDataService.updateContrattoSoccida(id, data),
  deleteContrattoSoccida: async (id) => hybridDataService.deleteContrattoSoccida(id),
  getSoccidanti: () => api.get('/amministrazione/soccidanti'),
  getAnimaliContratto: (contrattoId) => 
    api.get(`/amministrazione/contratti-soccida/${contrattoId}/animali`),
  associaAnimaliContratto: (contrattoId, animaleIds, options = {}) => {
    const payload = { animale_ids: animaleIds };
    if (options.pesi_animali) payload.pesi_animali = options.pesi_animali;
    if (options.peso_totale !== undefined) payload.peso_totale = options.peso_totale;
    if (options.peso_medio !== undefined) payload.peso_medio = options.peso_medio;
    if (options.data_cambio) payload.data_cambio = options.data_cambio;
    if (options.note) payload.note = options.note;
    return api.post(`/amministrazione/contratti-soccida/${contrattoId}/animali`, payload);
  },
  disassociaAnimaleContratto: (contrattoId, animaleId, options = {}) => {
    const params = {};
    if (options.peso_ingresso !== undefined) params.peso_ingresso = options.peso_ingresso;
    if (options.data_cambio) params.data_cambio = options.data_cambio;
    if (options.note) params.note = options.note;
    return api.delete(`/amministrazione/contratti-soccida/${contrattoId}/animali/${animaleId}`, { params });
  },
  getPartiteContratto: (contrattoId) =>
    api.get(`/amministrazione/contratti-soccida/${contrattoId}/partite`),
  associaPartiteContratto: (contrattoId, partitaIds, cascadeAnimali = true) =>
    api.post(`/amministrazione/contratti-soccida/${contrattoId}/partite`, { partita_ids: partitaIds, cascade_animali: cascadeAnimali }),
  disassociaPartitaContratto: (contrattoId, partitaId) =>
    api.delete(`/amministrazione/contratti-soccida/${contrattoId}/partite/${partitaId}`),
  sincronizzaModalitaGestionePartite: (aziendaId = null) =>
    api.post('/amministrazione/contratti-soccida/sincronizza-modalita-gestione', null, {
      params: aziendaId ? { azienda_id: aziendaId } : {}
    }),
  
  // Polizze Attrezzature
  getPolizzeAttrezzature: (params = {}) =>
    api.get('/amministrazione/polizze-attrezzature', { params }),
  getPolizzaAttrezzatura: (id) =>
    api.get(`/amministrazione/polizze-attrezzature/${id}`),
  createPolizzaAttrezzatura: (data) =>
    api.post('/amministrazione/polizze-attrezzature', data),
  updatePolizzaAttrezzatura: (id, data) =>
    api.put(`/amministrazione/polizze-attrezzature/${id}`, data),
  deletePolizzaAttrezzatura: (id) =>
    api.delete(`/amministrazione/polizze-attrezzature/${id}`),
  getPolizzaPagamenti: (polizzaId) =>
    api.get(`/amministrazione/polizze-attrezzature/${polizzaId}/pagamenti`),
  createPolizzaPagamento: (polizzaId, data) =>
    api.post(`/amministrazione/polizze-attrezzature/${polizzaId}/pagamenti`, data),
  updatePolizzaPagamento: (polizzaId, pagamentoId, data) =>
    api.put(`/amministrazione/polizze-attrezzature/${polizzaId}/pagamenti/${pagamentoId}`, data),
  deletePolizzaPagamento: (polizzaId, pagamentoId) =>
    api.delete(`/amministrazione/polizze-attrezzature/${polizzaId}/pagamenti/${pagamentoId}`),
  getPolizzaRinnovi: (polizzaId) =>
    api.get(`/amministrazione/polizze-attrezzature/${polizzaId}/rinnovi`),
  createPolizzaRinnovo: (polizzaId, data) =>
    api.post(`/amministrazione/polizze-attrezzature/${polizzaId}/rinnovi`, data),
  updatePolizzaRinnovo: (polizzaId, rinnovoId, data) =>
    api.put(`/amministrazione/polizze-attrezzature/${polizzaId}/rinnovi/${rinnovoId}`, data),
  deletePolizzaRinnovo: (polizzaId, rinnovoId) =>
    api.delete(`/amministrazione/polizze-attrezzature/${polizzaId}/rinnovi/${rinnovoId}`),

  // Categorie Prima Nota unificate
  getCategoriePrimaNota: (aziendaId, tipoOperazione = null, attiveOnly = true) =>
    api.get('/prima-nota/categorie', {
      azienda_id: aziendaId,
      tipo_operazione: tipoOperazione,
      attive_only: attiveOnly,
    }),
  createCategoriaPrimaNota: (data) =>
    api.post('/prima-nota/categorie', data),
  updateCategoriaPrimaNota: (categoriaId, data) =>
    api.put(`/prima-nota/categorie/${categoriaId}`, data),
  deleteCategoriaPrimaNota: (categoriaId) =>
    api.delete(`/prima-nota/categorie/${categoriaId}`),
};

