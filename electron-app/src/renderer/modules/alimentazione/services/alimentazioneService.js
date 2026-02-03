import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';

export const alimentazioneService = {
  // Fatture - usa database locale per letture
  getFatture: async (params = {}) => hybridDataService.getFatture(params),
  getFattura: async (id) => hybridDataService.getFattura(id),
  createFattura: async (data) => hybridDataService.insertFattura(data),
  updateFattura: async (id, data) => hybridDataService.updateFattura(id, data),
  deleteFattura: async (id) => hybridDataService.deleteFattura(id),

  // Componenti Alimentari - usa database locale per letture
  getComponenti: async (params = {}) => hybridDataService.getComponentiAlimentari(params),
  getComponente: (id) => api.get(`/componenti-alimentari/${id}`), // Dettaglio sempre online
  createComponente: (data) => api.post('/componenti-alimentari', data),
  updateComponente: (id, data) => api.put(`/componenti-alimentari/${id}`, data),
  deleteComponente: (id) => api.delete(`/componenti-alimentari/${id}`),

  // Mangimi Confezionati - usa database locale per letture
  getMangimi: async (params = {}) => hybridDataService.getMangimi(params),
  getMangime: (id) => api.get(`/mangimi-confezionati/${id}`), // Dettaglio sempre online
  createMangime: (data) => api.post('/mangimi-confezionati', data),
  updateMangime: (id, data) => api.put(`/mangimi-confezionati/${id}`, data),
  deleteMangime: (id) => api.delete(`/mangimi-confezionati/${id}`),

  // Piani Alimentazione
  getPiani: async (params = {}) => hybridDataService.getPianiAlimentazione(params),
  getPiano: async (id) => hybridDataService.getPianoAlimentazione(id),
  createPiano: async (data) => hybridDataService.insertPianoAlimentazione(data),
  updatePiano: async (id, data) => hybridDataService.updatePianoAlimentazione(id, data),
  deletePiano: async (id) => hybridDataService.deletePianoAlimentazione(id),

  // Composizioni Piano
  getComposizioni: async (params = {}) => {
    if (params.piano_alimentazione_id) {
      return hybridDataService.getComposizioniPiano(params.piano_alimentazione_id);
    }
    return api.get('/composizioni-piano', params);
  },
  getComposizione: (id) => api.get(`/composizioni-piano/${id}`), // Dettaglio sempre online
  createComposizione: async (data) => hybridDataService.insertComposizionePiano(data),
  updateComposizione: async (id, data) => hybridDataService.updateComposizionePiano(id, data),
  deleteComposizione: async (id) => hybridDataService.deleteComposizionePiano(id),

  // Registro Alimentazione
  getRegistro: async (params = {}, options = {}) => hybridDataService.getRegistroAlimentazione(params),
  getVoceRegistro: async (id) => hybridDataService.getVoceRegistro(id),
  previewVoceRegistro: (data) => api.post('/registro-alimentazione/anteprima', data), // Sempre online
  createVoceRegistro: async (data) => hybridDataService.insertVoceRegistro(data),
  updateVoceRegistro: async (id, data) => hybridDataService.updateVoceRegistro(id, data),
  deleteVoceRegistro: async (id) => hybridDataService.deleteVoceRegistro(id),

  // DDT
  getDdt: async (params = {}) => hybridDataService.getDdt(params),
  getDdtById: async (id) => hybridDataService.getDdtById(id),
  createDdt: async (data) => hybridDataService.insertDdt(data),
  updateDdt: async (id, data) => hybridDataService.updateDdt(id, data),
  deleteDdt: async (id) => hybridDataService.deleteDdt(id),

  // DDT Righe
  getDdtRighe: async (ddtId) => hybridDataService.getDdtRighe(ddtId),
  getDdtRiga: (id) => api.get(`/ddt-righe/${id}`), // Dettaglio sempre online
  createDdtRiga: async (data) => hybridDataService.insertDdtRiga(data),
  updateDdtRiga: async (id, data) => hybridDataService.updateDdtRiga(id, data),
  deleteDdtRiga: async (id) => hybridDataService.deleteDdtRiga(id),

  // Magazzino movimenti
  getMovimenti: async (params = {}) => hybridDataService.getMagazzinoMovimenti(params),
  getMovimento: async (id) => hybridDataService.getMagazzinoMovimento(id),
  createMovimento: async (data) => hybridDataService.insertMagazzinoMovimento(data),
  updateMovimento: async (id, data) => hybridDataService.updateMagazzinoMovimento(id, data),
  deleteMovimento: async (id) => hybridDataService.deleteMagazzinoMovimento(id),

  // Scorte - sempre online (calcolo aggregato)
  getScorte: (params = {}) => api.get('/magazzino/scorte', params),
};
