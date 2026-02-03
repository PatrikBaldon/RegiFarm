/**
 * Service for Allevamento module API calls
 * Usa hybridDataService per letture (database locale) e API per scritture/operazioni speciali
 */
import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';

export const allevamentoService = {
  // Sedi - usa database locale per letture
  getSedi: async (aziendaId, options = {}) => {
    const { signal, include_stabilimenti, include_box, ...restOptions } = options;
    // Se include_stabilimenti o include_box, usa API (query complessa)
    if (include_stabilimenti || include_box) {
      return api.get('/allevamento/sedi', { 
        azienda_id: aziendaId,
        include_stabilimenti: include_stabilimenti || false,
        include_box: include_box || false,
      }, { signal, ...restOptions });
    }
    // Altrimenti usa database locale
    return hybridDataService.getSedi({ azienda_id: aziendaId });
  },
  getSediCount: (aziendaId) => api.get('/allevamento/sedi/count', { azienda_id: aziendaId }),
  getSede: async (id) => hybridDataService.getSede(id),
  createSede: async (data) => hybridDataService.insertSede(data),
  updateSede: async (id, data) => hybridDataService.updateSede(id, data),
  deleteSede: async (id) => hybridDataService.deleteSede(id),

  // Codici Stalla Gestiti - sempre online (calcolo complesso)
  getCodiciStallaGestiti: (aziendaId) => api.get('/allevamento/codici-stalla-gestiti', { azienda_id: aziendaId }),

  // Stabilimenti - usa database locale per letture
  getStabilimenti: async (sedeId, options = {}) => {
    const { signal, ...restOptions } = options;
    // Usa database locale se disponibile
    return hybridDataService.getStabilimenti({ sede_id: sedeId });
  },
  getStabilimento: async (id) => hybridDataService.getStabilimento(id),
  createStabilimento: async (data) => hybridDataService.insertStabilimento(data),
  updateStabilimento: async (id, data) => hybridDataService.updateStabilimento(id, data),
  deleteStabilimento: async (id) => hybridDataService.deleteStabilimento(id),

  // Box - usa database locale per letture
  getBox: async (stabilimentoId, options = {}) => {
    const { signal, ...restOptions } = options;
    // Usa database locale se disponibile
    return hybridDataService.getBox({ stabilimento_id: stabilimentoId });
  },
  getBoxDetail: async (id) => hybridDataService.getBoxDetail(id),
  createBox: async (data) => hybridDataService.insertBox(data),
  updateBox: async (id, data) => hybridDataService.updateBox(id, data),
  deleteBox: async (id) => hybridDataService.deleteBox(id),

  // Animali - usa database locale per letture
  getAnimali: async (filters = {}, options = {}) => {
    const { signal, ...restOptions } = options;
    // Usa database locale se disponibile
    return hybridDataService.getAnimali(filters);
  },
  getAnimale: async (id) => {
    // Usa database locale se disponibile
    return hybridDataService.getAnimale(id);
  },
  getAnimaleDetail: (id) => api.get(`/allevamento/animali/${id}/detail`), // Sempre online (dati complessi)
  createAnimale: async (data) => hybridDataService.insertAnimale(data),
  updateAnimale: async (id, data, updatePartita = false) => {
    // Se updatePartita è true, usa API direttamente per passare il parametro
    if (updatePartita) {
      return api.put(`/allevamento/animali/${id}?update_partita=true`, data);
    }
    // Altrimenti usa hybridDataService per scritture (locale + sync)
    return hybridDataService.updateAnimale(id, data);
  },
  checkAnimaleUpdateImpact: async (id, updateData) => {
    return api.post(`/allevamento/animali/${id}/check-update-impact`, updateData);
  },
  updateValoreDecesso: (animaleId, valoreCapo) => 
    api.put(`/allevamento/animali/${animaleId}/decesso/valore`, { valore_capo: valoreCapo }),
  updateResponsabileDecesso: (animaleId, responsabile) => 
    api.put(`/allevamento/animali/${animaleId}/decesso/responsabile`, { responsabile }),
  updateValorePartita: (animaleId, data) => 
    api.put(`/allevamento/animali/${animaleId}/partita/valore`, data),
  updateValoreAnimale: (animaleId, valore, extendToPartita = false) => 
    api.put(`/allevamento/animali/${animaleId}/valore`, { valore, extend_to_partita: extendToPartita }),

  // Movimentazioni
  createMovimentazione: async (data) => hybridDataService.insertMovimentazione(data),
  getMovimentazioniAnimale: async (animaleId) => hybridDataService.getMovimentazioni({ animale_id: animaleId }),

  // Piani di Uscita
  getPianiUscita: (params = {}) => api.get('/allevamento/piani-uscita', params),
  getPianoUscita: (id) => api.get(`/allevamento/piani-uscita/${id}`),
  createPianoUscita: (data) => api.post('/allevamento/piani-uscita', data),
  updatePianoUscita: (id, data) => api.put(`/allevamento/piani-uscita/${id}`, data),
  deletePianoUscita: (id) => api.delete(`/allevamento/piani-uscita/${id}`),
  addAnimaliToPiano: (pianoId, animaleIds) =>
    api.post(`/allevamento/piani-uscita/${pianoId}/animali`, { animale_ids: animaleIds }),
  removeAnimaleFromPiano: (pianoId, animaleId) =>
    api.delete(`/allevamento/piani-uscita/${pianoId}/animali/${animaleId}`),

  // Piano Uscita PDF
  generatePianoUscitaPDF: async (animaleIds) => {
    const response = await fetch(`https://regifarm-backend.fly.dev/api/v1/allevamento/piano-uscita/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ animale_ids: animaleIds }),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: response.statusText }));
      throw new Error(error.detail || `HTTP error! status: ${response.status}`);
    }
    
    const blob = await response.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Usa Electron IPC per salvare il file
    const { ipcRenderer } = require('electron');
    const defaultFilename = `piano_uscita_${new Date().toISOString().slice(0, 10)}.pdf`;
    
    const result = await ipcRenderer.invoke('save-pdf', buffer, defaultFilename);
    
    if (result.success) {
      return result.path;
    } else if (result.canceled) {
      throw new Error('Salvataggio annullato');
    } else {
      throw new Error(result.error || 'Errore nel salvataggio del file');
    }
  },
};

