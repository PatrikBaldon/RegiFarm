import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';

export const terreniService = {
  // Usa database locale per tutte le operazioni CRUD principali
  getTerreni: async (params = {}) => hybridDataService.getTerreni({ deleted_at: null, ...params }),
  getTerreno: async (id) => hybridDataService.getTerreno(id),
  createTerreno: async (data) => hybridDataService.insertTerreno(data),
  updateTerreno: async (id, data) => hybridDataService.updateTerreno(id, data),
  deleteTerreno: async (id) => hybridDataService.deleteTerreno(id),

  getLavorazioni: async (terrenoId) => hybridDataService.getLavorazioni({ terreno_id: terrenoId }),
  createLavorazione: async (data) => hybridDataService.insertLavorazione(data),
  updateLavorazione: async (id, data) => hybridDataService.updateLavorazione(id, data),
  deleteLavorazione: async (id) => hybridDataService.deleteLavorazione(id),

  getRaccolti: async (terrenoId) => hybridDataService.getRaccolti({ terreno_id: terrenoId }),
  createRaccolto: async (data) => hybridDataService.insertRaccolto(data),
  updateRaccolto: async (id, data) => hybridDataService.updateRaccolto(id, data),
  deleteRaccolto: async (id) => hybridDataService.deleteRaccolto(id),

  // Cicli colturali
  getCicli: async (terrenoId) => hybridDataService.getCicli({ terreno_id: terrenoId }),
  getCiclo: async (id) => hybridDataService.getCiclo(id),
  createCiclo: async (data) => hybridDataService.insertCiclo(data),
  updateCiclo: async (id, data) => hybridDataService.updateCiclo(id, data),
  deleteCiclo: async (id) => hybridDataService.deleteCiclo(id),

  createCicloFase: async (cicloId, data) => hybridDataService.insertCicloFase(cicloId, data),
  updateCicloFase: async (faseId, data) => hybridDataService.updateCicloFase(faseId, data),
  deleteCicloFase: async (faseId) => hybridDataService.deleteCicloFase(faseId),

  createCicloCosto: async (cicloId, data) => hybridDataService.insertCicloCosto(cicloId, data),
  updateCicloCosto: async (costoId, data) => hybridDataService.updateCicloCosto(costoId, data),
  deleteCicloCosto: async (costoId) => hybridDataService.deleteCicloCosto(costoId),

  getRiepilogo: async (terrenoId) => hybridDataService.getTerrenoRiepilogo(terrenoId),
};
