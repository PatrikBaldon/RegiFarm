/**
 * Service for Sanitario module API calls
 * Usa hybridDataService per letture (database locale) e API per scritture/operazioni speciali
 */
import api from '../../../services/api';
import hybridDataService from '../../../services/hybridDataService';

export const sanitarioService = {
  // Farmaci - usa database locale per letture
  getFarmaci: async (search = null) => {
    const filters = search ? { search } : {};
    return hybridDataService.getFarmaci(filters);
  },
  getFarmaco: async (id) => hybridDataService.getFarmaco(id),
  createFarmaco: async (data) => hybridDataService.insertFarmaco(data),
  updateFarmaco: async (id, data) => hybridDataService.updateFarmaco(id, data),
  deleteFarmaco: async (id) => hybridDataService.deleteFarmaco(id),

  // Lotti Farmaco (Magazzino)
  getLottiFarmaco: async (aziendaId = null, farmacoId = null) => 
    hybridDataService.getLottiFarmaco({ azienda_id: aziendaId, farmaco_id: farmacoId }),
  getLottoFarmaco: async (id) => hybridDataService.getLottoFarmaco(id),
  createLottoFarmaco: async (data) => hybridDataService.insertLottoFarmaco(data),
  updateLottoFarmaco: async (id, data) => hybridDataService.updateLottoFarmaco(id, data),
  deleteLottoFarmaco: async (id) => hybridDataService.deleteLottoFarmaco(id),
  getGiacenzeAzienda: (aziendaId) => 
    api.get(`/sanitario/lotti-farmaco/azienda/${aziendaId}/giacenze`), // Sempre online (calcolo aggregato)

  // Somministrazioni - usa database locale per tutte le operazioni CRUD
  getSomministrazioni: async (filters = {}, options = {}) => hybridDataService.getSomministrazioni(filters),
  getSomministrazione: async (id) => hybridDataService.getSomministrazione(id),
  createSomministrazione: async (data) => hybridDataService.insertSomministrazione(data),
  updateSomministrazione: async (id, data) => hybridDataService.updateSomministrazione(id, data),
  deleteSomministrazione: async (id) => hybridDataService.deleteSomministrazione(id),

  // Somministrazioni di gruppo - usa API diretta
  getAnimaliCandidatiSomministrazione: async (targetTipo, targetId, dataRiferimento = null) => {
    const params = { target_tipo: targetTipo, target_id: targetId };
    if (dataRiferimento) {
      params.data_riferimento = dataRiferimento;
    }
    const response = await api.get('/sanitario/somministrazioni-gruppo/animali-candidati', { params });
    return response.data;
  },
  createSomministrazioniGruppo: async (data) => {
    const response = await api.post('/sanitario/somministrazioni-gruppo', data);
    return response.data;
  },
};

